import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");
const JOURNAL_FILE = path.join(DATA_DIR, "print_jobs.json");

export const JobStatus = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  SUBMITTED: "SUBMITTED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  UNKNOWN_OUTCOME: "UNKNOWN_OUTCOME",
  CANCELLED: "CANCELLED",
};

export class PersistentQueue {
  constructor(options = {}) {
    this.storagePath = options.storagePath || JOURNAL_FILE;
    this.jobs = new Map(); // id -> job
    this.keyIndex = new Map(); // idempotencyKey -> job.id
    this.isProcessing = false;
    this.maxHistory = options.maxHistory || 1000;
    this.initStorage();
  }

  initStorage() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, "utf8");
        const list = JSON.parse(raw || "[]");
        if (Array.isArray(list)) {
          for (const item of list) {
            this.jobs.set(item.id, item);
            if (item.idempotency_key) {
              this.keyIndex.set(item.idempotency_key, item.id);
            }
          }
        }
      }

      // 🚨 CRASH RECOVERY: Handle in-flight jobs on startup
      this.recoverInFlightJobs();
    } catch (err) {
      console.error("⚠️ Failed to load print job journal, starting fresh:", err.message);
      this.jobs.clear();
      this.keyIndex.clear();
    }
  }

  /**
   * Recovers jobs that were left in PROCESSING or SUBMITTED state before service restart.
   * Crucial rule: Never automatically resend them to physical printers!
   */
  recoverInFlightJobs() {
    let recoveredCount = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === JobStatus.PROCESSING || job.status === JobStatus.SUBMITTED) {
        job.status = JobStatus.UNKNOWN_OUTCOME;
        job.error_details = "Service was restarted while job was in flight. Outcome uncertain; physical print cannot be verified.";
        job.updated_at = new Date().toISOString();
        job.retry_eligible = false;
        recoveredCount++;
      }
    }

    if (recoveredCount > 0) {
      console.warn(`⚠️ Crash Recovery: Reconciled ${recoveredCount} in-flight print job(s) to UNKNOWN_OUTCOME.`);
      this.persist();
    }
  }

  persist() {
    try {
      // Maintain bounded memory/file history
      const jobList = Array.from(this.jobs.values());
      if (jobList.length > this.maxHistory) {
        // Keep most recent maxHistory items
        jobList.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const pruned = jobList.slice(jobList.length - this.maxHistory);
        this.jobs.clear();
        this.keyIndex.clear();
        for (const item of pruned) {
          this.jobs.set(item.id, item);
          if (item.idempotency_key) {
            this.keyIndex.set(item.idempotency_key, item.id);
          }
        }
      }

      fs.writeFileSync(this.storagePath, JSON.stringify(Array.from(this.jobs.values()), null, 2), "utf8");
    } catch (err) {
      console.error("⚠️ Failed to persist print job journal:", err.message);
    }
  }

  /**
   * Enqueue a job using a stable idempotency key.
   * If a job already exists with this key:
   * - If not FAILED: returns existing job (prevents duplicate printing).
   * - If FAILED and allowRetry: re-queues the existing job.
   */
  enqueue({
    idempotencyKey,
    printerTarget,
    connectionType = "os_spooler",
    port = 9100,
    jobType = "receipt",
    payload,
    metadata = {},
    allowRetry = false,
  }) {
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      idempotencyKey = `auto:${crypto.randomUUID()}`;
    }

    const existingId = this.keyIndex.get(idempotencyKey);
    if (existingId) {
      const existing = this.jobs.get(existingId);
      if (existing) {
        // If it's already active or completed, return it immediately without printing twice
        if (
          existing.status === JobStatus.QUEUED ||
          existing.status === JobStatus.PROCESSING ||
          existing.status === JobStatus.SUBMITTED ||
          existing.status === JobStatus.COMPLETED ||
          existing.status === JobStatus.UNKNOWN_OUTCOME
        ) {
          return { job: existing, isDuplicate: true };
        }

        // If it failed and caller requested retry
        if (existing.status === JobStatus.FAILED && allowRetry) {
          existing.status = JobStatus.QUEUED;
          existing.attempt_count = (existing.attempt_count || 1) + 1;
          existing.error_details = null;
          existing.updated_at = new Date().toISOString();
          this.persist();
          return { job: existing, isDuplicate: false, isRetry: true };
        }

        return { job: existing, isDuplicate: true };
      }
    }

    const newJob = {
      id: crypto.randomUUID(),
      idempotency_key: idempotencyKey,
      printer_target: printerTarget,
      connection_type: connectionType,
      port: port,
      job_type: jobType,
      payload: payload,
      metadata: metadata,
      status: JobStatus.QUEUED,
      attempt_count: 1,
      max_attempts: 1, // Only 1 attempt for physical printing; explicit reprint required if uncertain
      error_details: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    };

    this.jobs.set(newJob.id, newJob);
    this.keyIndex.set(newJob.idempotency_key, newJob.id);
    this.persist();

    return { job: newJob, isDuplicate: false };
  }

  getJob(id) {
    return this.jobs.get(id) || null;
  }

  getJobByKey(key) {
    const id = this.keyIndex.get(key);
    return id ? this.jobs.get(id) || null : null;
  }

  updateJobStatus(id, status, errorDetails = null, extra = {}) {
    const job = this.jobs.get(id);
    if (!job) return null;

    job.status = status;
    job.updated_at = new Date().toISOString();

    if (errorDetails) {
      job.error_details = typeof errorDetails === "string" ? errorDetails : errorDetails.message || JSON.stringify(errorDetails);
    }

    if (status === JobStatus.COMPLETED) {
      job.completed_at = new Date().toISOString();
    }

    Object.assign(job, extra);
    this.persist();
    return job;
  }

  getNextQueuedJob() {
    for (const job of this.jobs.values()) {
      if (job.status === JobStatus.QUEUED) {
        return job;
      }
    }
    return null;
  }

  getStats() {
    const counts = {
      [JobStatus.QUEUED]: 0,
      [JobStatus.PROCESSING]: 0,
      [JobStatus.SUBMITTED]: 0,
      [JobStatus.COMPLETED]: 0,
      [JobStatus.FAILED]: 0,
      [JobStatus.UNKNOWN_OUTCOME]: 0,
    };

    for (const job of this.jobs.values()) {
      if (counts[job.status] !== undefined) {
        counts[job.status]++;
      }
    }

    return {
      total: this.jobs.size,
      by_status: counts,
    };
  }
}

export default new PersistentQueue();
