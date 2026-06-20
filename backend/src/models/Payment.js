import mongoose from "mongoose";

// Mock billing record — completes the freemium cycle without a real gateway.
// A real provider (Stripe) is a drop-in replacement at the `provider` boundary.
const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: ["succeeded", "failed", "refunded"],
      default: "succeeded",
    },
    provider: { type: String, default: "mock" },
    providerRef: { type: String, default: null },
  },
  { timestamps: true }
);

export const Payment =
  mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema);
