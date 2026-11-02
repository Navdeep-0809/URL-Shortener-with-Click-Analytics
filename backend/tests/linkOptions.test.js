import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLinkOptions,
  verifyLinkPassword
} from "../src/services/linkOptions.js";

test("hashes link passwords and represents one-time use as one click", async () => {
  const options = await normalizeLinkOptions({
    password: "link-secret-123",
    oneTimeUse: true
  }, { creating: true });

  assert.notEqual(options.passwordHash, "link-secret-123");
  assert.equal(await verifyLinkPassword("link-secret-123", options.passwordHash), true);
  assert.equal(await verifyLinkPassword("incorrect-password", options.passwordHash), false);
  assert.equal(options.clickLimit, 1);
  assert.equal(options.expiresAt, null);
});

test("validates optional passwords, click limits, and future expiry dates", async () => {
  await assert.rejects(
    normalizeLinkOptions({ password: "short" }, { creating: true }),
    { statusCode: 400 }
  );
  await assert.rejects(
    normalizeLinkOptions({ password: "é".repeat(37) }, { creating: true }),
    { statusCode: 400 }
  );
  await assert.rejects(
    normalizeLinkOptions({ clickLimit: 0 }, { creating: true }),
    { statusCode: 400 }
  );
  await assert.rejects(
    normalizeLinkOptions({ expiresAt: "2026-02-30" }, { creating: true }),
    { statusCode: 400 }
  );
  await assert.rejects(
    normalizeLinkOptions({ expiresAt: "2020-01-01" }, { creating: true }),
    { statusCode: 400 }
  );
  await assert.rejects(
    normalizeLinkOptions({
      clickLimit: 5,
      oneTimeUse: true
    }, { creating: true }),
    { statusCode: 400 }
  );
});

test("allows removing an existing password and clearing a click limit", async () => {
  const options = await normalizeLinkOptions({
    password: null,
    clickLimit: null
  });

  assert.deepEqual(options, { clickLimit: null, passwordHash: null });
});
