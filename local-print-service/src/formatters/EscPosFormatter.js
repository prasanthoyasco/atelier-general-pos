/**
 * Universal ESC/POS Text & Command Formatter
 * Supports dynamic column widths (32 to 56 cols), alignment, bolding,
 * partial/full paper cuts, and cash drawer kick pulses.
 */

export const ESC = "\x1B";
export const GS = "\x1D";

export const COMMANDS = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_SIZE_ON: `${GS}!\x11`,
  DOUBLE_HEIGHT_ON: `${GS}!\x01`,
  DOUBLE_WIDTH_ON: `${GS}!\x10`,
  NORMAL_SIZE: `${GS}!\x00`,
  CUT_FULL: `${GS}V\x00`,
  CUT_PARTIAL: `${GS}V\x01`,
  DRAWER_PIN2: `${ESC}p\x00\x19\xFA`, // 25ms pulse to pin 2
  DRAWER_PIN5: `${ESC}p\x01\x19\xFA`, // 25ms pulse to pin 5
};

/**
 * Normalizes text for ESC/POS receipt printers:
 * - Maps ₹ to 'Rs.'
 * - Replaces non-ASCII smart quotes and dashes
 * - Preserves readable text without garbage spitting
 */
export const normalizeText = (value = "") => {
  return String(value || "")
    .replace(/₹/g, "Rs.")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E\r\n\t]/g, "")
    .replace(/[\t ]+/g, " ")
    .trim();
};

export const padRow = (left, right, width = 48) => {
  const safeLeft = normalizeText(left);
  const safeRight = normalizeText(right);
  const space = Math.max(1, width - safeLeft.length - safeRight.length);
  return `${safeLeft}${" ".repeat(space)}${safeRight}`;
};

export const wrapText = (text, width = 48) => {
  const words = normalizeText(text).split(" ").filter(Boolean);
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

export const format3Col = (col1, col2, col3, width = 48) => {
  const c1 = normalizeText(col1);
  const c2 = normalizeText(col2);
  const c3 = normalizeText(col3);

  const col3Width = Math.max(9, Math.floor(width * 0.22));
  const col2Width = Math.max(8, Math.floor(width * 0.18));
  const col1Width = Math.max(12, width - col2Width - col3Width - 2);

  const part1 = c1.slice(0, col1Width).padEnd(col1Width, " ");
  const part2 = c2.padStart(col2Width, " ");
  const part3 = c3.padStart(col3Width, " ");

  return `${part1} ${part2} ${part3}`;
};

/**
 * Builds standard Cashier Receipt
 */
export const buildReceipt = (bill, options = {}) => {
  const width = options.columns || (options.paperWidth === "58mm" ? 32 : 48);
  const cut = options.hasCutter !== false;
  const kickDrawer = Boolean(options.hasCashDrawer);

  const lines = [COMMANDS.INIT];

  if (kickDrawer) {
    lines.push(COMMANDS.DRAWER_PIN2);
  }

  // Header / Store Info
  const profile = bill.receiptProfile || {};
  const storeName = profile.storeName || bill.branch?.branch_name || "Atelier General POS";

  lines.push(COMMANDS.ALIGN_CENTER);
  lines.push(`${COMMANDS.BOLD_ON}${COMMANDS.DOUBLE_SIZE_ON}${normalizeText(storeName)}${COMMANDS.NORMAL_SIZE}${COMMANDS.BOLD_OFF}`);

  const addressLines = profile.addressLines || (profile.address ? [profile.address] : []);
  addressLines.forEach((addr) => {
    wrapText(addr, width).forEach((l) => lines.push(l));
  });

  if (profile.cell1 || profile.cell2 || profile.phone) {
    const p1 = profile.cell1 || profile.phone;
    const p2 = profile.cell2;
    lines.push(normalizeText(`Tel: ${[p1, p2].filter(Boolean).join(", ")}`));
  }

  if (profile.gstin) {
    lines.push(normalizeText(`GSTIN: ${profile.gstin}`));
  }

  lines.push("");
  lines.push(`${COMMANDS.BOLD_ON}${normalizeText(profile.billTitle || "TAX INVOICE")}${COMMANDS.BOLD_OFF}`);
  lines.push(COMMANDS.ALIGN_LEFT);
  lines.push("-".repeat(width));

  // Bill metadata
  lines.push(padRow("Bill No:", bill.billing_no || bill.bill_no || "N/A", width));
  lines.push(padRow("Date:", new Date(bill.billing_date || Date.now()).toLocaleString("en-IN"), width));
  lines.push(padRow("Customer:", bill.customer_name || "Walk-in Customer", width));
  if (bill.counter_no || bill.table_no) {
    lines.push(padRow("Table/Counter:", bill.counter_no || bill.table_no, width));
  }
  if (bill.payment_method) {
    lines.push(padRow("Payment Method:", bill.payment_method.toUpperCase(), width));
  }

  lines.push("-".repeat(width));

  // Item List Header
  if (width >= 40) {
    lines.push(format3Col("ITEM", "QTY", "AMOUNT", width));
  } else {
    lines.push(padRow("ITEM (QTY)", "AMOUNT", width));
  }
  lines.push("-".repeat(width));

  const items = bill.items || bill.billing_items || [];
  for (const item of items) {
    const name = item.product?.product_name || item.product_name || item.name || "Item";
    const qty = Number(item.quantity || item.qty || 1);
    const amount = Number(item.total_price || item.amount || qty * Number(item.unit_price || item.price || 0));

    if (width >= 40) {
      lines.push(format3Col(name, `${qty}x`, `Rs.${amount.toFixed(2)}`, width));
    } else {
      lines.push(padRow(`${name.slice(0, 14)} (${qty}x)`, `Rs.${amount.toFixed(2)}`, width));
    }

    if (Array.isArray(item.addons) && item.addons.length > 0) {
      const addonStr = item.addons.map((a) => `+ ${a.addon_name || a.name}`).join(", ");
      wrapText(`  ${addonStr}`, width).forEach((al) => lines.push(al));
    }
  }

  lines.push("-".repeat(width));

  // Financial Summary
  const subtotal = Number(bill.subtotal_amount || 0);
  const discount = Number(bill.discount_amount || 0);
  const tax = Number(bill.tax_amount || 0);
  const total = Number(bill.total_amount || bill.grand_total || subtotal - discount + tax);

  if (discount > 0) lines.push(padRow("Discount:", `-Rs.${discount.toFixed(2)}`, width));
  if (tax > 0) lines.push(padRow("GST / Tax:", `Rs.${tax.toFixed(2)}`, width));

  lines.push(`${COMMANDS.BOLD_ON}${padRow("TOTAL AMOUNT:", `Rs.${total.toFixed(2)}`, width)}${COMMANDS.BOLD_OFF}`);

  if (bill.paid_amount !== undefined) {
    lines.push(padRow("Paid Amount:", `Rs.${Number(bill.paid_amount).toFixed(2)}`, width));
  }
  if (bill.due_amount && Number(bill.due_amount) > 0) {
    lines.push(padRow("Balance Due:", `Rs.${Number(bill.due_amount).toFixed(2)}`, width));
  }

  // Footer Terms
  const footerTerms = profile.footerTerms ? String(profile.footerTerms).split(/\r?\n/).filter(Boolean) : [];
  if (footerTerms.length > 0) {
    lines.push("");
    lines.push(COMMANDS.ALIGN_CENTER);
    lines.push(profile.footerTitle || "Thank you! Please visit again.");
    lines.push(COMMANDS.ALIGN_LEFT);
    footerTerms.slice(0, 3).forEach((term, i) => lines.push(`${i + 1}. ${normalizeText(term)}`));
  } else {
    lines.push("");
    lines.push(COMMANDS.ALIGN_CENTER);
    lines.push("Thank you for your visit!");
  }

  // Feed & Cut
  lines.push("\n\n\n");
  if (cut) {
    lines.push(COMMANDS.CUT_PARTIAL);
  }

  return lines.join("\n");
};

/**
 * Builds Kitchen Order Ticket (KOT)
 */
export const buildKOT = (kot, options = {}) => {
  const width = options.columns || (options.paperWidth === "58mm" ? 32 : 48);
  const cut = options.hasCutter !== false;

  const lines = [COMMANDS.INIT];
  lines.push(COMMANDS.ALIGN_CENTER);
  lines.push(`${COMMANDS.BOLD_ON}${COMMANDS.DOUBLE_SIZE_ON}* KITCHEN TICKET *${COMMANDS.NORMAL_SIZE}${COMMANDS.BOLD_OFF}`);

  const stationName = kot.kitchen_name || "MAIN KITCHEN";
  lines.push(`${COMMANDS.BOLD_ON}[ ${normalizeText(stationName).toUpperCase()} ]${COMMANDS.BOLD_OFF}`);
  lines.push(COMMANDS.ALIGN_LEFT);
  lines.push("=".repeat(width));

  lines.push(padRow("KOT No:", kot.kot_number || "N/A", width));
  lines.push(padRow("Table/Counter:", kot.table_name || kot.counter_no || "Takeaway", width));
  lines.push(padRow("Order Ref:", kot.billing_no || kot.bill_no || "Direct Order", width));
  lines.push(padRow("Time:", new Date(kot.createdAt || Date.now()).toLocaleTimeString("en-IN"), width));
  if (kot.server_name || kot.waiter_name) {
    lines.push(padRow("Server:", kot.server_name || kot.waiter_name, width));
  }

  lines.push("=".repeat(width));
  lines.push(padRow("ITEM DESCRIPTION", "QTY", width));
  lines.push("-".repeat(width));

  const items = kot.items || [];
  for (const item of items) {
    const name = item.product_name || item.name || "Menu Item";
    const qty = Number(item.quantity || item.qty || 1);

    lines.push(`${COMMANDS.BOLD_ON}${padRow(name, `x ${qty}`, width)}${COMMANDS.BOLD_OFF}`);

    if (Array.isArray(item.addons) && item.addons.length > 0) {
      const addonStr = item.addons.map((a) => `+ ${a.addon_name || a.name}`).join(", ");
      wrapText(`  [Addon: ${addonStr}]`, width).forEach((al) => lines.push(al));
    }

    if (item.notes || item.special_instructions) {
      wrapText(`  * Note: ${item.notes || item.special_instructions}`, width).forEach((nl) => lines.push(nl));
    }
  }

  lines.push("-".repeat(width));
  lines.push("\n\n\n");
  if (cut) {
    lines.push(COMMANDS.CUT_PARTIAL);
  }

  return lines.join("\n");
};

/**
 * Builds Test Pattern Receipt
 */
export const buildTestReceipt = (options = {}) => {
  const width = options.columns || (options.paperWidth === "58mm" ? 32 : 48);
  const cut = options.hasCutter !== false;
  const kickDrawer = Boolean(options.hasCashDrawer);

  const lines = [COMMANDS.INIT];
  if (kickDrawer) lines.push(COMMANDS.DRAWER_PIN2);

  lines.push(COMMANDS.ALIGN_CENTER);
  lines.push(`${COMMANDS.BOLD_ON}${COMMANDS.DOUBLE_SIZE_ON}PRINTER TEST OK${COMMANDS.NORMAL_SIZE}${COMMANDS.BOLD_OFF}`);
  lines.push(normalizeText(`Atelier Universal Thermal Driver`));
  lines.push(COMMANDS.ALIGN_LEFT);
  lines.push("-".repeat(width));

  lines.push(padRow("Target Width:", `${width} Columns (${options.paperWidth || "80mm"})`, width));
  lines.push(padRow("Timestamp:", new Date().toLocaleTimeString("en-IN"), width));
  lines.push(padRow("Currency Test:", "Rs.1,234.50", width));
  lines.push(padRow("Left Alignment", "Right Alignment", width));

  lines.push("-".repeat(width));
  lines.push(COMMANDS.ALIGN_CENTER);
  lines.push("Text formatting and alignment OK");

  lines.push("\n\n\n");
  if (cut) lines.push(COMMANDS.CUT_PARTIAL);

  return lines.join("\n");
};

export default {
  COMMANDS,
  normalizeText,
  padRow,
  wrapText,
  format3Col,
  buildReceipt,
  buildKOT,
  buildTestReceipt,
};
