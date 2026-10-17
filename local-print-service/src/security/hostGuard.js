/**
 * Host Header Guard Middleware
 * Protects local service against DNS Rebinding Attacks by strictly validating
 * that the Host header points to the expected local loopback address and port.
 */
export const createHostGuard = (expectedPort = 9123) => {
  const allowedHosts = new Set([
    `127.0.0.1:${expectedPort}`,
    `localhost:${expectedPort}`,
    `127.0.0.1`,
    `localhost`,
    `[::1]:${expectedPort}`,
    `[::1]`
  ]);

  return (req, res, next) => {
    const rawHost = req.headers["host"] || req.headers[":authority"];
    if (!rawHost) {
      return res.status(400).json({
        error: "Bad Request: Missing Host header.",
        code: "HOST_HEADER_MISSING"
      });
    }

    const host = String(rawHost).toLowerCase().trim();

    if (!allowedHosts.has(host)) {
      console.warn(`🛡️ Blocked request with untrusted Host header: "${host}" (Expected local loopback on port ${expectedPort})`);
      return res.status(403).json({
        error: "Forbidden: Invalid Host header. DNS rebinding protection activated.",
        code: "DNS_REBINDING_BLOCKED"
      });
    }

    next();
  };
};
