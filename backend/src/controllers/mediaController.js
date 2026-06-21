import jwt from "jsonwebtoken";
import { MediaAsset, MEDIA_KINDS, PRIVATE_MEDIA_KINDS } from "../models/MediaAsset.js";
import { env } from "../config.js";
import { AppError } from "../middlewares/errorHandler.js";
import { saveMedia, removeMedia, resolveUrl, localStream } from "../services/mediaStorage.js";

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
const RULES = {
  default: { mimes: IMAGE_MIME, maxBytes: 5 * 1024 * 1024 },
  certification: { mimes: [...IMAGE_MIME, "application/pdf"], maxBytes: 10 * 1024 * 1024 },
  coach_id_doc: { mimes: [...IMAGE_MIME, "application/pdf"], maxBytes: 10 * 1024 * 1024 },
};

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

    const stored = await saveMedia({ buffer: req.file.buffer, mime: req.file.mimetype, kind });
    const asset = await MediaAsset.create({
      ownerId: req.auth.userId,
      kind,
      provider: stored.provider,
      publicId: stored.publicId,
      mime: req.file.mimetype,
      sizeBytes: req.file.size,
      url: stored.url,
    });
    // Public local assets are served back through this API; give them that URL.
    if (!PRIVATE_MEDIA_KINDS.includes(kind) && stored.provider === "local") {
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

    if (asset.provider === "cloudinary") {
      const url = PRIVATE_MEDIA_KINDS.includes(asset.kind) ? resolveUrl(asset) : asset.url;
      if (!url) throw new AppError("Media not found", { statusCode: 404, code: "NOT_FOUND" });
      res.redirect(url);
      return;
    }

    const stream = localStream(asset);
    if (!stream) throw new AppError("File missing", { statusCode: 404, code: "NOT_FOUND" });
    res.type(asset.mime ?? "application/octet-stream");
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

// DELETE /media/:id — owner or admin; also removes the stored file/object.
export async function deleteMedia(req, res, next) {
  try {
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) throw new AppError("Media not found", { statusCode: 404, code: "NOT_FOUND" });
    if (String(asset.ownerId) !== String(req.auth.userId) && req.auth.role !== "admin") {
      throw new AppError("Forbidden", { statusCode: 403, code: "FORBIDDEN" });
    }
    await removeMedia(asset);
    await asset.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
