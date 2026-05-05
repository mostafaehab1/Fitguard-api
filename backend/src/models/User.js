import mongoose from "mongoose";

export const ROLES = ["user", "trainer", "admin"];
// Public API alias: expose "trainer" as "coach" in responses.
export const GENDERS = ["Male", "Female"];
export const GOALS = ["Muscle Building", "Weight Loss", "Maintain"];
export const ACTIVITY_LEVELS = [
  "Sedentary",
  "Light",
  "Moderate",
  "Active",
  "Very Active",
];
export const DIETARY_PREFERENCES = [
  "No restriction",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Low-carb",
];

const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    age: { type: Number, min: 8, max: 110, required: true },
    heightCm: { type: Number, min: 80, max: 260, required: true },
    weightKg: { type: Number, min: 20, max: 350, required: true },
    mealsPerDay: { type: Number, min: 1, max: 12, required: true },
    gender: { type: String, enum: GENDERS, required: true },
    goal: { type: String, enum: GOALS, required: true },
    activityLevel: { type: String, enum: ACTIVITY_LEVELS, required: true },
    dietaryPreference: { type: String, enum: DIETARY_PREFERENCES, required: true },
    foodDislikes: { type: String, trim: true, default: "" },
    healthConditions: { type: String, trim: true, default: "" },
    allergies: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "user" },
    profile: { type: ProfileSchema, default: () => ({}) },
    emailVerifiedAt: { type: Date, default: null },
    resetToken: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
    emailVerificationToken: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

export const User =
  mongoose.models.User ?? mongoose.model("User", userSchema);
