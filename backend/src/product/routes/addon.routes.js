import express from "express";
import addonController from "../controller/addon.controller.js";
import { verifyToken } from "../../middleware/auth.js";
import { authenticateBranch } from "../../middleware/authenticateBranch.js";

const router = express.Router();

router.use(verifyToken);
router.use(authenticateBranch({ allowMultipleBranches: false }));

router.post("/", addonController.create);
router.get("/", addonController.getAll);
router.put("/:id", addonController.update);
router.delete("/:id", addonController.delete);

export default router;
