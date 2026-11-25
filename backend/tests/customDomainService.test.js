import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomDomain,
  normalizeHostname,
  verifyCustomDomain
} from "../src/services/customDomainService.js";

test("normalizes domain hostnames and rejects URL-shaped input", () => {
  assert.equal(normalizeHostname(" Links.Example.com. "), "links.example.com");
  for (const hostname of [
    "https://links.example.com",
    "links.example.com/path",
    "localhost",
    "not a domain"
  ]) {
    assert.throws(() => normalizeHostname(hostname), { statusCode: 400 });
  }
});

test("creates pending custom domains with normalized hostnames", async () => {
  let created;
  const domainModel = {
    async create(value) {
      created = value;
      return { _id: "domain-id", ...value };
    }
  };

  const domain = await createCustomDomain({
    hostname: "Links.Example.com",
    userId: "owner-id"
  }, { domainModel });

  assert.equal(created.hostname, "links.example.com");
  assert.equal(created.userId, "owner-id");
  assert.equal(typeof created.verificationToken, "string");
  assert.equal(domain.verifiedAt, null);
});

test("verifies a domain only after its owner-scoped TXT challenge matches", async () => {
  const domainId = "0123456789abcdef01234567";
  const domain = {
    hostname: "links.example.com",
    verificationToken: "private-token",
    verifiedAt: null,
    async save() {
      this.saved = true;
    }
  };
  let filter;
  const domainModel = {
    findOne(value) {
      filter = value;
      return {
        select(fields) {
          assert.equal(fields, "hostname verifiedAt +verificationToken");
          return Promise.resolve(domain);
        }
      };
    }
  };

  await verifyCustomDomain({
    id: domainId,
    userId: "owner-id"
  }, {
    domainModel,
    lookupTxt: async (name) => {
      assert.equal(name, "_shortly-verification.links.example.com");
      return [["shortly-verification=private-", "token"]];
    }
  });

  assert.deepEqual(filter, { _id: domainId, userId: "owner-id" });
  assert.equal(domain.saved, true);
  assert.ok(domain.verifiedAt instanceof Date);
});

test("rejects a mismatched domain TXT challenge without marking it verified", async () => {
  const domain = {
    hostname: "links.example.com",
    verificationToken: "private-token",
    verifiedAt: null,
    async save() {
      assert.fail("A mismatched challenge must not save the domain.");
    }
  };
  const domainModel = {
    findOne() {
      return { select: async () => domain };
    }
  };

  await assert.rejects(
    verifyCustomDomain({
      id: "0123456789abcdef01234567",
      userId: "owner-id"
    }, {
      domainModel,
      lookupTxt: async () => [["shortly-verification=wrong-token"]]
    }),
    { statusCode: 400 }
  );
});
