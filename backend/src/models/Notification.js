import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "email_verification",
  "coach_approved",
  "coach_rejected",
  "subscription_activated",
  "subscription_expiring",
  "subscription_expired",
  "plan_updated",
  "risk_alert",
];

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, trim: true, required: true },
    body: { type: String, trim: true, default: "" },
    channels: { type: [{ type: String, enum: ["email", "in_app"] }], default: ["in_app"] },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Notification =
  mongoose.models.Notification ??
  mongoose.model("Notification", notificationSchema);
