// Scheduled lifecycle jobs (docs/06 §6.4). Idempotent.
import cron from "node-cron";
import { env } from "../config.js";
import { Subscription } from "../models/Subscription.js";
import { PlanAssignment } from "../models/PlanAssignment.js";
import { User } from "../models/User.js";
import { setActivePlan, generateAndActivateAiPlan } from "./planService.js";
import { notify } from "./notificationService.js";

// Expire due subscriptions and revert the user from coach plans back to AI plans.
export async function expireSubscriptions(now = new Date()) {
  const due = await Subscription.find({ status: "active", endDate: { $lte: now } });
  for (const sub of due) {
    sub.status = "expired";
    await sub.save();
    await User.findByIdAndUpdate(sub.userId, { $set: { activeSubscriptionId: null } });

    const active = await PlanAssignment.findOne({ userId: sub.userId, active: true });
    if (!active || active.source === "coach") {
      const latestAi = await PlanAssignment.findOne({ userId: sub.userId, source: "ai" }).sort({
        createdAt: -1,
      });
      if (latestAi) {
        await setActivePlan(sub.userId, latestAi._id);
      } else {
        try {
          await generateAndActivateAiPlan(sub.userId);
        } catch {
          /* profile incomplete — nothing to revert to */
        }
      }
    }
    await notify(sub.userId, "subscription_expired", {
      title: "Your coach subscription ended",
      body: "You're back on AI-generated plans. You can subscribe to a coach again anytime.",
      metadata: { coachId: sub.coachId },
    });
  }
  return due.length;
}

// Remind users whose subscription expires within 3 days (once each).
export async function sendExpiryReminders(now = new Date()) {
  const soon = new Date(now.getTime() + 3 * 86400000);
  const due = await Subscription.find({
    status: "active",
    endDate: { $gt: now, $lte: soon },
    expiryReminderSentAt: null,
  });
  for (const sub of due) {
    await notify(sub.userId, "subscription_expiring", {
      title: "Your coach subscription is ending soon",
      body: "Your subscription ends within 3 days. Renew to keep your coach's plans.",
      metadata: { coachId: sub.coachId, endDate: sub.endDate },
    });
    sub.expiryReminderSentAt = now;
    await sub.save();
  }
  return due.length;
}

let started = false;
export function startScheduler() {
  if (started) return;
  started = true;
  cron.schedule("0 * * * *", () => {
    expireSubscriptions().catch((e) => console.error("[job:expireSubscriptions]", e.message));
  });
  cron.schedule("0 9 * * *", () => {
    sendExpiryReminders().catch((e) => console.error("[job:expiryReminders]", e.message));
  });
  // Keep the AI plan service warm while the backend is awake (free HF Spaces sleep
  // when idle, causing a slow cold-start on the next plan request).
  if (env.aiService?.url) {
    cron.schedule("*/4 * * * *", () => {
      fetch(`${env.aiService.url}/health`).catch(() => {});
    });
  }
  console.log("[scheduler] lifecycle jobs scheduled (expire hourly, reminders daily 09:00)");
}
