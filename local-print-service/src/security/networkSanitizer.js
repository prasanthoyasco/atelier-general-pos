import net from "net";

/**
 * Validates whether an IP address belongs to RFC 1918 Private IPv4 address spaces or loopback.
 * Disallows public internet IPs, link-local, multicast, or malformed addresses.
 */
export const isPrivateOrLocalIp = (ip) => {
  if (!ip || typeof ip !== "string") return false;

  const trimmed = ip.trim();
  if (!net.isIPv4(trimmed)) {
    return false;
  }

  const parts = trimmed.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b, c, d] = parts;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private class A)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private class B: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private class C)
  if (a === 192 && b === 168) return true;

  return false;
};

/**
 * Validates and sanitizes a destination printer IP and port.
 * Throws structured error if target is unauthorized.
 */
export const validatePrinterDestination = (ip, port = 9100) => {
  if (!ip || typeof ip !== "string") {
    throw new Error("Missing printer target IP address.");
  }

  const targetIp = ip.trim();
  const targetPort = parseInt(port, 10);

  if (!isPrivateOrLocalIp(targetIp)) {
    throw new Error(`Unauthorized printer destination "${targetIp}". Network thermal printers must reside on an authorized private local subnet (192.168.x.x, 10.x.x.x, 172.16-31.x.x, or 127.0.0.1).`);
  }

  if (isNaN(targetPort) || targetPort < 1024 || targetPort > 65535) {
    throw new Error(`Invalid printer port ${port}. Raw thermal printer ports must be between 1024 and 65535 (default 9100).`);
  }

  // Block ports typically associated with internal system services
  const blacklistedPorts = new Set([3306, 5432, 6379, 27017, 8080, 8000, 22, 23, 25, 445]);
  if (blacklistedPorts.has(targetPort)) {
    throw new Error(`Port ${targetPort} is restricted for security reasons.`);
  }

  return { ip: targetIp, port: targetPort };
};
