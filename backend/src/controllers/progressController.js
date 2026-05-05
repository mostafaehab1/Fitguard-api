import { Exercise } from "../models/Exercise.js";
import { WorkoutSession } from "../models/WorkoutSession.js";
import { AppError } from "../middlewares/errorHandler.js";

export async function createWorkoutSession(req, res, next) {
  try {
    const { exerciseId, totalReps, correctReps, wrongReps, mistakes } = req.body ?? {};
    if (!exerciseId) {
      throw new AppError("exerciseId is required", { code: "VALIDATION_ERROR" });
    }

    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
      throw new AppError("Exercise not found", { statusCode: 404, code: "NOT_FOUND" });
    }

    if ((Number(correctReps) || 0) + (Number(wrongReps) || 0) !== Number(totalReps)) {
      throw new AppError("correctReps + wrongReps must equal totalReps", {
        code: "VALIDATION_ERROR",
      });
    }

    const session = await WorkoutSession.create({
      userId: req.auth.userId,
      exerciseId,
      tracked: exercise.type === "tracked",
      totalReps,
      correctReps,
      wrongReps,
      mistakes: Array.isArray(mistakes) ? mistakes : [],
      sessionAt: new Date(),
    });

    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

export async function getMyProgress(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
    const skip = (page - 1) * limit;

    const filter = { userId: req.auth.userId };
    if (req.query.from) filter.sessionAt = { $gte: new Date(req.query.from) };
    if (req.query.to) filter.sessionAt = { ...(filter.sessionAt ?? {}), $lte: new Date(req.query.to) };

    const [sessions, total] = await Promise.all([
      WorkoutSession.find(filter)
        .populate("exerciseId", "name type")
        .sort({ sessionAt: -1 })
        .skip(skip)
        .limit(limit),
      WorkoutSession.countDocuments(filter),
    ]);

    const summary = sessions.reduce(
      (acc, s) => {
        acc.totalReps += s.totalReps;
        acc.correctReps += s.correctReps;
        acc.wrongReps += s.wrongReps;
        return acc;
      },
      { totalReps: 0, correctReps: 0, wrongReps: 0 }
    );
    const accuracy =
      summary.totalReps > 0 ? Number((summary.correctReps / summary.totalReps).toFixed(3)) : 0;

    res.json({
      summary: { ...summary, accuracy },
      sessions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSessionById(req, res, next) {
  try {
    const { id } = req.params;
    const session = await WorkoutSession.findById(id).populate(
      "exerciseId",
      "name type instructions"
    );
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
