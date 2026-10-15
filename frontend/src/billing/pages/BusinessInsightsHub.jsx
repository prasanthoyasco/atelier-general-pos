import React, { useState, useEffect, useMemo } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Button,
  DatePicker,
  Progress,
  Spin,
  Empty,
  Badge,
  Segmented,
  Tooltip,
} from "antd";
import {
  TrendingUp,
  IndianRupee,
  Clock,
  Flame,
  CookingPot,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  Boxes,
  Users,
  RefreshCw,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  Store,
  Activity,
  ShieldAlert,
  ShoppingBag,
  ExternalLink,
  Hourglass,
  UtensilsCrossed,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useBranch } from "../../context/BranchContext";
import reportService from "../service/reportService";
import billingService from "../service/billingService";
import dailyInventoryService from "../../stock/service/dailyInventoryService";
import dashboardService from "../../dashboard/service/dashboardService";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

// Color helpers
const PAYMENT_COLORS = {
  cash: "#10b981",
  upi: "#8b5cf6",
  "upi normal account": "#8b5cf6",
  "upi current account": "#a855f7",
  card: "#3b82f6",
  credit_card: "#3b82f6",
  debit_card: "#06b6d4",
  split: "#f59e0b",
  net_banking: "#ec4899",
  other: "#64748b",
};

export default function BusinessInsightsHub() {
  const navigate = useNavigate();
  const { selectedBranch } = useBranch();

  // Active top-level insight sub-tab: 'sales' | 'kitchen' | 'inventory'
  const [activeTab, setActiveTab] = useState("sales");

  // Global Period Filter: 'today' | 'yesterday' | 'week' | 'month' | 'custom'
  const [period, setPeriod] = useState("today");
  const [dateRange, setDateRange] = useState(null);

  // Kitchen Mode: 'live' | 'historical'
  const [kitchenMode, setKitchenMode] = useState("live");
  const [overdueThreshold, setOverdueThreshold] = useState(15); // minutes

  // Loading states
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingKitchen, setLoadingKitchen] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Data states
  const [salesData, setSalesData] = useState(null);
  const [sourceData, setSourceData] = useState(null);
  const [kitchenData, setKitchenData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(null);

  // Auto-refresh timer for live kitchen data (every 20s)
  useEffect(() => {
    let interval;
    if (activeTab === "kitchen" && kitchenMode === "live") {
      interval = setInterval(() => {
        fetchKitchenInsights(false);
      }, 20000);
    }
    return () => clearInterval(interval);
  }, [activeTab, kitchenMode, selectedBranch]);

  // Fetch data when filters change
  useEffect(() => {
    if (activeTab === "sales") {
      fetchSalesInsights();
    } else if (activeTab === "kitchen") {
      fetchKitchenInsights(true);
    } else if (activeTab === "inventory") {
      fetchInventoryInsights();
    }
  }, [activeTab, period, dateRange, selectedBranch, kitchenMode, overdueThreshold]);

  // 1️⃣ Fetch Sales Insights
  const fetchSalesInsights = async () => {
    setLoadingSales(true);
    try {
      const params = { period };
      if (period === "custom" && dateRange) {
        params.startDate = dateRange[0].toISOString();
        params.endDate = dateRange[1].toISOString();
      }

      const [salesRes, sourceRes] = await Promise.allSettled([
        reportService.getSalesReport(params),
        reportService.getSourceWiseReport(params),
      ]);

      if (salesRes.status === "fulfilled") {
        setSalesData(salesRes.value?.data || salesRes.value);
      }
      if (sourceRes.status === "fulfilled") {
        setSourceData(sourceRes.value?.data || sourceRes.value);
      }
    } catch (err) {
      console.error("Failed to fetch sales insights:", err);
    } finally {
      setLoadingSales(false);
    }
  };

  // 2️⃣ Fetch Kitchen Insights
  const fetchKitchenInsights = async (showLoading = true) => {
    if (showLoading) setLoadingKitchen(true);
    try {
      const params = {
        period,
        threshold_minutes: overdueThreshold,
      };
      if (period === "custom" && dateRange) {
        params.startDate = dateRange[0].toISOString();
        params.endDate = dateRange[1].toISOString();
      }

      const res = await billingService.getKitchenInsights(params);
      setKitchenData(res?.data || res);
    } catch (err) {
      console.error("Failed to fetch kitchen insights:", err);
    } finally {
      if (showLoading) setLoadingKitchen(false);
    }
  };

  // 3️⃣ Fetch Inventory Insights
  const fetchInventoryInsights = async () => {
    setLoadingInventory(true);
    try {
      const [invRes, dashRes] = await Promise.allSettled([
        dailyInventoryService.getSummary({
          date: dayjs().format("YYYY-MM-DD"),
        }),
        dashboardService.getDashboardData(period),
      ]);

      if (invRes.status === "fulfilled") {
        setInventoryData(invRes.value);
      }
      if (dashRes.status === "fulfilled") {
        setDashboardSummary(dashRes.value?.data || dashRes.value);
      }
    } catch (err) {
      console.error("Failed to fetch inventory insights:", err);
    } finally {
      setLoadingInventory(false);
    }
  };

  // Helper for Period Label
  const periodLabel = useMemo(() => {
    switch (period) {
      case "today":
        return "Today";
      case "yesterday":
        return "Yesterday";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "custom":
        return "Custom Range";
      default:
        return "Selected Period";
    }
  }, [period]);

  return (
    <div className="min-h-screen bg-slate-50/70 p-3 sm:p-5 md:p-6 pb-28 md:pb-12 text-slate-800">
      {/* ── HEADER & BRANCH CONTEXT ────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <BarChart3 size={20} />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 m-0">
                Business Insights Hub
              </h1>
              <Tag color="purple" className="font-semibold text-xs rounded-full px-2.5">
                Executive
              </Tag>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0 flex items-center gap-1.5">
              <Store size={14} className="text-slate-400" />
              <span>
                Branch:{" "}
                <strong className="text-slate-700">
                  {selectedBranch?.branch_name || selectedBranch?.name || "All Branches"}
                </strong>
              </span>
            </p>
          </div>

          {/* Quick Refresh Button */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              icon={<RefreshCw size={14} />}
              onClick={() => {
                if (activeTab === "sales") fetchSalesInsights();
                else if (activeTab === "kitchen") fetchKitchenInsights(true);
                else fetchInventoryInsights();
              }}
              className="rounded-xl font-medium text-xs sm:text-sm border-slate-200 hover:border-indigo-400"
            >
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* ── MAIN INSIGHT PILL SELECTOR (TABS) ──────────────────────────────── */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-200/80 rounded-2xl max-w-xl mx-auto sm:mx-0">
          <button
            onClick={() => setActiveTab("sales")}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
              activeTab === "sales"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp size={16} />
            <span>Sales Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab("kitchen")}
            className={`relative flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
              activeTab === "kitchen"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Flame size={16} className={kitchenData?.live?.overdue_count > 0 ? "text-red-500 animate-pulse" : ""} />
            <span>Kitchen Health</span>
            {kitchenData?.live?.overdue_count > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-black text-white bg-red-500 rounded-full">
                {kitchenData.live.overdue_count}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
              activeTab === "inventory"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Boxes size={16} />
            <span>Inventory Health</span>
          </button>
        </div>
      </div>

      {/* ── TIME PERIOD FILTER CHIPS ────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto mb-5 sm:mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2.5 rounded-xl border border-slate-200/70 shadow-xs">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
              Period:
            </span>
            {["today", "yesterday", "week", "month"].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                  setDateRange(null);
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                  period === p && !dateRange
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p === "today"
                  ? "Today"
                  : p === "yesterday"
                  ? "Yesterday"
                  : p === "week"
                  ? "This Week"
                  : "This Month"}
              </button>
            ))}
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates) {
                  setPeriod("custom");
                  setDateRange(dates);
                } else {
                  setPeriod("today");
                  setDateRange(null);
                }
              }}
              size="small"
              className="rounded-lg text-xs"
              placeholder={["Start Date", "End Date"]}
            />
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB 1: SALES ANALYTICS ─────────────────────────────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "sales" && (
        <div className="max-w-6xl mx-auto space-y-5">
          {loadingSales ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
              <Spin size="large" />
              <p className="text-sm text-slate-500 font-medium mt-3">Crunching sales numbers...</p>
            </div>
          ) : (
            <>
              {/* Sales Key Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Sales */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Gross Sales</span>
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <IndianRupee size={16} />
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
                    ₹{parseFloat(salesData?.summary?.total_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1 mb-0">For {periodLabel}</p>
                </div>

                {/* Orders / Bills Count */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Bills</span>
                    <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <ShoppingBag size={16} />
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
                    {salesData?.summary?.total_bills || 0}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1 mb-0">Paid orders</p>
                </div>

                {/* Average Bill Value */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Avg Order Value</span>
                    <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                      <TrendingUp size={16} />
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
                    ₹{salesData?.summary?.total_bills > 0
                      ? (parseFloat(salesData?.summary?.total_sales || 0) / salesData?.summary?.total_bills).toFixed(0)
                      : 0}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1 mb-0">Average spend per ticket</p>
                </div>

                {/* Collected Amount */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Collected</span>
                    <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                      <CheckCircle2 size={16} />
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-emerald-600 m-0">
                    ₹{parseFloat(salesData?.summary?.total_collected || salesData?.summary?.total_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1 mb-0">Direct collection</p>
                </div>
              </div>

              {/* Payment Methods Breakdown & Channel Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Payment Methods */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800 m-0 flex items-center gap-1.5">
                      <PieChartIcon size={16} className="text-indigo-600" />
                      Payment Method Breakdown
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">By collection</span>
                  </div>

                  {salesData?.payment_methods && salesData.payment_methods.length > 0 ? (
                    <div className="space-y-3">
                      {salesData.payment_methods.map((method, idx) => {
                        const mName = method.payment_method?.toLowerCase() || "other";
                        const pct = parseFloat(method.percentage || 0);
                        const amount = parseFloat(method.paid_amount || method.total_amount || 0);

                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="capitalize text-slate-700">
                                {method.payment_method?.replace(/_/g, " ")} ({method.count} bills)
                              </span>
                              <span className="font-bold text-slate-900">
                                ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 0 })} ({pct}%)
                              </span>
                            </div>
                            <Progress
                              percent={pct}
                              showInfo={false}
                              strokeColor={PAYMENT_COLORS[mName] || "#6366f1"}
                              trailColor="#f1f5f9"
                              size={["100%", 7]}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No payment breakdown recorded for this period.
                    </div>
                  )}
                </div>

                {/* Sales Channels (Source-Wise) */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800 m-0 flex items-center gap-1.5">
                      <Layers size={16} className="text-indigo-600" />
                      Order Source & Channels
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">Walk-in vs Delivery</span>
                  </div>

                  {sourceData?.sources && sourceData.sources.length > 0 ? (
                    <div className="space-y-2.5">
                      {sourceData.sources.map((src, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                            <span className="font-bold text-slate-800">{src.source || "Walk-in"}</span>
                            <span className="text-slate-400">({src.bills_count} orders)</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900">
                              ₹{parseFloat(src.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                            </span>
                            <span className="text-slate-400 block text-[10px]">{src.percentage}% share</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No source-wise channel data available.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Banner to Full Sales Report */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-indigo-950 m-0">Detailed Sales & Invoices</h4>
                    <p className="text-xs text-indigo-700/80 m-0">
                      Export reports to Excel or PDF, filter by custom timestamps and verify item taxes.
                    </p>
                  </div>
                </div>
                <Button
                  type="primary"
                  onClick={() => navigate("/billing/reports")}
                  className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-xs shrink-0"
                >
                  View Full Sales Report
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB 2: KITCHEN HEALTH & BOTTLENECKS ("KITCHEN STRUGGLING") ─────── */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "kitchen" && (
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Sub-Switch: Live Queue vs Historical Performance */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Kitchen Mode:
              </span>
              <Segmented
                value={kitchenMode}
                onChange={setKitchenMode}
                options={[
                  {
                    label: (
                      <div className="flex items-center gap-1.5 px-1 py-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <span className="font-bold text-xs">Live Kitchen Pulse</span>
                      </div>
                    ),
                    value: "live",
                  },
                  {
                    label: (
                      <div className="flex items-center gap-1.5 px-1 py-0.5">
                        <BarChart3 size={13} />
                        <span className="font-bold text-xs">Past Bottlenecks & Trends</span>
                      </div>
                    ),
                    value: "historical",
                  },
                ]}
                className="font-medium bg-slate-100 p-1 rounded-xl"
              />
            </div>

            {/* Threshold Selector */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-xs text-slate-500 font-medium">Delay Threshold:</span>
              <select
                value={overdueThreshold}
                onChange={(e) => setOverdueThreshold(Number(e.target.value))}
                className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 cursor-pointer"
              >
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes (Standard)</option>
                <option value={20}>20 minutes</option>
                <option value={25}>25 minutes</option>
              </select>
            </div>
          </div>

          {loadingKitchen ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
              <Spin size="large" />
              <p className="text-sm text-slate-500 font-medium mt-3">Analyzing kitchen workload & delays...</p>
            </div>
          ) : (
            <>
              {/* 🔴 LIVE KITCHEN PULSE VIEW */}
              {kitchenMode === "live" && (
                <div className="space-y-4">
                  {/* Live Stress Meter Banner */}
                  <div
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      kitchenData?.live?.stress_level === "struggling"
                        ? "bg-red-50/90 border-red-200 shadow-sm"
                        : kitchenData?.live?.stress_level === "busy"
                        ? "bg-amber-50/90 border-amber-200 shadow-sm"
                        : "bg-emerald-50/90 border-emerald-200 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2.5 rounded-xl shrink-0 ${
                            kitchenData?.live?.stress_level === "struggling"
                              ? "bg-red-600 text-white animate-pulse"
                              : kitchenData?.live?.stress_level === "busy"
                              ? "bg-amber-500 text-white"
                              : "bg-emerald-600 text-white"
                          }`}
                        >
                          {kitchenData?.live?.stress_level === "struggling" ? (
                            <ShieldAlert size={22} />
                          ) : kitchenData?.live?.stress_level === "busy" ? (
                            <AlertCircle size={22} />
                          ) : (
                            <CheckCircle2 size={22} />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 m-0">
                              {kitchenData?.live?.stress_level === "struggling"
                                ? "Kitchen Struggling — Overdue Bottleneck Detected!"
                                : kitchenData?.live?.stress_level === "busy"
                                ? "Kitchen Busy — High Active Queue"
                                : "Kitchen Flowing Smoothly"}
                            </h3>
                            <Tag
                              color={
                                kitchenData?.live?.stress_level === "struggling"
                                  ? "red"
                                  : kitchenData?.live?.stress_level === "busy"
                                  ? "gold"
                                  : "green"
                              }
                              className="font-bold text-[10px] uppercase px-2 rounded-full"
                            >
                              {kitchenData?.live?.stress_level}
                            </Tag>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 mt-1 mb-0">
                            {kitchenData?.live?.stress_level === "struggling"
                              ? `Alert: ${kitchenData?.live?.overdue_count} order(s) have exceeded the ${overdueThreshold}-minute limit! Longest wait is ${kitchenData?.live?.max_wait_minutes} mins.`
                              : kitchenData?.live?.stress_level === "busy"
                              ? `${kitchenData?.live?.active_tickets_count} orders currently in prep. Keep an eye on station speed.`
                              : `All active orders are on schedule. No tickets have exceeded the ${overdueThreshold}-minute mark.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Active In Queue
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">
                          {kitchenData?.live?.active_tickets_count || 0}
                        </span>
                        <span className="text-xs text-slate-400">tickets</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                        <span>Pending: {kitchenData?.live?.pending_count || 0}</span>
                        <span>•</span>
                        <span>Cooking: {kitchenData?.live?.preparing_count || 0}</span>
                      </div>
                    </div>

                    <div className={`bg-white p-4 rounded-2xl border shadow-xs ${kitchenData?.live?.overdue_count > 0 ? "border-red-300 bg-red-50/30" : "border-slate-200/80"}`}>
                      <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block mb-1">
                        Overdue Tickets (&gt;{overdueThreshold}m)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-black ${kitchenData?.live?.overdue_count > 0 ? "text-red-600 animate-pulse" : "text-slate-900"}`}>
                          {kitchenData?.live?.overdue_count || 0}
                        </span>
                        <span className="text-xs text-slate-400">delayed</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 mb-0">Needs chef priority</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Longest Wait Right Now
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-amber-600">
                          {kitchenData?.live?.max_wait_minutes || 0}
                        </span>
                        <span className="text-xs text-slate-400">minutes</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 mb-0">Oldest active ticket</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Kitchen Stations
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-indigo-600">
                          {kitchenData?.live?.station_loads?.length || 1}
                        </span>
                        <span className="text-xs text-slate-400">active stations</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 mb-0">Routing tickets</p>
                    </div>
                  </div>

                  {/* Stations Live Load Distribution */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                      <CookingPot size={16} className="text-indigo-600" />
                      Live Station Workload Distribution
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {(kitchenData?.live?.station_loads || []).map((st, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border ${
                            st.overdueCount > 0
                              ? "bg-red-50/40 border-red-200"
                              : "bg-slate-50 border-slate-200/70"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-bold text-xs text-slate-800">{st.station}</span>
                            {st.overdueCount > 0 ? (
                              <Tag color="red" className="text-[10px] font-bold m-0">
                                {st.overdueCount} Overdue
                              </Tag>
                            ) : (
                              <Tag color="green" className="text-[10px] font-bold m-0">
                                Optimal
                              </Tag>
                            )}
                          </div>
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Active Tickets:</span>
                            <span className="font-bold text-slate-800">{st.activeCount}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                            <span>Dishes in Prep:</span>
                            <span className="font-bold text-slate-800">{st.itemsCount} items</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Overdue Tickets Watchlist (Actionable for Admin) */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-slate-900 m-0 flex items-center gap-1.5">
                        <Hourglass size={16} className="text-red-500" />
                        Delayed Orders Watchlist ({kitchenData?.live?.overdue_tickets?.length || 0})
                      </h3>
                      <span className="text-xs text-slate-400">Ordered by longest wait</span>
                    </div>

                    {kitchenData?.live?.overdue_tickets && kitchenData.live.overdue_tickets.length > 0 ? (
                      <div className="space-y-2.5">
                        {kitchenData.live.overdue_tickets.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl border border-red-200 bg-red-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs text-red-700">
                                  KOT #{t.kot_number}
                                </span>
                                {t.billing_no && (
                                  <span className="text-xs font-semibold text-slate-600">
                                    • Bill #{t.billing_no}
                                  </span>
                                )}
                                {t.counter_no && (
                                  <Tag color="orange" className="text-[10px] font-bold m-0">
                                    Table {t.counter_no}
                                  </Tag>
                                )}
                                <Tag color="red" className="text-[10px] font-black uppercase m-0">
                                  {t.wait_minutes}m Waiting
                                </Tag>
                              </div>

                              <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-1">
                                {t.items?.map((it, idx) => (
                                  <span key={idx} className="bg-white/80 px-1.5 py-0.5 rounded text-[11px] border border-red-100">
                                    {it.quantity}x {it.product_name}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <span className="text-[11px] text-slate-500">{t.kitchen_name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                        No overdue orders right now! All orders are being served within {overdueThreshold} minutes.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 📊 HISTORICAL KITCHEN PERFORMANCE & BOTTLENECKS VIEW (PAST DATA) */}
              {kitchenMode === "historical" && (
                <div className="space-y-4">
                  {/* Historical Key Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Avg Prep Time
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-indigo-600">
                          {kitchenData?.historical?.avg_prep_minutes || 0}
                        </span>
                        <span className="text-xs text-slate-400">minutes</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 mb-0">Cook turnaround</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Delay Rate %
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-black ${
                          parseFloat(kitchenData?.historical?.delay_rate_pct || 0) > 15
                            ? "text-red-600"
                            : "text-slate-900"
                        }`}>
                          {kitchenData?.historical?.delay_rate_pct || 0}%
                        </span>
                        <span className="text-xs text-slate-400">of tickets</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 mb-0">
                        {kitchenData?.historical?.delayed_tickets || 0} orders exceeded {overdueThreshold}m
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Total Orders Cooked
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">
                          {kitchenData?.historical?.served_tickets || 0}
                        </span>
                        <span className="text-xs text-slate-400">served</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 mb-0">
                        Total tickets: {kitchenData?.historical?.total_tickets || 0}
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Order Turnaround
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">
                          {kitchenData?.historical?.avg_turnaround_minutes || 0}
                        </span>
                        <span className="text-xs text-slate-400">minutes</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 mb-0">Order to table served</p>
                    </div>
                  </div>

                  {/* Hourly Bottleneck Breakdown (When did the kitchen struggle?) */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                      <Clock size={16} className="text-indigo-600" />
                      Peak Bottleneck Hours (Rush Analysis)
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                      Shows order load and delay spikes across hours of the day to optimize chef scheduling.
                    </p>

                    {kitchenData?.historical?.hourly_stats && kitchenData.historical.hourly_stats.length > 0 ? (
                      <div className="overflow-x-auto scrollbar-thin">
                        <div className="min-w-[500px] grid grid-cols-12 gap-1.5 text-center">
                          {kitchenData.historical.hourly_stats.map((h, i) => {
                            const delayPct = h.tickets > 0 ? Math.round((h.delayed / h.tickets) * 100) : 0;
                            return (
                              <div
                                key={i}
                                className={`p-2 rounded-xl border flex flex-col justify-between ${
                                  h.delayed > 0 ? "bg-red-50/60 border-red-200" : "bg-slate-50 border-slate-100"
                                }`}
                              >
                                <span className="text-[10px] font-bold text-slate-500">{h.hour}</span>
                                <div className="my-1.5">
                                  <span className="text-base font-black text-slate-900">{h.tickets}</span>
                                  <span className="block text-[9px] text-slate-400">tickets</span>
                                </div>
                                <div>
                                  {h.delayed > 0 ? (
                                    <Tag color="red" className="text-[9px] font-bold m-0 px-1">
                                      {h.delayed} delayed
                                    </Tag>
                                  ) : (
                                    <span className="text-[9px] text-slate-400">Smooth</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No hourly traffic recorded for this period.
                      </div>
                    )}
                  </div>

                  {/* Slowest / Bottleneck Dishes */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Slowest Dishes */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                      <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                        <UtensilsCrossed size={16} className="text-amber-500" />
                        Dishes Frequently Delayed (Bottleneck Menu Items)
                      </h3>
                      <p className="text-xs text-slate-500 mb-3">
                        Dishes with the highest delay frequency or longest cook times.
                      </p>

                      {kitchenData?.historical?.slowest_dishes && kitchenData.historical.slowest_dishes.length > 0 ? (
                        <div className="space-y-2">
                          {kitchenData.historical.slowest_dishes.map((dish, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-800">{dish.product_name}</span>
                                <span className="text-slate-400 block text-[11px]">
                                  {dish.order_count} orders prepared
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-red-600 block">
                                  {dish.delayed_count} delayed ({dish.delay_rate_pct}%)
                                </span>
                                {dish.avg_prep_minutes > 0 && (
                                  <span className="text-slate-500 text-[10px]">
                                    Avg cook: {dish.avg_prep_minutes}m
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          No bottleneck dishes recorded.
                        </div>
                      )}
                    </div>

                    {/* Historical Station Performance */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                      <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                        <CookingPot size={16} className="text-indigo-600" />
                        Station Efficiency Comparison
                      </h3>
                      <p className="text-xs text-slate-500 mb-3">
                        Turnaround times and delay rates by kitchen department.
                      </p>

                      {kitchenData?.historical?.stations && kitchenData.historical.stations.length > 0 ? (
                        <div className="space-y-2.5">
                          {kitchenData.historical.stations.map((st, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-800">{st.station}</span>
                                <span className="text-slate-400 block text-[11px]">
                                  {st.total_tickets} orders ({st.served_tickets} served)
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">
                                    Avg: {st.avg_prep_minutes}m
                                  </span>
                                  <Tag
                                    color={st.delay_rate_pct > 15 ? "red" : "green"}
                                    className="text-[10px] font-bold m-0"
                                  >
                                    {st.delay_rate_pct}% delay
                                  </Tag>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          No station history available.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* ── TAB 3: INVENTORY HEALTH & RECONCILIATION ───────────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === "inventory" && (
        <div className="max-w-6xl mx-auto space-y-5">
          {loadingInventory ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
              <Spin size="large" />
              <p className="text-sm text-slate-500 font-medium mt-3">Analyzing stock levels and wastage...</p>
            </div>
          ) : (
            <>
              {/* Critical Low Stock Warning Banner */}
              {dashboardSummary?.lowStockProducts && dashboardSummary.lowStockProducts.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950 m-0">
                      {dashboardSummary.lowStockProducts.length} Products Running Low on Stock!
                    </h4>
                    <p className="text-xs text-amber-800 mt-1 mb-0">
                      Immediate replenishment recommended to avoid 86-ing items on the menu during service.
                    </p>
                  </div>
                </div>
              )}

              {/* Inventory Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Total Stock Items
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">
                      {dashboardSummary?.summary?.totalStockQuantity || 0}
                    </span>
                    <span className="text-xs text-slate-400">units</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 mb-0">Across all catalog</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block mb-1">
                    Low Stock Alerts
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-600">
                      {dashboardSummary?.lowStockProducts?.length || 0}
                    </span>
                    <span className="text-xs text-slate-400">items</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 mb-0">Threshold &lt; 10 units</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Total Active Products
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-indigo-600">
                      {dashboardSummary?.summary?.totalProducts || 0}
                    </span>
                    <span className="text-xs text-slate-400">products</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 mb-0">Menu offerings</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                    Daily Reconciled
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-600">
                      {inventoryData?.summary?.total_items || 0}
                    </span>
                    <span className="text-xs text-slate-400">tracked</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 mb-0">Morning/Evening counts</p>
                </div>
              </div>

              {/* Low Stock Items List */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 m-0 flex items-center gap-1.5">
                    <Boxes size={16} className="text-amber-500" />
                    Low Stock & Reorder Watchlist
                  </h3>
                  <Button
                    size="small"
                    onClick={() => navigate("/stock/daily-inventory")}
                    className="text-xs font-bold rounded-lg"
                  >
                    Manage Daily Stock
                  </Button>
                </div>

                {dashboardSummary?.lowStockProducts && dashboardSummary.lowStockProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {dashboardSummary.lowStockProducts.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-xs text-slate-900 block truncate max-w-[170px]">
                            {p.product?.product_name || "Product"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.product?.product_code || "SKU"}
                          </span>
                        </div>
                        <div className="text-right">
                          <Tag color="red" className="font-black text-xs m-0">
                            {p.quantity} Left
                          </Tag>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                    Stock levels are healthy across all tracked items!
                  </div>
                )}
              </div>

              {/* Daily Reconciliation CTA Banner */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/10 text-white shrink-0">
                    <PackageCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white m-0">Daily Stock & Wastage Entry</h4>
                    <p className="text-xs text-slate-300 m-0">
                      Record morning stock arrivals, evening closing counts, and reasons for spoilage or shrinkage.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/stock/daily-inventory")}
                  className="bg-white text-slate-900 hover:bg-slate-100 border-none rounded-xl font-bold text-xs shrink-0"
                >
                  Open Daily Stock
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
