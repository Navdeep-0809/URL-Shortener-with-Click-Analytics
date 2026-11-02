import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { HttpError } from "./httpError.js";

const RESERVED_ALIASES = new Set([
  "api",
  "analytics",
  "auth",
  "dashboard",
  "health",
  "login",
  "logout",
  "register",
  "robots-txt",
  "shorten",
  "urls"
]);

const BLOCKED_IP_RANGES = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20]
].map(([network, prefix]) => [ipaddr.parse(network), prefix]);

export function validateDestinationUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 2048) {
    throw new HttpError(400, "longUrl must be a non-empty URL no longer than 2048 characters.");
  }

  const candidate = value.trim();
  if (/[\u0000-\u001f\u007f]/.test(candidate)) {
    throw new HttpError(400, "longUrl contains invalid control characters.");
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new HttpError(400, "longUrl must be a valid absolute HTTP or HTTPS URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(400, "longUrl must use HTTP or HTTPS.");
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new HttpError(400, "longUrl must include a hostname and must not contain credentials.");
  }

  return parsed.toString();
}

export function validateCustomAlias(value) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "customAlias must be a string.");
  }

  const alias = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(alias)) {
    throw new HttpError(400, "customAlias must be 3-30 characters using letters, numbers, and internal hyphens.");
  }
  if (RESERVED_ALIASES.has(alias)) {
    throw new HttpError(400, "That customAlias is reserved for an application route.");
  }

  return alias;
}

export function isPublicIpAddress(address) {
  if (!isIP(address)) {
    return false;
  }

  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }
    if (
      BLOCKED_IP_RANGES.some(
        ([network, prefix]) => parsed.kind() === network.kind() && parsed.match(network, prefix)
      )
    ) {
      return false;
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

function isReservedHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.+$/, "");
  return (
    !normalized.includes(".") ||
    normalized === "localhost" ||
    [".localhost", ".local", ".internal", ".home.arpa", ".onion"].some((suffix) =>
      normalized.endsWith(suffix)
    )
  );
}

export async function validateSafeDestinationUrl(value, resolve = lookup) {
  const normalizedUrl = validateDestinationUrl(value);
  const hostname = new URL(normalizedUrl).hostname.replace(/^\[|\]$/g, "");

  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new HttpError(400, "Destination IP addresses must be publicly routable.");
    }
    return normalizedUrl;
  }

  if (isReservedHostname(hostname)) {
    throw new HttpError(400, "Destination hostnames must be public and externally routable.");
  }

  let addresses;
  try {
    addresses = await resolve(hostname, { all: true, verbatim: true });
  } catch (error) {
    if (["EAI_AGAIN", "EAI_FAIL", "EAI_NONAME", "ENODATA", "ENOTFOUND"].includes(error?.code)) {
      throw new HttpError(400, "Destination hostname could not be resolved to a public address.");
    }
    throw error;
  }

  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new HttpError(400, "Destination hostname must resolve exclusively to public IP addresses.");
  }

  return normalizedUrl;
}
