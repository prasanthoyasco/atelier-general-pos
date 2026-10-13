/**
 * sanitizeUrl.js
 * Comprehensive URL sanitization to prevent javascript:, vbscript:, and unsafe data: URI execution.
 */

// Characters commonly used to obfuscate schemes: whitespace, tabs, newlines, control chars
const CONTROL_OR_WHITESPACE_REGEX = /[\u0000-\u001F\u007F-\u009F\s]+/g;

/**
 * Validates whether a URL uses an allowlisted safe scheme or relative path.
 * Safe protocols: http, https, mailto, tel, blob (only for local object URLs)
 * Disallows: javascript:, data:, vbscript:, file:
 *
 * @param {string} url - The candidate URL
 * @returns {boolean} True if the URL is safe to render in href or pass to window.open
 */
export function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;

  // Trim and strip control characters & whitespace
  const sanitized = url.trim().replace(CONTROL_OR_WHITESPACE_REGEX, '');
  if (!sanitized) return false;

  // Relative URLs (starting with '/', './', '../', or anchor '#') are safe relative to origin
  if (
    sanitized.startsWith('/') ||
    sanitized.startsWith('./') ||
    sanitized.startsWith('../') ||
    sanitized.startsWith('#') ||
    sanitized.startsWith('?')
  ) {
    return true;
  }

  // Parse protocol
  const colonIndex = sanitized.indexOf(':');
  if (colonIndex === -1) {
    // No scheme, treat as relative or simple path
    return true;
  }

  const scheme = sanitized.slice(0, colonIndex).toLowerCase();

  // Explicit allowlist of permitted schemes
  const SAFE_SCHEMES = ['http', 'https', 'mailto', 'tel'];

  if (SAFE_SCHEMES.includes(scheme)) {
    return true;
  }

  // Blob URLs are only allowed if strictly starting with blob:http or blob:https or blob:null
  if (scheme === 'blob' && /^blob:(https?:\/\/|null)/i.test(sanitized)) {
    return true;
  }

  return false;
}

/**
 * Sanitizes a URL for safe use in `<a href={...}>` or `window.open(...)`.
 * Returns a safe fallback if the input URL contains unsafe protocols like javascript:.
 *
 * @param {string} url - The candidate URL
 * @param {string} fallback - Fallback URL if unsafe (default: '#')
 * @returns {string} Sanitized URL
 */
export function sanitizeUrl(url, fallback = '#') {
  if (isSafeUrl(url)) {
    return url.trim();
  }
  return fallback;
}

/**
 * Safely opens a URL in a new window/tab, enforcing URL validation and noopener/noreferrer.
 *
 * @param {string} url - The target URL
 * @param {string} target - Target window name (default: '_blank')
 * @param {string} features - Window features (default: 'noopener,noreferrer')
 * @returns {Window | null}
 */
export function safeOpen(url, target = '_blank', features = 'noopener,noreferrer') {
  if (!isSafeUrl(url)) {
    console.warn(`[Security] Blocked attempt to open dangerous URL: ${url}`);
    return null;
  }
  return window.open(url, target, features);
}

export default sanitizeUrl;
