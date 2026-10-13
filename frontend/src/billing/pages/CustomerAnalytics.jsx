import React, { useState, useEffect } from "react";
import { Table, DatePicker, message, Dropdown, Menu } from "antd";
import {
  Users, UserPlus, UserCheck, IndianRupee, Store, Calendar,
  BarChart3, Download, Award
} from "lucide-react";
import dayjs from "dayjs";
import { ReportSkeleton } from "../../components/SkeletonLoader.jsx";
import reportService from "../service/reportService";
import { useBranch } from "../../context/BranchContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { RangePicker } = DatePicker;

function CustomerAnalytics() {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("today");
  const [dateRange, setDateRange] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const { selectedBranch } = useBranch();

  useEffect(() => {
    fetchReport(period, dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  useEffect(() => {
    if (period === "custom" && dateRange) {
      fetchReport("custom", dateRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const fetchReport = async (p = period, dr = dateRange) => {
    setLoading(true);
    try {
      const params = { period: p };

      if (p === "custom" && dr) {
        params.startDate = dr[0].toISOString();
        params.endDate = dr[1].toISOString();
      }

      const response = await reportService.getCustomerAnalytics(params);
      setReportData(response.data);
      message.success("Customer analytics generated");
    } catch (error) {
      console.error("Error fetching report:", error);
      message.error(error.response?.data?.message || "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (value) => {
    setPeriod(value);
    if (value !== "custom") {
      setDateRange(null);
      fetchReport(value, null);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "today": return "Today";
      case "yesterday": return "Yesterday";
      case "this_month": return "This Month";
      case "this_year": return "This Year";
      case "custom": return "Custom Range";
      default: return "";
    }
  };

  const exportToPDF = () => {
    if (!reportData) return;
    try {
      setExporting(true);
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Customer Analytics Report - ${getPeriodLabel()}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${dayjs().format('DD MMM YYYY HH:mm')}`, 14, 22);

      const tableData = reportData.top_spenders.map((c, i) => [
        i + 1,
        c.customer_name,
        c.customer_phone,
        c.bills_count,
        `Rs. ${c.total_spent}`
      ]);

      autoTable(doc, {
        startY: 30,
        head: [['#', 'Customer Name', 'Phone', 'Visits/Bills', 'Total Spent']],
        body: tableData,
      });

      doc.save(`Customer_Analytics_${dayjs().format('YYYYMMDD')}.pdf`);
      message.success("Report exported to PDF");
    } catch (err) {
      console.error("Export error", err);
      message.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  const exportMenu = (
    <Menu>
      <Menu.Item key="pdf" onClick={exportToPDF}>
        Export to PDF
      </Menu.Item>
    </Menu>
  );

  const topSpendersColumns = [
    {
      title: "Rank",
      key: "rank",
      width: 80,
      render: (text, record, index) => (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
          {index + 1}
        </div>
      )
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
      render: (name) => <span className="font-semibold text-slate-800">{name}</span>
    },
    {
      title: "Phone",
      dataIndex: "customer_phone",
      key: "customer_phone",
      render: (phone) => <span className="text-slate-500">{phone || 'N/A'}</span>
    },
    {
      title: "Visits / Bills",
      dataIndex: "bills_count",
      key: "bills_count",
      align: "center",
      render: (val) => <span className="font-medium bg-slate-100 px-3 py-1 rounded-full text-slate-700">{val}</span>
    },
    {
      title: "Total Spent",
      dataIndex: "total_spent",
      key: "total_spent",
      align: "right",
      render: (val) => <span className="font-bold text-indigo-600">₹{parseFloat(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-[#F8FAFC] min-h-screen font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header & Export */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Users className="text-indigo-600" size={24} />
              Customer Analytics
            </h1>
            <p className="text-slate-500 text-sm m-0">
              Insights into customer retention, new acquisitions, and top spenders
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedBranch && (
              <div className="hidden sm:flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 text-sm font-medium">
                <Store size={16} />
                {selectedBranch.name === "All Branches" ? "All Branches" : selectedBranch.name}
              </div>
            )}
            {reportData && (
              <Dropdown overlay={exportMenu} placement="bottomRight" disabled={exporting}>
                <button
                  disabled={exporting}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 !text-white px-4 py-2 rounded-xl font-medium transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-70 cursor-pointer"
                >
                  <Download size={18} />
                  <span>{exporting ? "Exporting..." : "Export"}</span>
                </button>
              </Dropdown>
            )}
          </div>
        </div>

        {/* Filters Strip */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-2 border-r border-slate-200">
            <Calendar size={18} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-600 mr-2">Period</span>
          </div>
          <div className="flex bg-slate-100/80 p-1 rounded-xl flex-wrap">
            {[
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
              { value: "this_month", label: "This Month" },
              { value: "this_year", label: "This Year" },
              { value: "custom", label: "Custom" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => handlePeriodChange(opt.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${period === opt.value ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="ml-auto w-full md:w-auto mt-2 md:mt-0">
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                className="h-[36px] rounded-xl w-full md:w-[260px]"
                format="DD MMM YYYY"
              />
            </div>
          )}
        </div>

        {loading ? (
          <ReportSkeleton />
        ) : reportData ? (
          <div className="space-y-6">

            {/* Premium Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">

              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4 hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                  <Users size={22} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Active Customers</p>
                  <h3 className="text-2xl font-black text-slate-800 m-0">{reportData.summary.active_customers}</h3>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4 hover:border-emerald-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                  <UserPlus size={22} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Customers</p>
                  <h3 className="text-2xl font-black text-slate-800 m-0">{reportData.summary.new_customers}</h3>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4 hover:border-amber-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                  <UserCheck size={22} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Returning</p>
                  <h3 className="text-2xl font-black text-slate-800 m-0">{reportData.summary.returning_customers}</h3>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                  <IndianRupee size={22} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Spend</p>
                  <h3 className="text-2xl font-black text-slate-800 m-0">₹{parseFloat(reportData.summary.avg_spend_per_customer || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                </div>
              </div>

            </div>

            {/* Tables Layout */}
            <div className="space-y-6">

              {/* Top Spenders */}
              {reportData.top_spenders && reportData.top_spenders.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                    <Award size={18} className="text-slate-500" />
                    <h3 className="font-bold text-slate-700 m-0 text-base">Top 10 Spenders</h3>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <Table
                      dataSource={reportData.top_spenders}
                      columns={topSpendersColumns}
                      pagination={false}
                      rowKey={(record, i) => `${record.customer_name}-${i}`}
                      size="middle"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="text-slate-300" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">No Data Selected</h3>
            <p className="text-slate-500 text-sm">Select a period to generate the customer analytics.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerAnalytics;
