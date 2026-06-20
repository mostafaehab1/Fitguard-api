import { User, ROLES, BODY_REGIONS } from "../models/User.js";
import { CoachApplication } from "../models/CoachApplication.js";
import { Subscription } from "../models/Subscription.js";
import { Exercise } from "../models/Exercise.js";
import { WorkoutSession } from "../models/WorkoutSession.js";
import { MistakeCategory } from "../models/MistakeCategory.js";
import { AppError } from "../middlewares/errorHandler.js";

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    profile: user.profile,
    disabledAt: user.disabledAt ?? null,
    createdAt: user.createdAt,
  };
}

export async function getDashboard(req, res, next) {
  try {
    const [users, coaches, activeSubscriptions, pendingCoachApplications, exercises, sessions] =
      await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ role: "coach" }),
        Subscription.countDocuments({ status: "active", endDate: { $gt: new Date() } }),
        CoachApplication.countDocuments({ status: "pending" }),
        Exercise.countDocuments({ isActive: true }),
        WorkoutSession.countDocuments({}),
      ]);

    res.json({
      metrics: {
        users,
        coaches,
        activeSubscriptions,
        pendingCoachApplications,
        activeExercises: exercises,
        loggedSessions: sessions,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
    const skip = (page - 1) * limit;
    const role = req.query.role ? String(req.query.role) : null;
    const search = req.query.search ? String(req.query.search).trim() : "";

    const query = {};
    if (role) {
      if (!ROLES.includes(role)) {
        throw new AppError("Invalid role filter", { code: "VALIDATION_ERROR" });
      }
      query.role = role;
    }
    if (search) {
      query.email = { $regex: search, $options: "i" };
    }

    const [items, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    res.json({
      users: items.map(toPublicUser),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError("User not found", { statusCode: 404, code: "NOT_FOUND" });
    }
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body ?? {};

    if (!ROLES.includes(role)) {
      throw new AppError("role must be one of: user, coach, admin", {
        code: "VALIDATION_ERROR",
      });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError("User not found", { statusCode: 404, code: "NOT_FOUND" });
    }
    if (String(user.id) === String(req.auth.userId)) {
      throw new AppError("Cannot change your own role", {
        statusCode: 400,
        code: "SELF_ROLE_CHANGE",
      });
    }
    user.role = role;
    await user.save();
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

// DELETE /admin/users/:id — soft-deactivate (ban).
export async function deactivateUser(req, res, next) {
  try {
    if (String(req.params.id) === String(req.auth.userId)) {
      throw new AppError("You cannot deactivate your own account", {
        statusCode: 400,
        code: "SELF_DEACTIVATION",
      });
    }
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError("User not found", { statusCode: 404, code: "NOT_FOUND" });
    user.disabledAt = new Date();
    user.refreshTokenHash = null;
    await user.save();
    res.json({ user: toPublicUser(user), disabled: true });
  } catch (err) {
    next(err);
  }
}

// PATCH /admin/users/:id/status { disabled } — deactivate or reactivate.
export async function setUserStatus(req, res, next) {
  try {
    const { disabled } = req.body ?? {};
    if (typeof disabled !== "boolean") {
      throw new AppError("disabled (boolean) is required", { code: "VALIDATION_ERROR" });
    }
    if (disabled && String(req.params.id) === String(req.auth.userId)) {
      throw new AppError("You cannot deactivate your own account", {
        statusCode: 400,
        code: "SELF_DEACTIVATION",
      });
    }
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError("User not found", { statusCode: 404, code: "NOT_FOUND" });
    user.disabledAt = disabled ? new Date() : null;
    if (disabled) user.refreshTokenHash = null;
    await user.save();
    res.json({ user: toPublicUser(user), disabled });
  } catch (err) {
    next(err);
  }
}

// GET /admin/mistake-categories
export async function listMistakeCategories(req, res, next) {
  try {
    const categories = await MistakeCategory.find({}).sort({ key: 1 });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

// POST /admin/mistake-categories — upsert by key (create or update).
export async function upsertMistakeCategory(req, res, next) {
  try {
    const { key, label, appliesTo, bodyRegion, severityWeight, correctiveCue, isActive } =
      req.body ?? {};
    if (!key || !label || !bodyRegion || severityWeight == null) {
      throw new AppError("key, label, bodyRegion and severityWeight are required", {
        code: "VALIDATION_ERROR",
      });
    }
    if (!BODY_REGIONS.includes(bodyRegion)) {
      throw new AppError(`bodyRegion must be one of: ${BODY_REGIONS.join(", ")}`, {
        code: "VALIDATION_ERROR",
      });
    }
    const sw = Number(severityWeight);
    if (!Number.isFinite(sw) || sw < 1 || sw > 5) {
      throw new AppError("severityWeight must be between 1 and 5", { code: "VALIDATION_ERROR" });
    }
    const category = await MistakeCategory.findOneAndUpdate(
      { key: String(key).trim() },
      {
        $set: {
          label: String(label).trim(),
          appliesTo: Array.isArray(appliesTo) ? appliesTo.map(String) : [],
          bodyRegion,
          severityWeight: sw,
          correctiveCue: String(correctiveCue ?? "").trim(),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ category });
  } catch (err) {
    next(err);
  }
}
