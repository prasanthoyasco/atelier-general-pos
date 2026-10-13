// routes/subcategory.routes.js
import express from "express";
import subcategoryController from "../controller/subcategory.controller.js";
import { verifyToken, authorize } from "../../middleware/auth.js";

const router = express.Router();

// ✅ Create a new subcategory
router.post('/subcategory', verifyToken, authorize(["product.create", "product.manage"]), subcategoryController.create);

// ✅ Get all subcategories
router.get('/subcategory', verifyToken, subcategoryController.getAll);

// ✅ Get subcategory by ID
router.get('/subcategory/:id', verifyToken, subcategoryController.getById);

// ✅ Update subcategory by ID
router.put('/subcategory/:id', verifyToken, authorize(["product.edit", "product.manage"]), subcategoryController.update);

// ✅ Delete subcategory by ID (soft delete)
router.delete('/subcategory/:id', verifyToken, authorize(["product.delete", "product.manage"]), subcategoryController.delete);

export default router;
