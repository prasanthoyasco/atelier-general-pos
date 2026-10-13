import rateLimit from 'express-rate-limit';

/**
 * Standard error response generator for rate limiters
 */
const rateLimitHandler = (message) => (req, res) => {
  res.status(429).json({
    status: 'error',
    message: message || 'Too many requests, please try again later.',
    retryAfter: res.getHeader('Retry-After') || 60,
  });
};

/**
 * Global API Rate Limiter
 * 600 requests per 15 minutes per IP
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler('Too many requests across the API, please try again after 15 minutes.'),
  skip: (req) => {
    // Skip static assets or health checks if needed
    return req.path === '/' || req.path.startsWith('/public');
  }
});

/**
 * Strict Authentication Rate Limiter
 * 15 requests per 15 minutes per IP (Brute-force / Credential Stuffing defense)
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler('Too many authentication attempts. Please try again after 15 minutes.'),
});

/**
 * Strict OTP Rate Limiter
 * 5 requests per 10 minutes per IP (SMS / OTP spam defense)
 */
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler('Too many OTP requests. Please wait before requesting another code.'),
});
