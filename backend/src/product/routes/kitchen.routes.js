import express from 'express';
import {
  getKitchens,
  getKitchenById,
  createKitchen,
  updateKitchen,
  deleteKitchen,
  assignItemsToKitchen,
  getKitchenOverviewStats
} from '../controllers/kitchen.controller.js';
import { verifyToken, authorize } from '../../middleware/auth.js';

const router = express.Router();

// Kitchen Station Overview Metrics
router.get('/kitchens/stats', verifyToken, getKitchenOverviewStats);

// List all kitchens
router.get(['/kitchens', '/kitchens/list'], verifyToken, getKitchens);

// Single kitchen details
router.get('/kitchens/:id', verifyToken, getKitchenById);

// Create kitchen
router.post('/kitchens', verifyToken, authorize(['product.manage', 'branch.manage', 'product.create']), createKitchen);

// Update kitchen
router.put('/kitchens/:id', verifyToken, authorize(['product.manage', 'branch.manage', 'product.edit']), updateKitchen);

// Delete kitchen
router.delete('/kitchens/:id', verifyToken, authorize(['product.manage', 'branch.manage', 'product.delete']), deleteKitchen);

// Bulk item / category assignment
router.post('/kitchens/:id/assign-items', verifyToken, authorize(['product.manage', 'branch.manage', 'product.edit']), assignItemsToKitchen);

export default router;
