import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  ACTIVITY_LEVELS,
  DIETARY_PREFERENCES,
  GENDERS,
  GOALS,
  User,
} from "../models/User.js";
import { env } from "../config.js";
import { AppError } from "../middlewares/errorHandler.js";

const SALT_ROUNDS = 10;

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function normalizeRole(role) {
  const r = String(role ?? "user").toLowerCase();
  if (r === "admin" || r === "trainer") {
    throw new AppError("Cannot self-register with elevated role", {
      statusCode: 403,
      code: "FORBIDDEN_ROLE",
    });
  }
  return "user";
}

function publicUser(doc) {
  return {
    id: doc.id,
    email: doc.email,
    role: doc.role === "trainer" ? "coach" : doc.role,
    profile: doc.profile
      ? {
          name: doc.profile.name ?? null,
          age: doc.profile.age ?? null,
          heightCm: doc.profile.heightCm ?? null,
          weightKg: doc.profile.weightKg ?? null,
          mealsPerDay: doc.profile.mealsPerDay ?? null,
          gender: doc.profile.gender ?? null,
          goal: doc.profile.goal ?? null,
          activityLevel: doc.profile.activityLevel ?? null,
          dietaryPreference: doc.profile.dietaryPreference ?? null,
          foodDislikes: doc.profile.foodDislikes ?? "",
          healthConditions: doc.profile.healthConditions ?? "",
          allergies: doc.profile.allergies ?? "",
        }
      : {},
  };
}

function assertEnum(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new AppError(`${fieldName} must be one of: ${allowed.join(", ")}`, {
      code: "VALIDATION_ERROR",
    });
  }
}

function normalizeRegistrationProfile(input) {
  const profile = input ?? {};
  const age = Number(profile.age);
  const heightCm = Number(profile.heightCm);
  const weightKg = Number(profile.weightKg);
  const mealsPerDay = Number(profile.mealsPerDay);
  const gender = String(profile.gender ?? "").trim();
  const goal = String(profile.goal ?? "").trim();
  const activityLevel = String(profile.activityLevel ?? "").trim();
  const dietaryPreference = String(profile.dietaryPreference ?? "").trim();
  const foodDislikes = String(profile.foodDislikes ?? "").trim();
  const healthConditions = String(profile.healthConditions ?? "").trim();
  const allergies = String(profile.allergies ?? "").trim();

  if (!Number.isInteger(age) || age < 8 || age > 110) {
    throw new AppError("age must be an integer between 8 and 110", {
      code: "VALIDATION_ERROR",
    });
  }
  if (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 260) {
    throw new AppError("heightCm must be between 80 and 260", {
      code: "VALIDATION_ERROR",
    });
  }
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 350) {
    throw new AppError("weightKg must be between 20 and 350", {
      code: "VALIDATION_ERROR",
    });
  }
  if (!Number.isInteger(mealsPerDay) || mealsPerDay < 1 || mealsPerDay > 12) {
    throw new AppError("mealsPerDay must be an integer between 1 and 12", {
      code: "VALIDATION_ERROR",
    });
  }

  assertEnum(gender, GENDERS, "gender");
  assertEnum(goal, GOALS, "goal");
  assertEnum(activityLevel, ACTIVITY_LEVELS, "activityLevel");
  assertEnum(dietaryPreference, DIETARY_PREFERENCES, "dietaryPreference");

  return {
    ...(profile.name !== undefined ? { name: String(profile.name).trim() } : {}),
    age,
    heightCm,
    weightKg,
    mealsPerDay,
    gender,
    goal,
    activityLevel,
    dietaryPreference,
    foodDislikes,
    healthConditions,
    allergies,
  };
}

export async function register(req, res, next) {
  try {
    const { email, password, role, profile } = req.body ?? {};
    const em = normalizeEmail(email);

    if (!em) {
      throw new AppError("Email is required", { code: "VALIDATION_ERROR" });
    }
    if (!password || password.length < 8) {
      throw new AppError("Password must be at least 8 characters", {
        code: "VALIDATION_ERROR",
      });
    }

    const taken = await User.exists({ email: em });
    if (taken) {
      throw new AppError("Email already registered", {
        statusCode: 409,
        code: "EMAIL_TAKEN",
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRole = normalizeRole(role);
    const normalizedProfile = normalizeRegistrationProfile(profile);

    const doc = await User.create({
      email: em,
      passwordHash,
      role: userRole,
      profile: normalizedProfile,
    });

    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    await User.findByIdAndUpdate(doc.id, { emailVerificationToken });

    res.status(201).json({
      user: publicUser(doc),
      ...(env.nodeEnv !== "production" ? { devEmailVerificationToken: emailVerificationToken } : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    const em = normalizeEmail(email);

    if (!em || !password) {
      throw new AppError("Email and password are required", {
        code: "VALIDATION_ERROR",
      });
    }

    const doc = await User.findOne({ email: em }).select("+passwordHash");
    if (!doc) {
      throw new AppError("Invalid email or password", {
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
      });
    }

    const ok = await bcrypt.compare(password, doc.passwordHash);
    if (!ok) {
      throw new AppError("Invalid email or password", {
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
      });
    }

    const token = jwt.sign(
      { sub: doc.id, role: doc.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.json({ token, user: publicUser(doc) });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body ?? {};
    const em = normalizeEmail(email);
    if (!em) {
      throw new AppError("Email is required", { code: "VALIDATION_ERROR" });
    }

    const user = await User.findOne({ email: em });
    if (!user) {
      res.json({ message: "If that email exists, a reset link has been sent." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const userWithToken = await User.findById(user.id).select("+resetToken +resetTokenExpiresAt");
    userWithToken.resetToken = token;
    userWithToken.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await userWithToken.save();

    res.json({
      message: "If that email exists, a reset link has been sent.",
      ...(env.nodeEnv !== "production" ? { devToken: token } : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword || String(newPassword).length < 8) {
      throw new AppError("token and newPassword (min 8 chars) are required", {
        code: "VALIDATION_ERROR",
      });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiresAt: { $gt: new Date() },
    }).select("+resetToken +resetTokenExpiresAt +passwordHash");

    if (!user) {
      throw new AppError("Invalid or expired reset token", {
        statusCode: 400,
        code: "INVALID_RESET_TOKEN",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.resetToken = null;
    user.resetTokenExpiresAt = null;
    await user.save();

    res.json({ message: "Password reset successful." });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const token = String(req.query.token ?? "").trim();
    if (!token) {
      throw new AppError("Verification token is required", {
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const user = await User.findOne({ emailVerificationToken: token }).select(
      "+emailVerificationToken"
    );
    if (!user) {
      throw new AppError("Invalid verification token", {
        statusCode: 400,
        code: "INVALID_TOKEN",
      });
    }
    if (user.emailVerifiedAt) {
      res.json({ message: "Email already verified." });
      return;
    }

    user.emailVerifiedAt = new Date();
    user.emailVerificationToken = null;
    await user.save();
    res.json({ message: "Email verified successfully." });
  } catch (err) {
    next(err);
  }
}
