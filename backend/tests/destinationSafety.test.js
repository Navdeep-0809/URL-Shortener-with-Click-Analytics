import assert from "node:assert/strict";
import test from "node:test";
import {
  isPublicIpAddress,
  validateSafeDestinationUrl
} from "../src/utils/urlValidation.js";

test("allows public IPv4 and IPv6 addresses but blocks non-public address ranges", () => {
  for (const address of ["8.8.8.8", "2606:4700:4700::1111"]) {
    assert.equal(isPublicIpAddress(address), true);
  }

  for (const address of [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "192.168.1.2",
    "224.0.0.1",
    "::",
    "::1",
    "::7f00:1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "64:ff9b::a00:1",
    "198.18.0.1",
    "2002:7f00:1::1"
  ]) {
    assert.equal(isPublicIpAddress(address), false, `${address} should not be public`);
  }
});

test("rejects localhost and private IP literals without resolving them", async () => {
  let resolutionCalled = false;
  const resolve = async () => {
    resolutionCalled = true;
    return [{ address: "8.8.8.8", family: 4 }];
  };

  for (const url of [
    "http://localhost/",
    "http://printer.local/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://10.0.0.1/"
  ]) {
    await assert.rejects(validateSafeDestinationUrl(url, resolve), { statusCode: 400 });
  }
  assert.equal(resolutionCalled, false);
});

test("rejects hostnames that resolve to any non-public address", async () => {
  const resolve = async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "10.0.0.7", family: 4 }
  ];

  await assert.rejects(
    validateSafeDestinationUrl("https://mixed.example", resolve),
    { statusCode: 400 }
  );
});

test("accepts a hostname only when every resolved address is public", async () => {
  const resolve = async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "2606:4700:4700::1111", family: 6 }
  ];

  assert.equal(
    await validateSafeDestinationUrl("https://public.example/path", resolve),
    "https://public.example/path"
  );
});
