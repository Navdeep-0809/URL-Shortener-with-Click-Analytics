import bcrypt from "bcryptjs";
import { HttpError } from "../utils/httpError.js";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function parseExpiration(value) {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "expiresAt must be an ISO date or null.");
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!dateOnly && !isoTimestamp) {
    throw new HttpError(400, "expiresAt must be an ISO date or null.");
  }

  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== datePart) {
    throw new HttpError(400, "expiresAt must be a valid calendar date.");
  }

  const expiration = new Date(value);
  if (Number.isNaN(expiration.getTime())) {
    throw new HttpError(400, "expiresAt must be a valid date.");
  }
  if (dateOnly) {
    expiration.setUTCHours(23, 59, 59, 999);
  }
  if (expiration <= new Date()) {
    throw new HttpError(400, "expiresAt must be in the future.");
  }
  return expiration;
}

function parseClickLimit(value) {
  if (value === null) {
    return null;
  }
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new HttpError(400, "clickLimit must be a positive integer or null.");
  }
  return value;
}

function validatePassword(value) {
  if (typeof value !== "string") {
    throw new HttpError(400, "password must be a string or null.");
  }
  const bytes = Buffer.byteLength(value, "utf8");
  if (value.length < MIN_PASSWORD_LENGTH || bytes > MAX_PASSWORD_BYTES) {
    throw new HttpError(
      400,
      `password must be at least ${MIN_PASSWORD_LENGTH} characters and no more than ${MAX_PASSWORD_BYTES} UTF-8 bytes.`
    );
  }
  return value;
}

export async function normalizeLinkOptions(changes, { creating = false } = {}) {
  const options = {};

  if (Object.hasOwn(changes, "expiresAt")) {
    options.expiresAt = parseExpiration(changes.expiresAt);
  } else if (creating) {
    options.expiresAt = null;
  }

  if (Object.hasOwn(changes, "clickLimit")) {
    options.clickLimit = parseClickLimit(changes.clickLimit);
  } else if (creating) {
    options.clickLimit = null;
  }

  if (Object.hasOwn(changes, "oneTimeUse")) {
    if (typeof changes.oneTimeUse !== "boolean") {
      throw new HttpError(400, "oneTimeUse must be a boolean.");
    }
    if (changes.oneTimeUse) {
      if (options.clickLimit !== undefined && options.clickLimit !== null && options.clickLimit !== 1) {
        throw new HttpError(400, "oneTimeUse cannot be combined with a clickLimit other than 1.");
      }
      options.clickLimit = 1;
    } else if (!Object.hasOwn(changes, "clickLimit")) {
      options.clickLimit = null;
    }
  }

  if (Object.hasOwn(changes, "password")) {
    if (changes.password === null) {
      options.passwordHash = null;
    } else {
      options.passwordHash = await bcrypt.hash(validatePassword(changes.password), 12);
    }
  } else if (creating) {
    options.passwordHash = null;
  }

  return options;
}

export async function verifyLinkPassword(password, passwordHash) {
  if (typeof password !== "string" || typeof passwordHash !== "string") {
    return false;
  }
  return bcrypt.compare(password, passwordHash);
}
