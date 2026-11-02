import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  authenticateUser,
  createAccessToken,
  registerUser
} from "../src/services/authService.js";

const password = "Strong-password-123";

test("registers normalized email and stores only a password hash", async () => {
  let createdUser;
  const userModel = {
    async create(document) {
      createdUser = document;
      return { _id: "user-id", ...document };
    }
  };

  const user = await registerUser(
    { email: "  Person@Example.com ", password },
    { userModel }
  );

  assert.equal(createdUser.email, "person@example.com");
  assert.match(createdUser.passwordHash, /^\$2[aby]\$12\$/);
  assert.equal(await bcrypt.compare(password, createdUser.passwordHash), true);
  assert.equal("password" in createdUser, false);
  assert.equal(user._id, "user-id");
});

test("rejects weak passwords and duplicate email registrations", async () => {
  await assert.rejects(
    registerUser({ email: "user@example.com", password: "short" }, { userModel: {} }),
    { statusCode: 400 }
  );

  const userModel = {
    async create() {
      const error = new Error("duplicate key");
      error.code = 11000;
      error.keyPattern = { email: 1 };
      throw error;
    }
  };
  await assert.rejects(
    registerUser({ email: "user@example.com", password }, { userModel }),
    { statusCode: 409 }
  );
});

test("login uses a generic error for incorrect credentials", async () => {
  const userModel = {
    findOne(query) {
      assert.deepEqual(query, { email: "person@example.com" });
      return {
        select(fields) {
          assert.equal(fields, "+passwordHash");
          return { passwordHash: "bcrypt-hash", email: "person@example.com" };
        }
      };
    }
  };

  await assert.rejects(
    authenticateUser(
      { email: "Person@Example.com", password: "wrong-password" },
      {
        userModel,
        async comparePassword() {
          return false;
        }
      }
    ),
    { statusCode: 401, message: "Invalid email or password." }
  );
});

test("creates a signed one-hour access token", () => {
  const secret = "test-secret-with-more-than-thirty-two-characters";
  const token = createAccessToken("user-id", secret);
  const payload = jwt.verify(token, secret, {
    algorithms: ["HS256"],
    audience: "shortly-client",
    issuer: "shortly-api"
  });

  assert.equal(payload.sub, "user-id");
  assert.ok(payload.exp - payload.iat <= 3600);
});
