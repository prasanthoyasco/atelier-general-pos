import express from 'express';
import { getKitchens } from '../controllers/kitchen.controller.js';
import { verifyToken } from '../../middleware/auth.js';

const router = express.Router();

router.get('/kitchens', verifyToken, getKitchens);

export default router;
