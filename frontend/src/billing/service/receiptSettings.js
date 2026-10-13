export const RECEIPT_SETTINGS_KEY = "duchReceiptSettings";

export const defaultReceiptSettings = {
  storeName: "Pozhudhu",
  instagram: "@pozhudhu_cafe",
  cell1: "9629103751",
  cell2: "9042551109",
  gstin: "33AYDPV172S01ZO",
  billTitle: "CUSTOMER COPY",
  footerTitle: "Terms & Conditions:",
  footerTerms: [
    "Goods once sold cannot be taken back.",
    "Opened packet  No Exchange.",
    "No Cash Refund.",
    "Subject to Coimbatore Jurisdiction.",
  ].join("\n"),
};

export const getReceiptSettings = () => {
  try {
    const raw = localStorage.getItem(RECEIPT_SETTINGS_KEY);
    const saved = raw ? JSON.parse(raw) : {};

    // Auto-migrate old default store name "ANNAPOORANI" or empty to "Pozhudhu"
    if (!saved.storeName || saved.storeName === "ANNAPOORANI" || !saved.storeName.trim()) {
      saved.storeName = "Pozhudhu";
    }
    if (saved.instagram === "annapoorani_sweets") {
      saved.instagram = "@pozhudhu_cafe";
    }

    return { ...defaultReceiptSettings, ...saved };
  } catch (err) {
    console.error("Failed to parse receipt settings:", err);
    return { ...defaultReceiptSettings };
  }
};

export const saveReceiptSettings = (settings = {}) => {
  try {
    const current = getReceiptSettings();
    const next = {
      ...defaultReceiptSettings,
      ...current,
      ...settings,
      storeName: settings.storeName?.trim() || "Pozhudhu",
    };
    localStorage.setItem(RECEIPT_SETTINGS_KEY, JSON.stringify(next));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("receiptSettingsUpdated", { detail: next }));
    }

    return next;
  } catch (err) {
    console.error("Failed to save receipt settings:", err);
    return defaultReceiptSettings;
  }
};

export const getBranchDetails = (branches = [], selectedBranch) => {
  if (!selectedBranch || selectedBranch.id === "all") return null;
  const userBranch = branches.find((item) => item.branch_id === selectedBranch.id);
  return userBranch?.branch || null;
};

export const getBranchAddressLines = (branch) => {
  if (!branch) return ["Coimbatore, Tamil Nadu"];

  const lines = [];
  if (branch.address) {
    lines.push(...String(branch.address).split(/\r?\n/).filter(Boolean));
  }

  const cityLine = [branch.city, branch.state].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (branch.phone) lines.push(`CELL: ${branch.phone}`);

  return lines.length > 0 ? lines : [branch.branch_name || "Pozhudhu"];
};

export const getReceiptProfile = ({ branches = [], selectedBranch, settings, branch: branchOverride } = {}) => {
  const branch = branchOverride || getBranchDetails(branches, selectedBranch);
  const receiptSettings = settings || getReceiptSettings();

  return {
    ...receiptSettings,
    branch,
    addressLines: getBranchAddressLines(branch),
  };
};
