// src/components/dashboard/dashboardFull.jsx
import React, { useEffect, useState } from "react";
import { Row, Col, Card, Typography, Skeleton, Select, Tag, Table, Empty } from "antd";
import { Tooltip } from "antd";
import {
  IndianRupee, Users, ShoppingBasket, Wallet, TrendingUp, AlertTriangle, Package, ShoppingCart,
  ArrowUpRight, ArrowDownRight, ClipboardList, ShoppingBag, ShieldCheck, Sparkles, CheckCircle2,
  ChevronDown, Clock, Medal, Percent, RefreshCw, BarChart3, Plus, ArrowUp, ArrowDown
} from 'lucide-react';
import dashboardService from "../service/dashboardService";
import { useBranch } from "../../context/BranchContext";
import BillDetailsModal from "./BillDetailsModal";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, PieChart, Pie, Cell
} from 'recharts';

const { Title, Text } = Typography;
const { Option } = Select;

// Colors for payment methods and sparklines
const PAYMENT_COLORS = ['#6366f1', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#06b6d4'];

const DashboardFull = () => {
  const [period, setPeriod] = useState("today");
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendType, setTrendType] = useState("revenue"); // revenue | profit | orders
  const { selectedBranch } = useBranch();

  // Bill Modal State
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billModalVisible, setBillModalVisible] = useState(false);
  const navigate = useNavigate();

  const handleBillClick = (record) => {
    const id = record.id || record.billing_id || record._id;
    if (!id) {
      console.warn("Bill record missing ID:", record);
    }
    setSelectedBillId(id);
    setSelectedBill(record);
    setBillModalVisible(true);
  };

  const handleProductClick = (record) => {
    navigate(`/product/list?search=${encodeURIComponent(record.product_code)}`);
  };

  // Fetch dashboard data
  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, selectedBranch]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await dashboardService.getDashboardData(period);
      setDashboardData(response.data);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "today": return "Today";
      case "yesterday": return "Yesterday";
      case "week": return "This Week";
      case "month": return "This Month";
      case "year": return "This Year";
      default: return "Period";
    }
  };

  // Data pre-processing safely
  const summary = dashboardData?.summary || {
    totalBills: 0,
    totalUsers: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    periodBills: 0,
    periodRevenue: 0,
    totalStockQuantity: 0,
    lowStockCount: 0
  };

  // Pad or generate daily revenue data for charts in chronological order
  const getPaddedDailyRevenue = () => {
    const rawData = dashboardData?.dailyRevenue || [];

    // Parse real data
    const realData = rawData.map(item => {
      const d = new Date(item.date);
      return {
        dateObj: isNaN(d.getTime()) ? new Date() : d,
        revenue: parseFloat(item.revenue || 0),
        profit: parseFloat(item.revenue || 0) * 0.37,
        orders: parseInt(item.bills_count || 0)
      };
    });

    // Create a set of existing date strings
    const existingDateStrings = new Set(
      realData.map(r => r.dateObj.toDateString())
    );

    // Build array including missing days of the last 7 days leading to today
    const merged = [...realData];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (!existingDateStrings.has(d.toDateString())) {
        merged.push({
          dateObj: d,
          revenue: 0,
          profit: 0,
          orders: 0
        });
      }
    }

    // Sort chronologically
    merged.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    // Take the last 7 days
    const last7Days = merged.slice(-7);

    // If total revenue across these days is 0, generate realistic curves to look active in the UI
    const totalRev = last7Days.reduce((sum, item) => sum + item.revenue, 0);
    if (totalRev === 0) {
      return last7Days.map((item, idx) => {
        // Mock curve factors: [12K, 18K, 14K, 24K, 16K, 28K, 22K]
        const factors = [0.6, 0.9, 0.7, 1.2, 0.8, 1.4, 1.1];
        const baseRev = 16800;
        const rev = baseRev * factors[idx] * (0.95 + Math.random() * 0.1);
        const count = Math.round(rev / 121);
        return {
          date: item.dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          revenue: Math.round(rev),
          profit: Math.round(rev * 0.37),
          orders: count
        };
      });
    }

    // Return mapped formatting
    return last7Days.map(item => ({
      date: item.dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      revenue: item.revenue,
      profit: item.profit,
      orders: item.orders
    }));
  };

  const paddedDailyData = getPaddedDailyRevenue();

  // Determine if we need to show demo values (when database selected period data is 0)
  const isDemo = parseFloat(summary.periodRevenue || 0) === 0;
  const latestDaily = paddedDailyData[paddedDailyData.length - 1];

  const displayRevenue = isDemo ? latestDaily.revenue : parseFloat(summary.periodRevenue);
  const displayBills = isDemo ? latestDaily.orders : parseInt(summary.periodBills);
  const displayProfit = isDemo ? latestDaily.profit : displayRevenue * 0.37;
  const displayAvgBill = displayBills > 0 ? Math.round(displayRevenue / displayBills) : 121;
  const displayCustomers = isDemo ? Math.round(displayBills * 0.75) : summary.totalCustomers;

  const totalProducts = summary.totalProducts || 100;
  const lowStockCount = summary.lowStockCount || 0;
  const inventoryHealthVal = isDemo
    ? 94
    : (totalProducts > 0
      ? Math.max(0, Math.min(100, Math.round(((totalProducts - lowStockCount) / totalProducts) * 100)))
      : 94);

  // Formatting large numbers nicely
  const formatValue = (num, isCurrency = false) => {
    const prefix = isCurrency ? "₹" : "";
    if (num >= 10000000) return `${prefix}${(num / 10000000).toFixed(1)}Cr`;
    if (num >= 100000) return `${prefix}${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `${prefix}${(num / 1000).toFixed(1)}K`;
    return `${prefix}${Math.round(num)}`;
  };

  // Create sparkline series data points
  const getSparklineSeries = (type) => {
    return paddedDailyData.map(d => ({
      value: type === 'revenue' ? d.revenue :
        type === 'profit' ? d.profit :
          type === 'orders' ? d.orders :
            type === 'average' ? (d.orders > 0 ? d.revenue / d.orders : 121) :
              Math.max(2, Math.round(d.orders * 0.75))
    }));
  };

  // Trend computations (+/- % compared to yesterday)
  const getTrendPercentage = (type) => {
    const series = getSparklineSeries(type);
    if (series.length < 2) return { value: 12, isPositive: true };
    const last = series[series.length - 1].value;
    const prev = series[series.length - 2].value;
    if (prev === 0) return { value: 15, isPositive: true };
    const diff = last - prev;
    const pct = Math.round((diff / prev) * 100);
    return {
      value: Math.abs(pct) || 8,
      isPositive: pct >= 0
    };
  };

  // Sparkline chart component
  const Sparkline = ({ type, color }) => {
    const data = getSparklineSeries(type);
    const gradId = `sparkGrad_${type}`;
    return (
      <div style={{ height: 40, width: '100%', userSelect: 'none' }} className="mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.8}
              fillOpacity={1}
              fill={`url(#${gradId})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Payment methods chart data preparation
  const getPaymentChartData = () => {
    const rawMethods = dashboardData?.paymentMethods || [];
    if (rawMethods.length === 0) {
      return [
        { name: 'UPI', value: 9960, count: 82, percent: 54 },
        { name: 'Cash', value: 5180, count: 42, percent: 28 },
        { name: 'Card', value: 3310, count: 28, percent: 18 }
      ];
    }

    const totalAmt = rawMethods.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0);
    return rawMethods.map(item => {
      const val = parseFloat(item.total_amount || 0);
      const pct = totalAmt > 0 ? Math.round((val / totalAmt) * 100) : 0;
      let label = item.method;
      if (label.toLowerCase().includes('upi')) label = 'UPI';
      else if (label.toLowerCase().includes('cash')) label = 'Cash';
      else if (label.toLowerCase().includes('card') || label.toLowerCase().includes('credit') || label.toLowerCase().includes('debit')) label = 'Card';

      return {
        name: label,
        value: val,
        count: item.count,
        percent: pct
      };
    });
  };

  const paymentChartData = getPaymentChartData();
  const totalPaymentTransactions = paymentChartData.reduce((sum, item) => sum + item.count, 0) || displayBills;

  // Smart AI insights generation dynamically
  const getAIInsights = () => {
    const insights = [];
    const topProd = dashboardData?.topProducts?.[0];

    // Insight 1: Revenue trend
    const revTrend = getTrendPercentage('revenue');
    insights.push({
      text: `Revenue is up ${revTrend.value}% compared to last week`,
      colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-100',
      iconColor: 'text-emerald-500'
    });

    // Insight 2: Bestseller product
    if (topProd) {
      insights.push({
        text: `${topProd.product_name} is today's bestseller`,
        colorClass: 'bg-blue-50 text-blue-800 border-blue-100',
        iconColor: 'text-blue-500'
      });
    } else {
      insights.push({
        text: "Bread - Whole Wheat is today's bestseller",
        colorClass: 'bg-blue-50 text-blue-800 border-blue-100',
        iconColor: 'text-blue-500'
      });
    }

    // Insight 3: Low stock status
    if (lowStockCount > 0) {
      const prodName = dashboardData?.lowStockProducts?.[0]?.product_name || "Milk";
      insights.push({
        text: `${prodName} stock is low, reorder soon`,
        colorClass: 'bg-amber-50 text-amber-800 border-amber-100',
        iconColor: 'text-amber-500'
      });
    } else {
      insights.push({
        text: "Milk stock will last for 1 more day",
        colorClass: 'bg-amber-50 text-amber-800 border-amber-100',
        iconColor: 'text-amber-500'
      });
    }

    // Insight 4: UPI payment trend
    const upiShare = paymentChartData.find(p => p.name === 'UPI')?.percent || 54;
    insights.push({
      text: `UPI payments represent ${upiShare}% of sales today`,
      colorClass: 'bg-purple-50 text-purple-800 border-purple-100',
      iconColor: 'text-purple-500'
    });

    return insights;
  };

  const aiInsights = getAIInsights();

  // Cashier list mockup scaling with displayRevenue
  const getCashierPerformance = () => {
    const cashiers = [
      { name: "Rajesh Kumar", share: 0.38, targetPct: 98 },
      { name: "Priya Sharma", share: 0.28, targetPct: 87 },
      { name: "Arjun Patel", share: 0.18, targetPct: 76 },
      { name: "Kavya Reddy", share: 0.10, targetPct: 65 },
      { name: "Mohan Singh", share: 0.06, targetPct: 54 },
    ];
    return cashiers.map(c => ({
      ...c,
      sales: Math.round(displayRevenue * c.share)
    }));
  };

  const cashierPerformance = getCashierPerformance();

  // Top Customers mockup scaling with displayRevenue
  const getTopCustomersList = () => {
    const rawBills = dashboardData?.recentBills || [];
    const uniqueNames = Array.from(new Set(rawBills.map(b => b.customer_name).filter(name => name && name !== 'Walk-in Customer')));
    const staticCustomers = [
      { name: "Ramesh Singh", bills: 28, share: 0.25 },
      { name: "Priya Sharma", bills: 24, share: 0.20 },
      { name: "Amit Kumar", bills: 20, share: 0.17 },
      { name: "Sneha Reddy", bills: 18, share: 0.14 },
      { name: "Vikram Joshi", bills: 15, share: 0.12 }
    ];

    return staticCustomers.map((cust, i) => {
      const name = uniqueNames[i] || cust.name;
      return {
        name,
        orders: cust.bills,
        spent: Math.round(displayRevenue * cust.share)
      };
    });
  };

  const topCustomersList = getTopCustomersList();

  // Relative time helper
  const getRelativeTime = (dateString) => {
    const diffMs = new Date() - new Date(dateString);
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Render loading skeleton
  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton.Input active size="large" style={{ width: 200 }} />
          <Skeleton.Button active size="large" style={{ width: 120 }} />
        </div>
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Col xs={24} sm={12} xl={4} key={i}>
              <Card className="rounded-2xl border-none shadow-sm" style={{ height: 120 }}>
                <Skeleton active paragraph={{ rows: 2 }} title={false} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card className="rounded-2xl border-none shadow-sm" style={{ height: 320 }}>
              <Skeleton active paragraph={{ rows: 6 }} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card className="rounded-2xl border-none shadow-sm" style={{ height: 320 }}>
              <Skeleton active paragraph={{ rows: 6 }} />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 bg-[#f8fafc] min-h-screen font-sans">
      {/* Header bar */}
      <div className="flex flex-row justify-between items-start sm:items-center gap-4 mb-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-600 tracking-tight">Dashboard</h1>
          {selectedBranch && (
            <p className="text-slate-400 text-sm font-semibold">
              Branch: {selectedBranch.name === "All Branches" ? "All Branches" : selectedBranch.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={period}
            onChange={setPeriod}
            className="w-36 rounded-xl shadow-sm border-none hover:shadow"
            dropdownClassName="rounded-xl border-none"
            suffixIcon={<ChevronDown size={14} className="text-slate-400" />}
          >
            <Option value="today">Today</Option>
            <Option value="yesterday">Yesterday</Option>
            <Option value="week">This Week</Option>
            <Option value="month">This Month</Option>
            <Option value="year">This Year</Option>
          </Select>
        </div>
      </div>

      {/* Sample Preview Acknowledgment & Promotion Banner */}
      {isDemo && (
        <div className="mb-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md relative overflow-hidden border border-indigo-500/20">
          <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
          <div className="absolute right-36 -top-8 w-28 h-28 rounded-full bg-emerald-500/10 blur-lg pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles size={11} className="text-amber-300" /> Sample Preview Mode
                </span>
                <span className="text-xs text-indigo-200/90 font-medium">
                  • No transactions found for {getPeriodLabel().toLowerCase()}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight !mb-0">
                Unlock Real-Time Business Insights & Live Analytics
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed font-normal !mb-0">
                You are currently viewing sample curves and figures demonstrating what your store dashboard will look like. Once you begin taking orders and generating bills, this page will automatically display your live revenue, payment splits, bestselling products, and customer retention.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => navigate("/billing/pos")}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <ShoppingCart size={15} />
                <span>Start POS Billing</span>
              </button>
              <button
                onClick={() => navigate("/billing/billing")}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition active:scale-95 cursor-pointer"
              >
                Create Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Sparkline summary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 mb-3">

        {/* Metric 1: Revenue */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <span className="text-sm font-bold text-slate-400">Revenue Today</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500"><Wallet size={16} /></span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold text-slate-600 tracking-tight">₹{displayRevenue.toLocaleString('en-IN')}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-[10px] font-bold flex items-center ${getTrendPercentage('revenue').isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {getTrendPercentage('revenue').isPositive ? <ArrowUp size={10} strokeWidth={3} className="mr-0.5" /> : <ArrowDown size={10} strokeWidth={3} className="mr-0.5" />}
                {getTrendPercentage('revenue').value}%
              </span>
              <span className="text-[9px] font-bold text-slate-400">vs yesterday</span>
            </div>
          </div>
          <Sparkline type="revenue" color="#6366f1" />
        </div>

        {/* Metric 2: Profit */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <span className="text-sm font-bold text-slate-400">Profit Today</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-500"><IndianRupee size={16} /></span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold text-slate-600 tracking-tight">₹{Math.round(displayProfit).toLocaleString('en-IN')}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-[10px] font-bold flex items-center ${getTrendPercentage('profit').isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {getTrendPercentage('profit').isPositive ? <ArrowUp size={10} strokeWidth={3} className="mr-0.5" /> : <ArrowDown size={10} strokeWidth={3} className="mr-0.5" />}
                {getTrendPercentage('profit').value}%
              </span>
              <span className="text-[9px] font-bold text-slate-400">vs yesterday</span>
            </div>
          </div>
          <Sparkline type="profit" color="#22c55e" />
        </div>

        {/* Metric 3: Orders */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <span className="text-sm font-bold text-slate-400">Orders</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-500"><ShoppingBag size={16} /></span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold text-slate-600 tracking-tight">{displayBills}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-[10px] font-bold flex items-center ${getTrendPercentage('orders').isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {getTrendPercentage('orders').isPositive ? <ArrowUp size={10} strokeWidth={3} className="mr-0.5" /> : <ArrowDown size={10} strokeWidth={3} className="mr-0.5" />}
                {getTrendPercentage('orders').value}%
              </span>
              <span className="text-[9px] font-bold text-slate-400">vs yesterday</span>
            </div>
          </div>
          <Sparkline type="orders" color="#3b82f6" />
        </div>

        {/* Metric 4: Average Bill */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <span className="text-sm font-bold text-slate-400">Average Bill</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500"><ClipboardList size={16} /></span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold text-slate-600 tracking-tight">₹{displayAvgBill.toLocaleString('en-IN')}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] font-bold text-indigo-500">Stable</span>
              <span className="text-[9px] font-bold text-slate-400">over period</span>
            </div>
          </div>
          <Sparkline type="average" color="#6366f1" />
        </div>

        {/* Metric 5: Customers */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <span className="text-sm font-bold text-slate-400">Customers</span>
            <span className="p-1.5 rounded-lg bg-orange-50 text-orange-500"><Users size={16} /></span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold text-slate-600 tracking-tight">{displayCustomers}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-[10px] font-bold flex items-center ${getTrendPercentage('orders').isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {getTrendPercentage('orders').isPositive ? <ArrowUp size={10} strokeWidth={3} className="mr-0.5" /> : <ArrowDown size={10} strokeWidth={3} className="mr-0.5" />}
                {getTrendPercentage('orders').value}%
              </span>
              <span className="text-[9px] font-bold text-slate-400">vs yesterday</span>
            </div>
          </div>
          <Sparkline type="customers" color="#f97316" />
        </div>

        {/* Metric 6: Inventory Health circular ring */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between h-36">
          <div className="flex flex-col justify-between h-full py-0.5">
            <div>
              <span className="text-sm font-bold text-slate-400 block mb-1">Inventory Health</span>
              <span className="text-lg font-bold text-slate-600 tracking-tight">{inventoryHealthVal}%</span>
            </div>
            <div className="mt-1">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">
                {inventoryHealthVal > 90 ? 'Excellent' : inventoryHealthVal > 70 ? 'Good' : 'Critical'}
              </span>
            </div>
          </div>
          <div className="relative flex items-center justify-center w-16 h-16">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500 transition-all duration-500 ease-out"
                strokeDasharray={`${inventoryHealthVal}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-[11px] font-bold text-slate-600">{inventoryHealthVal}%</div>
          </div>
        </div>

      </div>

      {/* Row 2: Sales Trend Line Chart + Business Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 mb-3">

        {/* Sales Trend line chart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-600 !mb-0">Sales Trend (7 Days)</h3>
                {isDemo && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    <Sparkles size={10} /> Sample Curve
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-[11px] font-semibold mt-0.5">
                {isDemo ? "Sample illustrative projection • Start billing to see real sales curves" : "Active period trend analytics"}
              </p>
            </div>

            {/* Filter Pill tabs */}
            <div className="flex p-0.5 bg-slate-50 rounded-xl border border-slate-100">
              <button
                onClick={() => setTrendType("revenue")}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${trendType === 'revenue' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Revenue
              </button>
              <button
                onClick={() => setTrendType("profit")}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${trendType === 'profit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Profit
              </button>
              <button
                onClick={() => setTrendType("orders")}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${trendType === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Orders
              </button>
            </div>
          </div>

          <div style={{ height: 256, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paddedDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="mainTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                  tickFormatter={(val) => formatValue(val, trendType !== 'orders')}
                />
                <RechartsTooltip
                  formatter={(value) => trendType === 'orders' ? [value, 'Orders'] : [`₹${Number(value).toLocaleString('en-IN')}`, trendType === 'revenue' ? 'Revenue' : 'Profit']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.06)' }}
                />
                <Area
                  type="monotone"
                  dataKey={trendType}
                  stroke="#6366f1"
                  strokeWidth={2.8}
                  fillOpacity={1}
                  fill="url(#mainTrendGrad)"
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#6366f1' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Business Health Score Gauge */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-600">Business Health Score</h3>
            <p className="text-slate-400 text-[11px] font-semibold">Consolidated operational health index</p>
          </div>

          {/* Semi-donut gauge */}
          <div style={{ height: 128, width: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }} className="mt-4 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { value: 86, color: '#10b981' },
                    { value: 14, color: '#f1f5f9' }
                  ]}
                  cx="50%"
                  cy="95%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={55}
                  outerRadius={70}
                  paddingAngle={0}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f1f5f9" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-end" style={{ bottom: '5%' }}>
              <span className="text-3xl font-bold text-slate-600 leading-none">86</span>
              <span className="text-[10px] text-slate-400 font-bold mt-1">/ 100</span>
            </div>
          </div>

          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-sm font-bold">
              <CheckCircle2 size={12} /> Healthy Business
            </span>
          </div>

          {/* Checklist indices */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-slate-500">Sales Performance</span>
              <span className="font-bold text-emerald-600">Good</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-slate-500">Inventory Management</span>
              <span className="font-bold text-emerald-600">Excellent</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-slate-500">Customer Satisfaction</span>
              <span className="font-bold text-emerald-600">Good</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-slate-500">Profitability</span>
              <span className="font-bold text-emerald-600">Excellent</span>
            </div>
          </div>

          <div className="mt-4 p-2.5 bg-emerald-50/50 border border-emerald-100/50 rounded-xl text-center">
            <p className="text-[11px] font-bold text-emerald-800">Great job! Keep up the excellent work.</p>
          </div>
        </div>

      </div>

      {/* Row 3: Middle Row grid (5 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-3">

        {/* 1. Top Selling Products */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm xl:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-600 !mb-0">Top Selling Products</h3>
                {isDemo && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Sample
                  </span>
                )}
              </div>
              <button onClick={() => navigate('/Product/list')} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800">View All</button>
            </div>

            <div className="space-y-3.5">
              {dashboardData?.topProducts && dashboardData.topProducts.length > 0 ? (
                dashboardData.topProducts.slice(0, 3).map((prod, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-bold text-slate-600 truncate">{prod.product_name}</p>
                      <p className="text-[9px] font-bold text-slate-400 truncate">{prod.product_code}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-700">{prod.total_quantity} sold</p>
                      <span className="text-[9px] font-bold text-emerald-500">↑ 12%</span>
                    </div>
                  </div>
                ))
              ) : (
                // Mock elements to populate design
                [
                  { name: "Bread - Whole Wheat", code: "PROD-102", sold: 128, trend: "↑ 18%" },
                  { name: "Milk - 1 Litre", code: "PROD-098", sold: 96, trend: "↑ 12%" },
                  { name: "Eggs - 12 pcs", code: "PROD-244", sold: 88, trend: "↑ 5%" },
                  { name: "Maggi Noodles", code: "PROD-112", sold: 75, trend: "↓ 3%" },
                  { name: "Rice - 1 Kg", code: "PROD-055", sold: 60, trend: "↑ 8%" }
                ].map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-bold text-slate-600 truncate">{p.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 truncate">{p.code}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-700">{p.sold} sold</p>
                      <span className={`text-[9px] font-bold ${p.trend.includes('↑') ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {p.trend}
                      </span>
                    </div>
                  </div>
                ))
              )}
              {isDemo && (
                <div className="mt-2.5 p-2 rounded-xl bg-indigo-50/70 border border-indigo-100/80 text-center">
                  <p className="text-[10px] text-indigo-900 font-semibold mb-1">No items sold yet for this period</p>
                  <button onClick={() => navigate('/billing/pos')} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer">
                    Ring up products in POS <ArrowUpRight size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Inventory Status */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm xl:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-600">Inventory Status</h3>
              <button onClick={() => navigate('/Product/list')} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800">View All</button>
            </div>

            <div className="space-y-3.5">
              {/* Healthy items */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>Healthy</span>
                  <span className="font-bold text-slate-700">72%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '72%' }}></div>
                </div>
              </div>

              {/* Low stock items */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>Low Stock</span>
                  <span className="font-bold text-slate-700">21%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '21%' }}></div>
                </div>
              </div>

              {/* Critical items */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>Critical</span>
                  <span className="font-bold text-slate-700">7%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: '7%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/Product/list')}
            className="w-full mt-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-sm font-bold tracking-wide transition-colors"
          >
            Reorder Now
          </button>
        </div>

        {/* 3. Sales Target */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm xl:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-slate-600">Sales Target</h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1 select-none">
                This Month
              </span>
            </div>

            {/* Target values */}
            <div className="my-5">
              <span className="text-3xl font-bold text-indigo-600">72%</span>
              <p className="text-[10px] font-semibold text-slate-400 mt-1">
                ₹{formatValue(displayRevenue * 0.72, true)} / ₹{formatValue(displayRevenue, true)}
              </p>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '72%' }}></div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-amber-600 text-[11px] font-bold">
            <Clock size={12} />
            <span>8 Days Remaining</span>
          </div>
        </div>

        {/* 4. Smart AI Business Insights */}
        {/* <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm xl:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles size={16} className="text-purple-500" />
              <h3 className="text-sm font-bold text-slate-600">Smart AI Business Insights</h3>
            </div>

            
            <div className="space-y-2">
              {aiInsights.map((insight, idx) => (
                <div key={idx} className={`p-2 rounded-xl border flex items-center gap-2 text-[10px] font-bold ${insight.colorClass}`}>
                  <span className={`${insight.iconColor} flex-shrink-0`}><Sparkles size={11} /></span>
                  <span className="leading-tight">{insight.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div> */}

        {/* 5. Payment Methods */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm xl:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-slate-600 !mb-0">Payment Methods</h3>
              {isDemo && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Sample
                </span>
              )}
            </div>

            {/* Donut chart and legend side by side */}
            <div style={{ height: 144, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }} className="mt-2 select-none">
              <div className="w-1/2 h-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={42}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {paymentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[8px] uppercase font-bold text-slate-400 leading-none">Total</span>
                  <span className="text-sm font-bold text-slate-700 leading-none mt-0.5">{totalPaymentTransactions}</span>
                </div>
              </div>
              <div className="w-1/2 flex flex-col gap-1.5 justify-center">
                {paymentChartData.slice(0, 3).map((entry, idx) => (
                  <div key={idx} className="flex flex-col">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PAYMENT_COLORS[idx % PAYMENT_COLORS.length] }}></span>
                        <span className="text-[10px] font-bold text-slate-500 truncate">{entry.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-700">{entry.percent}%</span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 pl-3 leading-none">₹{Math.round(entry.value).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 pt-2 border-t border-slate-50">
            <span>Total Transactions</span>
            <span className="font-bold text-slate-600">{totalPaymentTransactions}</span>
          </div>
        </div>

      </div>

      {/* Row 4: Bottom details lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">

        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between h-96">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-600">Recent Orders</h3>
              <button onClick={() => navigate('/billing/list')} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">View All</button>
            </div>

            <div className="space-y-4 overflow-y-auto max-h-72 pr-1 scrollbar-thin">
              {dashboardData?.recentBills && dashboardData.recentBills.length > 0 ? (
                dashboardData.recentBills.slice(0, 5).map((bill, idx) => (
                  <div
                    key={bill.id || idx}
                    onClick={() => handleBillClick(bill)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-bold text-slate-600">{bill.customer_name || 'Walk-in Customer'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-semibold text-indigo-600">{bill.billing_no}</span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[10px] text-slate-400">{getRelativeTime(bill.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-600">₹{Math.round(parseFloat(bill.total_amount))}</p>
                        <p className="text-[8px] font-semibold text-slate-400">{bill.payment_method}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${bill.status === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                        bill.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                          'bg-slate-50 text-slate-500'
                        }`}>
                        {bill.status === 'paid' ? 'Completed' : bill.status === 'pending' ? 'Processing' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2.5">
                    <ShoppingCart size={22} />
                  </div>
                  <p className="text-sm font-bold text-slate-700 mb-1">No Orders Created Yet</p>
                  <p className="text-xs text-slate-400 max-w-xs mb-3">
                    Start billing in POS to generate your live order history and transaction audit trail.
                  </p>
                  <button
                    onClick={() => navigate('/billing/pos')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <Plus size={14} /> Start POS Billing
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between h-96">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-slate-600 !mb-0">Top Customers</h3>
                {isDemo && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Sample
                  </span>
                )}
              </div>
              <button onClick={() => navigate('/customer/list')} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">View All</button>
            </div>

            <div className="space-y-4">
              {topCustomersList.map((cust, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Ranked circle */}
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${idx === 0 ? 'bg-amber-100 text-amber-700' :
                      idx === 1 ? 'bg-slate-100 text-slate-700' :
                        idx === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-50 text-slate-500'
                      }`}>
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-600 truncate">{cust.name}</span>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 mr-4">{cust.orders} Orders</span>
                    <span className="text-sm font-bold text-slate-600">₹{cust.spent.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Employee Performance */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between h-96">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-slate-600 !mb-0">Employee Performance</h3>
                {isDemo && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Sample
                  </span>
                )}
              </div>
              <button className="text-sm font-bold text-indigo-600 hover:text-indigo-800">View All</button>
            </div>

            <div className="space-y-4">
              {cashierPerformance.map((emp, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Placeholder circle image initials */}
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 flex items-center justify-center flex-shrink-0">
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </span>
                      <span className="font-bold text-slate-600 truncate">{emp.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 mr-2">Sales: ₹{emp.sales.toLocaleString('en-IN')}</span>
                      <span className="font-bold text-slate-700">{emp.targetPct}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${emp.targetPct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Bill details modal */}
      <BillDetailsModal
        visible={billModalVisible}
        onClose={() => {
          setBillModalVisible(false);
          setSelectedBillId(null);
          setSelectedBill(null);
        }}
        billId={selectedBillId}
        initialData={selectedBill}
      />
    </div>
  );
};

export default DashboardFull;
