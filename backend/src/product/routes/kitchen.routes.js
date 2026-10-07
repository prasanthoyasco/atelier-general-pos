import express from 'express';
import { getKitchens } from '../controllers/kitchen.controller.js';

const router = express.Router();

router.get('/kitchens', getKitchens);

export default router;
