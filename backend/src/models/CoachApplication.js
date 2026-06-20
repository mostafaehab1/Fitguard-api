import mongoose from "mongoose";

const coachApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    bio: { type: String, trim: true, maxlength: 1000 },
    specialties: [{ type: String, trim: true }],
    yearsExperience: { type: Number, min: 0, default: 0 },
    governmentIdMediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MediaAsset",
      default: null,
    },
    certificationMediaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset" }],
    applicantNote: { type: String, trim: true, default: "" },
    decisionNote: { type: String, trim: true, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A user may hold only ONE pending application at a time, but may re-apply after a
// rejection — so the uniqueness is partial (only pending docs).
coachApplicationSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export const CoachApplication =
  mongoose.models.CoachApplication ??
  mongoose.model("CoachApplication", coachApplicationSchema);
