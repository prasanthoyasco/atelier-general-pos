import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE_PATH = path.join(__dirname, "../../.service-token");

let cachedToken = null;

/**
 * Initializes or retrieves the local service authentication token.
 * Can be overridden via PRINT_SERVICE_TOKEN environment variable.
 */
export const getOrInitServiceToken = () => {
  if (process.env.PRINT_SERVICE_TOKEN && process.env.PRINT_SERVICE_TOKEN.trim()) {
    cachedToken = process.env.PRINT_SERVICE_TOKEN.trim();
    return cachedToken;
  }

  if (cachedToken) {
    return cachedToken;
  }

  try {
    if (fs.existsSync(TOKEN_FILE_PATH)) {
      const existing = fs.readFileSync(TOKEN_FILE_PATH, "utf8").trim();
      if (existing && existing.length >= 16) {
        cachedToken = existing;
        return cachedToken;
      }
    }
  } catch (err) {
    console.warn("⚠️ Could not read .service-token file, generating new token:", err.message);
  }

  // Generate a cryptographically secure 32-byte hex token (64 chars)
  const newToken = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(TOKEN_FILE_PATH, newToken, { encoding: "utf8", mode: 0o600 });
    console.log("🔒 Generated new local print service pairing token.");
  } catch (err) {
    console.warn("⚠️ Failed to write .service-token to disk, keeping in memory:", err.message);
  }

  cachedToken = newToken;
  return cachedToken;
};

/**
 * Validates a candidate token against the active service token using timing-safe comparison.
 */
export const isValidToken = (candidateToken) => {
  if (!candidateToken || typeof candidateToken !== "string") {
    return false;
  }

  const activeToken = getOrInitServiceToken();
  if (!activeToken) return false;

  const candidateBuf = Buffer.from(candidateToken.trim());
  const activeBuf = Buffer.from(activeToken);

  if (candidateBuf.length !== activeBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuf, activeBuf);
};

/**
 * Express middleware to enforce pairing token on sensitive printing routes.
 */
export const requirePrintToken = (req, res, next) => {
  // Allow health checks without token so status monitors work
  if (req.path === "/health" || req.path === "/healthz") {
    return next();
  }

  const headerToken = req.headers["x-local-print-token"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  const queryToken = req.query.token;
  const token = headerToken || queryToken;

  if (!isValidToken(token)) {
    return res.status(401).json({
      error: "Unauthorized: Invalid or missing X-Local-Print-Token header.",
      code: "AUTH_TOKEN_INVALID",
      hint: "Pair this cashier terminal in POS Settings > Thermal Printer using the pairing token.",
    });
  }

  next();
};
