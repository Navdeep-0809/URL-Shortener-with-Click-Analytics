import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { config } from "../config/env.js";

const JWT_OPTIONS = {
  algorithms: ["HS256"],
  audience: "shortly-client",
  issuer: "shortly-api"
};

function sendUnauthorized(response, message) {
  return response.status(401).json({ error: message });
}

export function createAuthenticationMiddleware({
  optional = false,
  userModel = User,
  secret = config.jwtSecret
} = {}) {
  return async function authenticate(request, response, next) {
    const authorization = request.get("authorization");
    if (!authorization && optional) {
      request.user = null;
      return next();
    }
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
      return sendUnauthorized(response, "A valid Bearer token is required.");
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!token || !secret) {
      return sendUnauthorized(response, "Authentication token is invalid or expired.");
    }

    let payload;
    try {
      payload = jwt.verify(token, secret, JWT_OPTIONS);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return sendUnauthorized(response, "Authentication token expired. Please sign in again.");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return sendUnauthorized(response, "Authentication token is invalid.");
      }
      return next(error);
    }

    if (typeof payload !== "object" || typeof payload.sub !== "string") {
      return sendUnauthorized(response, "Authentication token is invalid.");
    }

    try {
      const user = await userModel.findById(payload.sub).select("email createdAt").lean();
      if (!user) {
        return sendUnauthorized(response, "Authentication token is invalid.");
      }
      request.user = {
        id: user._id.toString(),
        email: user.email,
        createdAt: user.createdAt
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const authenticate = createAuthenticationMiddleware();
export const optionalAuthentication = createAuthenticationMiddleware({ optional: true });
