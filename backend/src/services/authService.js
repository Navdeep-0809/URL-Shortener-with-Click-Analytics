import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_HASH_ROUNDS = 12;

function validateCredentials(email, password) {
  if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !EMAIL_PATTERN.test(email.trim())
  ) {
    throw new HttpError(400, "Provide a valid email address.");
  }
  if (
    typeof password !== "string" ||
    Array.from(password).length < PASSWORD_MIN_LENGTH ||
    Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES
  ) {
    throw new HttpError(
      400,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters and no more than ${PASSWORD_MAX_BYTES} UTF-8 bytes.`
    );
  }
}

export async function registerUser(
  { email, password },
  { userModel = User, hashPassword = bcrypt.hash } = {}
) {
  validateCredentials(email, password);

  try {
    return await userModel.create({
      email: email.trim().toLowerCase(),
      passwordHash: await hashPassword(password, PASSWORD_HASH_ROUNDS)
    });
  } catch (error) {
    if (isDuplicateKeyError(error, "email")) {
      throw new HttpError(409, "An account with that email already exists.");
    }
    throw error;
  }
}

export async function authenticateUser(
  { email, password },
  { userModel = User, comparePassword = bcrypt.compare } = {}
) {
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES
  ) {
    throw new HttpError(400, "Provide an email address and password.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const user = await userModel
    .findOne({ email: normalizedEmail })
    .select("+passwordHash");
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password.");
  }
  return user;
}

export function createAccessToken(userId, secret) {
  return jwt.sign({}, secret, {
    algorithm: "HS256",
    audience: "shortly-client",
    expiresIn: "1h",
    issuer: "shortly-api",
    subject: userId.toString()
  });
}
