/**
 * sanitizeHtml.js
 * Central HTML sanitization and text escaping utilities using DOMPurify.
 * Provides defense-in-depth against XSS for rich HTML rendering, PDF generation, and print popups.
 */

import DOMPurify from 'dompurify';

/**
 * Basic HTML entity encoder for safe interpolation in template strings.
 * Use this whenever untrusted text must be embedded into HTML strings (like PDF reports or print windows).
 *
 * @param {any} str - The input string/value
 * @returns {string} HTML-escaped string
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strict DOMPurify configuration allowlists.
 * Disallows script, object, embed, iframe, form, button, and dangerous event handlers (onerror, onload, onclick, etc.).
 */
export const DEFAULT_PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'span', 'br', 'hr',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'div', 'img', 'svg', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon'
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height',
    'target', 'rel', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
    'stroke-linejoin', 'd', 'rx', 'ry', 'x', 'y', 'r', 'cx', 'cy', 'points'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'head', 'link', 'meta', 'applet'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit']
};

/**
 * Sanitizes rich HTML using DOMPurify with the strict allowlist.
 *
 * @param {string} dirty - Unsanitized HTML string
 * @param {object} [customConfig] - Optional overrides for DOMPurify
 * @returns {string} Sanitized, safe HTML string
 */
export function sanitizeHtml(dirty, customConfig = {}) {
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, { ...DEFAULT_PURIFY_CONFIG, ...customConfig });
}

export default sanitizeHtml;
