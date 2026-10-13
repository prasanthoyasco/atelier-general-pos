/**
 * xss_security_test_suite.mjs
 * Comprehensive automated security test suite for Cross-Site Scripting (XSS) remediation.
 * Tests input sanitization, output escaping, URL validation, and HTTP security headers.
 */

import { sanitizeString, deepSanitize } from '../src/middleware/xssSanitizer.js';
import { escapeHtml } from '../src/utils/escapeHtml.js';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:10000';

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASSED' });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    results.push({ name, status: 'FAILED', error: err.message });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log('================================================================');
console.log('         CROSS-SITE SCRIPTING (XSS) SECURITY TEST SUITE         ');
console.log('================================================================\n');

// ── 1. Backend Input Sanitizer Tests ──────────────────────────────────────────
console.log('--- 1. Backend Input Sanitizer Tests ---');

await test('Strips <script> tags and inner code from user input', () => {
  const payload = 'Hello <script>alert("xss")</script> World';
  const clean = sanitizeString(payload);
  assert(!clean.includes('<script>'), `Expected no <script>, got "${clean}"`);
  assert(!clean.includes('alert("xss")'), `Expected script body removed, got "${clean}"`);
  assert(clean.includes('Hello  World'), `Expected outer text preserved, got "${clean}"`);
});

await test('Neutralizes inline event handlers (<img onerror=...>)', () => {
  const payload = '<img src="x" onerror="alert(document.cookie)">';
  const clean = sanitizeString(payload);
  assert(!clean.includes('onerror='), `Expected onerror removed, got "${clean}"`);
  assert(clean.includes('data-blocked-handler='), `Expected neutralized handler attribute, got "${clean}"`);
});

await test('Neutralizes javascript: pseudoprotocol in href and src', () => {
  const payload = '<a href="javascript:alert(1)">Click Me</a>';
  const clean = sanitizeString(payload);
  assert(!clean.toLowerCase().includes('href="javascript:'), `Expected javascript: removed from href, got "${clean}"`);
  assert(clean.includes('blocked-scheme:'), `Expected blocked-scheme, got "${clean}"`);
});

await test('Strips <iframe>, <object>, and <embed> tags', () => {
  const payload = '<iframe src="https://evil.com"></iframe><embed src="evil.swf">';
  const clean = sanitizeString(payload);
  assert(!clean.includes('<iframe'), `Expected no iframe, got "${clean}"`);
  assert(!clean.includes('<embed'), `Expected no embed, got "${clean}"`);
});

await test('Preserves password and secret keys unchanged during deep sanitization', () => {
  const input = {
    username: 'user<script>test</script>',
    password: 'MyP@ss<script>alert(1)</script>word!',
    profile: {
      bio: 'Normal bio <script>bad()</script>',
      confirmPassword: 'MyP@ss<script>alert(1)</script>word!'
    }
  };
  const sanitized = deepSanitize(input);
  assert(!sanitized.username.includes('<script>'), 'Username should be sanitized');
  assert(sanitized.password === 'MyP@ss<script>alert(1)</script>word!', 'Password must NOT be altered');
  assert(!sanitized.profile.bio.includes('<script>'), 'Nested bio should be sanitized');
  assert(sanitized.profile.confirmPassword === 'MyP@ss<script>alert(1)</script>word!', 'confirmPassword must NOT be altered');
});

// ── 2. Context-Aware Output Entity Escaping Tests ──────────────────────────────
console.log('\n--- 2. Output Entity Encoding Tests (escapeHtml) ---');

await test('Encodes <, >, ", \', and & to prevent HTML injection in emails/templates', () => {
  const raw = '<img src="test.jpg" alt=\'photo\' & "caption">';
  const escaped = escapeHtml(raw);
  assert(escaped === '&lt;img src=&quot;test.jpg&quot; alt=&#39;photo&#39; &amp; &quot;caption&quot;&gt;', `Unexpected encoding: ${escaped}`);
});

await test('Prevents tag breakout in <title> and attribute contexts', () => {
  const payload = '</title><script>alert("pwn")</script>';
  const escaped = escapeHtml(payload);
  assert(!escaped.includes('</title>'), 'Must escape closing title tag');
  assert(!escaped.includes('<script>'), 'Must escape script open tag');
  assert(escaped.includes('&lt;/title&gt;&lt;script&gt;'), 'Must encode tags to entities');
});

// ── 3. URL Validation & Dangerous Scheme Rejection Tests ───────────────────────
console.log('\n--- 3. URL Scheme Validation Tests ---');

// Emulate frontend sanitizeUrl logic for backend node environment testing
function isSafeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const sanitized = url.trim().replace(/[\u0000-\u001F\u007F-\u009F\s]+/g, '');
  if (!sanitized) return false;
  if (sanitized.startsWith('/') || sanitized.startsWith('./') || sanitized.startsWith('../') || sanitized.startsWith('#')) return true;
  const colonIndex = sanitized.indexOf(':');
  if (colonIndex === -1) return true;
  const scheme = sanitized.slice(0, colonIndex).toLowerCase();
  const SAFE_SCHEMES = ['http', 'https', 'mailto', 'tel'];
  if (SAFE_SCHEMES.includes(scheme)) return true;
  if (scheme === 'blob' && /^blob:(https?:\/\/|null)/i.test(sanitized)) return true;
  return false;
}

await test('Permits legitimate http:, https:, relative, and blob: URLs', () => {
  assert(isSafeUrl('https://example.com/image.png'), 'https should be allowed');
  assert(isSafeUrl('http://localhost:10000/selfies/abc.jpg'), 'http should be allowed');
  assert(isSafeUrl('/billing/customer-copy/123'), 'Relative path should be allowed');
  assert(isSafeUrl('blob:http://localhost:5173/uuid-1234'), 'Safe blob URL should be allowed');
});

await test('Rejects dangerous javascript:, data:, and vbscript: URL schemes', () => {
  assert(!isSafeUrl('javascript:alert(document.cookie)'), 'javascript: must be blocked');
  assert(!isSafeUrl('JAVASCRIPT:alert(1)'), 'Uppercase JAVASCRIPT: must be blocked');
  assert(!isSafeUrl('java\x00script:alert(1)'), 'Control-char obfuscated javascript: must be blocked');
  assert(!isSafeUrl('  javascript:void(0)'), 'Leading whitespace javascript: must be blocked');
  assert(!isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), 'data: scheme must be blocked');
  assert(!isSafeUrl('vbscript:msgbox(1)'), 'vbscript: must be blocked');
});

// ── 4. Helmet Content Security Policy & Security Header Tests ───────────────────
console.log('\n--- 4. HTTP Security Headers & CSP Enforcement Tests ---');

await test('Enforces Content-Security-Policy on API responses', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  const csp = res.headers.get('content-security-policy');
  assert(csp, 'Expected Content-Security-Policy header on /health');
  assert(csp.includes("default-src 'self'"), 'CSP must specify default-src');
  assert(csp.includes("object-src 'none'"), 'CSP must block object-src plugins');
  assert(csp.includes("frame-ancestors 'self'"), 'CSP must restrict frame-ancestors');
  assert(csp.includes("base-uri 'self'"), 'CSP must restrict base-uri');
});

await test('Enforces X-Content-Type-Options: nosniff header', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  const nosniff = res.headers.get('x-content-type-options');
  assert(nosniff === 'nosniff', `Expected x-content-type-options: nosniff, got ${nosniff}`);
});

await test('Static file endpoint (/selfies) applies sandbox CSP and nosniff', async () => {
  const res = await fetch(`${BASE_URL}/selfies/test.svg`);
  const csp = res.headers.get('content-security-policy');
  const nosniff = res.headers.get('x-content-type-options');
  assert(csp && csp.includes('sandbox'), `Expected sandbox CSP on static file endpoint, got: ${csp}`);
  assert(nosniff === 'nosniff', 'Expected nosniff on static files');
});

await test('Ticket uploads endpoint (/uploads/tickets) applies sandbox CSP and nosniff', async () => {
  const res = await fetch(`${BASE_URL}/uploads/tickets/test.svg`);
  const csp = res.headers.get('content-security-policy');
  const nosniff = res.headers.get('x-content-type-options');
  assert(csp && csp.includes('sandbox'), `Expected sandbox CSP on ticket uploads endpoint, got: ${csp}`);
  assert(nosniff === 'nosniff', 'Expected nosniff on ticket uploads');
});

// ── 5. Error Responses Return JSON without Reflected Unsafe HTML ───────────────
console.log('\n--- 5. Error Handling & Reflected Payload Tests ---');

await test('Non-existent route with XSS in URI path returns structured JSON 404, not unescaped HTML', async () => {
  const maliciousPath = '/api/v1/invalid-<script>alert(1)</script>';
  const res = await fetch(`${BASE_URL}${maliciousPath}`);
  const contentType = res.headers.get('content-type') || '';
  assert(contentType.includes('application/json'), `Expected application/json, got ${contentType}`);
  const body = await res.text();
  assert(!body.includes('<script>alert(1)</script>'), `Expected raw script not reflected in body: ${body}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n================================================================');
const passed = results.filter(r => r.status === 'PASSED').length;
const failed = results.filter(r => r.status === 'FAILED').length;
console.log(`TOTAL XSS TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL XSS SECURITY AND REMEDIATION TESTS PASSED CLEANLY!\n');
}
