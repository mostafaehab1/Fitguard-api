// Plan ownership + AI plan generation (docs ADR-006, 04 §4.3.4).
import { PlanAssignment } from "../models/PlanAssignment.js";
import { Exercise } from "../models/Exercise.js";
import { User } from "../models/User.js";
import { AppError } from "../middlewares/errorHandler.js";
import { fetchWorkoutPlan, fetchNutritionPlan } from "./aiClient.js";
import { buildWorkout, computeNutrition } from "./planGenerator.js";

/**
 * The single source of truth for the active plan (ADR-006): deactivates every other
 * plan for the user, activates `planId`, and points `User.activePlanId` at it.
 */
export async function setActivePlan(userId, planId) {
  await PlanAssignment.updateMany(
    { userId, active: true, _id: { $ne: planId } },
    { $set: { active: false } }
  );
  await PlanAssignment.findByIdAndUpdate(planId, { $set: { active: true } });
  await User.findByIdAndUpdate(userId, { $set: { activePlanId: planId } });
}

function isValidWorkout(w) {
  return w && Array.isArray(w.weeklySchedule);
}
function isValidNutrition(n) {
  return n && typeof n.dailyCalories === "number" && n.dailyCalories > 0;
}

// Loads active exercises keyed by trackedKey — used to resolve plan items.
export async function getExerciseTrackedKeyMap() {
  const exercises = await Exercise.find({ isActive: true }).lean();
  return new Map(exercises.filter((e) => e.trackedKey).map((e) => [e.trackedKey, e]));
}

// AI/coach plans reference exercises by trackedKey; resolve to exerciseId + snapshot name.
export function resolveWorkout(workout, byTrackedKey) {
  return {
    notes: workout.notes ?? "",
    weeklySchedule: (workout.weeklySchedule || []).map((day) => ({
      dayOfWeek: day.dayOfWeek,
      focus: day.focus,
      rest: Boolean(day.rest),
      items: (day.items || []).map((it) => {
        const ex = it.trackedKey ? byTrackedKey.get(it.trackedKey) : null;
        return {
          exerciseId: ex?._id ?? null,
          exerciseName: ex?.name ?? it.exerciseName ?? it.trackedKey ?? "",
          trackedKey: it.trackedKey ?? ex?.trackedKey ?? null,
          sets: it.sets,
          reps: it.reps,
          restSeconds: it.restSeconds,
          intensity: it.intensity,
          notes: it.notes ?? "",
        };
      }),
    })),
  };
}

/**
 * Generates an AI plan (LLM service if configured + valid, else deterministic
 * fallback), persists it, and makes it the user's active plan.
 */
export async function generateAndActivateAiPlan(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", { statusCode: 404, code: "NOT_FOUND" });
  }
  const p = user.profile ?? {};
  if (!p.age || !p.heightCm || !p.weightKg || !p.gender || !p.goal) {
    throw new AppError("Complete your profile before generating a plan", {
      code: "VALIDATION_ERROR",
    });
  }

  const exercises = await Exercise.find({ isActive: true }).lean();
  const byTrackedKey = new Map(
    exercises.filter((e) => e.trackedKey).map((e) => [e.trackedKey, e])
  );
  // The AI service requires a non-null trackedKey, so only send tracked exercises.
  // Guided exercises (no trackedKey) are excluded from AI-generated workouts.
  const catalog = exercises
    .filter((e) => e.trackedKey)
    .map((e) => ({
      trackedKey: e.trackedKey,
      name: e.name,
      type: e.type,
      muscleGroups: e.muscleGroups,
    }));

  const profilePayload = {
    age: p.age,
    gender: p.gender,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    goal: p.goal,
    experienceLevel: p.experienceLevel,
    activityLevel: p.activityLevel,
    mealsPerDay: p.mealsPerDay,
    dietaryPreference: p.dietaryPreference,
    allergies: p.allergies,
    foodDislikes: p.foodDislikes,
    limitations: p.limitations ?? [],
    daysPerWeek: p.daysPerWeek,
  };

  let workout = null;
  let nutrition = null;
  let modelName = "deterministic-fallback";

  try {
    const [w, n] = await Promise.all([
      fetchWorkoutPlan(profilePayload, catalog),
      fetchNutritionPlan(profilePayload),
    ]);
    if (isValidWorkout(w) && isValidNutrition(n)) {
      workout = resolveWorkout(w, byTrackedKey);
      nutrition = n;
      modelName = "ai-service";
    }
  } catch {
    // fall through to deterministic fallback
  }

  if (!workout || !nutrition) {
    workout = buildWorkout(p, exercises, p.limitations ?? []);
    nutrition = computeNutrition(p);
  }

  const plan = await PlanAssignment.create({
    userId,
    source: "ai",
    assignedBy: userId,
    active: false,
    workout,
    nutrition,
    generatedBy: { model: modelName, promptVersion: "v1", generatedAt: new Date() },
    notes: "",
  });

  await setActivePlan(userId, plan._id);
  return plan;
}
