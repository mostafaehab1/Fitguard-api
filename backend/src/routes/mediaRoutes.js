import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import * as media from "../controllers/mediaController.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.post("/", authMiddleware, upload.single("file"), media.uploadMedia);
router.get("/:id", media.getMedia); // access control handled inside (private kinds)

export default router;
