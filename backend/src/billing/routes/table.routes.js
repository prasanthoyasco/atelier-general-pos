import express from "express";
import tableController from "../controller/table.controller.js";
import { verifyToken } from "../../middleware/auth.js";
import { authenticateBranch } from "../../middleware/authenticateBranch.js";

const router = express.Router();

// Apply auth and branch middlewares to all table routes
router.use(verifyToken);
router.use(authenticateBranch({ allowMultipleBranches: false }));

// Table Routes
router.post("/", tableController.createTable);
router.get("/", tableController.getTables);
router.put("/:id", tableController.updateTable);
router.delete("/:id", tableController.deleteTable);

export default router;
