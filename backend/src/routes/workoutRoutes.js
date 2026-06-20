import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import * as workouts from "../controllers/workoutController.js";

const router = Router();

router.post("/sessions", authMiddleware, workouts.submitSession);
router.get("/sessions", authMiddleware, workouts.listSessions);
router.get("/sessions/:id", authMiddleware, workouts.getSessionById);

export default router;
