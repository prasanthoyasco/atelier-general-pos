// routes/role.routes.js
import express from "express";
import roleController from "../controller/role.controller.js";
import { verifyToken, authorize } from "../../middleware/auth.js";

const router = express.Router();

router.post('/role', verifyToken, authorize(['role.create', 'role.manage']), roleController.create);
router.get('/role', verifyToken, authorize(['role.view', 'role.manage']), roleController.getAll);
router.get('/role/:id', verifyToken, authorize(['role.view', 'role.manage']), roleController.getById);
router.put('/role/:id', verifyToken, authorize(['role.edit', 'role.manage']), roleController.update);
router.delete('/role/:id', verifyToken, authorize(['role.delete', 'role.manage']), roleController.delete);

export default router;
