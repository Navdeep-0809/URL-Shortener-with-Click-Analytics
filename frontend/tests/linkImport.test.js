import assert from "node:assert/strict";
import test from "node:test";
import { parseLinkImport } from "../src/utils/linkImport.js";

test("parses non-empty lines as link rows", () => {
  assert.deepEqual(parseLinkImport(
    "\n https://example.com/one \r\nhttps://example.com/two\n",
    "lines"
  ), [
    { longUrl: "https://example.com/one" },
    { longUrl: "https://example.com/two" }
  ]);
});

test("parses CSV headers, aliases, and quoted commas", () => {
  assert.deepEqual(parseLinkImport(
    'longUrl,customAlias\r\n"https://example.com/?a=one,two",article\r\n',
    "csv"
  ), [{
    longUrl: "https://example.com/?a=one,two",
    customAlias: "article"
  }]);
});

test("reports malformed CSV quoting and unknown headers", () => {
  assert.throws(() => parseLinkImport(
    'longUrl\n"https://example.com',
    "csv"
  ), /unclosed quoted field/);
  assert.throws(() => parseLinkImport(
    "destination\nhttps://example.com",
    "csv"
  ), /must include longUrl/);
});
