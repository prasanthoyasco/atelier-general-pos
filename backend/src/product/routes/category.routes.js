// routes/category.routes.js
import express from "express";
import categoryController from "../controller/category.controller.js";
import { verifyToken, authorize } from "../../middleware/auth.js";

const router = express.Router();

// ✅ Create a new category
router.post('/category', verifyToken, authorize(["product.create", "product.manage"]), categoryController.create);

// ✅ Get all categories
router.get('/category', verifyToken, categoryController.getAll);

// ✅ Get category by ID
router.get('/category/:id', verifyToken, categoryController.getById);

// ✅ Update category by ID
router.put('/category/:id', verifyToken, authorize(["product.edit", "product.manage"]), categoryController.update);

// ✅ Delete category by ID (soft delete)
router.delete('/category/:id', verifyToken, authorize(["product.delete", "product.manage"]), categoryController.delete);

export default router;
