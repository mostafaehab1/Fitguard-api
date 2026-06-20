import mongoose from "mongoose";

export const ROLES = ["user", "coach", "admin"];
export const GENDERS = ["Male", "Female"];
export const GOALS = ["Weight Loss", "Muscle Building", "Improve Fitness", "Maintain"];
export const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"];
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
// Body regions: used for user limitations and MistakeCategory.bodyRegion.
export const BODY_REGIONS = [
  "Knee",
  "Shoulder",
  "Lower back",
  "Wrist",
  "Elbow",
  "Hip",
  "Neck",
];

// Profile fields are NOT required at the DB level: a user is created at
// registration with email+password only, then completes the profile during
// onboarding (POST /users/me/onboarding), which enforces required-ness.
const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    age: { type: Number, min: 8, max: 110 },
    heightCm: { type: Number, min: 80, max: 260 },
    weightKg: { type: Number, min: 20, max: 350 },
    mealsPerDay: { type: Number, min: 1, max: 12 },
    daysPerWeek: { type: Number, min: 1, max: 7 },
    gender: { type: String, enum: GENDERS },
    goal: { type: String, enum: GOALS },
    experienceLevel: { type: String, enum: EXPERIENCE_LEVELS },
    activityLevel: { type: String, enum: ACTIVITY_LEVELS },
    dietaryPreference: { type: String, enum: DIETARY_PREFERENCES },
    limitations: { type: [{ type: String, enum: BODY_REGIONS }], default: [] },
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
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "user" },
    profile: { type: ProfileSchema, default: () => ({}) },

    onboardingCompletedAt: { type: Date, default: null },
    disclaimerAcceptedAt: { type: Date, default: null },

    activePlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlanAssignment",
      default: null,
    },
    activeSubscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },

    emailVerifiedAt: { type: Date, default: null },
    emailVerificationToken: { type: String, default: null, select: false },
    emailVerificationTokenExpiresAt: { type: Date, default: null, select: false },
    resetToken: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
