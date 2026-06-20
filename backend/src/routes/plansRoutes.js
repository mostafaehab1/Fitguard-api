import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/rbacMiddleware.js";
import * as plans from "../controllers/plansController.js";

const router = Router();

router.get("/me", authMiddleware, plans.getMyPlan);
router.post("/coach", authMiddleware, requireRole("coach"), plans.coachAssignPlan);
router.patch("/:id", authMiddleware, requireRole("coach"), plans.updatePlan);

export default router;
