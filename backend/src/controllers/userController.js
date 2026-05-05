import {
  ACTIVITY_LEVELS,
  DIETARY_PREFERENCES,
  GENDERS,
  GOALS,
  User,
} from "../models/User.js";
import { PlanAssignment } from "../models/PlanAssignment.js";
import { AppError } from "../middlewares/errorHandler.js";

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
      role: user.role === "trainer" ? "coach" : user.role,
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
      role: user.role === "trainer" ? "coach" : user.role,
      profile: user.profile,
    });
  } catch (err) {
    next(err);
  }
}

export async function generateAiPlan(req, res, next) {
  try {
    assertAuth(req);
    const user = await User.findById(req.auth.userId);
    if (!user) {
      throw new AppError("User not found", { statusCode: 404, code: "NOT_FOUND" });
    }
    const { heightCm, weightKg, goal } = user.profile ?? {};
    if (!heightCm || !weightKg || !goal) {
      throw new AppError("Profile must include heightCm, weightKg and goal", {
        code: "VALIDATION_ERROR",
      });
    }

    await PlanAssignment.updateMany(
      { userId: user.id, source: "ai", active: true },
      { $set: { active: false } }
    );

    const plan = await PlanAssignment.create({
      userId: user.id,
      assignedBy: user.id,
      source: "ai",
      workoutPlan: [
        `3 full-body sessions/week focused on ${goal}`,
        "Start each session with dynamic warm-up",
      ],
      nutritionPlan: [
        "Prioritize whole foods and hydration",
        `Set calories for ${goal} with weekly check-ins`,
      ],
      notes: "Generated from profile inputs. External AI integration pending.",
      active: true,
    });

    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
}
