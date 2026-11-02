import mongoose from "mongoose";
import { config } from "../config/env.js";
import {
  deleteOwnedUrl,
  getUserSummary,
  listOwnedUrls,
  performBulkAction,
  updateOwnedUrl
} from "../services/urlManagementService.js";
import { HttpError } from "../utils/httpError.js";

const PATCH_FIELDS = new Set([
  "longUrl",
  "customAlias",
  "isActive",
  "expiresAt",
  "clickLimit",
  "oneTimeUse",
  "password"
]);
const BULK_FIELDS = new Set(["ids", "action"]);

function serializeUrl(url) {
  return {
    id: url._id.toString(),
    code: url.code,
    longUrl: url.longUrl,
    shortUrl: `${config.publicShortUrlBase}/${url.code}`,
    customAlias: url.customAlias,
    clicks: url.clicks,
    clickLimit: url.clickLimit,
    oneTimeUse: url.clickLimit === 1,
    hasPassword: Boolean(url.passwordHash),
    isActive: url.isActive,
    expiresAt: url.expiresAt,
    createdAt: url.createdAt
  };
}

function parsePage(value) {
  if (value === undefined) {
    return 1;
  }
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new HttpError(400, "page must be a positive integer.");
  }
  const page = Number(value);
  if (!Number.isSafeInteger(page)) {
    throw new HttpError(400, "page must be a positive integer.");
  }
  return page;
}

function requireObjectId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw new HttpError(400, "Link ID is invalid.");
  }
}

function validateBody(body, allowedFields) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw new HttpError(400, "Request body contains unsupported fields.");
  }
}

export async function listUrls(request, response, next) {
  try {
    const result = await listOwnedUrls({
      userId: request.user.id,
      page: parsePage(request.query.page),
      search: request.query.search ?? "",
      status: request.query.status ?? "all"
    });
    response.json({
      items: result.items.map(serializeUrl),
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

export async function userSummary(request, response, next) {
  try {
    const summary = await getUserSummary(request.user.id);
    response.json({
      ...summary,
      topLinks: summary.topLinks.map(serializeUrl),
      recentLinks: summary.recentLinks.map(serializeUrl)
    });
  } catch (error) {
    next(error);
  }
}

export async function patchUrl(request, response, next) {
  try {
    requireObjectId(request.params.id);
    validateBody(request.body, PATCH_FIELDS);
    const url = await updateOwnedUrl({
      id: request.params.id,
      userId: request.user.id,
      changes: request.body
    });
    response.json({ url: serializeUrl(url) });
  } catch (error) {
    next(error);
  }
}

export async function deleteUrl(request, response, next) {
  try {
    requireObjectId(request.params.id);
    await deleteOwnedUrl({ id: request.params.id, userId: request.user.id });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function bulkAction(request, response, next) {
  try {
    validateBody(request.body, BULK_FIELDS);
    const result = await performBulkAction({
      ids: request.body.ids,
      action: request.body.action,
      userId: request.user.id
    });
    response.json(result);
  } catch (error) {
    next(error);
  }
}
