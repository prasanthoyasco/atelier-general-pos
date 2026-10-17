/**
 * Printer Configuration & Multi-Role Storage Manager
 * Stores local hardware assignments, network IP targets, paper widths, and pairing tokens.
 */

export const CONFIGURED_PRINTERS_KEY = "atelierConfiguredPrinters";
export const LOCAL_PRINT_TOKEN_KEY = "localPrintServiceToken";

export const DEFAULT_BILLING_PRINTER = {
  id: "default-billing",
  name: "Cashier Thermal Printer",
  role: "billing", // 'billing', 'kot_station', 'both'
  kitchen_id: null,
  connection_type: "os_spooler", // 'os_spooler' | 'network'
  target: "80mm Series Printer",
  port: 9100,
  paper_width: "80mm",
  columns: 48,
  has_cutter: true,
  has_cash_drawer: true,
  is_default: true,
};

/**
 * Retrieves configured printers with backward-compatible migration
 */
export const getConfiguredPrinters = () => {
  try {
    const raw = localStorage.getItem(CONFIGURED_PRINTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Auto-migrate legacy single printer name if present
    const legacyName = localStorage.getItem("thermalPrinterName");
    const initialPrinters = [
      {
        ...DEFAULT_BILLING_PRINTER,
        target: legacyName ? legacyName.trim() : DEFAULT_BILLING_PRINTER.target,
        name: legacyName ? legacyName.trim() : DEFAULT_BILLING_PRINTER.name,
      },
    ];

    localStorage.setItem(CONFIGURED_PRINTERS_KEY, JSON.stringify(initialPrinters));
    return initialPrinters;
  } catch (err) {
    console.error("Failed to load configured printers:", err);
    return [DEFAULT_BILLING_PRINTER];
  }
};

/**
 * Persists printers list and notifies subscribers
 */
export const saveConfiguredPrinters = (printers = []) => {
  try {
    const valid = Array.isArray(printers) ? printers : [];
    localStorage.setItem(CONFIGURED_PRINTERS_KEY, JSON.stringify(valid));

    // Keep legacy key in sync with default billing printer for backward compatibility
    const defaultBilling = valid.find((p) => p.role === "billing" || p.role === "both") || valid[0];
    if (defaultBilling?.target) {
      localStorage.setItem("thermalPrinterName", defaultBilling.target);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("printersConfigUpdated", { detail: valid }));
    }

    return valid;
  } catch (err) {
    console.error("Failed to save configured printers:", err);
    return printers;
  }
};

/**
 * Resolves the appropriate printer with strict fallback hierarchy:
 * 1. Exact match for station `kitchen_id`
 * 2. Dedicated `kot_station` printer
 * 3. Default `billing` cashier printer
 * 4. First available printer
 */
export const getPrinterForRole = (role = "billing", kitchenId = null) => {
  const printers = getConfiguredPrinters();
  if (printers.length === 0) {
    return DEFAULT_BILLING_PRINTER;
  }

  // 1. Kitchen Station lookup
  if (kitchenId) {
    const matchedStation = printers.find(
      (p) => (p.role === "kot_station" || p.role === "both") && String(p.kitchen_id) === String(kitchenId)
    );
    if (matchedStation) return matchedStation;
  }

  // 2. Any KOT printer if role is KOT
  if (role === "kot" || role === "kot_station") {
    const kotPrinter = printers.find((p) => p.role === "kot_station" || p.role === "both");
    if (kotPrinter) return kotPrinter;
  }

  // 3. Billing printer
  const billingPrinter = printers.find((p) => p.role === "billing" || p.role === "both" || p.is_default);
  if (billingPrinter) return billingPrinter;

  // 4. Fallback to first printer
  return printers[0] || DEFAULT_BILLING_PRINTER;
};

/**
 * Service Pairing Token Accessors
 */
export const getPairingToken = () => {
  return localStorage.getItem(LOCAL_PRINT_TOKEN_KEY) || "";
};

export const savePairingToken = (token = "") => {
  const clean = String(token || "").trim();
  if (clean) {
    localStorage.setItem(LOCAL_PRINT_TOKEN_KEY, clean);
  } else {
    localStorage.removeItem(LOCAL_PRINT_TOKEN_KEY);
  }
  return clean;
};

export default {
  getConfiguredPrinters,
  saveConfiguredPrinters,
  getPrinterForRole,
  getPairingToken,
  savePairingToken,
};
