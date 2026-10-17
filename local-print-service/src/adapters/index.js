import BaseAdapter from "./BaseAdapter.js";
import OSSpoolerAdapter from "./OSSpoolerAdapter.js";
import NetworkTcpAdapter from "./NetworkTcpAdapter.js";
import DummyMockAdapter from "./DummyMockAdapter.js";

/**
 * Adapter Factory
 * Returns appropriate printer adapter instance based on configuration.
 */
export const getAdapter = (config = {}) => {
  const type = (config.connection_type || config.connectionType || "os_spooler").toLowerCase();

  switch (type) {
    case "network":
    case "tcp":
    case "lan":
    case "wifi":
      return new NetworkTcpAdapter(config);

    case "mock":
    case "dummy":
    case "test":
      return new DummyMockAdapter(config);

    case "os_spooler":
    case "spooler":
    case "usb":
    case "windows":
    default:
      return new OSSpoolerAdapter(config);
  }
};

export {
  BaseAdapter,
  OSSpoolerAdapter,
  NetworkTcpAdapter,
  DummyMockAdapter,
};

export default {
  getAdapter,
  BaseAdapter,
  OSSpoolerAdapter,
  NetworkTcpAdapter,
  DummyMockAdapter,
};
