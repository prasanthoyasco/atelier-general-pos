import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Button,
  Input,
  InputNumber,
  Select,
  Tag,
  DatePicker,
  Tabs,
  Card,
  Modal,
  Form,
  Space,
  message,
  Tooltip,
  Badge,
  Alert,
  Divider,
} from "antd";
import {
  SunOutlined,
  MoonOutlined,
  HistoryOutlined,
  DatabaseOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  SearchOutlined,
  ReloadOutlined,
  ShopOutlined,
  CoffeeOutlined,
  InboxOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import dailyInventoryService from "../service/dailyInventoryService";
import { useBranch } from "../../context/BranchContext";

const { Option } = Select;

const WASTAGE_REASONS = [
  { value: "Spoiled / Sour", label: "Spoiled / Sour" },
  { value: "Expired", label: "Expired" },
  { value: "Damaged / Crushed", label: "Damaged / Crushed" },
  { value: "Spillage", label: "Spillage" },
  { value: "Kitchen Waste", label: "Kitchen Waste" },
  { value: "Staff Meal", label: "Staff Meal" },
  { value: "Theft / Missing", label: "Theft / Missing" },
  { value: "Normal Loss / Trimming", label: "Normal Loss / Trimming" },
  { value: "Other", label: "Other" },
];

const DailyInventory = () => {
  const { selectedBranch, branches, changeBranch } = useBranch();
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [activeTab, setActiveTab] = useState("morning");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const effectiveBranchId = useMemo(() => {
    if (selectedBranch && selectedBranch.id && selectedBranch.id !== "all") {
      return selectedBranch.id;
    }
    if (branches && branches.length > 0) {
      return branches[0].branch_id;
    }
    const saved = localStorage.getItem("selectedBranchId");
    if (saved && saved !== "all") return saved;
    return null;
  }, [selectedBranch, branches]);

  const effectiveBranchName = useMemo(() => {
    if (effectiveBranchId && branches && branches.length > 0) {
      const match = branches.find((b) => b.branch_id === effectiveBranchId);
      if (match) return match.branch?.branch_name || match.branch?.name || match.name;
    }
    return selectedBranch?.branch_name || selectedBranch?.name || "Main Branch";
  }, [effectiveBranchId, branches, selectedBranch]);

  // Raw data from server
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [summaryMeta, setSummaryMeta] = useState({});

  // Morning Form State: item_id -> { added_qty, cost_price, supplier, notes }
  const [morningInputs, setMorningInputs] = useState({});

  // Evening Form State: item_id -> { closing_stock, wastage_qty, wastage_reason, notes }
  const [eveningInputs, setEveningInputs] = useState({});

  // History Tab State
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDateRange, setHistoryDateRange] = useState([
    dayjs().subtract(7, "day"),
    dayjs(),
  ]);

  // Ingredients Master Tab State
  const [allIngredients, setAllIngredients] = useState([]);
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [ingredientForm] = Form.useForm();

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // 'all', 'product', 'ingredient'

  // Fetch Daily Summary
  const fetchSummary = async () => {
    if (!effectiveBranchId || effectiveBranchId === "all") return;
    setLoading(true);
    try {
      const dateStr = selectedDate.format("YYYY-MM-DD");
      const res = await dailyInventoryService.getSummary({
        branch_id: effectiveBranchId,
        date: dateStr,
      });

      const prods = res.products || [];
      const ings = res.ingredients || [];
      setProducts(prods);
      setIngredients(ings);
      setSummaryMeta(res.summary || {});

      // Initialize evening inputs with existing closing values if any
      const initialEvening = {};
      [...prods, ...ings].forEach((item) => {
        initialEvening[item.id] = {
          closing_stock:
            item.closing_stock !== null && item.closing_stock !== undefined
              ? item.closing_stock
              : undefined,
          wastage_qty: item.wastage_qty || 0,
          wastage_reason: item.wastage_reason || undefined,
          notes: item.notes || "",
        };
      });
      setEveningInputs(initialEvening);
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to load daily inventory summary");
    } finally {
      setLoading(false);
    }
  };

  // Fetch History
  const fetchHistory = async () => {
    if (!effectiveBranchId || effectiveBranchId === "all") return;
    setHistoryLoading(true);
    try {
      const startDate = historyDateRange[0]?.format("YYYY-MM-DD");
      const endDate = historyDateRange[1]?.format("YYYY-MM-DD");
      const res = await dailyInventoryService.getHistory({
        branch_id: effectiveBranchId,
        startDate,
        endDate,
      });
      setHistoryLogs(res.data || []);
    } catch (err) {
      console.error(err);
      message.error("Failed to load inventory history");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fetch Ingredients Master
  const fetchIngredients = async () => {
    if (!effectiveBranchId || effectiveBranchId === "all") return;
    try {
      const res = await dailyInventoryService.getIngredients({
        branch_id: effectiveBranchId,
      });
      setAllIngredients(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [effectiveBranchId, selectedDate]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    } else if (activeTab === "ingredients") {
      fetchIngredients();
    }
  }, [activeTab, effectiveBranchId, historyDateRange]);

  // Combined active list filtered by type and search
  const filteredItems = useMemo(() => {
    let list = [];
    if (typeFilter === "all" || typeFilter === "product") {
      list = list.concat(products);
    }
    if (typeFilter === "all" || typeFilter === "ingredient") {
      list = list.concat(ingredients);
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query))
    );
  }, [products, ingredients, typeFilter, searchQuery]);

  // Handle Morning input changes
  const handleMorningChange = (id, field, value) => {
    setMorningInputs((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  // Save Morning Stock
  const handleSaveMorning = async () => {
    const entries = [];
    Object.keys(morningInputs).forEach((id) => {
      const input = morningInputs[id];
      if (input && Number(input.added_qty) > 0) {
        const item = [...products, ...ingredients].find((i) => i.id === id);
        if (item) {
          entries.push({
            item_id: id,
            item_type: item.item_type,
            added_qty: Number(input.added_qty),
            cost_price: input.cost_price ? Number(input.cost_price) : undefined,
            supplier: input.supplier || undefined,
            notes: input.notes || undefined,
          });
        }
      }
    });

    if (entries.length === 0) {
      message.warning("Please enter quantity added for at least one item");
      return;
    }

    setSubmitting(true);
    try {
      await dailyInventoryService.addMorningEntry({
        branch_id: effectiveBranchId,
        date: selectedDate.format("YYYY-MM-DD"),
        entries,
      });
      message.success(`Successfully saved stock additions for ${entries.length} items!`);
      setMorningInputs({});
      fetchSummary();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to save morning stock");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Evening input changes
  const handleEveningChange = (id, field, value) => {
    setEveningInputs((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  // Quick fill remaining stock as expected
  const handleAutoFillEvening = () => {
    const updated = { ...eveningInputs };
    filteredItems.forEach((item) => {
      if (updated[item.id]?.closing_stock === undefined) {
        updated[item.id] = {
          ...updated[item.id],
          closing_stock: item.expected_stock,
          wastage_qty: 0,
        };
      }
    });
    setEveningInputs(updated);
    message.info("Auto-filled uncounted items with expected stock");
  };

  // Save Evening Closing Stock
  const handleSaveEvening = async () => {
    const closings = [];
    let hasUnexplainedDiscrepancy = false;

    Object.keys(eveningInputs).forEach((id) => {
      const input = eveningInputs[id];
      if (
        input &&
        input.closing_stock !== undefined &&
        input.closing_stock !== null &&
        input.closing_stock !== ""
      ) {
        const item = [...products, ...ingredients].find((i) => i.id === id);
        if (item) {
          const closingStock = Number(input.closing_stock);
          const expected = Number(item.expected_stock);
          const diff = closingStock - expected;

          // If shortage exists and no reason was provided
          if (diff < 0 && !input.wastage_reason && (!input.wastage_qty || Number(input.wastage_qty) === 0)) {
            hasUnexplainedDiscrepancy = true;
          }

          closings.push({
            item_id: id,
            item_type: item.item_type,
            closing_stock: closingStock,
            wastage_qty: input.wastage_qty ? Number(input.wastage_qty) : diff < 0 ? Math.abs(diff) : 0,
            wastage_reason: input.wastage_reason || (diff < 0 ? "Normal Loss / Trimming" : undefined),
            notes: input.notes || undefined,
          });
        }
      }
    });

    if (closings.length === 0) {
      message.warning("Please enter closing remaining stock for at least one item");
      return;
    }

    if (hasUnexplainedDiscrepancy) {
      Modal.confirm({
        title: "Discrepancy Detected Without Reason",
        content:
          "Some items have remaining stock lower than expected without a specific wastage reason selected. Would you like to submit and log the difference as General Loss?",
        okText: "Yes, Confirm Closing",
        cancelText: "Review Reasons",
        onOk: () => submitEveningClosings(closings),
      });
      return;
    }

    await submitEveningClosings(closings);
  };

  const submitEveningClosings = async (closings) => {
    setSubmitting(true);
    try {
      await dailyInventoryService.recordEveningClosing({
        branch_id: effectiveBranchId,
        date: selectedDate.format("YYYY-MM-DD"),
        closings,
      });
      message.success(`Successfully reconciled evening stock for ${closings.length} items!`);
      fetchSummary();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to record evening closing");
    } finally {
      setSubmitting(false);
    }
  };

  // Save / Edit Ingredient
  const handleSaveIngredient = async (values) => {
    try {
      if (editingIngredient) {
        await dailyInventoryService.updateIngredient(editingIngredient.id, values);
        message.success("Ingredient updated successfully!");
      } else {
        await dailyInventoryService.createIngredient({
          ...values,
          branch_id: effectiveBranchId,
        });
        message.success("New ingredient added to master!");
      }
      setIngredientModalOpen(false);
      setEditingIngredient(null);
      ingredientForm.resetFields();
      fetchIngredients();
      fetchSummary();
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to save ingredient");
    }
  };

  // Columns for Morning Tab
  const morningColumns = [
    {
      title: "Item Name & Type",
      key: "name",
      render: (_, r) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">{r.name}</span>
            <Tag color={r.item_type === "product" ? "blue" : "purple"} className="text-xs">
              {r.item_type === "product" ? "Menu Product" : "Ingredient"}
            </Tag>
          </div>
          <span className="text-xs text-gray-400">
            Category: {r.category} | Unit: {r.unit}
          </span>
        </div>
      ),
    },
    {
      title: "Current Stock",
      key: "current_stock",
      width: 130,
      render: (_, r) => (
        <span className={`font-semibold ${r.current_stock < 0 ? "text-rose-500" : "text-gray-700"}`}>
          {r.current_stock} {r.unit}
        </span>
      ),
    },
    {
      title: "Morning Opening",
      key: "opening_stock",
      width: 140,
      render: (_, r) => (
        <span className="text-gray-600 font-medium">
          {r.opening_stock} {r.unit}
        </span>
      ),
    },
    {
      title: "Already Added Today",
      key: "added_stock",
      width: 150,
      render: (_, r) => (
        <span className={r.added_stock > 0 ? "text-emerald-600 font-semibold" : "text-gray-400"}>
          +{r.added_stock} {r.unit}
        </span>
      ),
    },
    {
      title: (
        <span className="text-emerald-700 font-bold flex items-center gap-1">
          <PlusOutlined /> Add Purchased Stock
        </span>
      ),
      key: "add_input",
      width: 180,
      render: (_, r) => (
        <InputNumber
          min={0}
          step={r.item_type === "product" ? 1 : 0.5}
          placeholder="+ Add qty"
          value={morningInputs[r.id]?.added_qty}
          onChange={(val) => handleMorningChange(r.id, "added_qty", val)}
          className="w-full border-emerald-300 focus:border-emerald-500 rounded-lg"
          addonAfter={r.unit}
        />
      ),
    },
    {
      title: "Supplier / Cost (Optional)",
      key: "supplier_cost",
      width: 220,
      render: (_, r) => (
        <div className="flex gap-1">
          <Input
            placeholder="Supplier"
            size="small"
            value={morningInputs[r.id]?.supplier}
            onChange={(e) => handleMorningChange(r.id, "supplier", e.target.value)}
            className="w-1/2"
          />
          <InputNumber
            placeholder="₹ Cost"
            size="small"
            min={0}
            value={morningInputs[r.id]?.cost_price}
            onChange={(val) => handleMorningChange(r.id, "cost_price", val)}
            className="w-1/2"
          />
        </div>
      ),
    },
    {
      title: "Remarks",
      key: "notes",
      width: 160,
      render: (_, r) => (
        <Input
          placeholder="e.g. Fresh batch"
          size="small"
          value={morningInputs[r.id]?.notes}
          onChange={(e) => handleMorningChange(r.id, "notes", e.target.value)}
        />
      ),
    },
  ];

  // Columns for Evening Tab
  const eveningColumns = [
    {
      title: "Item Name",
      key: "name",
      width: 200,
      render: (_, r) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">{r.name}</span>
            <Tag color={r.item_type === "product" ? "blue" : "purple"} className="text-xs">
              {r.item_type === "product" ? "Menu Item" : "Raw"}
            </Tag>
          </div>
          <span className="text-xs text-gray-400">Unit: {r.unit}</span>
        </div>
      ),
    },
    {
      title: "Opening + Added",
      key: "total_in",
      width: 130,
      render: (_, r) => {
        const total = Number(r.opening_stock) + Number(r.added_stock);
        return (
          <span className="text-gray-700 font-medium">
            {total} {r.unit}
          </span>
        );
      },
    },
    {
      title: "Sold Today",
      key: "billed_qty",
      width: 120,
      render: (_, r) => (
        <span className="font-semibold text-indigo-600">
          {r.billed_qty || 0} {r.unit}
        </span>
      ),
    },
    {
      title: "Expected Stock",
      key: "expected_stock",
      width: 130,
      render: (_, r) => (
        <span className="font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">
          {r.expected_stock} {r.unit}
        </span>
      ),
    },
    {
      title: (
        <span className="text-amber-700 font-bold flex items-center gap-1">
          <MoonOutlined /> Actual Count (Evening)
        </span>
      ),
      key: "closing_input",
      width: 180,
      render: (_, r) => {
        const currentVal = eveningInputs[r.id]?.closing_stock;
        const hasDiff = currentVal !== undefined && currentVal !== r.expected_stock;
        return (
          <InputNumber
            min={0}
            step={r.item_type === "product" ? 1 : 0.25}
            placeholder="Remaining count"
            value={currentVal}
            onChange={(val) => handleEveningChange(r.id, "closing_stock", val)}
            className={`w-full rounded-lg ${
              hasDiff ? "border-amber-500 bg-amber-50/30" : "border-indigo-200"
            }`}
            addonAfter={r.unit}
          />
        );
      },
    },
    {
      title: "Discrepancy / Variance",
      key: "discrepancy",
      width: 160,
      render: (_, r) => {
        const closingVal = eveningInputs[r.id]?.closing_stock;
        if (closingVal === undefined || closingVal === null || closingVal === "") {
          return <span className="text-xs text-gray-400">Enter count</span>;
        }
        const diff = Number(closingVal) - Number(r.expected_stock);
        if (diff === 0) {
          return (
            <Tag color="success" className="font-semibold">
              <CheckCircleOutlined /> Balanced (0)
            </Tag>
          );
        } else if (diff < 0) {
          return (
            <Tag color="error" className="font-bold">
              <WarningOutlined /> Shortage: {diff} {r.unit}
            </Tag>
          );
        } else {
          return (
            <Tag color="cyan" className="font-bold">
              Surplus: +{diff} {r.unit}
            </Tag>
          );
        }
      },
    },
    {
      title: "Wastage Reason (If Shortage)",
      key: "wastage_reason",
      width: 220,
      render: (_, r) => {
        const closingVal = eveningInputs[r.id]?.closing_stock;
        const diff = closingVal !== undefined ? Number(closingVal) - Number(r.expected_stock) : 0;
        const isShortage = diff < 0;

        return (
          <Select
            placeholder="Select reason..."
            allowClear
            size="small"
            className="w-full"
            status={isShortage && !eveningInputs[r.id]?.wastage_reason ? "warning" : ""}
            value={eveningInputs[r.id]?.wastage_reason}
            onChange={(val) => handleEveningChange(r.id, "wastage_reason", val)}
          >
            {WASTAGE_REASONS.map((reason) => (
              <Option key={reason.value} value={reason.value}>
                {reason.label}
              </Option>
            ))}
          </Select>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, r) =>
        r.status === "CLOSED" ? (
          <Tag color="green">Closed</Tag>
        ) : (
          <Tag color="orange">Pending</Tag>
        ),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl mb-6 border border-indigo-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Daily Stock Management
              </span>
              {branches && branches.length > 1 ? (
                <Select
                  value={effectiveBranchId}
                  onChange={(val) => changeBranch(val)}
                  options={branches.map((b) => ({
                    value: b.branch_id,
                    label: b.branch?.branch_name || b.branch?.name || "Branch",
                  }))}
                  className="w-44 text-xs font-semibold"
                />
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  <ShopOutlined /> {effectiveBranchName}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white m-0">
              Café Daily Inventory & Shift Stock
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Morning purchases & evening remaining stock log. Automatically track sales, calculate daily wastage, and reconcile inventory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DatePicker
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              format="DD MMM YYYY"
              allowClear={false}
              className="bg-white/10 border-white/20 text-white rounded-xl py-2 px-3 hover:border-indigo-400"
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchSummary}
              loading={loading}
              className="bg-white/10 border-white/20 !text-white hover:bg-white/20 rounded-xl"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-5 border-t border-indigo-900/50">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block font-medium">Menu Products</span>
            <span className="text-xl font-bold text-white mt-1 block">
              {summaryMeta.totalProducts || products.length}
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block font-medium">Raw Ingredients</span>
            <span className="text-xl font-bold text-indigo-300 mt-1 block">
              {summaryMeta.totalIngredients || ingredients.length}
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block font-medium">Billed Sales Today</span>
            <span className="text-xl font-bold text-emerald-400 mt-1 block">
              {products.reduce((acc, p) => acc + (p.billed_qty || 0), 0)} units
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-xs text-slate-400 block font-medium">Evening Closed</span>
            <span className="text-xl font-bold text-amber-300 mt-1 block">
              {summaryMeta.closedCount || 0} / {summaryMeta.totalItems || products.length + ingredients.length}
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 col-span-2 md:col-span-1">
            <span className="text-xs text-slate-400 block font-medium">Shift Reconciliation</span>
            <Tag
              color={summaryMeta.openCount === 0 && summaryMeta.totalItems > 0 ? "success" : "processing"}
              className="mt-1 font-semibold"
            >
              {summaryMeta.openCount === 0 && summaryMeta.totalItems > 0
                ? "Shift Closed"
                : "Active Shift"}
            </Tag>
          </div>
        </div>
      </div>

      {/* Main Tabs Container */}
      <Card className="rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          tabBarStyle={{ marginBottom: 20 }}
          items={[
            {
              key: "morning",
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <SunOutlined className="text-amber-500" /> Morning & Purchase Stock
                </span>
              ),
              children: (
                <div>
                  {/* Actions & Filters */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        placeholder="Search item or category..."
                        prefix={<SearchOutlined className="text-gray-400" />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64 rounded-xl"
                        allowClear
                      />
                      <Select
                        value={typeFilter}
                        onChange={setTypeFilter}
                        className="w-44 rounded-xl"
                      >
                        <Option value="all">All Items ({products.length + ingredients.length})</Option>
                        <Option value="product">Menu Items ({products.length})</Option>
                        <Option value="ingredient">Ingredients ({ingredients.length})</Option>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={handleSaveMorning}
                        loading={submitting}
                        className="bg-emerald-600 hover:bg-emerald-700 border-none rounded-xl font-semibold shadow-md shadow-emerald-600/20"
                      >
                        Save Morning / Added Stock
                      </Button>
                    </div>
                  </div>

                  <Alert
                    message="Add Morning Opening or Inward Stock"
                    description="Enter the quantities for items received this morning or purchased during the day. When saved, current stock and opening balances will be updated automatically."
                    type="info"
                    showIcon
                    className="mb-4 rounded-xl border-indigo-100 bg-indigo-50/50"
                  />

                  <Table
                    columns={morningColumns}
                    dataSource={filteredItems}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 12, showSizeChanger: true }}
                    className="rounded-xl overflow-hidden border border-slate-100"
                    size="middle"
                  />
                </div>
              ),
            },
            {
              key: "evening",
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <MoonOutlined className="text-indigo-600" /> Evening Closing & Remaining Stock
                </span>
              ),
              children: (
                <div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        placeholder="Search item or category..."
                        prefix={<SearchOutlined className="text-gray-400" />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64 rounded-xl"
                        allowClear
                      />
                      <Select
                        value={typeFilter}
                        onChange={setTypeFilter}
                        className="w-44 rounded-xl"
                      >
                        <Option value="all">All Items</Option>
                        <Option value="product">Menu Items</Option>
                        <Option value="ingredient">Ingredients</Option>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button onClick={handleAutoFillEvening} className="rounded-xl">
                        Auto-fill with Expected
                      </Button>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleSaveEvening}
                        loading={submitting}
                        className="bg-indigo-600 hover:bg-indigo-700 border-none rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                      >
                        Finalize Evening Closing
                      </Button>
                    </div>
                  </div>

                  <Alert
                    message="Evening Physical Count & Wastage Audit"
                    description="Perform your evening physical count. If actual stock is less than expected, select a wastage reason (e.g. Spoiled, Expired, Spillage) to record accurate loss and reset stock for tomorrow."
                    type="warning"
                    showIcon
                    className="mb-4 rounded-xl border-amber-200 bg-amber-50/50"
                  />

                  <Table
                    columns={eveningColumns}
                    dataSource={filteredItems}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 12, showSizeChanger: true }}
                    className="rounded-xl overflow-hidden border border-slate-100"
                    size="middle"
                  />
                </div>
              ),
            },
            {
              key: "history",
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <HistoryOutlined className="text-slate-600" /> Daily Stock History
                </span>
              ),
              children: (
                <div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <DatePicker.RangePicker
                        value={historyDateRange}
                        onChange={(dates) => dates && setHistoryDateRange(dates)}
                        className="rounded-xl"
                      />
                      <Button icon={<ReloadOutlined />} onClick={fetchHistory} loading={historyLoading}>
                        Filter
                      </Button>
                    </div>
                  </div>

                  <Table
                    dataSource={historyLogs}
                    rowKey="id"
                    loading={historyLoading}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      {
                        title: "Date",
                        dataIndex: "date",
                        key: "date",
                        render: (d) => <span className="font-semibold text-gray-800">{d}</span>,
                      },
                      {
                        title: "Item Name",
                        dataIndex: "item_name",
                        key: "item_name",
                        render: (text, r) => (
                          <div>
                            <span className="font-medium text-gray-800">{text}</span>
                            <Tag color={r.item_type === "product" ? "blue" : "purple"} className="ml-2 text-xs">
                              {r.item_type}
                            </Tag>
                          </div>
                        ),
                      },
                      {
                        title: "Opening",
                        dataIndex: "opening_stock",
                        key: "opening_stock",
                        render: (v, r) => `${v} ${r.unit}`,
                      },
                      {
                        title: "Added",
                        dataIndex: "added_stock",
                        key: "added_stock",
                        render: (v, r) => (
                          <span className={v > 0 ? "text-emerald-600 font-semibold" : ""}>
                            +{v} {r.unit}
                          </span>
                        ),
                      },
                      {
                        title: "Billed",
                        dataIndex: "billed_qty",
                        key: "billed_qty",
                        render: (v, r) => `${v} ${r.unit}`,
                      },
                      {
                        title: "Expected",
                        dataIndex: "expected_stock",
                        key: "expected_stock",
                        render: (v, r) => `${v} ${r.unit}`,
                      },
                      {
                        title: "Closing Count",
                        dataIndex: "closing_stock",
                        key: "closing_stock",
                        render: (v, r) => (v !== null ? `${v} ${r.unit}` : "-"),
                      },
                      {
                        title: "Discrepancy",
                        dataIndex: "discrepancy",
                        key: "discrepancy",
                        render: (v, r) => {
                          if (v === null || v === undefined) return "-";
                          if (v === 0) return <Tag color="success">Balanced</Tag>;
                          if (v < 0) return <Tag color="error">Shortage: {v} {r.unit}</Tag>;
                          return <Tag color="cyan">Surplus: +{v} {r.unit}</Tag>;
                        },
                      },
                      {
                        title: "Wastage Reason",
                        dataIndex: "wastage_reason",
                        key: "wastage_reason",
                        render: (v) => v ? <Tag color="warning">{v}</Tag> : "-",
                      },
                      {
                        title: "Logged By",
                        key: "logged_by",
                        render: (_, r) => (
                          <div className="text-xs text-gray-500">
                            {r.evening_logged_by_name || r.morning_logged_by_name || "Staff"}
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: "ingredients",
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <DatabaseOutlined className="text-teal-600" /> Ingredients Master
                </span>
              ),
              children: (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500 m-0">
                      Manage café raw ingredients (Milk, Coffee, Sugar, Cups, etc.) tracked in daily inventory.
                    </p>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingIngredient(null);
                        ingredientForm.resetFields();
                        setIngredientModalOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                    >
                      Add New Ingredient
                    </Button>
                  </div>

                  <Table
                    dataSource={allIngredients}
                    rowKey="id"
                    columns={[
                      {
                        title: "Ingredient Name",
                        dataIndex: "name",
                        key: "name",
                        render: (text) => <span className="font-semibold text-gray-800">{text}</span>,
                      },
                      {
                        title: "Current Stock",
                        dataIndex: "stock_quantity",
                        key: "stock_quantity",
                        render: (val, r) => (
                          <span className={`font-semibold ${val <= r.low_stock_threshold ? "text-amber-600" : "text-gray-700"}`}>
                            {val} {r.base_unit}
                          </span>
                        ),
                      },
                      {
                        title: "Base Unit",
                        dataIndex: "base_unit",
                        key: "base_unit",
                      },
                      {
                        title: "Low Stock Alert",
                        dataIndex: "low_stock_threshold",
                        key: "low_stock_threshold",
                        render: (v, r) => `${v} ${r.base_unit}`,
                      },
                      {
                        title: "Cost / Unit",
                        dataIndex: "cost_per_unit",
                        key: "cost_per_unit",
                        render: (v) => `₹${Number(v || 0).toFixed(2)}`,
                      },
                      {
                        title: "Actions",
                        key: "actions",
                        render: (_, r) => (
                          <Button
                            size="small"
                            onClick={() => {
                              setEditingIngredient(r);
                              ingredientForm.setFieldsValue(r);
                              setIngredientModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Add / Edit Ingredient Modal */}
      <Modal
        title={editingIngredient ? "Edit Ingredient" : "Add New Raw Material / Ingredient"}
        open={ingredientModalOpen}
        onCancel={() => {
          setIngredientModalOpen(false);
          setEditingIngredient(null);
        }}
        onOk={() => ingredientForm.submit()}
        okText="Save Ingredient"
        destroyOnHidden
      >
        <Form form={ingredientForm} layout="vertical" onFinish={handleSaveIngredient}>
          <Form.Item
            name="name"
            label="Ingredient Name"
            rules={[{ required: true, message: "Please enter name" }]}
          >
            <Input placeholder="e.g. Fresh Milk, Sugar, Coffee Powder" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="base_unit"
              label="Base Unit"
              initialValue="kg"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="kg">kg (Kilograms)</Option>
                <Option value="litre">litre (Litres)</Option>
                <Option value="nos">nos (Pieces / Cups)</Option>
                <Option value="packet">packet (Packets)</Option>
                <Option value="bottle">bottle (Bottles)</Option>
                <Option value="gram">gram (Grams)</Option>
                <Option value="ml">ml (Millilitres)</Option>
              </Select>
            </Form.Item>

            <Form.Item name="stock_quantity" label="Initial Stock" initialValue={0}>
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="low_stock_threshold"
              label="Low Stock Warning At"
              initialValue={5}
            >
              <InputNumber min={0} className="w-full" />
            </Form.Item>

            <Form.Item name="cost_per_unit" label="Cost Per Unit (₹)" initialValue={0}>
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default DailyInventory;
