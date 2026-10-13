import express from 'express';
import branchController from '../controller/branch.controller.js';
import { verifyToken, authorize } from '../../middleware/auth.js';

const router = express.Router();

// Branch CRUD - authenticated with role-based checks for mutations
router.post('/branches', verifyToken, authorize(['branch.create', 'branch.manage']), branchController.createBranch);
router.get('/branches', verifyToken, branchController.getBranches);
router.get('/branches/:id', verifyToken, branchController.getBranchById);
router.put('/branches/:id', verifyToken, authorize(['branch.edit', 'branch.manage']), branchController.updateBranch);
router.delete('/branches/:id', verifyToken, authorize(['branch.delete', 'branch.manage']), branchController.deleteBranch);

// User-Branch assignments - administrative operations
router.post('/branches/assign-user', verifyToken, authorize(['branch.edit', 'branch.manage', 'user.manage']), branchController.assignUserToBranch);
router.post('/branches/remove-user', verifyToken, authorize(['branch.edit', 'branch.manage', 'user.manage']), branchController.removeUserFromBranch);
router.put('/branches/update-user-role', verifyToken, authorize(['branch.edit', 'branch.manage', 'user.manage']), branchController.updateUserBranchRole);

// Get branches for a user - self-service and listing
router.get('/users/:userId/branches', verifyToken, branchController.getUserBranches);
router.get('/my-branches', verifyToken, branchController.getUserBranches);

// Get users in a branch - require authentication
router.get('/branches/:branchId/users', verifyToken, branchController.getBranchUsers);

export default router;
