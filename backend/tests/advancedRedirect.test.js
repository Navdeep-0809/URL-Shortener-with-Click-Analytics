import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import test from "node:test";
import { redirectToUrl, verifyPassword } from "../src/controllers/redirectController.js";

function request(code, body = {}) {
  return {
    params: { code },
    body,
    get: () => undefined
  };
}

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers = { ...this.headers, [name]: value };
      return this;
    },
    type(value) {
      this.contentType = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    redirect(status, destination) {
      this.redirected = { status, destination };
      return this;
    }
  };
}

function modelReturning(url) {
  return {
    findOne(query) {
      assert.deepEqual(query, { code: "short123" });
      return {
        select() {
          return { lean: async () => url };
        }
      };
    }
  };
}

test("returns a 410 response for an expired link without consuming it", async () => {
  let reservationAttempted = false;
  const urlModel = {
    ...modelReturning({
      _id: "url-id",
      code: "short123",
      longUrl: "https://example.com",
      isActive: true,
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      clickLimit: 1,
      clicks: 0
    }),
    findOneAndUpdate() {
      reservationAttempted = true;
    }
  };
  const res = response();

  await redirectToUrl(request("short123"), res, (error) => { throw error; }, {
    urlModel,
    now: () => new Date("2026-01-01T00:00:00.000Z")
  });

  assert.equal(res.statusCode, 410);
  assert.equal(res.body.error, "This short link has expired.");
  assert.equal(reservationAttempted, false);
});

test("atomically reserves each click for a limited link before redirecting", async () => {
  let capturedFilter;
  let capturedUpdate;
  let scheduled;
  let asynchronousCounterUpdate = false;
  const urlModel = {
    ...modelReturning({
      _id: "url-id",
      code: "short123",
      longUrl: "https://example.com",
      isActive: true,
      expiresAt: null,
      clickLimit: 3,
      clicks: 1
    }),
    findOneAndUpdate(filter, update) {
      capturedFilter = filter;
      capturedUpdate = update;
      return {
        lean: async () => ({
          _id: "url-id",
          code: "short123",
          longUrl: "https://example.com",
          clicks: 2
        })
      };
    },
    updateOne() {
      asynchronousCounterUpdate = true;
      return { exec: async () => ({ modifiedCount: 1 }) };
    }
  };
  const res = response();

  await redirectToUrl(request("short123"), res, (error) => { throw error; }, {
    urlModel,
    clickModel: { create: async () => ({}) },
    schedule(callback) { scheduled = callback; },
    now: () => new Date("2026-01-01T00:00:00.000Z")
  });

  assert.deepEqual(res.redirected, { status: 302, destination: "https://example.com" });
  assert.equal(capturedFilter.clicks.$lt, 3);
  assert.equal(capturedFilter.isActive, true);
  assert.deepEqual(capturedUpdate, { $inc: { clicks: 1 } });
  scheduled();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(asynchronousCounterUpdate, false);
});

test("allows only one concurrent request to consume a one-time link", async () => {
  let consumed = false;
  const link = {
    _id: "url-id",
    code: "short123",
    longUrl: "https://example.com",
    isActive: true,
    expiresAt: null,
    clickLimit: 1,
    clicks: 0
  };
  const urlModel = {
    findOneAndUpdate() {
      return {
        lean: async () => {
          if (consumed) {
            return null;
          }
          consumed = true;
          return { ...link, clicks: 1 };
        }
      };
    },
    findOne() {
      return {
        select(fields) {
          if (fields === "isActive expiresAt clicks clickLimit") {
            return { lean: async () => ({ ...link, clicks: consumed ? 1 : 0 }) };
          }
          return { lean: async () => ({ ...link }) };
        }
      };
    }
  };
  const responses = [response(), response()];
  const errors = [];
  const schedules = [];

  await Promise.all(responses.map((res) => redirectToUrl(
    request("short123"),
    res,
    (error) => errors.push(error),
    {
      urlModel,
      clickModel: { create: async () => ({}) },
      schedule(callback) { schedules.push(callback); },
      now: () => new Date("2026-01-01T00:00:00.000Z")
    }
  )));

  assert.deepEqual(errors, []);
  assert.equal(responses.filter((res) => res.redirected).length, 1);
  assert.equal(responses.filter((res) => res.statusCode === 410).length, 1);
  assert.equal(schedules.length, 1);
});

test("prompts for a password and redirects only after successful verification", async () => {
  const passwordHash = await bcrypt.hash("correct-horse-42", 4);
  const url = {
    _id: "url-id",
    code: "short123",
    longUrl: "https://example.com/private",
    isActive: true,
    expiresAt: null,
    clickLimit: null,
    clicks: 0,
    passwordHash
  };
  const urlModel = {
    ...modelReturning(url),
    updateOne() {
      return { exec: async () => ({ modifiedCount: 1 }) };
    }
  };
  const page = response();
  await redirectToUrl(request("short123"), page, (error) => { throw error; }, { urlModel });
  assert.equal(page.contentType, "html");
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /name="password"/);
  assert.doesNotMatch(page.body, /private/);

  let scheduled;
  const wrongPassword = response();
  await verifyPassword(request("short123", { password: "wrong-password" }), wrongPassword, (error) => {
    throw error;
  }, { urlModel });
  assert.equal(wrongPassword.statusCode, 401);
  assert.match(wrongPassword.body, /password is incorrect/i);

  const correctPassword = response();
  await verifyPassword(request("short123", { password: "correct-horse-42" }), correctPassword, (error) => {
    throw error;
  }, {
    urlModel,
    clickModel: { create: async () => ({}) },
    schedule(callback) { scheduled = callback; }
  });
  assert.deepEqual(correctPassword.redirected, { status: 302, destination: "https://example.com/private" });
  scheduled();
});
