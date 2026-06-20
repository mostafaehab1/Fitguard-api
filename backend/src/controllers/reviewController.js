import mongoose from "mongoose";
import { Review } from "../models/Review.js";
import { Subscription } from "../models/Subscription.js";
import { CoachProfile } from "../models/CoachProfile.js";
import { AppError } from "../middlewares/errorHandler.js";

async function recomputeCoachRating(coachId) {
  const [agg] = await Review.aggregate([
    { $match: { coachId: new mongoose.Types.ObjectId(String(coachId)) } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await CoachProfile.findOneAndUpdate(
    { userId: coachId },
    { $set: { ratingAvg: agg ? Number(agg.avg.toFixed(2)) : 0, ratingCount: agg ? agg.count : 0 } }
  );
}

// GET /coaches/:id/reviews (public)
export async function listReviews(req, res, next) {
  try {
    const reviews = await Review.find({ coachId: req.params.id, isPublic: true })
      .sort({ createdAt: -1 })
      .populate("userId", "profile.name");
    res.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        author: r.userId?.profile?.name ?? "FitGuard user",
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /coaches/:id/reviews — subscription is derived by the backend (item 3).
export async function createReview(req, res, next) {
  try {
    const coachId = req.params.id;
    const { rating, comment } = req.body ?? {};
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      throw new AppError("rating must be between 1 and 5", { code: "VALIDATION_ERROR" });
    }

    const subs = await Subscription.find({
      userId: req.auth.userId,
      coachId,
      status: { $in: ["active", "expired"] },
    }).sort({ startDate: -1 });
    if (subs.length === 0) {
      throw new AppError("You have not subscribed to this coach", {
        statusCode: 403,
        code: "NOT_SUBSCRIBED",
      });
    }

    let target = null;
    for (const s of subs) {
      const existing = await Review.findOne({ userId: req.auth.userId, subscriptionId: s._id });
      if (!existing) {
        target = s;
        break;
      }
    }
    if (!target) {
      throw new AppError("You have already reviewed your subscription(s) with this coach", {
        statusCode: 409,
        code: "ALREADY_REVIEWED",
      });
    }

    const review = await Review.create({
      userId: req.auth.userId,
      coachId,
      subscriptionId: target._id,
      rating: r,
      comment: String(comment ?? "").trim(),
    });
    await recomputeCoachRating(coachId);
    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
}

// DELETE /coaches/:id/reviews/:reviewId — author or admin.
export async function deleteReview(req, res, next) {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) throw new AppError("Review not found", { statusCode: 404, code: "NOT_FOUND" });
    const isOwner = String(review.userId) === String(req.auth.userId);
    if (!isOwner && req.auth.role !== "admin") {
      throw new AppError("Forbidden", { statusCode: 403, code: "FORBIDDEN" });
    }
    const { coachId } = review;
    await review.deleteOne();
    await recomputeCoachRating(coachId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
