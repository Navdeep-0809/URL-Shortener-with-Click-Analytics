import { Router } from "express";
import {
  bulkAction,
  deleteUrl,
  listUrls,
  patchUrl,
  userSummary
} from "../controllers/urlManagementController.js";
import { linkAnalytics } from "../controllers/analyticsController.js";
import { verifyPassword } from "../controllers/redirectController.js";
import { createUrl } from "../controllers/urlController.js";
import { authenticate, optionalAuthentication } from "../middleware/authenticate.js";
import {
  analyticsRateLimiter,
  createUrlRateLimiter,
  passwordVerificationRateLimiter
} from "../middleware/rateLimiters.js";

const router = Router();

router.post("/:code/verify", passwordVerificationRateLimiter, verifyPassword);
router.post("/", optionalAuthentication, createUrlRateLimiter, createUrl);
router.get("/", authenticate, listUrls);
router.get("/summary", authenticate, userSummary);
router.get("/:id/analytics", authenticate, analyticsRateLimiter, linkAnalytics);
router.post("/bulk", authenticate, bulkAction);
router.patch("/:id", authenticate, patchUrl);
router.delete("/:id", authenticate, deleteUrl);

export default router;
