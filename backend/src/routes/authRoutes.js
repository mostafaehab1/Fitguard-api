import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import * as auth from "../controllers/authController.js";

const limited = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
});

const strict = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." } },
});

const router = Router();

router.post("/register", limited, auth.register);
router.post("/login", strict, auth.login);
router.post("/refresh", limited, auth.refresh);
router.post("/logout", authMiddleware, auth.logout);
router.post("/forgot-password", strict, auth.forgotPassword);
router.get("/reset-password", auth.resetPasswordPage);
router.post("/reset-password", strict, auth.resetPassword);
router.get("/verify-email", auth.verifyEmail);

export default router;
