/**
 * xssSanitizer.js
 * Express middleware providing Defense-in-Depth against Stored and Reflected XSS.
 * Sanitizes request bodies, query parameters, and route parameters by stripping
 * executable script tags, event handlers, and dangerous URL pseudoprotocols.
 */

// Keys that should never be sanitized or mutated (passwords, tokens, raw hashes)
const EXEMPT_KEYS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'token',
  'jwt',
  'secret',
  'signature',
  'authHeader'
]);

/**
 * Strips dangerous HTML tags, malicious attributes, and script injection payloads.
 *
 * @param {string} value
 * @returns {string} Sanitized string
 */
export function sanitizeString(value) {
  if (typeof value !== 'string') return value;

  let sanitized = value;

  // 1. Strip <script> ... </script> tags and unclosed <script> tags
  sanitized = sanitized.replace(/<\s*script\b[^>]*>([\s\S]*?)<\s*\/\s*script\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*script\b[^>]*>/gi, '');

  // 2. Strip dangerous embed tags (iframe, object, embed, applet)
  sanitized = sanitized.replace(/<\s*(iframe|object|embed|applet|base)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*(iframe|object|embed|applet|base)\b[^>]*>/gi, '');

  // 3. Neutralize inline event handlers on tags (e.g. <img src=x onerror=alert(1)> -> <img src=x data-blocked-handler>)
  sanitized = sanitized.replace(/(<[^>]+)\s+(on[a-z]{3,20}\s*=)/gi, '$1 data-blocked-handler=');

  // 4. Neutralize javascript: and vbscript: pseudoprotocols inside href/src attributes or raw strings
  sanitized = sanitized.replace(/(href|src)\s*=\s*(['"]?)\s*(javascript|vbscript):/gi, '$1=$2blocked-scheme:');

  return sanitized;
}

/**
 * Recursively sanitizes an object or array.
 *
 * @param {any} target
 * @param {string} [currentKey]
 * @returns {any}
 */
export function deepSanitize(target, currentKey = '') {
  if (target === null || target === undefined) return target;

  if (EXEMPT_KEYS.has(currentKey)) {
    return target;
  }

  if (typeof target === 'string') {
    return sanitizeString(target);
  }

  if (Array.isArray(target)) {
    return target.map((item, index) => deepSanitize(item, String(index)));
  }

  if (typeof target === 'object') {
    const cleaned = {};
    for (const [key, val] of Object.entries(target)) {
      if (EXEMPT_KEYS.has(key)) {
        cleaned[key] = val;
      } else {
        cleaned[key] = deepSanitize(val, key);
      }
    }
    return cleaned;
  }

  return target;
}

/**
 * Express middleware to sanitize req.body, req.query, and req.params.
 */
export const xssSanitizer = (req, res, next) => {
  try {
    if (req.body && typeof req.body === 'object') {
      for (const key of Object.keys(req.body)) {
        req.body[key] = deepSanitize(req.body[key], key);
      }
    }

    if (req.query && typeof req.query === 'object') {
      for (const key of Object.keys(req.query)) {
        try {
          req.query[key] = deepSanitize(req.query[key], key);
        } catch {
          // Ignore if property descriptor is read-only
        }
      }
    }

    if (req.params && typeof req.params === 'object') {
      for (const key of Object.keys(req.params)) {
        try {
          req.params[key] = deepSanitize(req.params[key], key);
        } catch {
          // Ignore if property descriptor is read-only
        }
      }
    }
  } catch (err) {
    console.warn('[xssSanitizer] Warning during sanitization:', err.message);
  }

  next();
};

export default xssSanitizer;
