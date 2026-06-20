import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import * as user from "../controllers/userController.js";

const router = Router();

router.get("/me/profile", authMiddleware, user.getProfile);
router.post("/me/onboarding", authMiddleware, user.completeOnboarding);
router.patch("/me/profile", authMiddleware, user.updateProfile);
router.post("/me/ai-plan", authMiddleware, user.generateAiPlan);
router.delete("/me", authMiddleware, user.deleteMyAccount); // self soft-deactivate

export default router;
