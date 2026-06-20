import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config.js";

// One-time tokens (email verification, password reset) and refresh tokens are stored
// as SHA-256 hashes so a DB leak does not expose usable tokens.
export const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

export function signAccessToken(user) {
  return jwt.sign({ sub: String(user.id ?? user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: String(user.id ?? user._id), type: "refresh" }, env.jwtSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.type !== "refresh") throw new Error("Not a refresh token");
  return payload;
}
