// routes/billing.routes.js
import express from "express";
import billingController from "../controller/billing.controller.js";
import { verifyToken, authorize } from "../../middleware/auth.js";
import { authenticateBranch, authenticateBranchRole } from "../../middleware/authenticateBranch.js";

const router = express.Router();

// ✅ Create billing - requires branch access
router.post("/billing", verifyToken, authenticateBranch(), billingController.create);

// ✅ Get active kitchen queue
router.get("/billing/kitchen-queue", verifyToken, authorize(["kot.view", "billing.view", "billing.manage"]), authenticateBranch(), billingController.getKitchenQueue);

// ✅ Get all billings - allows multiple branches
router.get("/billing", verifyToken, authenticateBranch(true), billingController.getAll);

// ✅ Update KOT Status
router.patch("/billing/:id/kot-status", verifyToken, authorize(["kot.manage", "kot.serve", "billing.manage"]), authenticateBranch(), billingController.updateKOTStatus);

// ✅ Get billing by ID - requires branch access
router.get("/billing/:id", verifyToken, authenticateBranch(), billingController.getById);

// ✅ Update billing - requires manager/admin role
router.put("/billing/:id", verifyToken, authenticateBranch(), billingController.update);

router.delete("/billing/:id", verifyToken, authenticateBranch(), authenticateBranchRole(['admin']), billingController.delete);

export default router;
