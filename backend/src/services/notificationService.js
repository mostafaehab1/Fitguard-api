// Notification fan-out (docs/06 §6.6): writes an in-app Notification and, for
// email-worthy types, also sends an email (best-effort).
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { sendMail } from "./emailService.js";

const EMAIL_TYPES = new Set([
  "coach_approved",
  "coach_rejected",
  "subscription_activated",
  "subscription_expiring",
  "subscription_expired",
  "plan_updated",
]);

export async function notify(userId, type, { title, body = "", metadata = {} } = {}) {
  const channels = ["in_app"];
  const wantsEmail = EMAIL_TYPES.has(type);
  if (wantsEmail) channels.push("email");

  const notification = await Notification.create({
    userId,
    type,
    title,
    body,
    channels,
    metadata,
  });

  if (wantsEmail) {
    try {
      const user = await User.findById(userId).select("email").lean();
      if (user?.email) await sendMail({ to: user.email, subject: title, text: body });
    } catch (err) {
      console.warn(`[notify] email for ${type} failed:`, err.message);
    }
  }

  return notification;
}
