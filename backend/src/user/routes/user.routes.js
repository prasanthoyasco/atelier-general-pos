import { Router } from "express";
import userController from "../controller/user.controller.js";
import { verifyToken, authorize } from "../../middleware/auth.js";
import { authLimiter, otpLimiter } from "../../middleware/rateLimiter.js";

const router = Router();

// PUBLIC ROUTES (with rate limiting protection)
router.post("/login", authLimiter, userController.loginUser);
router.post("/refresh-token", authLimiter, userController.refreshAccessToken);
router.post("/send-otp", otpLimiter, userController.sendOtpToken);
router.get("/exists", userController.userAlreadyExists);

// PROTECTED ROUTES - Authenticated User Self-Service
// (MUST come before /:id parameterized routes)
router.post("/logout", verifyToken, userController.logoutUser);
router.get("/me", verifyToken, userController.getMe);
router.get("/me/profile", verifyToken, userController.getMe);
router.post("/change-password", verifyToken, authLimiter, userController.changePassword);

// PROTECTED ROUTES - User Management (Requires administrative permissions)
router.post("/", verifyToken, authorize(['user.create', 'user.manage']), userController.createUser);
router.get("/", verifyToken, authorize(['user.view', 'user.manage']), userController.getUsers);

// Parameterized routes (placed last to prevent collision)
router.get("/:id", verifyToken, authorize(['user.view', 'user.manage']), userController.getUserById);
router.put("/:id", verifyToken, authorize(['user.edit', 'user.manage']), userController.updateUserById);
router.delete("/:id", verifyToken, authorize(['user.delete', 'user.manage']), userController.softDeleteUser);
router.patch("/:id/restore", verifyToken, authorize(['user.edit', 'user.delete', 'user.manage']), userController.restoreUser);

export default router;
