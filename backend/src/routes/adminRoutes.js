import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/rbacMiddleware.js";
import * as admin from "../controllers/adminController.js";
import * as coach from "../controllers/coachController.js";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/dashboard", admin.getDashboard);
router.get("/users", admin.listUsers);
router.get("/users/:id", admin.getUserById);
router.patch("/users/:id/role", admin.updateUserRole);
router.patch("/users/:id/status", admin.setUserStatus); // deactivate/reactivate
router.delete("/users/:id", admin.deactivateUser); // soft-deactivate (ban)

// Coach application review
router.get("/coach-applications", coach.listApplications);
router.patch("/coach-applications/:id", coach.decideApplication);

// CV mistake-category taxonomy
router.get("/mistake-categories", admin.listMistakeCategories);
router.post("/mistake-categories", admin.upsertMistakeCategory);

export default router;
