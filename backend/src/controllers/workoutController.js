import { Subscription } from "../models/Subscription.js";
import { PlanAssignment } from "../models/PlanAssignment.js";
import { AppError } from "../middlewares/errorHandler.js";

async function requireCoachSubscription(userId, coachId) {
  const sub = await Subscription.findOne({
    userId,
    coachId,
    status: "active",
    endDate: { $gt: new Date() },
  });
  if (!sub) {
    throw new AppError("User is not actively subscribed to this coach", {
      statusCode: 403,
      code: "NOT_SUBSCRIBED",
    });
  }
}

export async function assignPlanToSubscribedUser(req, res, next) {
  try {
    const { userId, workoutPlan, nutritionPlan, notes } = req.body ?? {};
    if (!userId) {
      throw new AppError("userId is required", { code: "VALIDATION_ERROR" });
    }
    if (!Array.isArray(workoutPlan) || workoutPlan.length === 0) {
      throw new AppError("workoutPlan must be a non-empty array of strings", {
        code: "VALIDATION_ERROR",
      });
    }
    if (nutritionPlan !== undefined && !Array.isArray(nutritionPlan)) {
      throw new AppError("nutritionPlan must be an array of strings", {
        code: "VALIDATION_ERROR",
      });
    }
    await requireCoachSubscription(userId, req.auth.userId);

    await PlanAssignment.updateMany(
      { userId, source: "coach", active: true },
      { $set: { active: false } }
    );

    const plan = await PlanAssignment.create({
      userId,
      assignedBy: req.auth.userId,
      source: "coach",
      workoutPlan: Array.isArray(workoutPlan) ? workoutPlan : [],
      nutritionPlan: Array.isArray(nutritionPlan) ? nutritionPlan : [],
      notes: String(notes ?? "").trim(),
      active: true,
    });

    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
}

export async function getMyCurrentPlan(req, res, next) {
  try {
    const plan = await PlanAssignment.findOne({ userId: req.auth.userId, active: true }).sort({
      createdAt: -1,
    });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
}
