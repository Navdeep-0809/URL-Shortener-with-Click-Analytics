import { Router } from "express";
import {
  addDomain,
  listDomains,
  removeDomain,
  verifyDomain
} from "../controllers/customDomainController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);
router.get("/", listDomains);
router.post("/", addDomain);
router.post("/:id/verify", verifyDomain);
router.delete("/:id", removeDomain);

export default router;
