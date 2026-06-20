import { PlanAssignment } from "../models/PlanAssignment.js";
import { Subscription } from "../models/Subscription.js";
import { AppError } from "../middlewares/errorHandler.js";
import {
  setActivePlan,
  resolveWorkout,
  getExerciseTrackedKeyMap,
} from "../services/planService.js";
import { notify } from "../services/notificationService.js";

async function requireActiveSubscription(userId, coachId) {
  const sub = await Subscription.findOne({
    userId,
    coachId,
    status: "active",
    endDate: { $gt: new Date() },
  });
  if (!sub) {
    throw new AppError("User is not actively subscribed to you", {
      statusCode: 403,
      code: "NOT_SUBSCRIBED",
    });
  }
  return sub;
}

function normalizeNutrition(n) {
  if (!n || typeof n !== "object") return {};
  return {
    dailyCalories: n.dailyCalories,
    protein_g: n.protein_g,
    carbs_g: n.carbs_g,
    fat_g: n.fat_g,
    hydrationLiters: n.hydrationLiters,
    mealStructure: Array.isArray(n.mealStructure) ? n.mealStructure : [],
    notes: n.notes ?? "",
  };
}

// GET /plans/me — the user's single active plan (AI or coach).
export async function getMyPlan(req, res, next) {
  try {
    const plan = await PlanAssignment.findOne({ userId: req.auth.userId, active: true }).sort({
      createdAt: -1,
    });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
}

// POST /plans/coach — a coach assigns/replaces a subscriber's plan.
export async function coachAssignPlan(req, res, next) {
  try {
    const { userId, workout, nutrition, notes } = req.body ?? {};
    if (!userId) {
      throw new AppError("userId is required", { code: "VALIDATION_ERROR" });
    }
    if (!workout || !Array.isArray(workout.weeklySchedule)) {
      throw new AppError("workout.weeklySchedule must be an array", { code: "VALIDATION_ERROR" });
    }
    await requireActiveSubscription(userId, req.auth.userId);

    const byTrackedKey = await getExerciseTrackedKeyMap();
    const plan = await PlanAssignment.create({
      userId,
      source: "coach",
      assignedBy: req.auth.userId,
      active: false,
      version: 1,
      workout: resolveWorkout(workout, byTrackedKey),
      nutrition: normalizeNutrition(nutrition),
      notes: String(notes ?? "").trim(),
    });
    await setActivePlan(userId, plan._id);
    await notify(userId, "plan_updated", {
      title: "Your coach updated your plan",
      body: "Open FitGuard to see your new plan.",
      metadata: { coachId: req.auth.userId, planId: plan.id },
    });

    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
}

// PATCH /plans/:id — a coach updates a plan they authored (bumps version).
export async function updatePlan(req, res, next) {
  try {
    const plan = await PlanAssignment.findById(req.params.id);
    if (!plan) {
      throw new AppError("Plan not found", { statusCode: 404, code: "NOT_FOUND" });
    }
    if (String(plan.assignedBy) !== String(req.auth.userId) || plan.source !== "coach") {
      throw new AppError("You can only edit plans you authored", {
        statusCode: 403,
        code: "FORBIDDEN",
      });
    }
    await requireActiveSubscription(plan.userId, req.auth.userId);

    const { workout, nutrition, notes } = req.body ?? {};
    if (workout && Array.isArray(workout.weeklySchedule)) {
      const byTrackedKey = await getExerciseTrackedKeyMap();
      plan.workout = resolveWorkout(workout, byTrackedKey);
    }
    if (nutrition) plan.nutrition = normalizeNutrition(nutrition);
    if (notes !== undefined) plan.notes = String(notes).trim();
    plan.version += 1;
    await plan.save();
    await notify(plan.userId, "plan_updated", {
      title: "Your coach updated your plan",
      body: "Open FitGuard to see the changes.",
      metadata: { coachId: req.auth.userId, planId: plan.id },
    });

    res.json({ plan });
  } catch (err) {
    next(err);
  }
}
