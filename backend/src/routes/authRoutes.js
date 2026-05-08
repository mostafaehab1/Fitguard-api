import { Router } from "express";
import * as auth from "../controllers/authController.js";

const router = Router();

router.post("/register", auth.register);
router.post("/login", auth.login);
router.post("/forgot-password", auth.forgotPassword);
router.get("/reset-password", auth.resetPasswordPage);
router.post("/reset-password", auth.resetPassword);
router.get("/verify-email", auth.verifyEmail);

export default router;
