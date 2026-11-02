import assert from "node:assert/strict";
import test from "node:test";
import { validateCustomAlias, validateDestinationUrl } from "../src/utils/urlValidation.js";

test("accepts and normalizes HTTP and HTTPS destinations", () => {
  assert.equal(validateDestinationUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(validateDestinationUrl(" http://example.com "), "http://example.com/");
});

test("rejects malformed, non-HTTP, credential-bearing, and oversized destinations", () => {
  for (const value of [
    "",
    "example.com",
    "javascript:alert(1)",
    "ftp://example.com/file",
    "https://user:pass@example.com/",
    `https://example.com/${"a".repeat(2050)}`
  ]) {
    assert.throws(() => validateDestinationUrl(value), { statusCode: 400 });
  }
});

test("normalizes valid custom aliases and rejects reserved or invalid aliases", () => {
  assert.equal(validateCustomAlias("My-Short-Link"), "my-short-link");

  for (const value of ["api", "dashboard", "a", "has spaces", "starts-", "-starts"]) {
    assert.throws(() => validateCustomAlias(value), { statusCode: 400 });
  }
  assert.equal(validateCustomAlias(undefined), undefined);
});
