import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import * as progress from "../controllers/progressController.js";

const router = Router();

router.post("/sessions", authMiddleware, progress.createWorkoutSession);
router.get("/sessions/:id", authMiddleware, progress.getSessionById);
router.get("/me", authMiddleware, progress.getMyProgress);

export default router;
