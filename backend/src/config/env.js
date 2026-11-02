import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const port = Number(process.env.PORT ?? 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const frontendOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
try {
  const parsedFrontendOrigin = new URL(frontendOrigin);
  if (!["http:", "https:"].includes(parsedFrontendOrigin.protocol)) {
    throw new Error();
  }
} catch {
  throw new Error("CLIENT_ORIGIN must be a valid absolute HTTP or HTTPS URL.");
}

const publicShortUrlBase = process.env.PUBLIC_SHORT_URL_BASE ?? "http://localhost:5000";
let parsedPublicShortUrlBase;
try {
  parsedPublicShortUrlBase = new URL(publicShortUrlBase);
} catch {
  throw new Error("PUBLIC_SHORT_URL_BASE must be a valid absolute URL.");
}
if (
  !["http:", "https:"].includes(parsedPublicShortUrlBase.protocol) ||
  parsedPublicShortUrlBase.username ||
  parsedPublicShortUrlBase.password ||
  parsedPublicShortUrlBase.pathname !== "/" ||
  parsedPublicShortUrlBase.search ||
  parsedPublicShortUrlBase.hash
) {
  throw new Error("PUBLIC_SHORT_URL_BASE must be an HTTP or HTTPS origin without credentials, a path, a query, or a fragment.");
}

const mongodbUri = process.env.MONGODB_URI?.trim() || undefined;
if (mongodbUri) {
  try {
    const parsedMongoDbUri = new URL(mongodbUri);
    if (!["mongodb:", "mongodb+srv:"].includes(parsedMongoDbUri.protocol) || !parsedMongoDbUri.hostname) {
      throw new Error();
    }
  } catch {
    throw new Error("MONGODB_URI must be a valid mongodb:// or mongodb+srv:// connection string.");
  }
}

const jwtSecret = process.env.JWT_SECRET?.trim() || undefined;
if (
  jwtSecret &&
  (jwtSecret.length < 32 || jwtSecret.startsWith("replace-with-"))
) {
  throw new Error("JWT_SECRET must be a private random value with at least 32 characters.");
}

export const config = {
  port,
  frontendOrigin,
  publicShortUrlBase: publicShortUrlBase.replace(/\/+$/, ""),
  mongodbUri,
  jwtSecret
};
