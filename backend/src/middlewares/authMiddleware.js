import jwt from "jsonwebtoken";
import { env } from "../config.js";
import { User } from "../models/User.js";
import { AppError } from "./errorHandler.js";

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      throw new AppError("Missing token", { statusCode: 401, code: "UNAUTHORIZED" });
    }

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new AppError("Invalid or expired token", {
        statusCode: 401,
        code: "UNAUTHORIZED",
      });
    }

    const userId = payload.sub;
    if (!userId) {
      throw new AppError("Invalid token payload", {
        statusCode: 401,
        code: "UNAUTHORIZED",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", { statusCode: 401, code: "UNAUTHORIZED" });
    }
    if (user.disabledAt) {
      throw new AppError("Account deactivated", { statusCode: 403, code: "ACCOUNT_DISABLED" });
    }

    req.auth = { userId: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}
