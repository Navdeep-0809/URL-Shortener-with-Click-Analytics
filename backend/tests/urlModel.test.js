import assert from "node:assert/strict";
import test from "node:test";
import Click from "../src/models/Click.js";
import User from "../src/models/User.js";
import Url from "../src/models/Url.js";

test("defines a unique code index and owner/creation index", () => {
  const indexes = Url.schema.indexes();

  assert.ok(indexes.some(([fields, options]) =>
    fields.code === 1 && options.unique === true && options.name === "url_code_unique"
  ));
  assert.ok(indexes.some(([fields]) => fields.userId === 1 && fields.createdAt === -1));
});

test("defines a unique normalized email index and hides password hashes", () => {
  assert.ok(User.schema.indexes().some(([fields, options]) =>
    fields.email === 1 && options.unique === true && options.name === "user_email_unique"
  ));
  assert.equal(User.schema.path("email").options.lowercase, true);
  assert.equal(User.schema.path("passwordHash").options.select, false);
});

test("indexes click events by URL and timestamp and hides hashed IPs", () => {
  assert.ok(Click.schema.indexes().some(([fields]) =>
    fields.urlId === 1 && fields.timestamp === -1
  ));
  assert.equal(Click.schema.path("ipHash").options.select, false);
});

test("keeps password hashes excluded and validates destination URLs", () => {
  assert.equal(Url.schema.path("passwordHash").options.select, false);

  const invalidUrl = new Url({
    code: "example1",
    longUrl: "javascript:alert(1)"
  });
  const validationError = invalidUrl.validateSync();

  assert.ok(validationError?.errors.longUrl);
});
