import { createHmac } from "node:crypto";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";
import { config } from "../config/env.js";
import Click from "../models/Click.js";
import Url from "../models/Url.js";
import { isPublicIpAddress } from "../utils/urlValidation.js";

function normalizeReferrer(value) {
  if (typeof value !== "string" || value.length > 2048) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.origin.slice(0, 255);
  } catch {
    return null;
  }
}

function hashIp(address, secret) {
  if (!address) {
    return null;
  }
  if (!secret) {
    throw new Error("JWT_SECRET is required to hash click IP addresses.");
  }
  const key = createHmac("sha256", secret).update("shortly.click-ip.v1").digest();
  return createHmac("sha256", key).update(address).digest("hex");
}

function lookupApproximateLocation(address, lookup) {
  if (!address || !isPublicIpAddress(address)) {
    return null;
  }
  try {
    return lookup(address);
  } catch (error) {
    console.error("Approximate click geolocation lookup failed:", error);
    return null;
  }
}

export function buildClickRecord(
  { urlId, referrer, userAgent, ip, timestamp = new Date() },
  { locationLookup = geoip.lookup, secret = config.jwtSecret } = {}
) {
  const safeUserAgent = typeof userAgent === "string" ? userAgent.slice(0, 512) : "";
  const parsedAgent = new UAParser(safeUserAgent).getResult();
  const location = lookupApproximateLocation(ip, locationLookup);

  return {
    urlId,
    timestamp,
    referrer: normalizeReferrer(referrer),
    userAgent: safeUserAgent || null,
    device: parsedAgent.device.type ?? (safeUserAgent ? "desktop" : "Unknown"),
    browser: parsedAgent.browser.name ?? "Unknown",
    OS: parsedAgent.os.name ?? "Unknown",
    country: location?.country ?? null,
    city: location?.city ?? null,
    ipHash: hashIp(ip, secret)
  };
}

export function scheduleClickLogging(
  clickData,
  {
    clickModel = Click,
    urlModel = Url,
    schedule = setImmediate,
    logger = console,
    secret = config.jwtSecret,
    locationLookup = geoip.lookup,
    incrementCounter = true
  } = {}
) {
  schedule(() => {
    let record;
    try {
      record = buildClickRecord(clickData, { secret, locationLookup });
    } catch (error) {
      logger.error("Click metadata could not be prepared:", error);
      return;
    }

    Promise.resolve()
      .then(() => clickModel.create(record))
      .catch((error) => logger.error("Asynchronous click event write failed:", error));

    if (incrementCounter) {
      Promise.resolve()
        .then(() => urlModel.updateOne(
          { _id: clickData.urlId },
          { $inc: { clicks: 1 } }
        ).exec())
        .catch((error) => logger.error("Asynchronous click counter update failed:", error));
    }
  });
}
