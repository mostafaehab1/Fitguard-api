import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/rbacMiddleware.js";
import * as exercise from "../controllers/exerciseController.js";

const router = Router();

router.get("/", exercise.listExercises);
router.post("/", authMiddleware, requireRole("admin"), exercise.createExercise);
router.get("/:id", exercise.getExerciseById);
router.patch("/:id", authMiddleware, requireRole("admin"), exercise.updateExercise);

export default router;
