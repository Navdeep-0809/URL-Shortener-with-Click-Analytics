import assert from "node:assert/strict";
import test from "node:test";
import { getLinkAnalytics } from "../src/services/analyticsService.js";

const linkId = "0123456789abcdef01234567";
const from = new Date("2026-01-01T00:00:00.000Z");
const to = new Date("2026-01-03T23:59:59.999Z");

test("aggregates owner-scoped click data and fills days with zero clicks", async () => {
  let linkFilter;
  let pipeline;
  const urlModel = {
    findOne(filter) {
      linkFilter = filter;
      return {
        select: () => ({
          lean: async () => ({ _id: linkId, code: "short123" })
        })
      };
    }
  };
  const clickModel = {
    async aggregate(value) {
      pipeline = value;
      return [{
        totals: [{ clicks: 2 }],
        clicksByDay: [{ date: "2026-01-02", clicks: 2 }],
        referrers: [{ name: "https://referrer.example", clicks: 2 }],
        devices: [],
        browsers: [],
        operatingSystems: [],
        countries: [],
        cities: [],
        recentClicks: []
      }];
    }
  };

  const result = await getLinkAnalytics({
    id: linkId,
    userId: "owner-id",
    from,
    to
  }, { urlModel, clickModel });

  assert.deepEqual(linkFilter, { _id: linkId, userId: "owner-id" });
  assert.equal(pipeline[0].$match.urlId.toString(), linkId);
  assert.deepEqual(pipeline[0].$match.timestamp, { $gte: from, $lte: to });
  assert.deepEqual(result.clicksByDay, [
    { date: "2026-01-01", clicks: 0 },
    { date: "2026-01-02", clicks: 2 },
    { date: "2026-01-03", clicks: 0 }
  ]);
  assert.equal(result.totalClicks, 2);
});

test("does not aggregate analytics for a link outside the owner's account", async () => {
  let aggregateCalled = false;
  const urlModel = {
    findOne() {
      return { select: () => ({ lean: async () => null }) };
    }
  };
  const clickModel = {
    async aggregate() {
      aggregateCalled = true;
      return [];
    }
  };

  await assert.rejects(
    getLinkAnalytics({ id: linkId, userId: "owner-id", from, to }, { urlModel, clickModel }),
    { statusCode: 404 }
  );
  assert.equal(aggregateCalled, false);
});
