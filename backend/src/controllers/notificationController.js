import { Notification } from "../models/Notification.js";
import { AppError } from "../middlewares/errorHandler.js";

// GET /notifications?unread=true&page=
export async function listNotifications(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
    const skip = (page - 1) * limit;
    const filter = { userId: req.auth.userId };
    if (req.query.unread === "true") filter.read = false;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.auth.userId, read: false }),
    ]);

    res.json({
      notifications: items,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /notifications/:id/read
export async function markRead(req, res, next) {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.auth.userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!n) throw new AppError("Notification not found", { statusCode: 404, code: "NOT_FOUND" });
    res.json({ notification: n });
  } catch (err) {
    next(err);
  }
}

// PATCH /notifications/read-all
export async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { userId: req.auth.userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// DELETE /notifications/:id
export async function deleteNotification(req, res, next) {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.auth.userId });
    if (!n) throw new AppError("Notification not found", { statusCode: 404, code: "NOT_FOUND" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// DELETE /notifications — clear all of mine
export async function clearAll(req, res, next) {
  try {
    const { deletedCount } = await Notification.deleteMany({ userId: req.auth.userId });
    res.json({ ok: true, deleted: deletedCount ?? 0 });
  } catch (err) {
    next(err);
  }
}
