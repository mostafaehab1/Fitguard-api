import mongoose from "mongoose";

const mistakeItemSchema = new mongoose.Schema(
  {
    categoryKey: { type: String, required: true, trim: true },
    count: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const effortSchema = new mongoose.Schema(
  {
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise" },
    exerciseName: { type: String, trim: true },
    trackedKey: { type: String, trim: true, default: null },
    tracked: { type: Boolean, required: true },
    setsCompleted: { type: Number, min: 0, default: 0 },
    totalReps: { type: Number, min: 0, default: 0 },
    correctReps: { type: Number, min: 0, default: 0 },
    wrongReps: { type: Number, min: 0, default: 0 },
    accuracy: { type: Number, min: 0, max: 1, default: 0 }, // derived, server-computed
    mistakes: { type: [mistakeItemSchema], default: [] },
  },
  { _id: false }
);

const summarySchema = new mongoose.Schema(
  {
    totalReps: { type: Number, default: 0 },
    correctReps: { type: Number, default: 0 },
    wrongReps: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    mistakeBreakdown: { type: [mistakeItemSchema], default: [] },
  },
  { _id: false }
);

const workoutSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlanAssignment",
      default: null,
    },
    dayFocus: { type: String, trim: true, default: "" },
    source: { type: String, enum: ["device_cv", "manual"], required: true },
    status: {
      type: String,
      enum: ["in_progress", "completed", "aborted"],
      default: "completed",
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, required: true, default: () => new Date() },
    durationSec: { type: Number, min: 0, default: 0 },

    efforts: { type: [effortSchema], default: [] },
    // denormalized totals (computed server-side, never client-set)
    summary: { type: summarySchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Supports progress history and the injury-risk window query.
workoutSessionSchema.index({ userId: 1, endedAt: -1 });

export const WorkoutSession =
  mongoose.models.WorkoutSession ??
  mongoose.model("WorkoutSession", workoutSessionSchema);
