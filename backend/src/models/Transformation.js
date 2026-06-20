import mongoose from "mongoose";

const transformationSchema = new mongoose.Schema(
  {
    coachId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: "" },
    beforeMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    afterMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    durationWeeks: { type: Number, min: 0, default: 0 },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Transformation =
  mongoose.models.Transformation ??
  mongoose.model("Transformation", transformationSchema);
