import mongoose from "mongoose";
import Url from "../models/Url.js";
import { HttpError } from "../utils/httpError.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";
import { generateShortCode } from "../utils/shortCode.js";
import {
  validateCustomAlias,
  validateSafeDestinationUrl
} from "../utils/urlValidation.js";
import { normalizeLinkOptions } from "./linkOptions.js";

const PAGE_SIZE = 20;
const MAX_PAGE = 10000;
const MAX_BULK_IDS = 100;
const MAX_CODE_INSERT_ATTEMPTS = 5;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildUrlFilter({ userId, search, status }) {
  const filter = { userId };
  if (status === "active") {
    filter.isActive = true;
  } else if (status === "inactive") {
    filter.isActive = false;
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ code: pattern }, { longUrl: pattern }];
  }
  return filter;
}

export async function listOwnedUrls(
  { userId, page = 1, search = "", status = "all" },
  { urlModel = Url } = {}
) {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    throw new HttpError(400, `page must be an integer between 1 and ${MAX_PAGE}.`);
  }
  if (typeof search !== "string" || search.length > 100) {
    throw new HttpError(400, "search must be a string no longer than 100 characters.");
  }
  if (!["all", "active", "inactive"].includes(status)) {
    throw new HttpError(400, "status must be all, active, or inactive.");
  }

  const filter = buildUrlFilter({ userId, search: search.trim(), status });
  const [urls, total] = await Promise.all([
    urlModel
      .find(filter)
      .select("code longUrl customAlias clicks clickLimit isActive createdAt expiresAt +passwordHash")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    urlModel.countDocuments(filter)
  ]);

  return {
    items: urls,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE)
    }
  };
}

export async function getUserSummary(userId, { urlModel = Url } = {}) {
  const [summary] = await urlModel.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalLinks: { $sum: 1 },
              totalClicks: { $sum: { $ifNull: ["$clicks", 0] } },
              activeLinks: { $sum: { $cond: ["$isActive", 1, 0] } }
            }
          }
        ],
        topLinks: [
          { $sort: { clicks: -1, createdAt: -1 } },
          { $limit: 5 },
          {
            $project: {
              code: 1,
              longUrl: 1,
              customAlias: 1,
              clicks: { $ifNull: ["$clicks", 0] },
              isActive: 1,
              expiresAt: 1,
              createdAt: 1
            }
          }
        ],
        recentLinks: [
          { $sort: { createdAt: -1 } },
          { $limit: 5 },
          {
            $project: {
              code: 1,
              longUrl: 1,
              customAlias: 1,
              clicks: { $ifNull: ["$clicks", 0] },
              isActive: 1,
              expiresAt: 1,
              createdAt: 1
            }
          }
        ]
      }
    }
  ]);
  const totals = summary?.totals?.[0] ?? {
    totalLinks: 0,
    totalClicks: 0,
    activeLinks: 0
  };
  return {
    totalLinks: totals.totalLinks,
    totalClicks: totals.totalClicks,
    activeLinks: totals.activeLinks,
    topLinks: summary?.topLinks ?? [],
    recentLinks: summary?.recentLinks ?? []
  };
}

export async function updateOwnedUrl(
  { id, userId, changes },
  {
    urlModel = Url,
    destinationValidator = validateSafeDestinationUrl,
    codeGenerator = generateShortCode
  } = {}
) {
  const updates = {};
  if (Object.hasOwn(changes, "longUrl")) {
    updates.longUrl = await destinationValidator(changes.longUrl);
  }
  if (Object.hasOwn(changes, "isActive")) {
    if (typeof changes.isActive !== "boolean") {
      throw new HttpError(400, "isActive must be a boolean.");
    }
    updates.isActive = changes.isActive;
  }

  const linkOptions = await normalizeLinkOptions(changes);
  Object.assign(updates, linkOptions);

  let clearCustomAlias = false;
  if (Object.hasOwn(changes, "customAlias")) {
    if (changes.customAlias === null) {
      updates.customAlias = null;
      clearCustomAlias = true;
    } else {
      const alias = validateCustomAlias(changes.customAlias);
      updates.customAlias = alias;
      updates.code = alias;
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, "Provide at least one supported field to update.");
  }

  for (let attempt = 0; attempt < MAX_CODE_INSERT_ATTEMPTS; attempt += 1) {
    if (clearCustomAlias) {
      updates.code = codeGenerator();
    }

    try {
      const url = await urlModel
        .findOneAndUpdate(
          { _id: id, userId },
          { $set: updates },
          { new: true, runValidators: true }
        )
        .select("+passwordHash")
        .lean();
      if (!url) {
        throw new HttpError(404, "Short link not found.");
      }
      return url;
    } catch (error) {
      if (!isDuplicateKeyError(error, "code")) {
        throw error;
      }
      if (!clearCustomAlias) {
        throw new HttpError(409, "That short code is already in use.");
      }
    }
  }

  throw new HttpError(503, "Unable to allocate a unique short code. Please try again.");
}

export async function deleteOwnedUrl({ id, userId }, { urlModel = Url } = {}) {
  const deleted = await urlModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) {
    throw new HttpError(404, "Short link not found.");
  }
}

export async function performBulkAction(
  { ids, userId, action },
  { urlModel = Url } = {}
) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK_IDS) {
    throw new HttpError(400, `ids must contain between 1 and ${MAX_BULK_IDS} link IDs.`);
  }
  if (ids.some((id) => typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id))) {
    throw new HttpError(400, "Every id must be a valid link ID.");
  }

  const ownerFilter = { userId, _id: { $in: [...new Set(ids)] } };
  if (action === "delete") {
    const result = await urlModel.deleteMany(ownerFilter);
    return { action, affected: result.deletedCount };
  }
  if (action === "enable" || action === "disable") {
    const result = await urlModel.updateMany(
      ownerFilter,
      { $set: { isActive: action === "enable" } }
    );
    return { action, affected: result.modifiedCount };
  }

  throw new HttpError(400, "action must be enable, disable, or delete.");
}
