import assert from "node:assert/strict";
import test from "node:test";
import { linkAnalytics } from "../src/controllers/analyticsController.js";

const linkId = "0123456789abcdef01234567";

async function getValidationError(query) {
  let receivedError;
  await linkAnalytics(
    {
      params: { id: linkId },
      query,
      user: { id: "owner-id" }
    },
    { json() { throw new Error("Invalid date range should not return analytics."); } },
    (error) => { receivedError = error; }
  );
  return receivedError;
}

test("rejects malformed, impossible, and reversed analytics date ranges", async () => {
  for (const query of [
    { from: "01/01/2026", to: "2026-01-03" },
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-01-03", to: "2026-01-02" }
  ]) {
    const error = await getValidationError(query);
    assert.equal(error.statusCode, 400);
  }
});

test("caps the inclusive UTC calendar range at 366 days", async () => {
  const error = await getValidationError({
    from: "2025-01-01",
    to: "2026-01-02"
  });
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /366 days/);
});
