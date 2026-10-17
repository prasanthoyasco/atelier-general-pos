import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Security Modules
import { getOrInitServiceToken, requirePrintToken, isValidToken } from "./src/security/tokenManager.js";
import { createHostGuard } from "./src/security/hostGuard.js";

// Queue & Adapters
import queue, { JobStatus } from "./src/queue/PersistentQueue.js";
import { getAdapter, OSSpoolerAdapter } from "./src/adapters/index.js";
import { buildReceipt, buildKOT, buildTestReceipt } from "./src/formatters/EscPosFormatter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.LOCAL_PRINT_PORT || 9123);
const defaultPrinter = process.env.THERMAL_PRINTER_NAME || "80mm Series Printer";
const SERVICE_VERSION = "2.0.0";
const startTime = Date.now();

// Initialize token on boot
const activeToken = getOrInitServiceToken();
console.log(`🔑 Service Pairing Token Initialized: ${activeToken.slice(0, 8)}...${activeToken.slice(-6)}`);

// ---------- 1. Host Header Guard (DNS Rebinding Protection) ----------
app.use(createHostGuard(port));

// ---------- 2. Strict Origin Validation (CORS) ----------
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://atelier-general-pos.vercel.app",
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow local non-browser requests or loopback
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, "").trim();

      const isAllowed =
        allowedOrigins.includes(cleanOrigin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin) ||
        /^https:\/\/atelier-general-pos(-[a-z0-9-]+)?\.vercel\.app$/.test(cleanOrigin);

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: Origin "${origin}" is not authorized for local hardware access.`), false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// ---------- 3. Background Queue Worker ----------
let isWorkerRunning = false;

const processQueue = async () => {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    let job = queue.getNextQueuedJob();
    while (job) {
      queue.updateJobStatus(job.id, JobStatus.PROCESSING);

      try {
        const adapter = getAdapter({
          connection_type: job.connection_type,
          target: job.printer_target,
          port: job.port,
        });

        // Generate or extract ESC/POS payload
        let rawData = job.payload;
        if (typeof rawData === "object" && rawData !== null && !Buffer.isBuffer(rawData)) {
          if (job.job_type === "kot") {
            rawData = buildKOT(rawData, job.metadata);
          } else if (job.job_type === "test") {
            rawData = buildTestReceipt(job.metadata);
          } else {
            rawData = buildReceipt(rawData, job.metadata);
          }
        }

        // Send to hardware adapter
        const result = await adapter.sendRaw(rawData, job.metadata);

        if (result.ok) {
          queue.updateJobStatus(job.id, JobStatus.COMPLETED, null, {
            written_bytes: result.writtenBytes,
            confirmed: result.confirmed,
          });
        } else {
          queue.updateJobStatus(job.id, JobStatus.FAILED, result.error || "Printer transmission failed");
        }
      } catch (err) {
        console.error(`❌ Print Job ${job.id} failed:`, err.message);
        queue.updateJobStatus(job.id, JobStatus.FAILED, err.message);
      }

      job = queue.getNextQueuedJob();
    }
  } finally {
    isWorkerRunning = false;
  }
};

// ---------- 4. Diagnostic & Health Endpoints ----------

app.get(["/health", "/healthz"], (req, res) => {
  res.json({
    ok: true,
    service: "Atelier Universal Local Print Service",
    version: SERVICE_VERSION,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    default_printer: defaultPrinter,
    port: port,
    queue: queue.getStats(),
  });
});

app.get("/pairing/token", (req, res) => {
  // Only accessible from local machine
  const remoteIp = req.socket.remoteAddress;
  const isLoopback = remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";

  if (!isLoopback) {
    return res.status(403).json({ error: "Pairing token retrieval is only allowed from local loopback interface." });
  }

  res.json({
    ok: true,
    pairing_token: getOrInitServiceToken(),
    instructions: "Add this token to your POS Terminal Settings to pair local thermal printers.",
  });
});

app.get("/diagnostics", requirePrintToken, (req, res) => {
  res.json({
    ok: true,
    version: SERVICE_VERSION,
    platform: process.platform,
    node_version: process.version,
    memory_usage: process.memoryUsage(),
    queue_stats: queue.getStats(),
    default_printer: defaultPrinter,
  });
});

// ---------- 5. Printer Enumeration & Testing Endpoints ----------

app.get("/printers", requirePrintToken, async (req, res) => {
  try {
    const printers = await OSSpoolerAdapter.listPrinters();
    res.json({
      ok: true,
      printers,
      default_printer: defaultPrinter,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/printers/test", requirePrintToken, async (req, res) => {
  try {
    const {
      printer_target,
      printer_name,
      connection_type = "os_spooler",
      port: destPort = 9100,
      paper_width = "80mm",
      has_cutter = true,
      has_cash_drawer = false,
      print_sample = false,
    } = req.body;

    const target = printer_target || printer_name || defaultPrinter;
    if (!target) {
      return res.status(400).json({ ok: false, error: "Printer target (name or IP) is required." });
    }

    const adapter = getAdapter({
      connection_type,
      target,
      port: destPort,
    });

    // 1. Connection check
    const testResult = await adapter.testConnection();
    if (!testResult.ok) {
      return res.status(400).json(testResult);
    }

    // 2. Optional sample print
    if (print_sample) {
      const sampleText = buildTestReceipt({
        paperWidth: paper_width,
        hasCutter: has_cutter,
        hasCashDrawer: has_cash_drawer,
      });

      const printResult = await adapter.sendRaw(sampleText);
      return res.json({
        ok: true,
        connection: testResult,
        print: printResult,
        message: `Test pattern sent to "${target}".`,
      });
    }

    res.json(testResult);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ---------- 6. Core Print Job Submission Endpoint ----------

app.post("/print", requirePrintToken, async (req, res) => {
  try {
    const {
      printer_name,
      printer_target,
      connection_type = "os_spooler",
      port: destPort = 9100,
      receipt_text,
      structured_data,
      bill,
      kot,
      job_type = "receipt",
      idempotency_key,
      paper_width = "80mm",
      columns,
      has_cutter = true,
      has_cash_drawer = false,
      allow_retry = false,
    } = req.body;

    const target = printer_target || printer_name || defaultPrinter;
    if (!target) {
      return res.status(400).json({ ok: false, error: "Printer target or name is required." });
    }

    const payload = receipt_text || structured_data || bill || kot;
    if (!payload) {
      return res.status(400).json({ ok: false, error: "Print content payload (receipt_text or structured_data) is required." });
    }

    // Stable Idempotency Key
    const safeKey = idempotency_key || `auto:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    const { job, isDuplicate, isRetry } = queue.enqueue({
      idempotencyKey: safeKey,
      printerTarget: target,
      connectionType: connection_type,
      port: destPort,
      jobType: job_type,
      payload: payload,
      metadata: {
        paperWidth: paper_width,
        columns: columns ? parseInt(columns, 10) : undefined,
        hasCutter: has_cutter,
        hasCashDrawer: has_cash_drawer,
      },
      allowRetry: allow_retry,
    });

    if (isDuplicate) {
      return res.json({
        ok: true,
        duplicate: true,
        job_id: job.id,
        status: job.status,
        printer_name: job.printer_target,
        message: `Existing print job recognized (${job.status}). Prevented duplicate printing.`,
      });
    }

    // Trigger queue processing asynchronously
    setImmediate(processQueue);

    res.json({
      ok: true,
      job_id: job.id,
      status: job.status,
      printer_name: job.printer_target,
      is_retry: Boolean(isRetry),
      message: "Job queued for printing.",
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// ---------- 7. Job Status Query Endpoint ----------

app.get("/jobs/:jobId", requirePrintToken, (req, res) => {
  const job = queue.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: "Print job not found." });
  }
  res.json({ ok: true, job });
});

// ---------- 8. Start Service ----------

app.listen(port, "127.0.0.1", () => {
  console.log(`=======================================================`);
  console.log(`🖨️  Atelier Universal Local Print Service v${SERVICE_VERSION}`);
  console.log(`   Listening at: http://127.0.0.1:${port}`);
  console.log(`   Default Printer: ${defaultPrinter}`);
  console.log(`=======================================================`);
});

export default app;
