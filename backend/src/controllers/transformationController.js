import { Transformation } from "../models/Transformation.js";
import { AppError } from "../middlewares/errorHandler.js";

// GET /coaches/:id/transformations (public)
export async function listTransformations(req, res, next) {
  try {
    const items = await Transformation.find({ coachId: req.params.id, isPublic: true }).sort({
      createdAt: -1,
    });
    res.json({ transformations: items });
  } catch (err) {
    next(err);
  }
}

// POST /coaches/me/transformations (coach)
export async function createTransformation(req, res, next) {
  try {
    const { title, description, beforeMediaId, afterMediaId, durationWeeks } = req.body ?? {};
    if (!title) throw new AppError("title is required", { code: "VALIDATION_ERROR" });
    const t = await Transformation.create({
      coachId: req.auth.userId,
      title: String(title).trim(),
      description: String(description ?? "").trim(),
      beforeMediaId: beforeMediaId || null,
      afterMediaId: afterMediaId || null,
      durationWeeks: Number(durationWeeks) || 0,
    });
    res.status(201).json({ transformation: t });
  } catch (err) {
    next(err);
  }
}

// DELETE /coaches/me/transformations/:id — owning coach or admin.
export async function deleteTransformation(req, res, next) {
  try {
    const t = await Transformation.findById(req.params.id);
    if (!t) throw new AppError("Transformation not found", { statusCode: 404, code: "NOT_FOUND" });
    if (String(t.coachId) !== String(req.auth.userId) && req.auth.role !== "admin") {
      throw new AppError("Forbidden", { statusCode: 403, code: "FORBIDDEN" });
    }
    await t.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
