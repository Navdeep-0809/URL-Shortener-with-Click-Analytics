import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthenticationMiddleware
} from "../src/middleware/authenticate.js";
import { createAccessToken } from "../src/services/authService.js";

const secret = "middleware-test-secret-more-than-32-characters";

function createResponse() {
  return {
    statusCode: null,
    payload: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test("requires a valid bearer token on protected routes", async () => {
  const middleware = createAuthenticationMiddleware({ secret, userModel: {} });
  const response = createResponse();
  let nextCalled = false;

  await middleware(
    { get: () => undefined },
    response,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("loads the current user from a verified token before authorizing", async () => {
  let requestedId;
  const userModel = {
    findById(id) {
      requestedId = id;
      return {
        select(fields) {
          assert.equal(fields, "email createdAt");
          return {
            lean: async () => ({
              _id: id,
              email: "person@example.com",
              createdAt: new Date("2026-01-01T00:00:00Z")
            })
          };
        }
      };
    }
  };
  const middleware = createAuthenticationMiddleware({ secret, userModel });
  const request = {
    get: () => `Bearer ${createAccessToken("user-id", secret)}`
  };
  const response = createResponse();
  let nextCalled = false;

  await middleware(request, response, () => {
    nextCalled = true;
  });

  assert.equal(requestedId, "user-id");
  assert.equal(request.user.email, "person@example.com");
  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});

test("optional authentication retains anonymous shortening", async () => {
  const middleware = createAuthenticationMiddleware({
    optional: true,
    secret,
    userModel: {}
  });
  const request = { get: () => undefined };
  let nextCalled = false;

  await middleware(request, createResponse(), () => {
    nextCalled = true;
  });

  assert.equal(request.user, null);
  assert.equal(nextCalled, true);
});
