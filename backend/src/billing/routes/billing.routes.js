// routes/billing.routes.js
import express from "express";
import billingController from "../controller/billing.controller.js";
import { verifyToken, authorize } from "../../middleware/auth.js";
import { authenticateBranch, authenticateBranchRole } from "../../middleware/authenticateBranch.js";

const router = express.Router();

// ✅ Create billing - requires branch access and billing creation permission
router.post("/billing", verifyToken, authorize(["billing.create", "billing.manage"]), authenticateBranch(), billingController.create);

// ✅ Get active kitchen queue
router.get("/billing/kitchen-queue", verifyToken, authorize(["kot.view", "billing.view", "billing.manage"]), authenticateBranch(), billingController.getKitchenQueue);

// ✅ Get all billings - allows multiple branches
router.get("/billing", verifyToken, authorize(["billing.view", "billing.manage"]), authenticateBranch(true), billingController.getAll);

// ✅ Serve individual KOT item (unit or full quantity)
router.patch("/billing/kot-items/:id/serve", verifyToken, authorize(["kot.serve", "kot.manage", "billing.manage"]), authenticateBranch(), billingController.serveKOTItem);

// ✅ Update individual KOT item status (Kitchen preparation)
router.patch("/billing/kot-items/:id/status", verifyToken, authorize(["kot.manage", "kot.view", "billing.manage"]), authenticateBranch(), billingController.updateKOTItemStatus);

// ✅ Update KOT Status
router.patch("/billing/:id/kot-status", verifyToken, authorize(["kot.manage", "kot.serve", "billing.manage"]), authenticateBranch(), billingController.updateKOTStatus);

// ✅ Get billing by ID - requires branch access
router.get("/billing/:id", verifyToken, authorize(["billing.view", "billing.manage"]), authenticateBranch(), billingController.getById);

// ✅ Update billing - requires manager/admin role
router.put("/billing/:id", verifyToken, authorize(["billing.edit", "billing.manage"]), authenticateBranch(), billingController.update);

router.delete("/billing/:id", verifyToken, authorize(["billing.delete", "billing.manage"]), authenticateBranch(), authenticateBranchRole(['admin']), billingController.delete);

export default router;
