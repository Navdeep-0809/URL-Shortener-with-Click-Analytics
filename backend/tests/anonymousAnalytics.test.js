import assert from "node:assert/strict";
import test from "node:test";
import { getAnonymousLinkAnalytics } from "../src/services/analyticsService.js";
import { createAnalyticsToken, hashAnalyticsToken } from "../src/utils/analyticsToken.js";

const linkId = "0123456789abcdef01234567";
const from = new Date("2026-01-01T00:00:00.000Z");
const to = new Date("2026-01-01T23:59:59.999Z");

test("anonymous link analytics require the returned private token", async () => {
  const token = createAnalyticsToken();
  let aggregateCalled = false;
  const urlModel = {
    findOne(filter) {
      return {
        select() {
          return {
            lean: async () => filter.code
              ? { _id: linkId, code: "short123", analyticsTokenHash: hashAnalyticsToken(token) }
              : { _id: linkId, code: "short123" }
          };
        }
      };
    }
  };
  const clickModel = {
    async aggregate() {
      aggregateCalled = true;
      return [{ totals: [{ clicks: 0 }] }];
    }
  };

  await assert.rejects(
    getAnonymousLinkAnalytics({
      code: "short123",
      token: "wrong-token",
      from,
      to
    }, { urlModel, clickModel }),
    { statusCode: 404 }
  );
  assert.equal(aggregateCalled, false);

  const analytics = await getAnonymousLinkAnalytics({
    code: "short123",
    token,
    from,
    to
  }, { urlModel, clickModel });
  assert.equal(analytics.totalClicks, 0);
  assert.equal(aggregateCalled, true);
});
