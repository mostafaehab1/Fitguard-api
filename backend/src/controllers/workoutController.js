import { Exercise } from "../models/Exercise.js";
import { WorkoutSession } from "../models/WorkoutSession.js";
import { AppError } from "../middlewares/errorHandler.js";
import { recomputeUserRisk } from "../services/riskEngine.js";
import { notify } from "../services/notificationService.js";

// Resolves an effort's exercise by trackedKey (preferred) or exerciseId.
async function resolveExercise(effort) {
  if (effort.trackedKey) return Exercise.findOne({ trackedKey: effort.trackedKey });
  if (effort.exerciseId) return Exercise.findById(effort.exerciseId);
  return null;
}

// POST /workouts/sessions — submit a completed session (raw events only).
export async function submitSession(req, res, next) {
  try {
    const { planAssignmentId, dayFocus, source, startedAt, endedAt, efforts } = req.body ?? {};
    if (!Array.isArray(efforts) || efforts.length === 0) {
      throw new AppError("efforts must be a non-empty array", { code: "VALIDATION_ERROR" });
    }
    const src = source === "manual" ? "manual" : "device_cv";

    const processed = [];
    const breakdown = new Map();
    let tTotal = 0;
    let tCorrect = 0;
    let tWrong = 0;

    for (const e of efforts) {
      const exercise = await resolveExercise(e);
      if (!exercise) {
        throw new AppError(`Unknown exercise: ${e.trackedKey ?? e.exerciseId}`, {
          statusCode: 404,
          code: "NOT_FOUND",
        });
      }
      const tracked = src === "device_cv" && exercise.type === "tracked" && e.tracked !== false;

      let totalReps = 0;
      let correctReps = 0;
      let wrongReps = 0;
      const mistakes = [];

      if (tracked) {
        correctReps = Number(e.correctReps) || 0;
        wrongReps = Number(e.wrongReps) || 0;
        // totalReps is optional: defaults to correct+wrong so the on-device CV
        // FormResult ({correctReps, wrongReps, mistakes}) submits as-is.
        totalReps = e.totalReps != null ? Number(e.totalReps) : correctReps + wrongReps;
        if (correctReps + wrongReps !== totalReps) {
          throw new AppError("correctReps + wrongReps must equal totalReps", {
            code: "VALIDATION_ERROR",
          });
        }
        const supported = new Set(exercise.supportedMistakes ?? []);
        for (const m of e.mistakes ?? []) {
          if (!supported.has(m.categoryKey)) {
            throw new AppError(
              `Mistake "${m.categoryKey}" is not valid for ${exercise.trackedKey}`,
              { code: "VALIDATION_ERROR" }
            );
          }
          mistakes.push({ categoryKey: m.categoryKey, count: Math.max(1, Number(m.count) || 1) });
        }
      }

      const accuracy = totalReps > 0 ? Number((correctReps / totalReps).toFixed(3)) : 0;
      processed.push({
        exerciseId: exercise._id,
        exerciseName: exercise.name,
        trackedKey: exercise.trackedKey ?? null,
        tracked,
        setsCompleted: Number(e.setsCompleted) || 0,
        totalReps,
        correctReps,
        wrongReps,
        accuracy,
        mistakes,
      });
      tTotal += totalReps;
      tCorrect += correctReps;
      tWrong += wrongReps;
      for (const m of mistakes) {
        breakdown.set(m.categoryKey, (breakdown.get(m.categoryKey) ?? 0) + m.count);
      }
    }

    const ended = endedAt ? new Date(endedAt) : new Date();
    const started = startedAt ? new Date(startedAt) : null;
    const durationSec =
      started && ended ? Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)) : 0;

    const session = await WorkoutSession.create({
      userId: req.auth.userId,
      planAssignmentId: planAssignmentId || null,
      dayFocus: dayFocus || "",
      source: src,
      status: "completed",
      startedAt: started,
      endedAt: ended,
      durationSec,
      efforts: processed,
      summary: {
        totalReps: tTotal,
        correctReps: tCorrect,
        wrongReps: tWrong,
        accuracy: tTotal > 0 ? Number((tCorrect / tTotal).toFixed(3)) : 0,
        mistakeBreakdown: [...breakdown].map(([categoryKey, count]) => ({ categoryKey, count })),
      },
    });

    // Recompute injury risk from raw events (server is the authority).
    let riskAlert = null;
    if (src === "device_cv") {
      const result = await recomputeUserRisk(req.auth.userId);
      riskAlert = result.riskAlert;
      if (riskAlert) {
        await notify(req.auth.userId, "risk_alert", {
          title: `Elevated ${riskAlert.region} injury risk`,
          body: `Your ${riskAlert.region.toLowerCase()} risk is now ${riskAlert.band}. ${riskAlert.cue}`,
          metadata: riskAlert,
        });
      }
    }

    res.status(201).json({ session, riskAlert });
  } catch (err) {
    next(err);
  }
}

// GET /workouts/sessions — paginated history.
export async function listSessions(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
    const skip = (page - 1) * limit;

    const filter = { userId: req.auth.userId };
    if (req.query.from) filter.endedAt = { $gte: new Date(req.query.from) };
    if (req.query.to) filter.endedAt = { ...(filter.endedAt ?? {}), $lte: new Date(req.query.to) };

    const [sessions, total] = await Promise.all([
      WorkoutSession.find(filter).sort({ endedAt: -1 }).skip(skip).limit(limit),
      WorkoutSession.countDocuments(filter),
    ]);

    res.json({
      sessions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

// GET /workouts/sessions/:id — one session (owner only).
export async function getSessionById(req, res, next) {
  try {
    const session = await WorkoutSession.findById(req.params.id);
    if (!session) {
      throw new AppError("Session not found", { statusCode: 404, code: "NOT_FOUND" });
    }
    if (String(session.userId) !== String(req.auth.userId)) {
      throw new AppError("Forbidden", { statusCode: 403, code: "FORBIDDEN" });
    }
    res.json({ session });
  } catch (err) {
    next(err);
  }
}
