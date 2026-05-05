import { CoachApplication } from "../models/CoachApplication.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { AppError } from "../middlewares/errorHandler.js";

export async function applyForCoach(req, res, next) {
  try {
    if (!req.auth?.userId) {
      throw new AppError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
    }
    const { bio, specialties } = req.body ?? {};
    const existing = await CoachApplication.findOne({ userId: req.auth.userId });
    if (existing && existing.status === "pending") {
      throw new AppError("Application already pending", {
        statusCode: 409,
        code: "APPLICATION_PENDING",
      });
    }

    const app = await CoachApplication.findOneAndUpdate(
      { userId: req.auth.userId },
      {
        $set: {
          bio: String(bio ?? "").trim(),
          specialties: Array.isArray(specialties)
            ? specialties.map((s) => String(s).trim()).filter(Boolean)
            : [],
          status: "pending",
          decisionNote: "",
          reviewedBy: null,
          reviewedAt: null,
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ application: app });
  } catch (err) {
    next(err);
  }
}

export async function listPublicCoaches(req, res, next) {
  try {
    const coaches = await User.find({ role: "trainer" }).select("email profile createdAt");
    const coachIds = coaches.map((c) => c._id);
    const applications = await CoachApplication.find({
      userId: { $in: coachIds },
      status: "approved",
    }).select("userId bio specialties");

    const appMap = {};
    for (const a of applications) {
      appMap[String(a.userId)] = a;
    }

    res.json({
      coaches: coaches.map((c) => {
        const app = appMap[String(c._id)];
        return {
          id: c.id,
          email: c.email,
          name: c.profile?.name ?? null,
          bio: app?.bio ?? null,
          specialties: app?.specialties ?? [],
          memberSince: c.createdAt,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}

export async function listApplications(req, res, next) {
  try {
    const items = await CoachApplication.find({ status: "pending" })
      .sort({ createdAt: 1 })
      .populate("userId", "email profile");
    res.json({ applications: items });
  } catch (err) {
    next(err);
  }
}

export async function decideApplication(req, res, next) {
  try {
    const { id } = req.params;
    const { decision, note } = req.body ?? {};
    if (!["approved", "rejected"].includes(decision)) {
      throw new AppError("decision must be approved or rejected", {
        code: "VALIDATION_ERROR",
      });
    }

    const app = await CoachApplication.findById(id);
    if (!app) {
      throw new AppError("Application not found", { statusCode: 404, code: "NOT_FOUND" });
    }

    app.status = decision;
    app.decisionNote = String(note ?? "").trim();
    app.reviewedBy = req.auth.userId;
    app.reviewedAt = new Date();
    await app.save();

    if (decision === "approved") {
      await User.findByIdAndUpdate(app.userId, { $set: { role: "trainer" } });
    }

    if (decision === "rejected") {
      await User.findByIdAndUpdate(app.userId, { $set: { role: "user" } });
    }

    res.json({ application: app });
  } catch (err) {
    next(err);
  }
}

export async function updateCoachProfile(req, res, next) {
  try {
    if (!req.auth?.userId) {
      throw new AppError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
    }
    const { bio, specialties } = req.body ?? {};
    if (bio !== undefined && typeof bio !== "string") {
      throw new AppError("bio must be a string", { code: "VALIDATION_ERROR" });
    }
    if (
      specialties !== undefined &&
      (!Array.isArray(specialties) || specialties.some((s) => typeof s !== "string"))
    ) {
      throw new AppError("specialties must be an array of strings", {
        code: "VALIDATION_ERROR",
      });
    }

    const app = await CoachApplication.findOne({
      userId: req.auth.userId,
      status: "approved",
    });
    if (!app) {
      throw new AppError("No approved coach profile found", {
        statusCode: 404,
        code: "NOT_FOUND",
      });
    }
    if (bio !== undefined) app.bio = String(bio).trim().slice(0, 500);
    if (Array.isArray(specialties)) {
      app.specialties = specialties.map((s) => String(s).trim()).filter(Boolean);
    }
    await app.save();
    res.json({ application: app });
  } catch (err) {
    next(err);
  }
}

export async function getCoachById(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "trainer" }).select("email profile createdAt");
    if (!user) {
      throw new AppError("Coach not found", { statusCode: 404, code: "NOT_FOUND" });
    }
    const application = await CoachApplication.findOne({
      userId: id,
      status: "approved",
    }).select("bio specialties");

    res.json({
      coach: {
        id: user.id,
        email: user.email,
        name: user.profile?.name ?? null,
        bio: application?.bio ?? null,
        specialties: application?.specialties ?? [],
        memberSince: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMySubscribers(req, res, next) {
  try {
    if (!req.auth?.userId) {
      throw new AppError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
    }
    const subs = await Subscription.find({
      coachId: req.auth.userId,
      status: "active",
      endDate: { $gt: new Date() },
    }).populate("userId", "email profile");

    res.json({
      subscribers: subs.map((s) => ({
        subscriptionId: s.id,
        userId: s.userId?._id,
        email: s.userId?.email ?? null,
        name: s.userId?.profile?.name ?? null,
        startDate: s.startDate,
        endDate: s.endDate,
      })),
    });
  } catch (err) {
    next(err);
  }
}
