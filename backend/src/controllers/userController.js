import {
  ACTIVITY_LEVELS,
  DIETARY_PREFERENCES,
  EXPERIENCE_LEVELS,
  GENDERS,
  GOALS,
  BODY_REGIONS,
  User,
} from "../models/User.js";
import { AppError } from "../middlewares/errorHandler.js";
import { generateAndActivateAiPlan } from "../services/planService.js";

function assertAuth(req) {
  if (!req.auth?.userId) {
    throw new AppError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
  }
}

function assertEnum(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new AppError(`${fieldName} must be one of: ${allowed.join(", ")}`, {
      code: "VALIDATION_ERROR",
    });
  }
}

export async function getProfile(req, res, next) {
  try {
    assertAuth(req);
    const user = await User.findById(req.auth.userId);
    if (!user) {
      throw new AppError("User not found", { statusCode: 404, code: "NOT_FOUND" });
    }
    res.json({
      role: user.role,
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
      profile: user.profile ?? {},
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    assertAuth(req);
    const body = req.body ?? {};
    const user = await User.findById(req.auth.userId);
    if (!user) {
      throw new AppError("User not found", { statusCode: 404, code: "NOT_FOUND" });
    }

    const updates = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();

    if (body.age !== undefined) {
      const age = Number(body.age);
      if (!Number.isInteger(age) || age < 8 || age > 110) {
        throw new AppError("age must be an integer between 8 and 110", {
          code: "VALIDATION_ERROR",
        });
      }
      updates.age = age;
    }
    if (body.heightCm !== undefined) {
      const heightCm = Number(body.heightCm);
      if (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 260) {
        throw new AppError("heightCm must be between 80 and 260", {
          code: "VALIDATION_ERROR",
        });
      }
      updates.heightCm = heightCm;
    }
    if (body.weightKg !== undefined) {
      const weightKg = Number(body.weightKg);
      if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 350) {
        throw new AppError("weightKg must be between 20 and 350", {
          code: "VALIDATION_ERROR",
        });
      }
      updates.weightKg = weightKg;
    }
    if (body.mealsPerDay !== undefined) {
      const mealsPerDay = Number(body.mealsPerDay);
      if (!Number.isInteger(mealsPerDay) || mealsPerDay < 1 || mealsPerDay > 12) {
        throw new AppError("mealsPerDay must be an integer between 1 and 12", {
          code: "VALIDATION_ERROR",
        });
      }
      updates.mealsPerDay = mealsPerDay;
    }
    if (body.gender !== undefined) {
      const gender = String(body.gender).trim();
      assertEnum(gender, GENDERS, "gender");
      updates.gender = gender;
    }
    if (body.goal !== undefined) {
      const goal = String(body.goal).trim();
      assertEnum(goal, GOALS, "goal");
      updates.goal = goal;
    }
    if (body.activityLevel !== undefined) {
      const activityLevel = String(body.activityLevel).trim();
      assertEnum(activityLevel, ACTIVITY_LEVELS, "activityLevel");
      updates.activityLevel = activityLevel;
    }
    if (body.dietaryPreference !== undefined) {
      const dietaryPreference = String(body.dietaryPreference).trim();
      assertEnum(dietaryPreference, DIETARY_PREFERENCES, "dietaryPreference");
      updates.dietaryPreference = dietaryPreference;
    }
    if (body.foodDislikes !== undefined) updates.foodDislikes = String(body.foodDislikes).trim();
    if (body.healthConditions !== undefined) {
      updates.healthConditions = String(body.healthConditions).trim();
    }
    if (body.allergies !== undefined) updates.allergies = String(body.allergies).trim();

    user.profile = { ...user.profile, ...updates };

    await user.save();
    res.json({
      role: user.role,
      profile: user.profile,
    });
  } catch (err) {
    next(err);
  }
}

// Manual fallback path: regenerate the AI plan (normally auto-generated at onboarding).
export async function generateAiPlan(req, res, next) {
  try {
    assertAuth(req);
    const plan = await generateAndActivateAiPlan(req.auth.userId);
    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
}

function normalizeOnboardingProfile(body) {
  const age = Number(body.age);
  const heightCm = Number(body.heightCm);
  const weightKg = Number(body.weightKg);
  const mealsPerDay = Number(body.mealsPerDay);
  const daysPerWeek = Number(body.daysPerWeek);
  const gender = String(body.gender ?? "").trim();
  const goal = String(body.goal ?? "").trim();
  const experienceLevel = String(body.experienceLevel ?? "").trim();
  const activityLevel = String(body.activityLevel ?? "").trim();
  const dietaryPreference = String(body.dietaryPreference ?? "").trim();

  if (!Number.isInteger(age) || age < 8 || age > 110) {
    throw new AppError("age must be an integer between 8 and 110", { code: "VALIDATION_ERROR" });
  }
  if (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 260) {
    throw new AppError("heightCm must be between 80 and 260", { code: "VALIDATION_ERROR" });
  }
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 350) {
    throw new AppError("weightKg must be between 20 and 350", { code: "VALIDATION_ERROR" });
  }
  if (!Number.isInteger(mealsPerDay) || mealsPerDay < 1 || mealsPerDay > 12) {
    throw new AppError("mealsPerDay must be an integer between 1 and 12", { code: "VALIDATION_ERROR" });
  }
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) {
    throw new AppError("daysPerWeek must be an integer between 1 and 7", { code: "VALIDATION_ERROR" });
  }
  assertEnum(gender, GENDERS, "gender");
  assertEnum(goal, GOALS, "goal");
  assertEnum(experienceLevel, EXPERIENCE_LEVELS, "experienceLevel");
  assertEnum(activityLevel, ACTIVITY_LEVELS, "activityLevel");
  assertEnum(dietaryPreference, DIETARY_PREFERENCES, "dietaryPreference");

  let limitations = [];
  if (body.limitations !== undefined) {
    if (!Array.isArray(body.limitations)) {
      throw new AppError("limitations must be an array", { code: "VALIDATION_ERROR" });
    }
    limitations = body.limitations.map((l) => String(l).trim());
    for (const l of limitations) {
      if (!BODY_REGIONS.includes(l)) {
        throw new AppError(`Invalid limitation: ${l}`, { code: "VALIDATION_ERROR" });
      }
    }
  }

  return {
    ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
    age,
    heightCm,
    weightKg,
    mealsPerDay,
    daysPerWeek,
    gender,
    goal,
    experienceLevel,
    activityLevel,
    dietaryPreference,
    limitations,
    foodDislikes: String(body.foodDislikes ?? "").trim(),
    healthConditions: String(body.healthConditions ?? "").trim(),
    allergies: String(body.allergies ?? "").trim(),
  };
}

// Onboarding: completes the profile (+disclaimer) and AUTO-generates the AI plan.
export async function completeOnboarding(req, res, next) {
  try {
    assertAuth(req);
    const body = req.body ?? {};
    if (body.disclaimerAccepted !== true) {
      throw new AppError("You must accept the disclaimer to continue", {
        code: "VALIDATION_ERROR",
      });
    }
    const profile = normalizeOnboardingProfile(body);
    const user = await User.findById(req.auth.userId);
    if (!user) {
      throw new AppError("User not found", { statusCode: 404, code: "NOT_FOUND" });
    }
    const current = user.profile?.toObject?.() ?? user.profile ?? {};
    user.profile = { ...current, ...profile };
    user.disclaimerAcceptedAt = new Date();
    user.onboardingCompletedAt = new Date();
    await user.save();

    const plan = await generateAndActivateAiPlan(user.id);
    res.status(201).json({ onboardingCompleted: true, profile: user.profile, plan });
  } catch (err) {
    next(err);
  }
}
