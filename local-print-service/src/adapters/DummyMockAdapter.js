import BaseAdapter from "./BaseAdapter.js";

/**
 * Mock / Dummy Printer Adapter
 * Used for automated tests, development, and validation without physical hardware.
 */
export class DummyMockAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config);
    this.printHistory = [];
    this.simulateFailure = config.simulateFailure || false;
    this.simulateTimeout = config.simulateTimeout || false;
  }

  async testConnection() {
    if (this.simulateFailure) {
      return { ok: false, error: "Mock printer connection simulated failure" };
    }
    return { ok: true, message: "Mock printer connection verified" };
  }

  async sendRaw(data, options = {}) {
    if (this.simulateTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      throw new Error("Mock printer connection timed out");
    }

    if (this.simulateFailure) {
      throw new Error("Mock printer device reported error");
    }

    const byteLength = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(String(data), "utf8");
    const record = {
      timestamp: new Date().toISOString(),
      bytes: byteLength,
      preview: String(data).slice(0, 100),
      options,
    };

    this.printHistory.push(record);

    return {
      ok: true,
      writtenBytes: byteLength,
      confirmed: true,
      message: `Mock print accepted (${byteLength} bytes)`,
    };
  }

  getCapabilities() {
    return {
      supportsCut: true,
      supportsDrawer: true,
      supportsQr: true,
      supportsStatusCheck: true,
      supportsNetwork: false,
      supportsSpooler: false,
      isMock: true,
    };
  }

  clearHistory() {
    this.printHistory = [];
  }
}

export default DummyMockAdapter;
