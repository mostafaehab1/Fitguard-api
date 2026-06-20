import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import * as notifications from "../controllers/notificationController.js";

const router = Router();

router.get("/", authMiddleware, notifications.listNotifications);
router.patch("/read-all", authMiddleware, notifications.markAllRead);
router.patch("/:id/read", authMiddleware, notifications.markRead);
router.delete("/:id", authMiddleware, notifications.deleteNotification);
router.delete("/", authMiddleware, notifications.clearAll);

export default router;
