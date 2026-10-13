import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:10000';
const JWT_SECRET = process.env.JWT_SECRET || '3540e43edf1f1ed4811552d2b0d5a9fd1b4b23b8b7f0c48c83c621ed103454a6';

// Helper to make test tokens
function createTestToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h', algorithm: 'HS256' });
}

const results = [];

async function assertTest(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASSED' });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, status: 'FAILED', error: err.message });
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

console.log('========================================================');
console.log('       AUTOMATED SECURITY VERIFICATION TEST SUITE       ');
console.log('========================================================\n');

// 1. Unauthenticated access to protected user management
await assertTest('Unauthenticated access to GET /api/v1/user/ returns 401', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/user/`);
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

await assertTest('Unauthenticated access to POST /api/v1/user/ returns 401', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/user/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'attacker', password: 'password123' })
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

await assertTest('Unauthenticated access to GET /api/v1/user/role returns 401', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/user/role`);
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// 2. Unauthenticated access to marketing sensitive endpoints
await assertTest('Unauthenticated access to GET /api/v1/marketing/whatsapp/customers returns 401', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/marketing/whatsapp/customers`);
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

await assertTest('Unauthenticated access to POST /api/v1/marketing/whatsapp/send returns 401', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/marketing/whatsapp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignName: 'Spam', customerIds: [1] })
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// 3. Unauthenticated access to product and kitchen endpoints
await assertTest('Unauthenticated access to GET /api/v1/product/kitchens returns 401', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/product/kitchens`);
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

await assertTest('Unauthenticated access to POST /api/v1/product/product returns 401', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/product/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_name: 'Malicious Item' })
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// 4. Token validation: Tampered and expired tokens
await assertTest('Malformed JWT token returns 401', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/user/me`, {
    headers: { 'Authorization': 'Bearer invalid.token.payload' }
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

await assertTest('Forged JWT with wrong signature returns 401', async () => {
  const forged = jwt.sign({ id: 'attacker', role_name: 'super admin' }, 'wrong-secret-key-attacker');
  const res = await fetch(`${BASE_URL}/api/v1/user/me`, {
    headers: { 'Authorization': `Bearer ${forged}` }
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// 5. RBAC Authorization: Low-privilege user calling Admin/Role endpoints
await assertTest('Low-privilege user without user.manage calling POST /api/v1/user/ returns 403', async () => {
  const waiterToken = createTestToken({
    id: 'user-waiter-1',
    username: 'waiter',
    role_name: 'waiter',
    permissions: ['kot.view']
  });
  const res = await fetch(`${BASE_URL}/api/v1/user/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${waiterToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username: 'newuser', email: 'test@example.com' })
  });
  if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
});

await assertTest('Low-privilege user calling POST /api/v1/user/role returns 403', async () => {
  const waiterToken = createTestToken({
    id: 'user-waiter-1',
    username: 'waiter',
    role_name: 'waiter',
    permissions: ['kot.view']
  });
  const res = await fetch(`${BASE_URL}/api/v1/user/role`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${waiterToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role_name: 'new_role' })
  });
  if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
});

// 6. OTP Response Redaction
await assertTest('POST /api/v1/user/send-otp does NOT leak OTP code in response', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/user/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'test@example.com' })
  });
  const json = await res.json();
  if (json.otp) throw new Error(`OTP was leaked in API response: ${json.otp}`);
});

// 7. Security Headers (Helmet)
await assertTest('Helmet security headers present (X-Content-Type-Options: nosniff)', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  const nosniff = res.headers.get('x-content-type-options');
  if (nosniff !== 'nosniff') throw new Error(`Missing X-Content-Type-Options: nosniff header`);
});

// 8. CORS Unauthorized Origin Blocking
await assertTest('CORS blocks untrusted origin with credentialed request', async () => {
  const res = await fetch(`${BASE_URL}/api/v1/user/exists?email=test@example.com`, {
    headers: {
      'Origin': 'https://evil-attacker-site.com'
    }
  });
  // When CORS fails in our middleware, status is 403 or error is returned
  const allowOrigin = res.headers.get('access-control-allow-origin');
  if (allowOrigin === 'https://evil-attacker-site.com') {
    throw new Error('CORS allowed unauthorized origin: https://evil-attacker-site.com');
  }
});

// 9. Legitimate Public Health Endpoint
await assertTest('GET /health returns 200 with status ok', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`Expected data.status 'ok', got ${data.status}`);
});

console.log('\n========================================================');
const passed = results.filter(r => r.status === 'PASSED').length;
const failed = results.filter(r => r.status === 'FAILED').length;
console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('========================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL SECURITY INVARIANTS VERIFIED SUCCESSFULLY!');
  process.exit(0);
}
