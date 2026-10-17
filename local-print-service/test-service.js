import assert from "assert";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Security
import { getOrInitServiceToken, isValidToken } from "./src/security/tokenManager.js";
import { isPrivateOrLocalIp, validatePrinterDestination } from "./src/security/networkSanitizer.js";

// Queue & Adapters
import { PersistentQueue, JobStatus } from "./src/queue/PersistentQueue.js";
import { DummyMockAdapter } from "./src/adapters/DummyMockAdapter.js";
import { getAdapter } from "./src/adapters/index.js";
import { buildReceipt, buildKOT, normalizeText, padRow } from "./src/formatters/EscPosFormatter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_JOURNAL_FILE = path.join(__dirname, "data/test_jobs.json");

console.log("🧪 Starting Local Print Service Automated Test Suite...\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. Security Tests
// -------------------------------------------------------------
console.log("▶ 1. Security & Pairing Token Tests");

test("Token initialization produces a 64-char hex token", () => {
  const token = getOrInitServiceToken();
  assert.ok(token && token.length === 64, "Token should be 64 characters");
});

test("Token validation verifies exact match and rejects invalid", () => {
  const token = getOrInitServiceToken();
  assert.strictEqual(isValidToken(token), true, "Active token should be valid");
  assert.strictEqual(isValidToken("wrong-token"), false, "Wrong token should fail");
  assert.strictEqual(isValidToken(""), false, "Empty token should fail");
  assert.strictEqual(isValidToken(null), false, "Null token should fail");
});

test("Network IP Sanitizer permits private subnets and loopback", () => {
  assert.strictEqual(isPrivateOrLocalIp("127.0.0.1"), true);
  assert.strictEqual(isPrivateOrLocalIp("192.168.1.100"), true);
  assert.strictEqual(isPrivateOrLocalIp("10.0.0.50"), true);
  assert.strictEqual(isPrivateOrLocalIp("172.16.10.20"), true);
});

test("Network IP Sanitizer rejects public IPs and invalid inputs", () => {
  assert.strictEqual(isPrivateOrLocalIp("8.8.8.8"), false);
  assert.strictEqual(isPrivateOrLocalIp("142.250.190.46"), false);
  assert.strictEqual(isPrivateOrLocalIp("not-an-ip"), false);
  assert.strictEqual(isPrivateOrLocalIp(""), false);
});

test("Printer destination validator rejects restricted ports and public IPs", () => {
  assert.throws(() => validatePrinterDestination("8.8.8.8", 9100), /Unauthorized printer destination/);
  assert.throws(() => validatePrinterDestination("192.168.1.100", 3306), /restricted for security/);
  assert.throws(() => validatePrinterDestination("192.168.1.100", 80), /between 1024 and 65535/);

  const valid = validatePrinterDestination("192.168.1.150", 9100);
  assert.strictEqual(valid.ip, "192.168.1.150");
  assert.strictEqual(valid.port, 9100);
});

// -------------------------------------------------------------
// 2. Persistent Queue & Idempotency Tests
// -------------------------------------------------------------
console.log("\n▶ 2. Persistent Queue & Idempotency Tests");

// Clean test journal
if (fs.existsSync(TEST_JOURNAL_FILE)) {
  fs.unlinkSync(TEST_JOURNAL_FILE);
}

const testQueue = new PersistentQueue({ storagePath: TEST_JOURNAL_FILE });

test("Enqueue creates job with QUEUED status and persists to disk", () => {
  const result = testQueue.enqueue({
    idempotencyKey: "b_1:receipt:101:billing:original",
    printerTarget: "80mm Test",
    payload: "Sample Receipt",
  });

  assert.strictEqual(result.isDuplicate, false);
  assert.strictEqual(result.job.status, JobStatus.QUEUED);
  assert.strictEqual(result.job.attempt_count, 1);
  assert.ok(fs.existsSync(TEST_JOURNAL_FILE), "Journal file must exist on disk");
});

test("Re-enqueueing with the exact same key prevents duplicate print", () => {
  const dupResult = testQueue.enqueue({
    idempotencyKey: "b_1:receipt:101:billing:original",
    printerTarget: "80mm Test",
    payload: "Sample Receipt Again",
  });

  assert.strictEqual(dupResult.isDuplicate, true);
  assert.strictEqual(dupResult.job.status, JobStatus.QUEUED);
});

test("Queue status transitions update state and completed timestamp", () => {
  const job = testQueue.getNextQueuedJob();
  assert.ok(job, "Should find queued job");

  testQueue.updateJobStatus(job.id, JobStatus.PROCESSING);
  assert.strictEqual(testQueue.getJob(job.id).status, JobStatus.PROCESSING);

  testQueue.updateJobStatus(job.id, JobStatus.COMPLETED);
  const completed = testQueue.getJob(job.id);
  assert.strictEqual(completed.status, JobStatus.COMPLETED);
  assert.ok(completed.completed_at, "completed_at should be set");
});

test("Crash recovery transitions abandoned PROCESSING/SUBMITTED jobs to UNKNOWN_OUTCOME without resending", () => {
  // Inject an in-flight job simulating a sudden power failure or process kill
  const crashJob = testQueue.enqueue({
    idempotencyKey: "b_1:receipt:999:billing:crash_test",
    printerTarget: "80mm Crash",
    payload: "Data In Flight",
  });
  testQueue.updateJobStatus(crashJob.job.id, JobStatus.PROCESSING);

  // Re-instantiate queue to simulate restart
  const restartedQueue = new PersistentQueue({ storagePath: TEST_JOURNAL_FILE });
  const recoveredJob = restartedQueue.getJob(crashJob.job.id);

  assert.strictEqual(recoveredJob.status, JobStatus.UNKNOWN_OUTCOME);
  assert.ok(recoveredJob.error_details.includes("Service was restarted"));
});

// -------------------------------------------------------------
// 3. ESC/POS Formatter & Encoding Tests
// -------------------------------------------------------------
console.log("\n▶ 3. ESC/POS Formatter & Currency Encoding Tests");

test("Currency normalization maps ₹ to Rs. and preserves numbers", () => {
  const raw = "Total: ₹1,500.00";
  const normalized = normalizeText(raw);
  assert.strictEqual(normalized, "Total: Rs.1,500.00");
});

test("PadRow correctly aligns text for 48 and 32 column profiles", () => {
  const row48 = padRow("Item Total", "Rs.250.00", 48);
  assert.strictEqual(row48.length, 48);
  assert.ok(row48.startsWith("Item Total"));
  assert.ok(row48.endsWith("Rs.250.00"));

  const row32 = padRow("Tax", "Rs.12.50", 32);
  assert.strictEqual(row32.length, 32);
});

test("buildReceipt generates valid ESC/POS commands with cut and store header", () => {
  const sampleBill = {
    billing_no: "BILL-2026-001",
    billing_date: new Date().toISOString(),
    customer_name: "John Doe",
    payment_method: "cash",
    receiptProfile: { storeName: "Test Cafe" },
    items: [
      { product_name: "Filter Coffee", quantity: 2, total_price: 60 },
      { product_name: "Masala Dosa", quantity: 1, total_price: 90 },
    ],
    total_amount: 150,
  };

  const receipt = buildReceipt(sampleBill, { paperWidth: "80mm", columns: 48 });
  assert.ok(receipt.includes("Test Cafe"));
  assert.ok(receipt.includes("BILL-2026-001"));
  assert.ok(receipt.includes("Filter Coffee"));
  assert.ok(receipt.includes("TOTAL AMOUNT:"));
  assert.ok(receipt.includes("\x1DV\x01"), "Should include cut command");
});

test("buildKOT formats kitchen station, table number, and order items", () => {
  const sampleKOT = {
    kot_number: "KOT-042",
    kitchen_name: "Bar Counter",
    table_name: "Table 4",
    items: [
      { product_name: "Fresh Lime Soda", quantity: 2, notes: "Less sugar" },
    ],
  };

  const kot = buildKOT(sampleKOT, { paperWidth: "58mm", columns: 32 });
  assert.ok(kot.includes("KITCHEN TICKET"));
  assert.ok(kot.includes("BAR COUNTER"));
  assert.ok(kot.includes("Table 4"));
  assert.ok(kot.includes("Fresh Lime Soda"));
  assert.ok(kot.includes("Less sugar"));
});

// -------------------------------------------------------------
// 4. Adapter Interface Tests
// -------------------------------------------------------------
console.log("\n▶ 4. Adapter Interface Tests");

test("Adapter factory instantiates correct adapter by connection_type", () => {
  const mockAdapter = getAdapter({ connection_type: "mock" });
  assert.ok(mockAdapter instanceof DummyMockAdapter);

  const netAdapter = getAdapter({ connection_type: "network", target: "192.168.1.100" });
  assert.strictEqual(netAdapter.ip, "192.168.1.100");
});

await asyncTest("DummyMockAdapter records print jobs and handles connection test", async () => {
  const mock = new DummyMockAdapter();
  const conn = await mock.testConnection();
  assert.strictEqual(conn.ok, true);

  const res = await mock.sendRaw("Hello ESC/POS");
  assert.strictEqual(res.ok, true);
  assert.strictEqual(mock.printHistory.length, 1);
  assert.strictEqual(mock.printHistory[0].bytes, 13);
});

// Cleanup test journal
if (fs.existsSync(TEST_JOURNAL_FILE)) {
  fs.unlinkSync(TEST_JOURNAL_FILE);
}

// -------------------------------------------------------------
// Test Summary
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 All Stage 1 tests passed successfully!\n");
  process.exit(0);
}
