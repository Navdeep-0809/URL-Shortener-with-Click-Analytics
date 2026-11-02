import { Router } from "express";
import { currentUser, login, register } from "../controllers/authController.js";
import { authenticate } from "../middleware/authenticate.js";
import { loginRateLimiter, registerRateLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.get("/me", authenticate, currentUser);

export default router;
