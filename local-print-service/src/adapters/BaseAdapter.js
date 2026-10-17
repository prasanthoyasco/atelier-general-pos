/**
 * Common Base Printer Adapter Interface
 * Every adapter (OS spooler, network socket, mock) must implement this contract.
 */
export class BaseAdapter {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Tests whether the printer is reachable and responsive.
   * Returns: { ok: boolean, message: string }
   */
  async testConnection() {
    throw new Error("testConnection() not implemented in adapter");
  }

  /**
   * Dispatches raw ESC/POS byte sequence or formatted string to printer.
   * Returns: { ok: boolean, writtenBytes: number, confirmed: boolean }
   */
  async sendRaw(data, options = {}) {
    throw new Error("sendRaw() not implemented in adapter");
  }

  /**
   * Reports capabilities supported by this adapter.
   */
  getCapabilities() {
    return {
      supportsCut: true,
      supportsDrawer: true,
      supportsQr: false,
      supportsStatusCheck: false,
      supportsNetwork: false,
      supportsSpooler: false,
    };
  }
}

export default BaseAdapter;
