import mongoose from "mongoose";
import { config } from "../config/env.js";
import { getLinkAnalytics } from "../services/analyticsService.js";
import { HttpError } from "../utils/httpError.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

function parseDate(value, name, endOfDay = false) {
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, `${name} must be a valid ISO date.`);
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!dateOnly && !isoTimestamp) {
    throw new HttpError(400, `${name} must be a valid ISO date.`);
  }
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== datePart) {
    throw new HttpError(400, `${name} must be a valid ISO date.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${name} must be a valid ISO date.`);
  }
  if (dateOnly && endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

function resolveDateRange(query) {
  const to = query.to === undefined ? new Date() : parseDate(query.to, "to", true);
  const from = query.from === undefined
    ? new Date(to.getTime() - (MAX_RANGE_DAYS - 1) * DAY_MS)
    : parseDate(query.from, "from");

  if (from > to) {
    throw new HttpError(400, "from must be earlier than or equal to to.");
  }
  const inclusiveUtcDays = (
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) -
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  ) / DAY_MS + 1;
  if (inclusiveUtcDays > MAX_RANGE_DAYS) {
    throw new HttpError(400, `The analytics date range cannot exceed ${MAX_RANGE_DAYS} days.`);
  }
  return { from, to };
}

export async function linkAnalytics(request, response, next) {
  try {
    if (!mongoose.isObjectIdOrHexString(request.params.id)) {
      throw new HttpError(400, "Link ID is invalid.");
    }
    const { from, to } = resolveDateRange(request.query);
    const analytics = await getLinkAnalytics({
      id: request.params.id,
      userId: request.user.id,
      from,
      to
    });
    response.json({
      ...analytics,
      link: {
        ...analytics.link,
        shortUrl: `${config.publicShortUrlBase}/${analytics.link.code}`
      }
    });
  } catch (error) {
    next(error);
  }
}
