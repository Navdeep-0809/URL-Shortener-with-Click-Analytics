import assert from "node:assert/strict";
import test from "node:test";
import { createShortUrl } from "../src/services/urlService.js";
import { validateDestinationUrl } from "../src/utils/urlValidation.js";

const validInput = { longUrl: "https://example.com/path" };
const destinationValidator = async (value) => validateDestinationUrl(value);

test("creates a generated short link", async () => {
  const created = [];
  const urlModel = {
    async create(document) {
      created.push(document);
      return { _id: "url-id", ...document };
    }
  };

  const result = await createShortUrl(validInput, {
    urlModel,
    codeGenerator: () => "Ab3xYz9",
    destinationValidator
  });

  assert.equal(result.code, "Ab3xYz9");
  assert.equal(result.longUrl, validInput.longUrl);
  assert.equal(created.length, 1);
});

test("associates a created link with an authenticated owner", async () => {
  let created;
  const urlModel = {
    async create(document) {
      created = document;
      return { _id: "url-id", ...document };
    }
  };

  await createShortUrl(validInput, {
    urlModel,
    destinationValidator,
    userId: "0123456789abcdef01234567"
  });

  assert.equal(created.userId, "0123456789abcdef01234567");
});

test("persists one-time, expiry, and click-limit options on a short link", async () => {
  let created;
  const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const urlModel = {
    async create(document) {
      created = document;
      return { _id: "url-id", ...document };
    }
  };

  await createShortUrl({
    ...validInput,
    expiresAt,
    oneTimeUse: true
  }, {
    urlModel,
    destinationValidator,
    codeGenerator: () => "Once123"
  });

  assert.equal(created.clickLimit, 1);
  assert.equal(created.expiresAt.toISOString().slice(0, 10), expiresAt);
});

test("rejects an alias already present in the database", async () => {
  let createCalled = false;
  const urlModel = {
    async exists() {
      return { _id: "existing-url" };
    },
    async create() {
      createCalled = true;
    }
  };

  await assert.rejects(
    createShortUrl(
      { ...validInput, customAlias: "my-link" },
      { urlModel, destinationValidator }
    ),
    { statusCode: 409 }
  );
  assert.equal(createCalled, false);
});

test("retries generated codes after a unique-index collision", async () => {
  const codes = ["first12", "second3"];
  const inserted = [];
  const urlModel = {
    async create(document) {
      if (document.code === "first12") {
        const collision = new Error("duplicate key");
        collision.code = 11000;
        collision.keyPattern = { code: 1 };
        throw collision;
      }
      inserted.push(document);
      return { _id: "url-id", ...document };
    }
  };

  const result = await createShortUrl(validInput, {
    urlModel,
    codeGenerator: () => codes.shift(),
    destinationValidator
  });

  assert.equal(result.code, "second3");
  assert.equal(inserted.length, 1);
});
