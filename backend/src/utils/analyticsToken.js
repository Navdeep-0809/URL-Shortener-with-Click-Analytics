import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createAnalyticsToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAnalyticsToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function matchesAnalyticsToken(token, expectedHash) {
  if (typeof token !== "string" || typeof expectedHash !== "string") {
    return false;
  }
  const actualHash = Buffer.from(hashAnalyticsToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}
