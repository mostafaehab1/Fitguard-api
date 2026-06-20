import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/rbacMiddleware.js";
import * as coach from "../controllers/coachController.js";
import * as reviews from "../controllers/reviewController.js";
import * as transformations from "../controllers/transformationController.js";

const router = Router();

// Public directory
router.get("/", coach.listPublicCoaches);

// Coach self-service (must precede "/:id")
router.post("/applications", authMiddleware, requireRole("user"), coach.applyForCoach);
router.get("/me/profile", authMiddleware, requireRole("coach"), coach.getMyProfile);
router.patch("/me/profile", authMiddleware, requireRole("coach"), coach.updateCoachProfile);
router.get("/me/subscribers", authMiddleware, requireRole("coach"), coach.getMySubscribers);
router.get(
  "/me/subscribers/:userId/progress",
  authMiddleware,
  requireRole("coach"),
  coach.getSubscriberProgress
);
router.post(
  "/me/transformations",
  authMiddleware,
  requireRole("coach"),
  transformations.createTransformation
);

// Public coach detail + reviews + transformations
router.get("/:id", coach.getCoachById);
router.get("/:id/reviews", reviews.listReviews);
router.post("/:id/reviews", authMiddleware, reviews.createReview);
router.get("/:id/transformations", transformations.listTransformations);

export default router;
