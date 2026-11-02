import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClickRecord,
  scheduleClickLogging
} from "../src/services/clickLoggingService.js";

test("parses click context, strips referrer paths, and hashes the IP", () => {
  const record = buildClickRecord(
    {
      urlId: "url-id",
      referrer: "https://referrer.example/article?email=user@example.com",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ip: "8.8.8.8",
      timestamp: new Date("2026-01-02T03:04:05.000Z")
    },
    {
      secret: "click-hash-secret-with-more-than-32-characters",
      locationLookup: () => ({ country: "US", city: "Mountain View" })
    }
  );

  assert.equal(record.referrer, "https://referrer.example");
  assert.equal(record.browser, "Chrome");
  assert.equal(record.OS, "Windows");
  assert.equal(record.device, "desktop");
  assert.equal(record.country, "US");
  assert.equal(record.city, "Mountain View");
  assert.match(record.ipHash, /^[a-f\d]{64}$/);
  assert.equal(JSON.stringify(record).includes("8.8.8.8"), false);
  assert.equal(record.userAgent.includes("email=user@example.com"), false);
});

test("stores unknown location and agent data gracefully", () => {
  const record = buildClickRecord(
    { urlId: "url-id", ip: "127.0.0.1" },
    {
      secret: "click-hash-secret-with-more-than-32-characters",
      locationLookup: () => {
        throw new Error("Private IP should not be looked up.");
      }
    }
  );

  assert.equal(record.country, null);
  assert.equal(record.city, null);
  assert.equal(record.device, "Unknown");
  assert.equal(record.browser, "Unknown");
  assert.equal(record.OS, "Unknown");
});

test("logs click-event and counter write failures explicitly", async () => {
  const errors = [];
  let scheduled;
  scheduleClickLogging(
    {
      urlId: "url-id",
      ip: "127.0.0.1",
      userAgent: "test-agent"
    },
    {
      secret: "click-hash-secret-with-more-than-32-characters",
      clickModel: {
        async create() {
          throw new Error("click write failed");
        }
      },
      urlModel: {
        updateOne() {
          return { exec: async () => { throw new Error("counter update failed"); } };
        }
      },
      schedule(callback) {
        scheduled = callback;
      },
      logger: {
        error(message) {
          errors.push(message);
        }
      }
    }
  );

  scheduled();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(errors.length, 2);
  assert.match(errors[0], /click event write failed/i);
  assert.match(errors[1], /click counter update failed/i);
});
