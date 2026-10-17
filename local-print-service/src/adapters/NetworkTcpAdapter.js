import net from "net";
import BaseAdapter from "./BaseAdapter.js";
import { validatePrinterDestination } from "../security/networkSanitizer.js";

/**
 * Direct Raw TCP Network Printer Adapter
 * Used for Ethernet and Wi-Fi thermal printers listening on raw port 9100.
 */
export class NetworkTcpAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);
    this.ip = config.target || config.ip;
    this.port = parseInt(config.port || 9100, 10);
    this.timeoutMs = parseInt(config.timeoutMs || 3500, 10);

    // Validate security boundaries immediately
    if (this.ip) {
      const sanitized = validatePrinterDestination(this.ip, this.port);
      this.ip = sanitized.ip;
      this.port = sanitized.port;
    }
  }

  /**
   * Tests TCP connection to printer port 9100
   */
  async testConnection() {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(this.timeoutMs);

      socket.connect(this.port, this.ip, () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ ok: true, message: `Connected to network printer at ${this.ip}:${this.port}` });
        }
      });

      socket.on("timeout", () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ ok: false, error: `Connection to ${this.ip}:${this.port} timed out after ${this.timeoutMs}ms` });
        }
      });

      socket.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({ ok: false, error: `Network printer connection error (${this.ip}:${this.port}): ${err.message}` });
        }
      });
    });
  }

  /**
   * Sends raw byte stream to printer
   */
  async sendRaw(data, options = {}) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = options.timeoutMs || this.timeoutMs;
      let handled = false;

      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");

      socket.setTimeout(timeout);

      socket.connect(this.port, this.ip, () => {
        socket.write(buffer, (err) => {
          if (err) {
            if (!handled) {
              handled = true;
              socket.destroy();
              reject(new Error(`Failed to transmit bytes to ${this.ip}:${this.port}: ${err.message}`));
            }
            return;
          }

          // Ensure all bytes flushed to printer before closing
          socket.end();
        });
      });

      socket.on("close", () => {
        if (!handled) {
          handled = true;
          resolve({
            ok: true,
            writtenBytes: buffer.length,
            confirmed: true, // socket drained and closed cleanly
            message: `Dispatched ${buffer.length} bytes to ${this.ip}:${this.port}`,
          });
        }
      });

      socket.on("timeout", () => {
        if (!handled) {
          handled = true;
          socket.destroy();
          reject(new Error(`Network print transmission timed out (${this.ip}:${this.port}) after ${timeout}ms`));
        }
      });

      socket.on("error", (err) => {
        if (!handled) {
          handled = true;
          socket.destroy();
          reject(new Error(`Network printer error (${this.ip}:${this.port}): ${err.message}`));
        }
      });
    });
  }

  getCapabilities() {
    return {
      supportsCut: true,
      supportsDrawer: true,
      supportsQr: true,
      supportsStatusCheck: false,
      supportsNetwork: true,
      supportsSpooler: false,
    };
  }
}

export default NetworkTcpAdapter;
