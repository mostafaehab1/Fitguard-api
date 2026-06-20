import { Exercise, EXERCISE_TYPES } from "../models/Exercise.js";
import { AppError } from "../middlewares/errorHandler.js";

function applyExerciseFields(ex, body) {
  if (body.category !== undefined) ex.category = String(body.category).trim();
  if (body.muscleGroups !== undefined) {
    ex.muscleGroups = Array.isArray(body.muscleGroups) ? body.muscleGroups.map(String) : [];
  }
  if (body.trackedKey !== undefined) {
    ex.trackedKey = body.trackedKey ? String(body.trackedKey).trim() : null;
  }
  if (body.supportedMistakes !== undefined) {
    ex.supportedMistakes = Array.isArray(body.supportedMistakes)
      ? body.supportedMistakes.map(String)
      : [];
  }
  if (body.cvThresholds !== undefined) ex.cvThresholds = body.cvThresholds;
  if (body.demoMediaId !== undefined) ex.demoMediaId = body.demoMediaId || null;
}

// GET /exercises?type=&category=
export async function listExercises(req, res, next) {
  try {
    const filter = { isActive: true };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    const items = await Exercise.find(filter).sort({ name: 1 });
    res.json({ exercises: items });
  } catch (err) {
    next(err);
  }
}

// GET /exercises/cv-config — thresholds for the on-device CV, keyed by trackedKey.
export async function getCvConfig(req, res, next) {
  try {
    const exercises = await Exercise.find({
      isActive: true,
      type: "tracked",
      trackedKey: { $ne: null },
    })
      .select("trackedKey cvThresholds")
      .lean();
    const config = {};
    for (const e of exercises) {
      config[e.trackedKey] = e.cvThresholds ?? {};
    }
    res.json({ config });
  } catch (err) {
    next(err);
  }
}

export async function createExercise(req, res, next) {
  try {
    const { name, type, instructions } = req.body ?? {};
    if (!name || !type || !instructions) {
      throw new AppError("name, type and instructions are required", { code: "VALIDATION_ERROR" });
    }
    if (!EXERCISE_TYPES.includes(type)) {
      throw new AppError("type must be tracked or guided", { code: "VALIDATION_ERROR" });
    }
    const ex = new Exercise({
      name: String(name).trim(),
      type,
      instructions: String(instructions).trim(),
    });
    applyExerciseFields(ex, req.body);
    await ex.save();
    res.status(201).json({ exercise: ex });
  } catch (err) {
    next(err);
  }
}

export async function getExerciseById(req, res, next) {
  try {
    const ex = await Exercise.findById(req.params.id);
    if (!ex) throw new AppError("Exercise not found", { statusCode: 404, code: "NOT_FOUND" });
    res.json({ exercise: ex });
  } catch (err) {
    next(err);
  }
}

export async function updateExercise(req, res, next) {
  try {
    const ex = await Exercise.findById(req.params.id);
    if (!ex) throw new AppError("Exercise not found", { statusCode: 404, code: "NOT_FOUND" });
    const { name, type, instructions, isActive } = req.body ?? {};
    if (name !== undefined) ex.name = String(name).trim();
    if (type !== undefined) {
      if (!EXERCISE_TYPES.includes(type)) {
        throw new AppError("type must be tracked or guided", { code: "VALIDATION_ERROR" });
      }
      ex.type = type;
    }
    if (instructions !== undefined) ex.instructions = String(instructions).trim();
    if (isActive !== undefined) ex.isActive = Boolean(isActive);
    applyExerciseFields(ex, req.body);
    await ex.save();
    res.json({ exercise: ex });
  } catch (err) {
    next(err);
  }
}
