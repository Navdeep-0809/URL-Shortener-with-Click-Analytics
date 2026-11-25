import { createAnalyticsToken, hashAnalyticsToken } from "../utils/analyticsToken.js";
import { resolveVerifiedCustomDomain } from "../services/customDomainService.js";
import { createShortUrl } from "../services/urlService.js";
import { HttpError } from "../utils/httpError.js";
import { buildShortUrl } from "../utils/shortUrl.js";

const ACCEPTED_FIELDS = new Set([
  "longUrl",
  "customAlias",
  "expiresAt",
  "clickLimit",
  "oneTimeUse",
  "password",
  "domainId"
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

    const userId = request.user?.id ?? null;
    let shortDomain = null;
    if (body.domainId !== undefined && body.domainId !== null) {
      if (!userId) {
        throw new HttpError(400, "Sign in to use a custom domain.");
      }
      shortDomain = await resolveVerifiedCustomDomain({
        id: body.domainId,
        userId
      });
    }

    const analyticsToken = userId ? null : createAnalyticsToken();
    const url = await createShortUrl(body, {
      userId,
      shortDomain,
      analyticsTokenHash: analyticsToken ? hashAnalyticsToken(analyticsToken) : null
    });
    response.status(201).json({
      id: url._id.toString(),
      code: url.code,
      longUrl: url.longUrl,
      shortUrl: buildShortUrl(url.code, url.shortDomain),
      shortDomain: url.shortDomain,
      expiresAt: url.expiresAt,
      clickLimit: url.clickLimit,
      oneTimeUse: url.clickLimit === 1,
      hasPassword: Boolean(url.passwordHash),
      ...(analyticsToken ? { analyticsToken } : {}),
      createdAt: url.createdAt
    });
  } catch (error) {
    next(error);
  }
}
