import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteOwnedUrl,
  getUserSummary,
  listOwnedUrls,
  performBulkAction,
  updateOwnedUrl
} from "../src/services/urlManagementService.js";

const ownerId = "owner-id";
const linkId = "0123456789abcdef01234567";

test("aggregates summary data for one owner only", async () => {
  let pipeline;
  const urlModel = {
    async aggregate(value) {
      pipeline = value;
      return [{
        totals: [{ totalLinks: 2, totalClicks: 9, activeLinks: 1 }],
        topLinks: [{ code: "top1234", clicks: 8 }],
        recentLinks: [{ code: "new1234", clicks: 1 }]
      }];
    }
  };

  const summary = await getUserSummary(
    "0123456789abcdef01234567",
    { urlModel }
  );

  assert.equal(pipeline[0].$match.userId.toString(), "0123456789abcdef01234567");
  assert.equal(summary.totalLinks, 2);
  assert.equal(summary.totalClicks, 9);
  assert.equal(summary.topLinks[0].code, "top1234");
});

test("lists links using an owner-scoped filter and validated pagination", async () => {
  let capturedFilter;
  const urlModel = {
    find(filter) {
      capturedFilter = filter;
      return {
        select: () => ({
          sort: () => ({
            skip: () => ({
              limit: () => ({ lean: async () => [{ code: "mine123" }] })
            })
          })
        })
      };
    },
    async countDocuments(filter) {
      assert.deepEqual(filter, capturedFilter);
      return 1;
    }
  };

  const result = await listOwnedUrls(
    { userId: ownerId, page: 2, search: "article.*", status: "active" },
    { urlModel }
  );

  assert.equal(capturedFilter.userId, ownerId);
  assert.equal(capturedFilter.isActive, true);
  assert.equal(capturedFilter.$or[0].code.source, "article\\.\\*");
  assert.equal(result.pagination.page, 2);
  assert.equal(result.items[0].code, "mine123");
});

test("updates a link only when both its ID and owner match", async () => {
  let capturedFilter;
  const urlModel = {
    findOneAndUpdate(filter, update, options) {
      capturedFilter = filter;
      assert.deepEqual(update, { $set: { isActive: false } });
      assert.equal(options.runValidators, true);
      return { select: () => ({ lean: async () => null }) };
    }
  };

  await assert.rejects(
    updateOwnedUrl({
      id: linkId,
      userId: ownerId,
      changes: { isActive: false }
    }, { urlModel }),
    { statusCode: 404 }
  );
  assert.deepEqual(capturedFilter, { _id: linkId, userId: ownerId });
});

test("updates expiry and click limits only within the authenticated owner scope", async () => {
  let capturedFilter;
  let capturedUpdate;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const urlModel = {
    findOneAndUpdate(filter, update) {
      capturedFilter = filter;
      capturedUpdate = update;
      return {
        select: () => ({
          lean: async () => ({
            _id: linkId,
            code: "short123",
            expiresAt: new Date(expiresAt),
            clickLimit: 3,
            clicks: 0,
            passwordHash: null
          })
        })
      };
    }
  };

  const updated = await updateOwnedUrl({
    id: linkId,
    userId: ownerId,
    changes: { expiresAt, clickLimit: 3 }
  }, { urlModel });

  assert.deepEqual(capturedFilter, { _id: linkId, userId: ownerId });
  assert.equal(capturedUpdate.$set.clickLimit, 3);
  assert.equal(capturedUpdate.$set.expiresAt.toISOString(), expiresAt);
  assert.equal(updated.clickLimit, 3);
});

test("deletes only an owner's link", async () => {
  let capturedFilter;
  const urlModel = {
    async findOneAndDelete(filter) {
      capturedFilter = filter;
      return null;
    }
  };

  await assert.rejects(
    deleteOwnedUrl({ id: linkId, userId: ownerId }, { urlModel }),
    { statusCode: 404 }
  );
  assert.deepEqual(capturedFilter, { _id: linkId, userId: ownerId });
});

test("bulk actions are scoped to the authenticated owner", async () => {
  let capturedFilter;
  const urlModel = {
    async updateMany(filter, update) {
      capturedFilter = filter;
      assert.deepEqual(update, { $set: { isActive: false } });
      return { modifiedCount: 1 };
    }
  };

  const result = await performBulkAction({
    ids: [linkId, linkId],
    userId: ownerId,
    action: "disable"
  }, { urlModel });

  assert.deepEqual(capturedFilter, {
    userId: ownerId,
    _id: { $in: [linkId] }
  });
  assert.deepEqual(result, { action: "disable", affected: 1 });
});
