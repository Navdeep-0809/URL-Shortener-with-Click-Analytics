import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { isIP } from "node:net";
import mongoose from "mongoose";
import CustomDomain from "../models/CustomDomain.js";
import Url from "../models/Url.js";
import { HttpError } from "../utils/httpError.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";

function normalizeHostname(value) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 253) {
    throw new HttpError(400, "hostname must be a valid domain name.");
  }

  const input = value.trim().toLowerCase();
  if (input.includes("://") || /[/?#:@]/.test(input)) {
    throw new HttpError(400, "Enter a hostname only, without a scheme, port, path, or credentials.");
  }

  let hostname;
  try {
    hostname = new URL(`https://${input}`).hostname.replace(/\.$/, "");
  } catch {
    throw new HttpError(400, "hostname must be a valid domain name.");
  }

  if (
    hostname.length > 253 ||
    !hostname.includes(".") ||
    isIP(hostname) ||
    [".localhost", ".local", ".internal", ".home.arpa", ".onion"].some((suffix) =>
      hostname.endsWith(suffix)
    ) ||
    hostname.split(".").some((label) =>
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
    )
  ) {
    throw new HttpError(400, "hostname must be a fully qualified public domain name.");
  }
  return hostname;
}

export async function createCustomDomain(
  { hostname, userId },
  { domainModel = CustomDomain } = {}
) {
  const normalizedHostname = normalizeHostname(hostname);
  const verificationToken = randomBytes(32).toString("hex");

  try {
    return await domainModel.create({
      userId,
      hostname: normalizedHostname,
      verificationToken,
      verifiedAt: null
    });
  } catch (error) {
    if (isDuplicateKeyError(error, "hostname")) {
      throw new HttpError(409, "That domain is already connected to an account.");
    }
    throw error;
  }
}

export async function listCustomDomains(
  userId,
  { domainModel = CustomDomain } = {}
) {
  return domainModel
    .find({ userId })
    .select("hostname verifiedAt createdAt +verificationToken")
    .sort({ createdAt: -1 })
    .lean();
}

export async function verifyCustomDomain(
  { id, userId },
  { domainModel = CustomDomain, lookupTxt = resolveTxt } = {}
) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw new HttpError(400, "Domain ID is invalid.");
  }

  const domain = await domainModel
    .findOne({ _id: id, userId })
    .select("hostname verifiedAt +verificationToken");
  if (!domain) {
    throw new HttpError(404, "Custom domain not found.");
  }
  if (domain.verifiedAt) {
    return domain;
  }

  let records;
  try {
    records = await lookupTxt(`_shortly-verification.${domain.hostname}`);
  } catch (error) {
    if (["ENODATA", "ENOTFOUND", "ENODOMAIN", "EAI_AGAIN"].includes(error?.code)) {
      throw new HttpError(400, "Verification TXT record was not found. Check the DNS record and try again.");
    }
    throw error;
  }

  const expected = `shortly-verification=${domain.verificationToken}`;
  const found = Array.isArray(records) &&
    records.some((record) => Array.isArray(record) && record.join("") === expected);
  if (!found) {
    throw new HttpError(400, "Verification TXT record does not match. Check its value and try again.");
  }

  domain.verifiedAt = new Date();
  await domain.save();
  return domain;
}

export async function deleteCustomDomain(
  { id, userId },
  { domainModel = CustomDomain, urlModel = Url } = {}
) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw new HttpError(400, "Domain ID is invalid.");
  }

  const domain = await domainModel.findOne({ _id: id, userId }).select("hostname");
  if (!domain) {
    throw new HttpError(404, "Custom domain not found.");
  }
  if (await urlModel.exists({ userId, shortDomain: domain.hostname })) {
    throw new HttpError(409, "Move or delete links using this domain before disconnecting it.");
  }
  await domainModel.deleteOne({ _id: id, userId });
}

export async function resolveVerifiedCustomDomain(
  { id, userId },
  { domainModel = CustomDomain } = {}
) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw new HttpError(400, "domainId is invalid.");
  }
  const domain = await domainModel
    .findOne({ _id: id, userId, verifiedAt: { $ne: null } })
    .select("hostname")
    .lean();
  if (!domain) {
    throw new HttpError(400, "Choose one of your verified custom domains.");
  }
  return domain.hostname;
}

export { normalizeHostname };
