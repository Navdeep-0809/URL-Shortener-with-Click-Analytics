import rateLimit from "express-rate-limit";

function createLimiter(limit, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, response) {
      response.status(429).json({ error: message });
    }
  });
}

export const apiRateLimiter = createLimiter(
  100,
  "Too many API requests. Please try again later."
);

export const createUrlRateLimiter = createLimiter(
  20,
  "Too many links created from this address. Please try again later."
);

export const redirectRateLimiter = createLimiter(
  300,
  "Too many redirects from this address. Please try again later."
);

export const registerRateLimiter = createLimiter(
  5,
  "Too many account creation attempts. Please try again later."
);

export const loginRateLimiter = createLimiter(
  10,
  "Too many sign-in attempts. Please try again later."
);

export const analyticsRateLimiter = createLimiter(
  60,
  "Too many analytics requests. Please try again later."
);

export const passwordVerificationRateLimiter = createLimiter(
  10,
  "Too many password attempts. Please wait before trying again."
);
