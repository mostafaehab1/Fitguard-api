import mongoose from "mongoose";

const workoutItemSchema = new mongoose.Schema(
  {
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise" },
    exerciseName: { type: String, trim: true }, // denormalized snapshot
    trackedKey: { type: String, trim: true },
    sets: { type: Number, min: 0 },
    reps: { type: String, trim: true }, // "8-12"
    restSeconds: { type: Number, min: 0 },
    intensity: { type: String, trim: true }, // "RPE 7" / "70% 1RM" / "Bodyweight"
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const workoutDaySchema = new mongoose.Schema(
  {
    dayOfWeek: { type: String, enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    focus: { type: String, trim: true }, // "Lower body"
    rest: { type: Boolean, default: false },
    items: { type: [workoutItemSchema], default: [] },
  },
  { _id: false }
);

const mealSchema = new mongoose.Schema(
  {
    meal: { type: String, trim: true },
    guidance: { type: String, trim: true },
    approxCalories: { type: Number, min: 0 },
  },
  { _id: false }
);

const workoutSchema = new mongoose.Schema(
  {
    weeklySchedule: { type: [workoutDaySchema], default: [] },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const nutritionSchema = new mongoose.Schema(
  {
    dailyCalories: { type: Number, min: 0 },
    protein_g: { type: Number, min: 0 },
    carbs_g: { type: Number, min: 0 },
    fat_g: { type: Number, min: 0 },
    hydrationLiters: { type: Number, min: 0 },
    mealStructure: { type: [mealSchema], default: [] },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const planAssignmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    source: { type: String, enum: ["ai", "coach"], required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, default: true, index: true },
    version: { type: Number, default: 1 },
    notes: { type: String, trim: true, default: "" },

    // provenance for AI-generated plans (reproducibility/defense)
    generatedBy: {
      model: { type: String, default: null },
      promptVersion: { type: String, default: null },
      generatedAt: { type: Date, default: null },
    },

    workout: { type: workoutSchema, default: () => ({}) },
    nutrition: { type: nutritionSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const PlanAssignment =
  mongoose.models.PlanAssignment ??
  mongoose.model("PlanAssignment", planAssignmentSchema);
