import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, "server.js");

const MAX_RAPID_CRASHES = 5;
const CRASH_WINDOW_MS = 30000;

let crashTimestamps = [];
let childProcess = null;
let isShuttingDown = false;

function startServer() {
  if (isShuttingDown) return;

  console.log(`[SUPERVISOR] Starting print service: node ${SERVER_PATH}`);

  childProcess = spawn(process.execPath, [SERVER_PATH], {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, SUPERVISED: "1" },
  });

  childProcess.on("exit", (code, signal) => {
    if (isShuttingDown) {
      console.log(`[SUPERVISOR] Service shutdown cleanly.`);
      process.exit(0);
      return;
    }

    const now = Date.now();
    crashTimestamps.push(now);
    crashTimestamps = crashTimestamps.filter((ts) => now - ts < CRASH_WINDOW_MS);

    console.warn(`[SUPERVISOR] Service process exited with code ${code}, signal ${signal}.`);

    if (crashTimestamps.length >= MAX_RAPID_CRASHES) {
      console.error(
        `🚨 [SUPERVISOR] Excessive crashes detected (${crashTimestamps.length} in 30s). Throttling restart for 15s to protect system resources...`
      );
      setTimeout(() => {
        crashTimestamps = [];
        startServer();
      }, 15000);
      return;
    }

    console.log(`[SUPERVISOR] Restarting print service in 1.5 seconds...`);
    setTimeout(startServer, 1500);
  });
}

function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[SUPERVISOR] Received ${signal}. Gracefully stopping print service...`);

  if (childProcess && !childProcess.killed) {
    childProcess.kill(signal);
    setTimeout(() => {
      if (!childProcess.killed) {
        console.warn(`[SUPERVISOR] Forcing termination of unresponsive child process.`);
        childProcess.kill("SIGKILL");
      }
      process.exit(0);
    }, 4000);
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

startServer();
