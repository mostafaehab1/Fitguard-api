// Media storage abstraction. Uses Cloudinary when fully configured (durable, CDN),
// otherwise falls back to local disk (ephemeral — fine for dev). The media API
// contract is identical for both, so the frontend never changes.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { env } from "../config.js";
import { PRIVATE_MEDIA_KINDS } from "../models/MediaAsset.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const c = env.media.cloudinary;
const useCloudinary =
  env.media.provider === "cloudinary" && c.cloudName && c.apiKey && c.apiSecret;

let cloudinary = null;
if (useCloudinary) {
  const mod = await import("cloudinary");
  cloudinary = mod.v2;
  cloudinary.config({
    cloud_name: c.cloudName,
    api_key: c.apiKey,
    api_secret: c.apiSecret,
    secure: true,
  });
}

export const activeProvider = useCloudinary ? "cloudinary" : "local";

const EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const resourceTypeFor = (mime) => (mime === "application/pdf" ? "raw" : "image");
const isPrivate = (kind) => PRIVATE_MEDIA_KINDS.includes(kind);

// Returns { provider, publicId, url } — url is null for private kinds (served via GET /media/:id).
export async function saveMedia({ buffer, mime, kind }) {
  if (useCloudinary) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `fitguard/${kind}`,
          resource_type: resourceTypeFor(mime),
          type: isPrivate(kind) ? "authenticated" : "upload",
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(buffer);
    });
    return {
      provider: "cloudinary",
      publicId: result.public_id,
      url: isPrivate(kind) ? null : result.secure_url,
    };
  }
  const filename = `${crypto.randomBytes(16).toString("hex")}${EXT[mime] ?? ""}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { provider: "local", publicId: filename, url: null };
}

export async function removeMedia(asset) {
  if (asset.provider === "cloudinary" && cloudinary) {
    try {
      await cloudinary.uploader.destroy(asset.publicId, {
        resource_type: resourceTypeFor(asset.mime),
        type: isPrivate(asset.kind) ? "authenticated" : "upload",
      });
    } catch {
      /* already gone */
    }
    return;
  }
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, asset.publicId));
  } catch {
    /* already gone */
  }
}

// Short-lived signed URL for a private Cloudinary asset (or its public URL).
export function resolveUrl(asset) {
  if (asset.provider === "cloudinary" && cloudinary) {
    if (!isPrivate(asset.kind)) return asset.url;
    return cloudinary.url(asset.publicId, {
      resource_type: resourceTypeFor(asset.mime),
      type: "authenticated",
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
  }
  return null; // local assets are streamed from disk
}

export function localStream(asset) {
  const filePath = path.join(UPLOAD_DIR, asset.publicId);
  if (!fs.existsSync(filePath)) return null;
  return fs.createReadStream(filePath);
}
