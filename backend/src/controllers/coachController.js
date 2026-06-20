import mongoose from "mongoose";
import { CoachApplication } from "../models/CoachApplication.js";
import { CoachProfile } from "../models/CoachProfile.js";
import { Subscription } from "../models/Subscription.js";
import { Transformation } from "../models/Transformation.js";
import { User } from "../models/User.js";
import { InjuryRiskProfile } from "../models/InjuryRiskProfile.js";
import { WorkoutSession } from "../models/WorkoutSession.js";
import { AppError } from "../middlewares/errorHandler.js";
import { notify } from "../services/notificationService.js";

// POST /coaches/applications (user)
export async function applyForCoach(req, res, next) {
  try {
    const { bio, specialties, yearsExperience, governmentIdMediaId, certificationMediaIds, applicantNote } =
      req.body ?? {};
    const existing = await CoachApplication.findOne({ userId: req.auth.userId });
    if (existing && existing.status === "pending") {
      throw new AppError("You already have a pending application", {
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
          yearsExperience: Number(yearsExperience) || 0,
          governmentIdMediaId: governmentIdMediaId || null,
          certificationMediaIds: Array.isArray(certificationMediaIds) ? certificationMediaIds : [],
          applicantNote: String(applicantNote ?? "").trim(),
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

// GET /admin/coach-applications?status=pending (admin)
export async function listApplications(req, res, next) {
  try {
    const status = req.query.status ? String(req.query.status) : "pending";
    const items = await CoachApplication.find({ status })
      .sort({ createdAt: 1 })
      .populate("userId", "email profile");
    res.json({ applications: items });
  } catch (err) {
    next(err);
  }
}

// PATCH /admin/coach-applications/:id (admin) { decision, note }
export async function decideApplication(req, res, next) {
  try {
    const { decision, note } = req.body ?? {};
    if (!["approved", "rejected"].includes(decision)) {
      throw new AppError("decision must be approved or rejected", { code: "VALIDATION_ERROR" });
    }
    const app = await CoachApplication.findById(req.params.id);
    if (!app) throw new AppError("Application not found", { statusCode: 404, code: "NOT_FOUND" });

    app.status = decision;
    app.decisionNote = String(note ?? "").trim();
    app.reviewedBy = req.auth.userId;
    app.reviewedAt = new Date();
    await app.save();

    if (decision === "approved") {
      await User.findByIdAndUpdate(app.userId, { $set: { role: "coach" } });
      await CoachProfile.findOneAndUpdate(
        { userId: app.userId },
        {
          $set: {
            userId: app.userId,
            bio: app.bio ?? "",
            specialties: app.specialties ?? [],
            yearsExperience: app.yearsExperience ?? 0,
            certifications: (app.certificationMediaIds ?? []).map((mediaId) => ({ mediaId })),
            isPublic: true,
          },
        },
        { upsert: true, new: true }
      );
      await notify(app.userId, "coach_approved", {
        title: "You're an approved FitGuard coach",
        body: "Your coach profile is now public and you can build plans for subscribers.",
      });
    } else {
      await User.findByIdAndUpdate(app.userId, { $set: { role: "user" } });
      await notify(app.userId, "coach_rejected", {
        title: "Coach application update",
        body: app.decisionNote || "Your coach application was not approved.",
        metadata: { note: app.decisionNote },
      });
    }
    res.json({ application: app });
  } catch (err) {
    next(err);
  }
}

// GET /coaches (public directory)
export async function listPublicCoaches(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
    const skip = (page - 1) * limit;
    const filter = { isPublic: true };
    if (req.query.specialty) filter.specialties = req.query.specialty;

    const [profiles, total] = await Promise.all([
      CoachProfile.find(filter)
        .sort({ ratingAvg: -1, ratingCount: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "email profile.name createdAt"),
      CoachProfile.countDocuments(filter),
    ]);

    res.json({
      coaches: profiles.map((p) => ({
        id: p.userId?._id,
        name: p.userId?.profile?.name ?? null,
        bio: p.bio,
        specialties: p.specialties,
        areasOfExpertise: p.areasOfExpertise,
        yearsExperience: p.yearsExperience,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        profileImageId: p.profileImageId,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

// GET /coaches/:id (public)
export async function getCoachById(req, res, next) {
  try {
    const profile = await CoachProfile.findOne({ userId: req.params.id, isPublic: true }).populate(
      "userId",
      "email profile.name createdAt"
    );
    if (!profile) throw new AppError("Coach not found", { statusCode: 404, code: "NOT_FOUND" });
    const transformations = await Transformation.find({
      coachId: req.params.id,
      isPublic: true,
    }).sort({ createdAt: -1 });

    res.json({
      coach: {
        id: profile.userId?._id,
        name: profile.userId?.profile?.name ?? null,
        bio: profile.bio,
        specialties: profile.specialties,
        areasOfExpertise: profile.areasOfExpertise,
        yearsExperience: profile.yearsExperience,
        certifications: profile.certifications,
        ratingAvg: profile.ratingAvg,
        ratingCount: profile.ratingCount,
        profileImageId: profile.profileImageId,
        memberSince: profile.userId?.createdAt,
      },
      transformations,
    });
  } catch (err) {
    next(err);
  }
}

// GET /coaches/me/profile (coach)
export async function getMyProfile(req, res, next) {
  try {
    const profile = await CoachProfile.findOne({ userId: req.auth.userId });
    if (!profile) throw new AppError("No coach profile found", { statusCode: 404, code: "NOT_FOUND" });
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

// PATCH /coaches/me/profile (coach)
export async function updateCoachProfile(req, res, next) {
  try {
    const { bio, specialties, areasOfExpertise, yearsExperience, profileImageId } = req.body ?? {};
    const profile = await CoachProfile.findOne({ userId: req.auth.userId });
    if (!profile) throw new AppError("No coach profile found", { statusCode: 404, code: "NOT_FOUND" });

    if (bio !== undefined) profile.bio = String(bio).trim().slice(0, 1000);
    if (Array.isArray(specialties)) {
      profile.specialties = specialties.map((s) => String(s).trim()).filter(Boolean);
    }
    if (Array.isArray(areasOfExpertise)) {
      profile.areasOfExpertise = areasOfExpertise.map((s) => String(s).trim()).filter(Boolean);
    }
    if (yearsExperience !== undefined) profile.yearsExperience = Number(yearsExperience) || 0;
    if (profileImageId !== undefined) profile.profileImageId = profileImageId || null;
    await profile.save();
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

// GET /coaches/me/subscribers (coach)
export async function getMySubscribers(req, res, next) {
  try {
    const subs = await Subscription.find({
      coachId: req.auth.userId,
      status: "active",
      endDate: { $gt: new Date() },
    }).populate("userId", "email profile.name");
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

// GET /coaches/me/subscribers/:userId/progress (coach) — read-only.
export async function getSubscriberProgress(req, res, next) {
  try {
    const { userId } = req.params;
    const sub = await Subscription.findOne({
      userId,
      coachId: req.auth.userId,
      status: "active",
      endDate: { $gt: new Date() },
    });
    if (!sub) throw new AppError("Not your active subscriber", { statusCode: 403, code: "NOT_SUBSCRIBED" });

    const [risk, totals] = await Promise.all([
      InjuryRiskProfile.findOne({ userId }).lean(),
      WorkoutSession.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
        {
          $group: {
            _id: null,
            totalReps: { $sum: "$summary.totalReps" },
            correctReps: { $sum: "$summary.correctReps" },
            completedWorkouts: { $sum: 1 },
          },
        },
      ]),
    ]);
    const t = totals[0] ?? { totalReps: 0, correctReps: 0, completedWorkouts: 0 };
    res.json({
      userId,
      risk: risk ?? null,
      summary: {
        totalReps: t.totalReps,
        correctReps: t.correctReps,
        accuracy: t.totalReps > 0 ? Number((t.correctReps / t.totalReps).toFixed(3)) : 0,
        completedWorkouts: t.completedWorkouts,
      },
    });
  } catch (err) {
    next(err);
  }
}
