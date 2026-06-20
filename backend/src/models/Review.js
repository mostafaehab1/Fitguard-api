import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    }, // author (athlete)
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, default: "" },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One review per subscription period — enforced at the database level.
reviewSchema.index({ userId: 1, subscriptionId: 1 }, { unique: true });

export const Review =
  mongoose.models.Review ?? mongoose.model("Review", reviewSchema);
