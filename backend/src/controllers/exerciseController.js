import { Exercise } from "../models/Exercise.js";
import { AppError } from "../middlewares/errorHandler.js";

export async function listExercises(req, res, next) {
  try {
    const filter = { isActive: true };
    if (req.query.type) filter.type = req.query.type;
    const items = await Exercise.find(filter).sort({ name: 1 });
    res.json({ exercises: items });
  } catch (err) {
    next(err);
  }
}

export async function createExercise(req, res, next) {
  try {
    const { name, type, instructions } = req.body ?? {};
    if (!name || !type || !instructions) {
      throw new AppError("name, type and instructions are required", {
        code: "VALIDATION_ERROR",
      });
    }
    const ex = await Exercise.create({ name, type, instructions });
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
    const { name, type, instructions, isActive } = req.body ?? {};
    const ex = await Exercise.findById(req.params.id);
    if (!ex) throw new AppError("Exercise not found", { statusCode: 404, code: "NOT_FOUND" });
    if (name !== undefined) ex.name = String(name).trim();
    if (type !== undefined) {
      if (!["tracked", "guided"].includes(type)) {
        throw new AppError("type must be tracked or guided", { code: "VALIDATION_ERROR" });
      }
      ex.type = type;
    }
    if (instructions !== undefined) ex.instructions = String(instructions).trim();
    if (isActive !== undefined) ex.isActive = Boolean(isActive);
    await ex.save();
    res.json({ exercise: ex });
  } catch (err) {
    next(err);
  }
}
