import mongoose from "mongoose";
import { BODY_REGIONS } from "./User.js";

// Canonical taxonomy of form mistakes. Owns the severity weight that feeds the
// injury-risk engine and the corrective cue shown to the user.
const mistakeCategorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true }, // "knee_valgus"
    label: { type: String, required: true, trim: true }, // "Knees collapsing inward"
    appliesTo: { type: [String], default: [] }, // Exercise.trackedKey values
    bodyRegion: { type: String, enum: BODY_REGIONS, required: true },
    severityWeight: { type: Number, required: true, min: 1, max: 5 },
    correctiveCue: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const MistakeCategory =
  mongoose.models.MistakeCategory ??
  mongoose.model("MistakeCategory", mistakeCategorySchema);
