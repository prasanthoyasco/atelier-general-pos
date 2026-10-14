import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { responseHelper } from './middleware/index.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { xssSanitizer } from './middleware/xssSanitizer.js';
import userRoutes from './user/routes/index.js';
import productRoutes from './product/routes/index.js';
import stockRoutes from './stock/routes/index.js';
import inwardRoutes from './inward/routes/index.js';
import billingRoutes from './billing/routes/index.js';
import dashboardRoutes from './dashboard/routes/index.js';
import marketingRoutes from './marketing/routes/index.js';
import employeeRoutes from './employee/routes/employee.routes.js';
import ticketRoutes from './ticket/routes/ticket.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// import razerpayRoutes from './razerpay/routes/index.js'

// Import model associations to ensure they're loaded
import './inward/models/index.js';
import './billing/models/associations.js';
import './user/models/associations.js';
import './marketing/models/index.js';
import './employee/models/associations.js';
import './ticket/models/associations.js';
import './product/models/associations.js';

const app = express();

// Trust reverse proxies (Nginx / Cloudflare / Load Balancers) for correct rate limiting IP
app.set('trust proxy', 1);

// ---------- Security Headers & Content Security Policy (CSP) ----------
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http://localhost:*", "http://127.0.0.1:*"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      connectSrc: [
        "'self'",
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://atelier-general-pos.vercel.app",
        "https://atelier-general-pos.onrender.com",
        "https://api.razorpay.com",
        "https://*.digitaloceanspaces.com",
        "https://*.amazonaws.com"
      ],
      ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {})
    },
  },
}));

// ---------- Middleware & Input Sanitization ----------
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(xssSanitizer);
app.use(responseHelper);

// ---------- Strict CORS Allowlist ----------
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'https://atelier-general-pos.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
].map(o => o.replace(/\/+$/, '').trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g., mobile apps, curl, server-to-server) with no origin
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/+$/, '').trim();
    if (
      allowedOrigins.includes(cleanOrigin) ||
      /^https:\/\/atelier-general-pos(-[a-z0-9-]+)?\.vercel\.app$/.test(cleanOrigin) ||
      (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin))
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: origin ${origin} is not allowed`), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-branch-id", "Accept"],
  credentials: true,
  maxAge: 86400 // 24 hours preflight caching
}));

app.use(morgan('dev'));

// ---------- Rate Limiting ----------
app.use('/api/', globalLimiter);

// ---------- Static Files (Sandboxed to prevent SVG / HTML XSS) ----------
app.use('/selfies', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=259200'); // 3 days
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  next();
}, express.static(path.join(__dirname, '../../public/selfies')));

// Serve ticket attachments
app.use('/uploads/tickets', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  next();
}, express.static(path.join(__dirname, '../../public/uploads/tickets')));

// ---------- Health / Test Routes ----------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.status(200).send("Hello World!!");
});

app.get('/api/data', (req, res) => {
  res.sendSuccess({ value: 42 }, 'Data fetched successfully');
});

// ---------- Main Routes ----------

app.use('/api/v1', userRoutes);
app.use('/api/v1', productRoutes);
app.use('/api/v1', stockRoutes);
app.use('/api/v1', inwardRoutes);
app.use('/api/v1', billingRoutes);
app.use('/api/v1', dashboardRoutes);
app.use('/api/v1', marketingRoutes);
app.use('/api/v1', employeeRoutes);
app.use('/api/v1', ticketRoutes);
// app.use('/api/v1', razerpayRoutes);

// ---------- 404 Handler ----------
app.use((req, res) => {
  if (typeof res.sendError === 'function') {
    return res.sendError('Route not found', 404);
  }
  return res.status(404).json({ status: 'error', message: 'Route not found' });
});

// ---------- Global Secure Error Handler ----------
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack || err.message || err);

  // Distinguish client/validation errors from 500 server crashes
  const status = err.status || err.statusCode || (err.message?.includes('CORS policy') ? 403 : 500);
  const isProd = process.env.NODE_ENV === 'production';

  // In production, mask internal server error details
  let userMessage = err.message || 'Internal Server Error';
  if (isProd && status === 500) {
    userMessage = 'An internal server error occurred. Please contact support.';
  }

  if (typeof res.sendError === 'function') {
    return res.sendError(userMessage, status);
  }
  return res.status(status).json({ status: 'error', message: userMessage });
});

export default app;
