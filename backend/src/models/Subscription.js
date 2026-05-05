import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true, default: () => new Date() },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "cancelled", "expired"],
      default: "active",
      index: true,
    },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Subscription =
  mongoose.models.Subscription ?? mongoose.model("Subscription", subscriptionSchema);
