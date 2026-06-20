import mongoose from "mongoose";

const certificationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    issuer: { type: String, trim: true },
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset", default: null },
  },
  { _id: false }
);

const coachProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bio: { type: String, trim: true, maxlength: 1000, default: "" },
    specialties: { type: [String], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    yearsExperience: { type: Number, min: 0, default: 0 },
    areasOfExpertise: { type: [String], default: [] },
    profileImageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MediaAsset",
      default: null,
    },

    // denormalized for the directory listing
    ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },

    isPublic: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const CoachProfile =
  mongoose.models.CoachProfile ??
  mongoose.model("CoachProfile", coachProfileSchema);
