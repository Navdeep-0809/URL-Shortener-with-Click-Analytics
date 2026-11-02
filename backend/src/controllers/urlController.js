import { config } from "../config/env.js";
import { createShortUrl } from "../services/urlService.js";
import { HttpError } from "../utils/httpError.js";

const ACCEPTED_FIELDS = new Set([
  "longUrl",
  "customAlias",
  "expiresAt",
  "clickLimit",
  "oneTimeUse",
  "password"
]);

export async function createUrl(request, response, next) {
  try {
    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }
    if (Object.keys(body).some((field) => !ACCEPTED_FIELDS.has(field))) {
      throw new HttpError(400, "Request body contains unsupported fields.");
    }

    const url = await createShortUrl(body, { userId: request.user?.id ?? null });
    response.status(201).json({
      id: url._id.toString(),
      code: url.code,
      longUrl: url.longUrl,
      shortUrl: `${config.publicShortUrlBase}/${url.code}`,
      expiresAt: url.expiresAt,
      clickLimit: url.clickLimit,
      oneTimeUse: url.clickLimit === 1,
      hasPassword: Boolean(url.passwordHash),
      createdAt: url.createdAt
    });
  } catch (error) {
    next(error);
  }
}
