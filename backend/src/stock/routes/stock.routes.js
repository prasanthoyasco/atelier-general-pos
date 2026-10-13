// routes/stock.routes.js
import express from "express";
import stockController from "../controller/stock.controller.js";
import dailyInventoryController from "../controller/dailyInventory.controller.js";
import { verifyToken } from "../../middleware/auth.js";
import { authenticateBranch, authenticateBranchRole } from "../../middleware/authenticateBranch.js";

const router = express.Router();

// -------------------------------------------------------------
// 📦 DAILY INVENTORY & STOCK LOGS (Morning / Evening / Wastage)
// -------------------------------------------------------------
// 1. Get daily stock summary (both products and ingredients with sales & logs)
router.get("/daily/summary", verifyToken, authenticateBranch(true), dailyInventoryController.getSummary);

// 2. Add morning / purchase stock (accessible to billing staff, managers, admins)
router.post("/daily/morning-entry", verifyToken, authenticateBranch(), dailyInventoryController.addMorningEntry);

// 3. Record evening closing stock with physical count & wastage reason
router.post("/daily/evening-closing", verifyToken, authenticateBranch(), dailyInventoryController.recordEveningClosing);

// 4. View daily inventory reconciliation history
router.get("/daily/history", verifyToken, authenticateBranch(true), dailyInventoryController.getHistory);

// -------------------------------------------------------------
// 🌿 INGREDIENTS / RAW MATERIALS MASTER
// -------------------------------------------------------------
router.get("/ingredients", verifyToken, dailyInventoryController.getIngredients);
router.post("/ingredients", verifyToken, dailyInventoryController.createIngredient);
router.put("/ingredients/:id", verifyToken, dailyInventoryController.updateIngredient);
router.delete("/ingredients/:id", verifyToken, dailyInventoryController.deleteIngredient);

// -------------------------------------------------------------
// 📊 GENERAL STOCK ROUTES
// -------------------------------------------------------------
// ✅ Add new stock (single) - requires branch access
router.post("/stock", verifyToken, authenticateBranch(), stockController.create);

// ✅ Bulk add stock - requires branch access
router.post("/stockbulk", verifyToken, authenticateBranch(), stockController.createBulk);

// ✅ Get all stock records - allows multiple branches
router.get("/stock", verifyToken, authenticateBranch(true), stockController.getAll);

// ✅ Get stock by ID - requires branch access
router.get("/stock/:id", verifyToken, authenticateBranch(), stockController.getById);

// ✅ Update stock by ID - requires manager/admin role
router.put("/stock/:id", verifyToken, authenticateBranch(), authenticateBranchRole(["admin", "manager"]), stockController.update);

// ✅ Delete stock by ID (soft delete) - requires admin role
router.delete("/stock/:id", verifyToken, authenticateBranch(), authenticateBranchRole(["admin"]), stockController.delete);

export default router;
