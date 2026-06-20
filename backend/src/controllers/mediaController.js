import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { MediaAsset, MEDIA_KINDS, PRIVATE_MEDIA_KINDS } from "../models/MediaAsset.js";
import { env } from "../config.js";
import { AppError } from "../middlewares/errorHandler.js";

// Local-disk storage so media works without cloud keys. For production, swap this
// service for Cloudinary/S3 at the same boundary (MediaAsset keeps only references).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
const RULES = {
  default: { mimes: IMAGE_MIME, maxBytes: 5 * 1024 * 1024 },
  certification: { mimes: [...IMAGE_MIME, "application/pdf"], maxBytes: 10 * 1024 * 1024 },
  coach_id_doc: { mimes: [...IMAGE_MIME, "application/pdf"], maxBytes: 10 * 1024 * 1024 },
};
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" };

function authFromHeader(req) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

// POST /media (multipart: file + kind)
export async function uploadMedia(req, res, next) {
  try {
    const kind = req.body?.kind;
    if (!MEDIA_KINDS.includes(kind)) {
      throw new AppError(`kind must be one of: ${MEDIA_KINDS.join(", ")}`, { code: "VALIDATION_ERROR" });
    }
    if (!req.file) {
      throw new AppError("file is required (multipart field 'file')", { code: "VALIDATION_ERROR" });
    }
    const rules = RULES[kind] ?? RULES.default;
    if (!rules.mimes.includes(req.file.mimetype)) {
      throw new AppError(`Unsupported file type for ${kind}`, { code: "VALIDATION_ERROR" });
    }
    if (req.file.size > rules.maxBytes) {
      throw new AppError(`File too large (max ${rules.maxBytes / 1024 / 1024}MB)`, {
        code: "VALIDATION_ERROR",
      });
    }

    const filename = `${crypto.randomBytes(16).toString("hex")}${EXT[req.file.mimetype] ?? ""}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);

    const isPrivate = PRIVATE_MEDIA_KINDS.includes(kind);
    const asset = await MediaAsset.create({
      ownerId: req.auth.userId,
      kind,
      provider: "local",
      publicId: filename,
      mime: req.file.mimetype,
      sizeBytes: req.file.size,
      url: null,
    });
    // Public kinds get a directly fetchable URL; private kinds are served only via the
    // access-controlled GET /media/:id.
    if (!isPrivate) {
      asset.url = `${env.appBaseUrl}/api/media/${asset.id}`;
      await asset.save();
    }

    res.status(201).json({ mediaId: asset.id, url: asset.url, kind });
  } catch (err) {
    next(err);
  }
}

// GET /media/:id — public kinds served freely; private kinds require owner/admin.
export async function getMedia(req, res, next) {
  try {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) throw new AppError("Media not found", { statusCode: 404, code: "NOT_FOUND" });

    if (PRIVATE_MEDIA_KINDS.includes(asset.kind)) {
      const user = authFromHeader(req);
      if (!user) throw new AppError("Unauthorized", { statusCode: 401, code: "UNAUTHORIZED" });
      if (user.role !== "admin" && String(user.userId) !== String(asset.ownerId)) {
        throw new AppError("Forbidden", { statusCode: 403, code: "FORBIDDEN" });
      }
    }

    const filePath = path.join(UPLOAD_DIR, asset.publicId);
    if (!fs.existsSync(filePath)) {
      throw new AppError("File missing", { statusCode: 404, code: "NOT_FOUND" });
    }
    res.type(asset.mime ?? "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
}

// DELETE /media/:id — owner or admin; also removes the stored file.
export async function deleteMedia(req, res, next) {
  try {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) throw new AppError("Media not found", { statusCode: 404, code: "NOT_FOUND" });
    if (String(asset.ownerId) !== String(req.auth.userId) && req.auth.role !== "admin") {
      throw new AppError("Forbidden", { statusCode: 403, code: "FORBIDDEN" });
    }
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, asset.publicId));
    } catch {
      /* file already gone */
    }
    await asset.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
