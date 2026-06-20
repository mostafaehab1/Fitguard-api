import mongoose from "mongoose";
import { WorkoutSession } from "../models/WorkoutSession.js";
import { InjuryRiskProfile } from "../models/InjuryRiskProfile.js";
import { InjuryRiskSnapshot } from "../models/InjuryRiskSnapshot.js";
import { riskConfig } from "../config/riskConfig.js";

// GET /progress/summary — aggregates over ALL sessions (overall, not per page).
export async function getSummary(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.auth.userId);
    const match = { userId };
    if (req.query.from) match.endedAt = { $gte: new Date(req.query.from) };
    if (req.query.to) match.endedAt = { ...(match.endedAt ?? {}), $lte: new Date(req.query.to) };

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const [totals, topMistakes, last7] = await Promise.all([
      WorkoutSession.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalReps: { $sum: "$summary.totalReps" },
            correctReps: { $sum: "$summary.correctReps" },
            wrongReps: { $sum: "$summary.wrongReps" },
            completedWorkouts: { $sum: 1 },
          },
        },
      ]),
      WorkoutSession.aggregate([
        { $match: match },
        { $unwind: "$summary.mistakeBreakdown" },
        {
          $group: {
            _id: "$summary.mistakeBreakdown.categoryKey",
            count: { $sum: "$summary.mistakeBreakdown.count" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      WorkoutSession.countDocuments({ ...match, endedAt: { $gte: sevenDaysAgo } }),
    ]);

    const t = totals[0] ?? { totalReps: 0, correctReps: 0, wrongReps: 0, completedWorkouts: 0 };
    const accuracy = t.totalReps > 0 ? Number((t.correctReps / t.totalReps).toFixed(3)) : 0;

    res.json({
      summary: {
        totalReps: t.totalReps,
        correctReps: t.correctReps,
        wrongReps: t.wrongReps,
        accuracy,
        completedWorkouts: t.completedWorkouts,
        workoutsLast7Days: last7,
        topMistakes: topMistakes.map((m) => ({ categoryKey: m._id, count: m.count })),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /progress/risk — current injury-risk profile (or insufficient_data).
export async function getRisk(req, res, next) {
  try {
    const profile = await InjuryRiskProfile.findOne({ userId: req.auth.userId }).lean();
    if (!profile || (profile.sessionsConsidered ?? 0) < riskConfig.minSessions) {
      res.json({
        status: "insufficient_data",
        minSessions: riskConfig.minSessions,
        sessionsConsidered: profile?.sessionsConsidered ?? 0,
      });
      return;
    }
    res.json({ status: "ok", risk: profile });
  } catch (err) {
    next(err);
  }
}

// GET /progress/trends?metric=accuracy|risk&days=45 — time series for charts.
export async function getTrends(req, res, next) {
  try {
    const metric = req.query.metric === "accuracy" ? "accuracy" : "risk";
    const days = Math.min(Math.max(Number(req.query.days ?? 45), 1), 365);
    const since = new Date(Date.now() - days * 86400000);

    const snapshots = await InjuryRiskSnapshot.find({
      userId: req.auth.userId,
      takenAt: { $gte: since },
    })
      .sort({ takenAt: 1 })
      .lean();

    const series = snapshots.map((s) => ({
      takenAt: s.takenAt,
      value: metric === "accuracy" ? s.accuracy : s.overallScore,
    }));

    res.json({ metric, days, series });
  } catch (err) {
    next(err);
  }
}
