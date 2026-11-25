import assert from "node:assert/strict";
import test from "node:test";
import { bulkImportOwnedUrls } from "../src/services/urlManagementService.js";
import { HttpError } from "../src/utils/httpError.js";

test("bulk import reports row errors and keeps importing valid owner-scoped links", async () => {
  const calls = [];
  const result = await bulkImportOwnedUrls({
    userId: "owner-id",
    shortDomain: "links.example.com",
    items: [
      { longUrl: "https://example.com/one" },
      { longUrl: "invalid" },
      { longUrl: "https://example.com/two", customAlias: "second-link" }
    ]
  }, {
    create: async (item, options) => {
      calls.push({ item, options });
      if (item.longUrl === "invalid") {
        throw new HttpError(400, "Invalid destination.");
      }
      return {
        code: item.customAlias ?? `code${calls.length}`,
        longUrl: item.longUrl,
        shortDomain: options.shortDomain
      };
    }
  });

  assert.equal(result.imported, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.results[1].error, "Invalid destination.");
  assert.equal(result.results[2].shortUrl, "https://links.example.com/second-link");
  assert.ok(calls.every(({ options }) => options.userId === "owner-id"));
});
