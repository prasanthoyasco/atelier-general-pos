import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import ticketController from '../controller/ticket.controller.js';
import { verifyToken } from '../../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Multer storage for attachments
const UPLOAD_DIR = path.join(__dirname, '../../../../public/uploads/tickets');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set(['jpeg', 'jpg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'ogg', 'pdf']);
const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  'application/pdf'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const randomHex = crypto.randomBytes(8).toString('hex');
    cb(null, `ticket-${Date.now()}-${randomHex}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (ALLOWED_EXTENSIONS.has(ext) && (ALLOWED_MIMES.has(file.mimetype) || file.mimetype.startsWith('image/'))) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${ext} or MIME ${file.mimetype} is not allowed`));
    }
  },
});

// Developer JWT verify middleware
const getDeveloperSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production');
    }
    console.warn('WARNING: JWT_SECRET is not set in environment.');
  }
  return secret || 'dev-fallback-local-only-secret-key-change-in-prod';
};

const verifyDeveloper = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Missing token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getDeveloperSecret(), { algorithms: ['HS256'] });
    if (decoded.role_name !== 'developer')
      return res.status(403).json({ success: false, message: 'Developer access only' });
    req.developer = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Super admin check middleware
const isSuperAdmin = (req, res, next) => {
  if (req.user?.role_name === 'super admin') return next();
  return res.status(403).json({ success: false, message: 'Super admin only' });
};

const router = Router();

// ── All authenticated users ───────────────────────────────────────────────
router.get('/tickets/stats',      verifyToken, ticketController.getStats);
router.get('/tickets',            verifyToken, ticketController.getAll);
router.get('/tickets/:id',        verifyToken, ticketController.getById);
router.post('/tickets',           verifyToken, upload.array('attachments', 5), ticketController.create);

// ── Super admin only ──────────────────────────────────────────────────────
router.put('/tickets/:id/assign', verifyToken, isSuperAdmin, ticketController.assign);
router.put('/tickets/:id/status', verifyToken, isSuperAdmin, ticketController.updateStatus);
router.get('/developers',         verifyToken, isSuperAdmin, ticketController.getDevelopers);
router.post('/developers',        verifyToken, isSuperAdmin, ticketController.addDeveloper);
router.delete('/developers/:id',  verifyToken, isSuperAdmin, ticketController.removeDeveloper);

// ── Developer portal (developer JWT) ─────────────────────────────────────
router.post('/developer/login',          ticketController.developerLogin);
router.post('/developer/logout',         verifyDeveloper, ticketController.developerLogout);
router.get('/developer/me',              verifyDeveloper, ticketController.developerMe);
router.get('/developer/tickets',         verifyDeveloper, ticketController.developerTickets);
router.put('/developer/tickets/:id/status', verifyDeveloper, ticketController.developerUpdateStatus);

export default router;
