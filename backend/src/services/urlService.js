import Url from "../models/Url.js";
import { HttpError } from "../utils/httpError.js";
import { generateShortCode } from "../utils/shortCode.js";
import {
  validateCustomAlias,
  validateSafeDestinationUrl
} from "../utils/urlValidation.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";
import { normalizeLinkOptions } from "./linkOptions.js";

const MAX_CODE_INSERT_ATTEMPTS = 5;

export async function createShortUrl(
  input,
  {
    urlModel = Url,
    codeGenerator = generateShortCode,
    destinationValidator = validateSafeDestinationUrl,
    userId = null
  } = {}
) {
  const { longUrl, customAlias } = input;
  const normalizedLongUrl = await destinationValidator(longUrl);
  const alias = validateCustomAlias(customAlias);

  if (alias && await urlModel.exists({ code: alias })) {
    throw new HttpError(409, "That customAlias is already in use.");
  }
  const options = await normalizeLinkOptions(input, { creating: true });

  if (alias) {
    try {
      return await urlModel.create({
        code: alias,
        longUrl: normalizedLongUrl,
        customAlias: alias,
        userId,
        ...options
      });
    } catch (error) {
      if (isDuplicateKeyError(error, "code")) {
        throw new HttpError(409, "That customAlias is already in use.");
      }
      throw error;
    }
  }

  for (let attempt = 0; attempt < MAX_CODE_INSERT_ATTEMPTS; attempt += 1) {
    try {
      return await urlModel.create({
        code: codeGenerator(),
        longUrl: normalizedLongUrl,
        userId,
        ...options
      });
    } catch (error) {
      if (!isDuplicateKeyError(error, "code")) {
        throw error;
      }
    }
  }

  throw new HttpError(503, "Unable to allocate a unique short code. Please try again.");
}
