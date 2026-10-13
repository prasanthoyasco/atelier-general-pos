/**
 * escapeHtml.js
 * Utility to encode untrusted strings into safe HTML entities for server-side templates and emails.
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

export default escapeHtml;
