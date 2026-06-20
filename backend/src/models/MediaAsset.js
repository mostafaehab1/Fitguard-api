import mongoose from "mongoose";

export const MEDIA_KINDS = [
  "profile_image",
  "coach_id_doc",
  "certification",
  "transformation_before",
  "transformation_after",
  "exercise_demo",
];

// Sensitive kinds are served only through GET /media/:id as short-lived signed URLs.
export const PRIVATE_MEDIA_KINDS = ["coach_id_doc", "certification"];

// DB stores references only; binaries live in object storage (Cloudinary/S3).
const mediaAssetSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: { type: String, enum: MEDIA_KINDS, required: true },
    url: { type: String, default: null }, // public URL, or null for private kinds
    provider: { type: String, default: null }, // "cloudinary" | "s3"
    publicId: { type: String, default: null }, // provider handle for deletion / signing
    mime: { type: String, default: null },
    sizeBytes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const MediaAsset =
  mongoose.models.MediaAsset ?? mongoose.model("MediaAsset", mediaAssetSchema);
