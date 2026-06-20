import mongoose from "mongoose";

export const EXERCISE_TYPES = ["tracked", "guided"];

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: EXERCISE_TYPES, required: true, index: true },
    category: { type: String, trim: true, default: "" }, // e.g. "Legs","Push","Pull","Core"
    muscleGroups: { type: [String], default: [] },
    instructions: { type: String, required: true, trim: true },
    demoMediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MediaAsset",
      default: null,
    },

    // tracked-only — the shared vocabulary with the on-device CV model
    trackedKey: { type: String, trim: true, default: null }, // e.g. "bodyweight_squat"
    supportedMistakes: { type: [String], default: [] }, // MistakeCategory.key values
    // per-exercise CV tuning, seeded from AI/configs/exercise_config.py; served by
    // GET /exercises/cv-config
    cvThresholds: { type: mongoose.Schema.Types.Mixed, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// trackedKey is unique among exercises that have one. Partial filter (string type)
// so the many guided exercises with null trackedKey don't collide.
exerciseSchema.index(
  { trackedKey: 1 },
  { unique: true, partialFilterExpression: { trackedKey: { $type: "string" } } }
);

export const Exercise =
  mongoose.models.Exercise ?? mongoose.model("Exercise", exerciseSchema);
