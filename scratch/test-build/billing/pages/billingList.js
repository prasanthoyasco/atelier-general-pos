import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Input,
  Button,
  Space,
  Popconfirm,
  Tag,
  message,
  Tabs,
  Radio,
  Select,
  Popover,
  List,
  Card,
  Row,
  Col,
  Empty,
  Divider,
  Modal,
  Tooltip,
  Statistic,
  Progress,
  Avatar,
  DatePicker,
  Typography
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  EyeOutlined,
  ReloadOutlined,
  PrinterOutlined,
  DownloadOutlined,
  TableOutlined,
  AppstoreOutlined
} from "@ant-design/icons";
import billingService from "../service/billingService.js";
import { useBranch } from "../../context/BranchContext";
import debounce from "lodash.debounce";
import { TableSkeleton, POSCatalogueSkeleton } from "../../components/SkeletonLoader.jsx";
import { Check, Receipt, MonitorSmartphone, UtensilsCrossed, Table as TableIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
const { Search } = Input;
function getInitials(name = "") {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function statusMeta(status = "") {
  const s = (status || "").toLowerCase();
  if (s === "paid") {
    return { color: "#10B981", bg: "#ECFDF5", textColor: "#10B981", label: "Paid" };
  }
  if (s === "pending" || s === "in progress") {
    return { color: "#F59E0B", bg: "#FFFBEB", textColor: "#F59E0B", label: "Pending" };
  }
  if (s === "failed") {
    return { color: "#EF4444", bg: "#FEF2F2", textColor: "#EF4444", label: "Failed" };
  }
  if (s === "overdue") {
    return { color: "#EF4444", bg: "#FEF2F2", textColor: "#EF4444", label: "Overdue" };
  }
  return { color: "#475569", bg: "#F8FAFC", textColor: "#475569", label: (status || "Unknown").toString() };
}
const cardStyles = {
  cardWrap: {
    borderRadius: 10,
    boxShadow: "0 4px 12px rgba(16,24,40,0.04)",
    overflow: "hidden",
    border: "1px solid #f1f5f9"
  },
  headerRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between"
  },
  leftMeta: { display: "flex", gap: 8, alignItems: "center" },
  avatarSquare: (bg) => ({
    background: bg,
    width: 36,
    height: 36,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: 13
  }),
  smallMeta: { color: "#6b7280", fontSize: 11 },
  itemsRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 6, padding: "4px 0" },
  footerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  totalText: { fontWeight: 700, fontSize: 14 }
};
function getTypeLabel(type = "") {
  if (!type) return "Unknown";
  if (type === "Customer Billing") return "Mobile";
  if (type === "Casier Billing") return "Casier";
  return type;
}
function BillingList() {
  const navigate = useNavigate();
  const { selectedBranch: contextBranch } = useBranch();
  const { user } = useAuth() || {};
  const userRole = (user?.role?.role_name || user?.role_name || "").toLowerCase().replace(/_/g, " ");
  const isOrderTaker = userRole === "order taker" || userRole === "waiter";
  const [billings, setBillings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState("");
  const [sorter, setSorter] = useState({ field: null, order: null });
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [dateRange, setDateRange] = useState(null);
  const [viewMode, setViewMode] = useState("card");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [splitDetailBill, setSplitDetailBill] = useState(null);
  const pollingRef = useRef(null);
  const lastSyncedRef = useRef(null);
  const POLL_INTERVAL = 5e3;
  const mapTypeKeyToBackend = (key) => {
    if (!key || key === "all") return null;
    if (key === "mobile") return "Customer Billing";
    if (key === "casier") return "Casier Billing";
    return key;
  };
  const fetchBillings = useCallback(
    async (params = {}) => {
      setLoading(true);
      try {
        const req = {
          page: params.current ?? pagination.current,
          limit: params.pageSize ?? pagination.pageSize,
          search: params.search ?? searchText,
          sortField: params.sortField ?? sorter.field,
          sortOrder: params.sortOrder ?? sorter.order
        };
        if (isOrderTaker && user?.id) {
          req.created_by = user.id;
        }
        const effectiveStatus = params.status ?? statusFilter;
        if (effectiveStatus && effectiveStatus !== "all") req.status = effectiveStatus;
        const effectiveTypeKey = params.type ?? typeFilter;
        const backendType = mapTypeKeyToBackend(effectiveTypeKey);
        if (backendType) req.type = backendType;
        const effectivePayment = params.payment ?? paymentFilter;
        if (effectivePayment && effectivePayment !== "all") req.payment_method = effectivePayment;
        const effectivePeriod = params.period ?? period;
        if (effectivePeriod && effectivePeriod !== "all") {
          req.period = effectivePeriod;
          const effectiveDateRange = params.dateRange !== void 0 ? params.dateRange : dateRange;
          if (effectivePeriod === "custom" && effectiveDateRange && effectiveDateRange.length === 2) {
            req.startDate = effectiveDateRange[0].toISOString();
            req.endDate = effectiveDateRange[1].toISOString();
          }
        }
        const data = await billingService.getAll(req);
        setBillings(data.data || []);
        setPagination((prev) => ({
          ...prev,
          current: data.page || req.page || 1,
          total: data.total || 0,
          pageSize: data.limit || req.limit || 10
        }));
      } catch (err) {
        console.error(err);
        message.error("Failed to fetch billings");
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, searchText, sorter, statusFilter, typeFilter, paymentFilter, period, dateRange, isOrderTaker, user?.id]
  );
  const doSearch = debounce((value) => {
    setPagination((prev) => ({ ...prev, current: 1 }));
    setSearchText(value);
  }, 500);
  useEffect(() => {
    fetchBillings();
  }, [fetchBillings]);
  useEffect(() => {
    if (contextBranch) {
      console.log("Branch changed in header:", contextBranch);
      setPagination((prev) => ({ ...prev, current: 1 }));
      fetchBillings({ current: 1 });
    }
  }, [contextBranch?.id]);
  async function handleDelete(id) {
    try {
      await billingService.remove(id);
      message.success("Billing deleted successfully");
      fetchBillings({ current: pagination.current });
    } catch (err) {
      console.error(err);
      message.error("Failed to delete billing");
    }
  }
  function exportPDF() {
    const doc = new jsPDF();
    doc.text("Billing List", 14, 10);
    const tableData = billings.map((bill) => [
      bill.billing_no,
      bill.customer_name,
      new Date(bill.billing_date).toLocaleDateString(),
      bill.total_quantity,
      bill.total_amount,
      bill.status
    ]);
    autoTable(doc, { head: [["Billing No", "Customer", "Date", "Quantity", "Amount", "Status"]], body: tableData });
    doc.save("billings.pdf");
  }
  const fetchBillingById = useCallback(
    async (id) => {
      setModalLoading(true);
      try {
        if (billingService.get) {
          const res = await billingService.get(id);
          const payload = res?.data ? res.data : res;
          setSelectedBilling(payload);
          lastSyncedRef.current = Date.now();
          return payload;
        }
        const found = billings.find((b) => b.id === id);
        if (found) {
          setSelectedBilling(found);
          lastSyncedRef.current = Date.now();
          return found;
        }
        message.warn("Billing details not available");
        return null;
      } catch (e) {
        console.error(e);
        message.error("Failed to load billing details");
        return null;
      } finally {
        setModalLoading(false);
      }
    },
    [billings]
  );
  const showDetails = async (recOrId) => {
    let id = null;
    if (recOrId && typeof recOrId === "object") {
      setSelectedBilling(recOrId);
      id = recOrId.id;
      setModalVisible(true);
    } else {
      id = recOrId;
      setModalVisible(true);
    }
    if (id) {
      await fetchBillingById(id);
      if (billingService.get) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(() => fetchBillingById(id), POLL_INTERVAL);
      }
    }
  };
  const closeModal = () => {
    setModalVisible(false);
    setSelectedBilling(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };
  const manualRefresh = async () => {
    if (!selectedBilling?.id) return;
    await fetchBillingById(selectedBilling.id);
    message.success("Refreshed");
  };
  const exportInvoicePDF = (billing) => {
    if (!billing) return;
    const doc = new jsPDF({ unit: "pt", format: "A4" });
    doc.setFontSize(18);
    doc.text("Invoice", 40, 40);
    doc.setFontSize(12);
    doc.text(`Billing No: ${billing.billing_no || "-"}`, 40, 70);
    doc.text(`Customer: ${billing.customer_name || "-"}`, 40, 88);
    doc.text(`Date: ${billing.billing_date ? new Date(billing.billing_date).toLocaleString() : "-"}`, 40, 106);
    const head = [["Product", "Code", "Unit", "Qty", "Unit Price", "Total"]];
    const body = (billing.items || []).map((it) => [
      it.product?.product_name || "-",
      it.product?.product_code || "-",
      it.product?.unit || "-",
      it.quantity,
      `\u20B9${it.unit_price}`,
      `\u20B9${it.total_price}`
    ]);
    const tableResult = autoTable(doc, { startY: 130, head, body, styles: { fontSize: 10 } });
    const finalY = (tableResult?.finalY ?? 300) + 20;
    doc.text(`Subtotal: \u20B9${billing.subtotal_amount || "0.00"}`, 40, finalY);
    doc.text(`Discount: \u20B9${billing.discount_amount || "0.00"}`, 40, finalY + 16);
    doc.text(`Tax: \u20B9${billing.tax_amount || "0.00"}`, 40, finalY + 32);
    doc.setFontSize(13);
    doc.text(`Total: \u20B9${billing.total_amount || "0.00"}`, 40, finalY + 56);
    doc.save(`${billing.billing_no || "invoice"}.pdf`);
  };
  const itemColumns = [
    { title: "Product", dataIndex: ["product", "product_name"], key: "product_name" },
    { title: "Code", dataIndex: ["product", "product_code"], key: "product_code" },
    { title: "Unit", dataIndex: ["product", "unit"], key: "unit" },
    { title: "Qty", dataIndex: "quantity", key: "quantity" },
    { title: "Unit Price", dataIndex: "unit_price", key: "unit_price", render: (v) => `\u20B9${v}` },
    { title: "Total", dataIndex: "total_price", key: "total_price", render: (v) => `\u20B9${v}` }
  ];
  const columns = [
    { title: "Billing No", dataIndex: "billing_no", key: "billing_no", width: 100, sorter: true, render: (val) => val ? val.replace("BILL-", "") : "" },
    {
      title: "Table / Counter",
      dataIndex: "counter_no",
      key: "counter_no",
      width: 125,
      render: (val, record) => {
        const raw = val || record.table_no;
        if (!raw) return /* @__PURE__ */ React.createElement("span", { className: "text-slate-400 text-xs" }, "Direct");
        const label = raw.startsWith("Counter ") ? raw.replace("Counter ", "Table ") : raw;
        return /* @__PURE__ */ React.createElement("span", { className: "font-bold text-xs text-slate-700 inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-lg" }, /* @__PURE__ */ React.createElement(TableIcon, { size: 12, className: "text-blue-600 shrink-0" }), /* @__PURE__ */ React.createElement("span", null, label));
      }
    },
    { title: "Customer", dataIndex: "customer_name", key: "customer_name", width: 150, sorter: true },
    {
      title: "Billing Date",
      dataIndex: "billing_date",
      key: "billing_date",
      width: 160,
      render: (date) => new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }),
      sorter: true
    },
    { title: "Quantity", dataIndex: "total_quantity", key: "total_quantity", width: 120, sorter: true },
    {
      title: "Amount",
      dataIndex: "total_amount",
      key: "total_amount",
      width: 100,
      render: (amount) => `\u20B9${amount}`,
      sorter: true
    },
    {
      title: "Payment",
      dataIndex: "payment_method",
      key: "payment_method",
      width: 120,
      render: (method, record) => {
        if (method === "split") {
          return /* @__PURE__ */ React.createElement(Tooltip, { title: "Click to see split details" }, /* @__PURE__ */ React.createElement(
            Tag,
            {
              color: "gold",
              style: { cursor: "pointer", margin: 0 },
              onClick: () => setSplitDetailBill(record)
            },
            "Split \u25BE"
          ));
        }
        return /* @__PURE__ */ React.createElement(Tag, { color: "geekblue", style: { margin: 0 } }, (method || "\u2014").replace(/_/g, " "));
      }
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status) => {
        const meta = statusMeta(status);
        return /* @__PURE__ */ React.createElement(Tag, { style: { background: meta.bg, color: meta.color, fontWeight: 700, margin: 0 } }, meta.label);
      }
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "center",
      width: 160,
      render: (_, record) => /* @__PURE__ */ React.createElement(Space, { size: "small" }, /* @__PURE__ */ React.createElement(Tooltip, { title: "Quick view" }, /* @__PURE__ */ React.createElement(Button, { type: "default", size: "small", icon: /* @__PURE__ */ React.createElement(EyeOutlined, null), onClick: () => showDetails(record) })), /* @__PURE__ */ React.createElement(Tooltip, { title: "Print thermal receipt" }, /* @__PURE__ */ React.createElement(Button, { size: "small", icon: /* @__PURE__ */ React.createElement(PrinterOutlined, null), onClick: () => navigate(`/billing/customer-copy/${record.id}?print=1`) })), /* @__PURE__ */ React.createElement(Button, { type: "primary", size: "small", icon: /* @__PURE__ */ React.createElement(EditOutlined, null), onClick: () => navigate(`/billing/pos?edit=${record.id}`) }))
    }
  ];
  const paidPercent = (b) => {
    const total = parseFloat((b?.total_amount ?? 0) || 0);
    const paid = parseFloat((b?.paid_amount ?? 0) || 0);
    if (!total || total <= 0) return 0;
    const p = Math.round(paid / total * 100);
    return Math.max(0, Math.min(100, p));
  };
  return /* @__PURE__ */ React.createElement("div", { className: "p-3 sm:p-4 lg:p-6 pb-28 md:pb-6 relative min-h-screen" }, isOrderTaker && /* @__PURE__ */ React.createElement("div", { className: "mb-4 p-3.5 sm:p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0" }, /* @__PURE__ */ React.createElement(Receipt, { size: 20 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("h2", { className: "text-base font-black text-slate-800 mb-0" }, "My Taken & Served Orders"), /* @__PURE__ */ React.createElement(Tag, { color: "emerald", className: "font-bold text-[10px] m-0 uppercase tracking-wider" }, userRole)), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mb-0" }, "Showing orders created or served by ", /* @__PURE__ */ React.createElement("span", { className: "font-bold text-emerald-700" }, user?.username || "You")))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 w-full sm:w-auto" }, /* @__PURE__ */ React.createElement(
    Button,
    {
      type: "primary",
      icon: /* @__PURE__ */ React.createElement(MonitorSmartphone, { size: 15 }),
      onClick: () => navigate("/billing/pos"),
      className: "!bg-emerald-600 hover:!bg-emerald-700 flex-1 sm:flex-none font-bold text-xs h-9 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
    },
    "POS Terminal"
  ), /* @__PURE__ */ React.createElement(
    Button,
    {
      icon: /* @__PURE__ */ React.createElement(UtensilsCrossed, { size: 15 }),
      onClick: () => navigate("/billing/waiter"),
      className: "flex-1 sm:flex-none font-bold text-xs h-9 flex items-center justify-center gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50 cursor-pointer shadow-sm"
    },
    "Waiter Service"
  ))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col justify-between items-start gap-4 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-4 w-full lg:w-auto overflow-x-auto" }, /* @__PURE__ */ React.createElement(
    Tabs,
    {
      activeKey: statusFilter,
      onChange: (key) => {
        setStatusFilter(key);
        setPagination((prev) => ({ ...prev, current: 1 }));
        fetchBillings({ current: 1, status: key, search: searchText, type: typeFilter });
      },
      items: [
        { key: "all", label: "All" },
        { key: "paid", label: "Paid" },
        { key: "pending", label: "Pending" },
        { key: "failed", label: "Failed" },
        { key: "overdue", label: "Overdue" }
      ],
      className: "w-full sm:w-auto"
    }
  ), /* @__PURE__ */ React.createElement(
    Tabs,
    {
      activeKey: typeFilter,
      onChange: (key) => {
        setTypeFilter(key);
        setPagination((prev) => ({ ...prev, current: 1 }));
        fetchBillings({ current: 1, status: statusFilter, search: searchText, type: key });
      },
      items: [
        { key: "all", label: "All Types" },
        { key: "mobile", label: "Mobile" },
        { key: "casier", label: "Casier" }
      ],
      className: "w-full sm:w-auto"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row lg:justify-between gap-2 w-full lg:w-auto" }, /* @__PURE__ */ React.createElement(
    Search,
    {
      placeholder: "Search billings...",
      onSearch: (v) => doSearch(v),
      onChange: (e) => doSearch(e.target.value),
      enterButton: true,
      allowClear: true,
      className: "w-full sm:w-[250px]"
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Button, { type: "primary", icon: /* @__PURE__ */ React.createElement(PlusOutlined, null), onClick: () => navigate("/billing/pos"), className: "flex-1 sm:flex-none" }, "Add"), /* @__PURE__ */ React.createElement(Button, { icon: /* @__PURE__ */ React.createElement(FilePdfOutlined, null), onClick: exportPDF, className: "flex-1 sm:flex-none" }, "PDF")))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-end justify-between gap-4 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-end gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1 w-full sm:w-auto" }, /* @__PURE__ */ React.createElement(Typography.Text, { strong: true, style: { fontSize: 13, color: "#4b5563" } }, "Payment Method"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
    Popover,
    {
      trigger: "click",
      placement: "bottomLeft",
      styles: { body: { padding: 12, borderRadius: 14, minWidth: 220 } },
      content: /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 } }, "Filter by Payment Method"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, [
        { value: "all", label: "All Methods" },
        { value: "cash", label: "Cash" },
        { value: "UPI Current Account", label: "UPI Current Account" },
        { value: "UPI Normal Account", label: "UPI Normal Account" },
        { value: "credit_card", label: "Credit Card" },
        { value: "debit_card", label: "Debit Card" },
        { value: "net_banking", label: "Net Banking" },
        { value: "split", label: "Split Payment" }
      ].map(({ value, label }) => {
        const active = paymentFilter === value;
        return /* @__PURE__ */ React.createElement(
          "div",
          {
            key: value,
            onClick: () => {
              setPaymentFilter(value);
              setPagination((prev) => ({ ...prev, current: 1 }));
              fetchBillings({ current: 1, status: statusFilter, search: searchText, type: typeFilter, payment: value });
            },
            style: {
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 8,
              cursor: "pointer",
              background: active ? "#6366f1" : "transparent",
              color: active ? "#fff" : "#374151",
              fontWeight: active ? 600 : 400,
              fontSize: 13,
              transition: "all 0.15s"
            },
            onMouseEnter: (e) => {
              if (!active) e.currentTarget.style.background = "#f1f5f9";
            },
            onMouseLeave: (e) => {
              if (!active) e.currentTarget.style.background = "transparent";
            }
          },
          label,
          active && /* @__PURE__ */ React.createElement(Check, { size: 16, className: "ml-auto" })
        );
      })))
    },
    /* @__PURE__ */ React.createElement(
      "button",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 40,
          // Match AntD Select controlHeight: 40
          padding: "0 14px",
          borderRadius: 8,
          // Match token borderRadius: 8
          border: `1px solid ${paymentFilter !== "all" ? "#4F46E5" : "#d9d9d9"}`,
          background: paymentFilter !== "all" ? "#EEF2FF" : "#fff",
          color: paymentFilter !== "all" ? "#4F46E5" : "#374151",
          fontWeight: 500,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "none",
          transition: "all 0.15s"
        }
      },
      /* @__PURE__ */ React.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" })),
      paymentFilter === "all" ? "Payment" : paymentFilter === "UPI Current Account" ? "UPI Current" : paymentFilter === "UPI Normal Account" ? "UPI Normal" : paymentFilter.replace(/_/g, " "),
      /* @__PURE__ */ React.createElement("svg", { width: "10", height: "10", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polyline", { points: "6 9 12 15 18 9" }))
    )
  ), paymentFilter !== "all" && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        setPaymentFilter("all");
        fetchBillings({ current: 1, status: statusFilter, search: searchText, type: typeFilter, payment: "all" });
      },
      style: { background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 2px" },
      title: "Clear filter"
    },
    "\xD7"
  ))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1 w-full sm:w-[180px]" }, /* @__PURE__ */ React.createElement(Typography.Text, { strong: true, style: { fontSize: 13, color: "#4b5563" } }, "Period"), /* @__PURE__ */ React.createElement(
    Select,
    {
      value: period,
      onChange: (value) => {
        setPeriod(value);
        if (value !== "custom") {
          setDateRange(null);
          setPagination((prev) => ({ ...prev, current: 1 }));
          fetchBillings({ current: 1, period: value, dateRange: null });
        }
      },
      style: { width: "100%" }
    },
    /* @__PURE__ */ React.createElement(Select.Option, { value: "all" }, "All Time"),
    /* @__PURE__ */ React.createElement(Select.Option, { value: "today" }, "Today"),
    /* @__PURE__ */ React.createElement(Select.Option, { value: "yesterday" }, "Yesterday"),
    /* @__PURE__ */ React.createElement(Select.Option, { value: "this_month" }, "This Month"),
    /* @__PURE__ */ React.createElement(Select.Option, { value: "this_year" }, "This Year"),
    /* @__PURE__ */ React.createElement(Select.Option, { value: "custom" }, "Custom Range")
  )), period === "custom" && /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1 w-full sm:w-[260px]" }, /* @__PURE__ */ React.createElement(Typography.Text, { strong: true, style: { fontSize: 13, color: "#4b5563" } }, "Date Range"), /* @__PURE__ */ React.createElement(
    DatePicker.RangePicker,
    {
      value: dateRange,
      onChange: (val) => {
        setDateRange(val);
        if (val) {
          setPagination((prev) => ({ ...prev, current: 1 }));
          fetchBillings({ current: 1, period: "custom", dateRange: val });
        }
      },
      style: { width: "100%" },
      format: "DD MMM YYYY"
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "hidden md:block ml-auto" }, /* @__PURE__ */ React.createElement(Radio.Group, { value: viewMode, onChange: (e) => setViewMode(e.target.value), optionType: "button", buttonStyle: "solid", style: { display: "flex", justifyContent: "center", alignItems: "center" } }, /* @__PURE__ */ React.createElement(Radio.Button, { value: "table" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(TableOutlined, null), " Table")), /* @__PURE__ */ React.createElement(Radio.Button, { value: "card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(AppstoreOutlined, null), " Card"))))), loading ? viewMode === "table" ? /* @__PURE__ */ React.createElement(TableSkeleton, { rows: 10, cols: 6 }) : /* @__PURE__ */ React.createElement(POSCatalogueSkeleton, { cards: 8 }) : viewMode === "table" ? /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" }, /* @__PURE__ */ React.createElement(
    Table,
    {
      columns,
      rowKey: (record) => record.id,
      dataSource: billings,
      pagination,
      onChange: (pag, filters, sort) => {
        const convertedOrder = sort.order === "ascend" ? "asc" : sort.order === "descend" ? "desc" : null;
        setPagination(pag);
        setSorter({ field: sort.field, order: convertedOrder });
        fetchBillings({
          current: pag.current,
          pageSize: pag.pageSize,
          sortField: sort.field,
          sortOrder: convertedOrder,
          status: statusFilter,
          search: searchText,
          type: typeFilter
        });
      },
      bordered: true,
      scroll: { x: 800 },
      expandable: {
        expandedRowRender: (record) => /* @__PURE__ */ React.createElement(
          Table,
          {
            columns: [
              { title: "Product", dataIndex: ["product", "product_name"], key: "product_name" },
              { title: "Code", dataIndex: ["product", "product_code"], key: "product_code" },
              { title: "Quantity", dataIndex: "quantity", key: "quantity" },
              { title: "Unit Price", dataIndex: "unit_price", key: "unit_price", render: (v) => `\u20B9${v}` },
              { title: "Total", dataIndex: "total_price", key: "total_price", render: (v) => `\u20B9${v}` }
            ],
            dataSource: record.items || [],
            pagination: false,
            rowKey: (item) => item.id,
            size: "small"
          }
        )
      }
    }
  )) : /* @__PURE__ */ React.createElement("div", null, billings.length === 0 ? /* @__PURE__ */ React.createElement(Empty, { description: "No billings" }) : /* @__PURE__ */ React.createElement(
    List,
    {
      grid: { gutter: 12, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 },
      dataSource: billings,
      renderItem: (item) => {
        const initials = getInitials(item.customer_name);
        const sMeta = statusMeta(item.status);
        const isSplit = item.payment_method === "split";
        const pmLabel = isSplit ? "Split" : (item.payment_method || "\u2014").replace(/_/g, " ");
        return /* @__PURE__ */ React.createElement(List.Item, { key: item.id }, /* @__PURE__ */ React.createElement(Card, { styles: { body: { padding: 12 } }, style: cardStyles.cardWrap }, /* @__PURE__ */ React.createElement("div", { style: cardStyles.headerRow }, /* @__PURE__ */ React.createElement("div", { style: cardStyles.leftMeta }, /* @__PURE__ */ React.createElement("div", { style: cardStyles.avatarSquare("#0ea5a4") }, initials), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, fontSize: 14, textTransform: "capitalize", color: "#1f2937" } }, item.customer_name), /* @__PURE__ */ React.createElement("div", { style: { ...cardStyles.smallMeta, fontSize: 9.5, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, "Bill No:"), " ", /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "monospace" } }, item.billing_no ? item.billing_no.replace("BILL-", "") : "")), item.counter_no && /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: 2, background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "1px 5px", borderRadius: 4, fontWeight: 700, fontSize: 9, color: "#334155" } }, /* @__PURE__ */ React.createElement(TableIcon, { size: 10, className: "text-blue-600" }), item.counter_no.startsWith("Counter ") ? item.counter_no.replace("Counter ", "Table ") : item.counter_no)), isSplit ? /* @__PURE__ */ React.createElement(Tooltip, { title: "Click to see split details" }, /* @__PURE__ */ React.createElement(
          "div",
          {
            onClick: () => setSplitDetailBill(item),
            style: { display: "inline-flex", alignItems: "center", gap: 3, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 10, fontWeight: 700, fontSize: 9, cursor: "pointer", marginTop: 2 }
          },
          "Split \u25BE"
        )) : /* @__PURE__ */ React.createElement("div", { style: { display: "inline-block", background: "#eef2ff", color: "#3730a3", padding: "1px 6px", borderRadius: 10, fontWeight: 600, fontSize: 9, marginTop: 2 } }, pmLabel))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "end", gap: 4 } }, /* @__PURE__ */ React.createElement("div", { style: { background: sMeta.bg, color: sMeta.color, padding: "4px 8px", borderRadius: 12, fontWeight: 700, fontSize: 10 } }, sMeta.label), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 8, opacity: 0.6 } }, new Date(item.billing_date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })))), /* @__PURE__ */ React.createElement(Divider, { style: { margin: "8px 0" } }), /* @__PURE__ */ React.createElement("div", { style: { height: 60, overflowY: "auto", scrollbarWidth: "none", marginRight: -8, paddingRight: 8 } }, (item.items || []).map((it) => /* @__PURE__ */ React.createElement("div", { key: it.id || `${it.product?.product_code}-${Math.random()}`, style: cardStyles.itemsRow }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#374151" } }, it.product?.product_name || "\u2013"), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "right", color: "#4b5563", fontSize: 12 } }, it.quantity, " \xD7 \u20B9", it.unit_price)))), /* @__PURE__ */ React.createElement("div", { style: cardStyles.footerRow }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 12, alignItems: "center" } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "#6b7280", fontSize: 10 } }, "Total"), /* @__PURE__ */ React.createElement("div", { style: cardStyles.totalText }, "\u20B9", item.total_amount)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { color: "#6b7280", fontSize: 10 } }, "Qty"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, fontSize: 14, color: "#374151" } }, item.total_quantity))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 4 } }, /* @__PURE__ */ React.createElement(Tooltip, { title: "Quick view (opens live modal)" }, /* @__PURE__ */ React.createElement(
          Button,
          {
            type: "default",
            size: "small",
            icon: /* @__PURE__ */ React.createElement(EyeOutlined, { style: { fontSize: 11 } }),
            onClick: () => showDetails(item),
            style: { borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }
          }
        )), /* @__PURE__ */ React.createElement(
          Button,
          {
            type: "primary",
            size: "small",
            icon: /* @__PURE__ */ React.createElement(EditOutlined, { style: { fontSize: 11 } }),
            onClick: () => navigate(`/billing/pos?edit=${item.id}`),
            style: { borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }
          }
        ), /* @__PURE__ */ React.createElement(Tooltip, { title: "Print thermal receipt" }, /* @__PURE__ */ React.createElement(
          Button,
          {
            size: "small",
            icon: /* @__PURE__ */ React.createElement(PrinterOutlined, { style: { fontSize: 11 } }),
            onClick: () => navigate(`/billing/customer-copy/${item.id}?print=1`),
            style: { borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }
          }
        ))))));
      },
      pagination: {
        current: pagination.current,
        pageSize: pagination.pageSize,
        total: pagination.total,
        onChange: (page, pageSize) => {
          setPagination((p) => ({ ...p, current: page, pageSize }));
          fetchBillings({ current: page, pageSize, status: statusFilter, search: searchText, type: typeFilter });
        }
      }
    }
  )), /* @__PURE__ */ React.createElement("style", null, `
    /* scope to only this modal so other modals stay untouched */
    .invoice-modal .ant-modal-content {
      padding-top: 2px !important;
    }

    /* optional: reduce the default modal header padding if you want it even tighter */
    .invoice-modal .ant-card-body {
      padding-top: 0px !important;
      padding-bottom: 8px !important;
    }
  `), /* @__PURE__ */ React.createElement(
    Modal,
    {
      open: !!splitDetailBill,
      onCancel: () => setSplitDetailBill(null),
      footer: /* @__PURE__ */ React.createElement("button", { onClick: () => setSplitDetailBill(null), className: "px-4 py-1.5 bg-gray-100 rounded-lg text-sm" }, "Close"),
      title: /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-[15px] font-bold text-gray-800" }, "Split Payment Details", /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-normal text-gray-400" }, "\u2014 ", splitDetailBill?.billing_no)),
      width: 380,
      centered: true
    },
    splitDetailBill && /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-3 pt-2" }, (splitDetailBill.payment_details || []).map((p, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-medium text-gray-700 capitalize" }, (p.method || "").replace(/_/g, " ")), /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-bold text-gray-900" }, "\u20B9", parseFloat(p.amount).toLocaleString("en-IN")))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between pt-1 border-t border-gray-200 mt-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-gray-600" }, "Total"), /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-bold text-green-600" }, "\u20B9", (splitDetailBill.payment_details || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0).toLocaleString("en-IN"))))
  ), /* @__PURE__ */ React.createElement(
    Modal,
    {
      style: { top: 15, paddingTop: 0 },
      className: "invoice-modal",
      open: modalVisible,
      title: null,
      onCancel: closeModal,
      footer: [
        /* @__PURE__ */ React.createElement(Space, { key: "modal-actions" }, /* @__PURE__ */ React.createElement(Button, { icon: /* @__PURE__ */ React.createElement(DownloadOutlined, null), onClick: () => exportInvoicePDF(selectedBilling) }, "Download PDF"), /* @__PURE__ */ React.createElement(Button, { key: "close", onClick: closeModal }, "Close"))
      ],
      width: 980,
      styles: { body: { maxHeight: "80vh", overflowY: "auto", padding: 0, scrollbarWidth: "none" } }
    },
    /* @__PURE__ */ React.createElement("div", { style: { padding: 10 } }, /* @__PURE__ */ React.createElement(Row, { gutter: 16 }, /* @__PURE__ */ React.createElement(Col, { xs: 24, md: 24 }, /* @__PURE__ */ React.createElement(
      Card,
      {
        size: "small",
        bordered: false,
        style: { borderRadius: 12, overflow: "hidden" }
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            // space between left info and right tags
            gap: 16,
            flexWrap: "wrap"
            // keeps it responsive on small screens
          }
        },
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 } }, /* @__PURE__ */ React.createElement(
          Avatar,
          {
            size: 40,
            style: {
              background: "#0ea5a4",
              color: "#fff",
              fontWeight: 800
            }
          },
          getInitials(selectedBilling?.customer_name)
        ), /* @__PURE__ */ React.createElement("div", { style: { minWidth: 0 } }, /* @__PURE__ */ React.createElement(
          "div",
          {
            style: {
              fontSize: 14,
              fontWeight: 800,
              color: "#0f172a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }
          },
          selectedBilling?.customer_name
        ), /* @__PURE__ */ React.createElement("div", { style: { color: "#6b7280", fontSize: 12 } }, "Order", " ", /* @__PURE__ */ React.createElement("strong", { style: { color: "#0f172a" } }, selectedBilling?.billing_no || "\u2014"), " \u2022 ", selectedBilling?.billing_date ? new Date(selectedBilling.billing_date).toLocaleString() : "Date \u2014"))),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
          Tag,
          {
            style: {
              fontWeight: 800,
              borderRadius: 8,
              padding: "0 10px",
              background: "#eef2ff",
              color: "#3730a3"
            }
          },
          getTypeLabel(selectedBilling?.type)
        ), /* @__PURE__ */ React.createElement(
          Tag,
          {
            style: {
              fontWeight: 800,
              borderRadius: 8,
              padding: "0 10px",
              background: "#fff7ed",
              color: "#92400e"
            }
          },
          (selectedBilling?.payment_method || "cash").toString().toUpperCase()
        ), /* @__PURE__ */ React.createElement(
          Tag,
          {
            style: {
              fontWeight: 800,
              borderRadius: 8,
              padding: "0 10px",
              background: statusMeta(selectedBilling?.status).bg,
              color: statusMeta(selectedBilling?.status).color
            }
          },
          statusMeta(selectedBilling?.status).label
        ))
      )
    ))), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 600, marginBottom: 1 } }, "Items"), /* @__PURE__ */ React.createElement(Table, { columns: itemColumns, dataSource: selectedBilling?.items || [], pagination: false, size: "small", rowKey: (r) => r.id }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { width: 360 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "0px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { color: "#6b7280" } }, "Total Quantity"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700 } }, selectedBilling?.total_quantity ?? 0, " pcs")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "0px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { color: "#6b7280" } }, "Subtotal"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700 } }, "\u20B9", selectedBilling?.subtotal_amount ?? "0.00")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "0px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { color: "#6b7280" } }, "Discount"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700 } }, "\u20B9", selectedBilling?.discount_amount ?? "0.00")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "0px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { color: "#6b7280" } }, "Tax"), /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700 } }, "\u20B9", selectedBilling?.tax_amount ?? "0.00")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "1px 0", background: "linear-gradient(90deg,#fef3c7,#fff7ed)", borderRadius: 8 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 16, fontWeight: 900 } }, "Total"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: "#b45309" } }, "\u20B9", selectedBilling?.total_amount ?? "0.00")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10, display: "flex", justifyContent: "space-between", color: "#6b7280" } }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", color: "#6b7280" } }))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }))
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => navigate("/billing/pos"),
      "aria-label": "New Bill",
      className: "fixed bottom-24 right-5 md:hidden z-30 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-95 !text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition shadow-indigo-600/30"
    },
    /* @__PURE__ */ React.createElement(PlusOutlined, { style: { fontSize: 22 } })
  ));
}
export default BillingList;
