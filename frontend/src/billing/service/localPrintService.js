import {
  getPrinterForRole,
  getPairingToken,
  savePairingToken,
} from "./printerSettings.js";

const LOCAL_PRINT_URL = import.meta.env.VITE_LOCAL_PRINT_URL || "http://127.0.0.1:9123";

const money = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

/**
 * Text normalizer replacing ₹ with Rs. and stripping non-printable characters
 */
const clean = (value = "") =>
  String(value || "")
    .replace(/₹/g, "Rs.")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E\r\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const padRow = (left, right, width = 48) => {
  const safeLeft = clean(left);
  const safeRight = clean(right);
  const space = Math.max(1, width - safeLeft.length - safeRight.length);
  return `${safeLeft}${" ".repeat(space)}${safeRight}`;
};

const wrapLine = (text, width = 48) => {
  const words = clean(text).split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
};

const format3Col = (c1, c2, c3, width = 48) => {
  const col3Width = Math.max(9, Math.floor(width * 0.22));
  const col2Width = Math.max(7, Math.floor(width * 0.18));
  const col1Width = Math.max(12, width - col2Width - col3Width - 2);

  const part1 = clean(c1).slice(0, col1Width).padEnd(col1Width, " ");
  const part2 = clean(c2).padStart(col2Width, " ");
  const part3 = clean(c3).padStart(col3Width, " ");

  return `${part1} ${part2} ${part3}`;
};

const itemName = (item) =>
  item.product?.product_name || item.product_name || item.name || "Item";

const itemCode = (item) =>
  item.product?.product_code || item.product_code || item.barcode || "";

const getReceiptProfile = (billing) => billing.receiptProfile || {};

const getTotalQty = (items) =>
  items.reduce((sum, item) => sum + Number(item.quantity || item.qty || 0), 0);

const getFooterTerms = (profile) =>
  String(profile.footerTerms || "")
    .split(/\r?\n/)
    .map((line) => clean(line))
    .filter(Boolean);

const formatDateTime = (value) => {
  const date = new Date(value || Date.now());
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatPayment = (value) =>
  clean(String(value || "").replace(/_/g, " "))
    .replace(/\b\w/g, (char) => char.toUpperCase());

const itemAmount = (item) =>
  Number(item.total_price || Number(item.quantity || item.qty || 0) * Number(item.unit_price || item.price || 0));

/**
 * Builds formatted ESC/POS Receipt with dynamic column width
 */
export const buildEscPosReceipt = (billing, options = {}) => {
  const width = options.columns || (options.paperWidth === "58mm" ? 32 : 48);
  const items = billing.items || billing.billing_items || [];
  const subtotal =
    Number(billing.subtotal_amount) ||
    items.reduce((sum, item) => sum + Number(item.unit_price || item.price || 0) * Number(item.quantity || item.qty || 0), 0);
  const discount = Number(billing.discount_amount || billing.discount || 0);
  const tax =
    Number(billing.tax_amount || billing.tax || 0) ||
    items.reduce((sum, item) => sum + Number(item.tax || item.tax_amount || 0), 0);
  const total =
    Number(billing.total_amount || billing.grand_total) ||
    Math.max(0, subtotal - discount + tax);
  const paid = Number(billing.paid_amount || total);
  const due = Number(billing.due_amount || Math.max(0, total - paid));
  const profile = getReceiptProfile(billing);
  const addressLines = profile.addressLines || (profile.address ? [profile.address] : []);
  const footerTerms = getFooterTerms(profile);
  const phone = billing.customer_phone || billing.customer?.customer_phone || "";

  const lines = [
    "\x1B\x40", // Initialize
  ];

  if (options.hasCashDrawer) {
    lines.push("\x1B\x70\x00\x19\xFA"); // Drawer kick
  }

  // Header
  lines.push(
    "\x1B\x61\x01", // Center
    "\x1B\x45\x01\x1D\x21\x11" + clean(profile.storeName || "Pozhudhu") + "\x1D\x21\x00\x1B\x45\x00"
  );

  addressLines.forEach((line) => {
    wrapLine(line, width).forEach((part) => lines.push(part));
  });

  if (profile.cell1 || profile.cell2) {
    lines.push(clean(`Tel: ${[profile.cell1, profile.cell2].filter(Boolean).join(", ")}`));
  }

  if (profile.gstin) {
    lines.push(clean(`GSTIN: ${profile.gstin}`));
  }

  lines.push(
    "",
    "\x1B\x45\x01" + clean(profile.billTitle || "TAX INVOICE") + "\x1B\x45\x00",
    "\x1B\x61\x00", // Left
    "-".repeat(width),
    padRow("Bill No:", billing.billing_no || billing.bill_no || "-", width),
    padRow("Date:", formatDateTime(billing.billing_date), width),
    padRow("Customer:", billing.customer_name || "Walk-in Customer", width),
    phone ? padRow("Phone:", phone, width) : "",
    billing.counter_no ? padRow("Counter/Table:", billing.counter_no, width) : "",
    billing.payment_method ? padRow("Payment:", formatPayment(billing.payment_method), width) : "",
    "-".repeat(width)
  );

  // Column header
  if (width >= 40) {
    lines.push(format3Col("DESCRIPTION", "QTY", "AMOUNT", width));
  } else {
    lines.push(padRow("ITEM (QTY)", "AMOUNT", width));
  }
  lines.push("-".repeat(width));

  for (const item of items) {
    const qty = Number(item.quantity || item.qty || 0);
    const amount = itemAmount(item);
    const name = clean(itemName(item));

    if (width >= 40) {
      lines.push(format3Col(name, `${qty} Nos`, amount.toFixed(2), width));
    } else {
      lines.push(padRow(`${name.slice(0, 14)} (${qty}x)`, `Rs.${amount.toFixed(2)}`, width));
    }

    if (Array.isArray(item.addons) && item.addons.length > 0) {
      const addonText = item.addons.map((a) => `+ ${a.addon_name || a.name || "Addon"}`).join(", ");
      lines.push(`  ${clean(addonText).slice(0, width - 2)}`);
    }
    if (itemCode(item)) lines.push(clean(itemCode(item)).slice(0, width));
  }

  lines.push("-".repeat(width));

  if (tax > 0) lines.push(padRow("Tax:", `Rs.${tax.toFixed(2)}`, width));
  if (discount > 0) lines.push(padRow("Discount:", `-Rs.${discount.toFixed(2)}`, width));

  const totalText = `Rs.${Number(total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const received = Number(billing.received_amount || 0);
  const balance = Math.max(0, received - total);

  lines.push(
    "\x1B\x45\x01" + padRow("NET AMOUNT:", totalText, width) + "\x1B\x45\x00",
    "-".repeat(width),
    padRow("Total Items:", String(items.length), width),
    padRow("Total Qty:", Number(getTotalQty(items)).toFixed(2), width),
    discount > 0 ? padRow("Today Savings:", money(discount), width) : "",
    received > 0 ? padRow("Amount Received:", money(received), width) : "",
    received > 0 ? padRow("Balance/Change:", money(balance), width) : "",
    due > 0 ? padRow("Due:", money(due), width) : ""
  );

  if (profile.footerTitle || footerTerms.length > 0) {
    lines.push("", clean(profile.footerTitle || "Terms & Conditions:"));
    footerTerms.slice(0, 3).forEach((term, index) => lines.push(`${index + 1}. ${term}`));
  }

  lines.push(
    "\x1B\x61\x01",
    "\n\n\n",
    options.hasCutter !== false ? "\x1D\x56\x01" : "" // Partial cut
  );

  return lines.filter(Boolean).join("\n");
};

/**
 * Builds formatted ESC/POS Kitchen Order Ticket (KOT)
 */
export const buildEscPosKOT = (kot, options = {}) => {
  const width = options.columns || (options.paperWidth === "58mm" ? 32 : 48);
  const station = kot.kitchen_name || "MAIN KITCHEN";

  const lines = [
    "\x1B\x40", // Initialize
    "\x1B\x61\x01", // Center
    "\x1B\x45\x01\x1D\x21\x11* KITCHEN TICKET *\x1D\x21\x00\x1B\x45\x00",
    `\x1B\x45\x01[ ${clean(station).toUpperCase()} ]\x1B\x45\x00`,
    "\x1B\x61\x00", // Left
    "=".repeat(width),
    padRow("KOT No:", kot.kot_number || "N/A", width),
    padRow("Table/Counter:", kot.table_name || kot.counter_no || "Takeaway", width),
    padRow("Order Ref:", kot.billing_no || kot.bill_no || "POS", width),
    padRow("Time:", new Date(kot.createdAt || Date.now()).toLocaleTimeString("en-IN"), width),
    kot.waiter_name || kot.server_name ? padRow("Server:", kot.waiter_name || kot.server_name, width) : "",
    "=".repeat(width),
    padRow("ITEM DESCRIPTION", "QTY", width),
    "-".repeat(width),
  ];

  const items = kot.items || [];
  for (const item of items) {
    const name = clean(item.product_name || item.name || "Item");
    const qty = Number(item.quantity || item.qty || 1);

    lines.push(`\x1B\x45\x01${padRow(name, `x ${qty}`, width)}\x1B\x45\x00`);

    if (Array.isArray(item.addons) && item.addons.length > 0) {
      const addonText = item.addons.map((a) => `+ ${a.addon_name || a.name}`).join(", ");
      wrapLine(`  [Addon: ${addonText}]`, width).forEach((l) => lines.push(l));
    }

    if (item.notes || item.special_instructions) {
      wrapLine(`  * Note: ${item.notes || item.special_instructions}`, width).forEach((l) => lines.push(l));
    }
  }

  lines.push(
    "-".repeat(width),
    "\n\n\n",
    options.hasCutter !== false ? "\x1D\x56\x01" : ""
  );

  return lines.filter(Boolean).join("\n");
};

/**
 * Low-level HTTP Dispatcher to Local Print Service
 */
const requestLocalPrintService = async (path, options = {}) => {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 10000;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const pairingToken = getPairingToken();
  const headers = {
    "Content-Type": "application/json",
    ...(pairingToken ? { "X-Local-Print-Token": pairingToken } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${LOCAL_PRINT_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Print service did not respond within ${timeoutMs}ms.`);
    }
    throw new Error("Local print service is not running or unreachable at " + LOCAL_PRINT_URL);
  } finally {
    window.clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Local print service returned status ${response.status}`);
    err.code = data.code;
    err.status = response.status;
    throw err;
  }
  return data;
};

// Public API
export const checkLocalPrintService = () => requestLocalPrintService("/health", { timeoutMs: 3000 });

export const findLocalPrinters = async () => {
  const data = await requestLocalPrintService("/printers", { timeoutMs: 8000 });
  return data.printers || [];
};

/**
 * Attempts auto-pairing with local print service on loopback
 */
export const autoPairService = async () => {
  try {
    const data = await requestLocalPrintService("/pairing/token", { timeoutMs: 3000 });
    if (data.pairing_token) {
      savePairingToken(data.pairing_token);
      return data.pairing_token;
    }
  } catch (err) {
    console.warn("Auto-pairing with local print service skipped:", err.message);
  }
  return null;
};

/**
 * Tests connection and optionally prints a test ticket
 */
export const testPrinterLocally = async (printerConfig, printSample = true) => {
  return requestLocalPrintService("/printers/test", {
    method: "POST",
    timeoutMs: 12000,
    body: JSON.stringify({
      printer_target: printerConfig.target,
      connection_type: printerConfig.connection_type || "os_spooler",
      port: printerConfig.port || 9100,
      paper_width: printerConfig.paper_width || "80mm",
      has_cutter: printerConfig.has_cutter !== false,
      has_cash_drawer: Boolean(printerConfig.has_cash_drawer),
      print_sample: printSample,
    }),
  });
};

/**
 * Prints Customer / Billing Receipt
 */
export const printReceiptLocally = async (billing, printerNameOverride, options = {}) => {
  const printer = printerNameOverride
    ? { target: printerNameOverride, connection_type: "os_spooler" }
    : getPrinterForRole("billing");

  const receiptText = buildEscPosReceipt(billing, {
    paperWidth: printer.paper_width || "80mm",
    columns: printer.columns || (printer.paper_width === "58mm" ? 32 : 48),
    hasCutter: printer.has_cutter !== false,
    hasCashDrawer: Boolean(printer.has_cash_drawer),
  });

  const branchId = billing.branch_id || "main";
  const billId = billing.id || billing.billing_no || Date.now().toString();
  const idempotencyKey = options.idempotencyKey || `${branchId}:receipt:${billId}:billing:${options.isReprint ? "reprint:" + (options.reprintId || Date.now()) : "original"}`;

  const data = await requestLocalPrintService("/print", {
    method: "POST",
    timeoutMs: 12000,
    body: JSON.stringify({
      printer_target: printer.target,
      connection_type: printer.connection_type || "os_spooler",
      port: printer.port || 9100,
      receipt_text: receiptText,
      job_type: "receipt",
      idempotency_key: idempotencyKey,
      allow_retry: Boolean(options.allowRetry),
    }),
  });

  return {
    printer_name: printer.target,
    job_id: data.job_id,
    duplicate: Boolean(data.duplicate),
    status: data.status,
  };
};

/**
 * Prints Station Kitchen Order Ticket (KOT)
 */
export const printKOTLocally = async (kot, printerOverride, options = {}) => {
  const printer = printerOverride || getPrinterForRole("kot_station", kot.kitchen_id);

  const kotText = buildEscPosKOT(kot, {
    paperWidth: printer.paper_width || "80mm",
    columns: printer.columns || (printer.paper_width === "58mm" ? 32 : 48),
    hasCutter: printer.has_cutter !== false,
  });

  const branchId = kot.branch_id || "main";
  const kotId = kot.id || kot.kot_number || Date.now().toString();
  const stationId = kot.kitchen_id || "main_station";
  const idempotencyKey = options.idempotencyKey || `${branchId}:kot:${kotId}:${stationId}:${options.isReprint ? "reprint:" + (options.reprintId || Date.now()) : "original"}`;

  const data = await requestLocalPrintService("/print", {
    method: "POST",
    timeoutMs: 12000,
    body: JSON.stringify({
      printer_target: printer.target,
      connection_type: printer.connection_type || "os_spooler",
      port: printer.port || 9100,
      receipt_text: kotText,
      job_type: "kot",
      idempotency_key: idempotencyKey,
      allow_retry: Boolean(options.allowRetry),
    }),
  });

  return {
    printer_name: printer.target,
    job_id: data.job_id,
    duplicate: Boolean(data.duplicate),
    status: data.status,
  };
};

export default {
  buildEscPosReceipt,
  buildEscPosKOT,
  checkLocalPrintService,
  findLocalPrinters,
  autoPairService,
  testPrinterLocally,
  printReceiptLocally,
  printKOTLocally,
};
