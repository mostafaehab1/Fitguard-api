import mongoose from "mongoose";

export const RISK_BANDS = ["low", "moderate", "elevated", "high"];
export const RISK_TRENDS = ["up", "down", "flat"];

const regionScoreSchema = new mongoose.Schema(
  {
    region: { type: String, required: true },
    score: { type: Number, min: 0, max: 100, required: true },
    band: { type: String, enum: RISK_BANDS, required: true },
    trend: { type: String, enum: RISK_TRENDS, default: "flat" },
    lastFlaggedAt: { type: Date, default: null },
  },
  { _id: false }
);

// DESCRIPTIVE breakdowns — NOT independently scored. `regionBand` mirrors the band
// of the contributing body region from byBodyRegion.
const exerciseBreakdownSchema = new mongoose.Schema(
  {
    trackedKey: { type: String, required: true },
    recentMistakeCount: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: null },
    regionBand: { type: String, enum: RISK_BANDS, default: "low" },
  },
  { _id: false }
);

const mistakeBreakdownSchema = new mongoose.Schema(
  {
    categoryKey: { type: String, required: true },
    recentCount: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: null },
    regionBand: { type: String, enum: RISK_BANDS, default: "low" },
  },
  { _id: false }
);

const injuryRiskProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    overall: {
      score: { type: Number, min: 0, max: 100, default: 0 },
      band: { type: String, enum: RISK_BANDS, default: "low" },
      trend: { type: String, enum: RISK_TRENDS, default: "flat" },
    },
    byBodyRegion: { type: [regionScoreSchema], default: [] }, // SCORED outputs
    byExercise: { type: [exerciseBreakdownSchema], default: [] }, // descriptive
    byMistakeCategory: { type: [mistakeBreakdownSchema], default: [] }, // descriptive
    sessionsConsidered: { type: Number, default: 0 },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const InjuryRiskProfile =
  mongoose.models.InjuryRiskProfile ??
  mongoose.model("InjuryRiskProfile", injuryRiskProfileSchema);
