import { config } from "../config/env.js";

export function buildShortUrl(code, shortDomain = null) {
  const base = shortDomain
    ? `https://${shortDomain}`
    : config.publicShortUrlBase;
  return `${base}/${code}`;
}
