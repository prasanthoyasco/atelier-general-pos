import express from "express";
import permissionController from "../controller/permission.controller.js";
import { verifyToken, authorize } from "../../middleware/auth.js";

const router = express.Router();

// All permission routes require authentication and authorization
router.get('/permission/all', verifyToken, permissionController.getAllFlat);   // for dropdowns
router.get('/permission', verifyToken, authorize(['permission.view', 'role.view', 'permission.manage']), permissionController.getAll);
router.get('/permission/:id', verifyToken, authorize(['permission.view', 'role.view', 'permission.manage']), permissionController.getById);
router.post('/permission', verifyToken, authorize(['permission.create', 'permission.manage']), permissionController.create);
router.put('/permission/:id', verifyToken, authorize(['permission.edit', 'permission.manage']), permissionController.update);
router.delete('/permission/:id', verifyToken, authorize(['permission.delete', 'permission.manage']), permissionController.delete);

export default router;
