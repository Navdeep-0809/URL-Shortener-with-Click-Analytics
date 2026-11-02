import { config } from "../config/env.js";
import { authenticateUser, createAccessToken, registerUser } from "../services/authService.js";
import { HttpError } from "../utils/httpError.js";

const AUTH_FIELDS = new Set(["email", "password"]);

function validateAuthBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
  if (Object.keys(body).some((field) => !AUTH_FIELDS.has(field))) {
    throw new HttpError(400, "Request body contains unsupported fields.");
  }
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    createdAt: user.createdAt
  };
}

export async function register(request, response, next) {
  try {
    validateAuthBody(request.body);
    const user = await registerUser(request.body);
    response.status(201).json({
      token: createAccessToken(user._id, config.jwtSecret),
      user: serializeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function login(request, response, next) {
  try {
    validateAuthBody(request.body);
    const user = await authenticateUser(request.body);
    response.json({
      token: createAccessToken(user._id, config.jwtSecret),
      user: serializeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export function currentUser(request, response) {
  response.json({ user: request.user });
}
