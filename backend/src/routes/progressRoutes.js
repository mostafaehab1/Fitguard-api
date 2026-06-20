import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import * as progress from "../controllers/progressController.js";

const router = Router();

router.get("/summary", authMiddleware, progress.getSummary);
router.get("/risk", authMiddleware, progress.getRisk);
router.get("/trends", authMiddleware, progress.getTrends);

export default router;
