import mongoose from "mongoose";

// Append-only time-series for trend charts ("accuracy/risk over time").
const injuryRiskSnapshotSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    takenAt: { type: Date, required: true, default: () => new Date(), index: true },
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    byBodyRegion: {
      type: [
        new mongoose.Schema(
          { region: { type: String }, score: { type: Number } },
          { _id: false }
        ),
      ],
      default: [],
    },
    accuracy: { type: Number, min: 0, max: 1, default: 0 },
  },
  { timestamps: true }
);

export const InjuryRiskSnapshot =
  mongoose.models.InjuryRiskSnapshot ??
  mongoose.model("InjuryRiskSnapshot", injuryRiskSnapshotSchema);
