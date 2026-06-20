import { Router } from "express";
import * as health from "../controllers/healthController.js";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import coachRoutes from "./coachRoutes.js";
import subscriptionRoutes from "./subscriptionRoutes.js";
import exerciseRoutes from "./exerciseRoutes.js";
import plansRoutes from "./plansRoutes.js";
import workoutRoutes from "./workoutRoutes.js";
import progressRoutes from "./progressRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import mediaRoutes from "./mediaRoutes.js";
import adminRoutes from "./adminRoutes.js";

const router = Router();

router.get("/health", health.healthCheck);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/coaches", coachRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/exercises", exerciseRoutes);
router.use("/plans", plansRoutes);
router.use("/workouts", workoutRoutes);
router.use("/progress", progressRoutes);
router.use("/notifications", notificationRoutes);
router.use("/media", mediaRoutes);
router.use("/admin", adminRoutes);

export default router;
