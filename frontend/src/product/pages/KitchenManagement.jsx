import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChefHat, CookingPot, Plus, Edit2, Trash2, Printer, Clock,
  Layers, Package, Check, AlertCircle, RefreshCw, Sparkles,
  ExternalLink, Search, Flame, ArrowRight, X, ShieldCheck, Tag
} from "lucide-react";
import {
  Modal, Form, Input, InputNumber, Switch, Button, message,
  Select, Tag as AntTag, Popconfirm, Drawer, Empty, Spin, Tooltip
} from "antd";
import { useNavigate } from "react-router-dom";
import productService from "../services/productService.js";
import categoryService from "../services/categoryService.js";
import { useBranch } from "../../context/BranchContext.jsx";

const { Option } = Select;

// Modern preset palette for kitchen station color tags
const COLOR_PRESETS = [
  { label: "Indigo", value: "#4F46E5", bg: "bg-indigo-500" },
  { label: "Emerald", value: "#10B981", bg: "bg-emerald-500" },
  { label: "Amber", value: "#F59E0B", bg: "bg-amber-500" },
  { label: "Rose", value: "#F43F5E", bg: "bg-rose-500" },
  { label: "Purple", value: "#8B5CF6", bg: "bg-purple-500" },
  { label: "Cyan", value: "#06B6D4", bg: "bg-cyan-500" },
  { label: "Blue", value: "#3B82F6", bg: "bg-blue-500" },
  { label: "Orange", value: "#F97316", bg: "bg-orange-500" },
];

export default function KitchenManagement() {
  const navigate = useNavigate();
  const { selectedBranch } = useBranch();
  const effectiveBranchId = selectedBranch?.id || selectedBranch?.branchId || null;

  // State
  const [kitchens, setKitchens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total_stations: 0,
    active_kots: 0,
    completed_today: 0,
    delayed_kots: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Station Modal state (Create / Edit)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingKitchen, setEditingKitchen] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [selectedColor, setSelectedColor] = useState("#4F46E5");

  // Routing Drawer state (Bulk Category / Item mapping)
  const [routingDrawerVisible, setRoutingDrawerVisible] = useState(false);
  const [targetKitchen, setTargetKitchen] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [kitchenDetail, setKitchenDetail] = useState(null);

  // 1. Fetch Kitchen Stations and Stats
  const fetchKitchens = useCallback(async () => {
    setLoading(true);
    try {
      const params = effectiveBranchId ? { branch_id: effectiveBranchId } : {};
      const [kitchensRes, statsRes] = await Promise.all([
        productService.getKitchens(params),
        productService.getKitchenStats(params).catch(() => ({ data: { data: {} } })),
      ]);

      const kList = kitchensRes?.data?.data || kitchensRes?.data || [];
      setKitchens(Array.isArray(kList) ? kList : []);

      const sData = statsRes?.data?.data || statsRes?.data || {};
      setStats({
        total_stations: sData.total_stations || (Array.isArray(kList) ? kList.length : 0),
        active_kots: sData.active_kots || 0,
        completed_today: sData.completed_today || 0,
        delayed_kots: sData.delayed_kots || 0,
      });
    } catch (err) {
      console.error("Failed to load kitchens:", err);
      message.error("Failed to load kitchen stations");
    } finally {
      setLoading(false);
    }
  }, [effectiveBranchId]);

  // 2. Fetch Categories and Products for routing drawer
  const fetchCategoriesAndProducts = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        categoryService.getAll({ limit: 200 }),
        productService.getAll({ limit: 1000 }),
      ]);
      setCategories(catRes?.data?.data || catRes?.data || []);
      setProducts(prodRes?.data?.data || prodRes?.data || []);
    } catch (err) {
      console.warn("Could not load categories/products for routing drawer:", err);
    }
  }, []);

  useEffect(() => {
    fetchKitchens();
    fetchCategoriesAndProducts();
  }, [fetchKitchens, fetchCategoriesAndProducts]);

  // Filtered Kitchens
  const filteredKitchens = useMemo(() => {
    if (!searchQuery.trim()) return kitchens;
    const q = searchQuery.toLowerCase();
    return kitchens.filter(
      (k) =>
        (k.kitchen_name && k.kitchen_name.toLowerCase().includes(q)) ||
        (k.code && k.code.toLowerCase().includes(q))
    );
  }, [kitchens, searchQuery]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingKitchen(null);
    setSelectedColor("#4F46E5");
    form.resetFields();
    form.setFieldsValue({
      color_tag: "#4F46E5",
      default_prep_time: 15,
      printer_port: 9100,
      auto_print: false,
      is_default: kitchens.length === 0,
    });
    setModalVisible(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (kitchen) => {
    setEditingKitchen(kitchen);
    setSelectedColor(kitchen.color_tag || "#4F46E5");
    form.setFieldsValue({
      kitchen_name: kitchen.kitchen_name,
      code: kitchen.code,
      description: kitchen.description,
      color_tag: kitchen.color_tag || "#4F46E5",
      default_prep_time: kitchen.default_prep_time || 15,
      printer_ip: kitchen.printer_ip,
      printer_port: kitchen.printer_port || 9100,
      auto_print: kitchen.auto_print || false,
      is_default: kitchen.is_default || false,
    });
    setModalVisible(true);
  };

  // Submit Create / Edit
  const handleFormSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        color_tag: selectedColor,
        branch_id: effectiveBranchId,
      };

      if (editingKitchen) {
        await productService.updateKitchen(editingKitchen.id, payload);
        message.success(`Kitchen station "${values.kitchen_name}" updated!`);
      } else {
        await productService.createKitchen(payload);
        message.success(`New kitchen station "${values.kitchen_name}" created!`);
      }

      setModalVisible(false);
      fetchKitchens();
    } catch (err) {
      console.error("Save kitchen error:", err);
      const errMsg = err.response?.data?.message || err.message || "Failed to save kitchen";
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Deactivate Station
  const handleDeleteKitchen = async (id, name) => {
    try {
      await productService.deleteKitchen(id);
      message.success(`Kitchen station "${name}" removed. Assigned items reassigned to default.`);
      fetchKitchens();
    } catch (err) {
      console.error("Delete kitchen error:", err);
      message.error(err.response?.data?.message || "Failed to delete kitchen");
    }
  };

  // Open Routing Drawer
  const handleOpenRoutingDrawer = async (kitchen) => {
    setTargetKitchen(kitchen);
    setSelectedCategoryIds([]);
    setSelectedProductIds([]);
    setRoutingDrawerVisible(true);

    try {
      const res = await productService.getKitchenById(kitchen.id);
      setKitchenDetail(res?.data?.data || res?.data || null);
    } catch (err) {
      console.warn("Failed to fetch kitchen details:", err);
    }
  };

  // Submit Routing Assignment
  const handleAssignItems = async () => {
    if (!targetKitchen) return;
    if (selectedCategoryIds.length === 0 && selectedProductIds.length === 0) {
      message.warning("Please select at least one category or product to route.");
      return;
    }

    setAssigning(true);
    try {
      const res = await productService.assignKitchenItems(targetKitchen.id, {
        category_ids: selectedCategoryIds,
        product_ids: selectedProductIds,
      });

      const count = res?.data?.data?.affected_products || "Selected";
      message.success(`Successfully routed items to ${targetKitchen.kitchen_name}!`);

      setSelectedCategoryIds([]);
      setSelectedProductIds([]);
      fetchKitchens();

      // Refresh drawer details
      const detailRes = await productService.getKitchenById(targetKitchen.id);
      setKitchenDetail(detailRes?.data?.data || detailRes?.data || null);
    } catch (err) {
      console.error("Item routing error:", err);
      message.error(err.response?.data?.message || "Failed to route items to kitchen");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50/70 min-h-screen space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <ChefHat size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight !mb-0">
                Kitchen Stations
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                KOT Routing
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium !mb-0 mt-0.5">
              Configure preparation stations, ticket printers, and automated category-to-kitchen routing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchKitchens}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh Stations"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => navigate("/billing/kitchen")}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ExternalLink size={14} className="text-slate-500" />
            <span>Open KDS Screen</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Kitchen Station</span>
          </button>
        </div>
      </div>

      {/* 2. Top Operational Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">Active Stations</span>
            <span className="text-2xl font-black text-slate-800 tracking-tight">
              {stats.total_stations}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CookingPot size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">Live KOTs in Queue</span>
            <span className="text-2xl font-black text-indigo-600 tracking-tight">
              {stats.active_kots}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Flame size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">Orders Prepared Today</span>
            <span className="text-2xl font-black text-slate-700 tracking-tight">
              {stats.completed_today}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Check size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-1">Delayed KOT Alerts</span>
            <span className={`text-2xl font-black tracking-tight ${stats.delayed_kots > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
              {stats.delayed_kots}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.delayed_kots > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* 3. Search and Station Cards Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-sm w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search station by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <div className="text-xs font-bold text-slate-500">
            Showing {filteredKitchens.length} of {kitchens.length} station(s)
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center items-center bg-white rounded-2xl border border-slate-100">
            <Spin size="large" tip="Loading kitchen stations..." />
          </div>
        ) : filteredKitchens.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <ChefHat size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-700 !mb-1">No Kitchen Stations Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              Create your preparation stations (e.g., Main Kitchen, Bar, Bakery, Grill) to route KOT tickets correctly.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus size={15} /> Create First Station
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredKitchens.map((kitchen) => (
              <div
                key={kitchen.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Station Color Stripe & Header */}
                <div>
                  <div
                    className="h-2 w-full"
                    style={{ backgroundColor: kitchen.color_tag || "#4F46E5" }}
                  />
                  <div className="p-4 sm:p-5 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-800 truncate !mb-0">
                            {kitchen.kitchen_name}
                          </h3>
                          {kitchen.code && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                              {kitchen.code}
                            </span>
                          )}
                        </div>
                        {kitchen.description && (
                          <p className="text-[11px] text-slate-400 font-medium line-clamp-1 mt-0.5 !mb-0">
                            {kitchen.description}
                          </p>
                        )}
                      </div>

                      {kitchen.is_default && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          Default Station
                        </span>
                      )}
                    </div>

                    {/* Operational Details Grid */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                          <Package size={12} className="text-slate-400" /> Assigned Items
                        </span>
                        <span className="text-sm font-black text-slate-700">
                          {kitchen.products_count || 0} product(s)
                        </span>
                      </div>

                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                          <Clock size={12} className="text-slate-400" /> Target Prep Time
                        </span>
                        <span className="text-sm font-black text-slate-700">
                          {kitchen.default_prep_time || 15} mins
                        </span>
                      </div>
                    </div>

                    {/* Printer Status */}
                    <div className="mt-2.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <Printer size={14} className={kitchen.printer_ip ? "text-indigo-600" : "text-slate-300"} />
                        <span className="truncate">
                          {kitchen.printer_ip ? `${kitchen.printer_ip}:${kitchen.printer_port || 9100}` : "No Network Printer"}
                        </span>
                      </div>
                      {kitchen.auto_print && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                          Auto-Print
                        </span>
                      )}
                    </div>

                    {/* Live Queue Pill */}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-slate-600 px-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${(kitchen.active_kots || 0) > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                        Queue: {kitchen.active_kots || 0} active KOT(s)
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {kitchen.pending_kots || 0} pending • {kitchen.ready_kots || 0} ready
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenRoutingDrawer(kitchen)}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Layers size={13} />
                    <span>Route Items</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(kitchen)}
                      className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-slate-800 transition cursor-pointer"
                      title="Edit Station"
                    >
                      <Edit2 size={14} />
                    </button>

                    <Popconfirm
                      title="Delete Kitchen Station"
                      description={`Are you sure you want to delete "${kitchen.kitchen_name}"? Assigned products will be routed to the default station.`}
                      onConfirm={() => handleDeleteKitchen(kitchen.id, kitchen.kitchen_name)}
                      okText="Delete"
                      cancelText="Cancel"
                      okButtonProps={{ danger: true }}
                    >
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Delete Station"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Popconfirm>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. MODAL: Create / Edit Kitchen Station */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ChefHat size={18} />
            </div>
            <div>
              <span className="font-black text-base text-slate-800 block leading-tight">
                {editingKitchen ? "Edit Kitchen Station" : "Create Kitchen Station"}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Configure ticket routing, target SLA, and hardware printing.
              </span>
            </div>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
        centered
        width={540}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          className="pt-4 space-y-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <Form.Item
              name="kitchen_name"
              label={<span className="font-bold text-xs text-slate-700">Station Name</span>}
              rules={[{ required: true, message: "Please enter station name" }]}
              className="col-span-2 !mb-0"
            >
              <Input placeholder="e.g. Bar & Beverages, Main Kitchen, Grill" className="rounded-xl py-2" />
            </Form.Item>

            <Form.Item
              name="code"
              label={<span className="font-bold text-xs text-slate-700">Code</span>}
              className="col-span-1 !mb-0"
            >
              <Input placeholder="e.g. BAR, MAIN" className="rounded-xl py-2 uppercase" />
            </Form.Item>
          </div>

          <Form.Item
            name="description"
            label={<span className="font-bold text-xs text-slate-700">Description (Optional)</span>}
            className="!mb-0"
          >
            <Input.TextArea placeholder="Items handled by this station..." rows={2} className="rounded-xl" />
          </Form.Item>

          {/* Color Tag Selector */}
          <div>
            <label className="font-bold text-xs text-slate-700 block mb-1.5">
              Station Badge Color Tag
            </label>
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSelectedColor(preset.value)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer ${preset.bg} ${selectedColor === preset.value ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-sm' : 'hover:scale-105'}`}
                  title={preset.label}
                >
                  {selectedColor === preset.value && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="default_prep_time"
              label={<span className="font-bold text-xs text-slate-700">Target Prep Time (Minutes)</span>}
              className="!mb-0"
            >
              <InputNumber min={2} max={120} className="w-full rounded-xl py-1" />
            </Form.Item>

            <Form.Item
              name="is_default"
              valuePropName="checked"
              label={<span className="font-bold text-xs text-slate-700">Default Station</span>}
              className="!mb-0"
            >
              <div className="flex items-center gap-2 pt-1">
                <Switch />
                <span className="text-[11px] text-slate-500 font-medium">
                  Catch-all for unassigned items
                </span>
              </div>
            </Form.Item>
          </div>

          {/* Network Thermal Printer Configuration */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                <Printer size={14} className="text-indigo-600" /> ESC/POS Thermal Network Printer
              </span>
              <Form.Item name="auto_print" valuePropName="checked" noStyle>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-medium">Auto-Print</span>
                  <Switch size="small" />
                </div>
              </Form.Item>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <Form.Item
                name="printer_ip"
                label={<span className="text-[11px] font-bold text-slate-500">Printer IP Address</span>}
                className="col-span-2 !mb-0"
              >
                <Input placeholder="e.g. 192.168.1.200" className="rounded-xl py-1.5 text-xs font-mono" />
              </Form.Item>

              <Form.Item
                name="printer_port"
                label={<span className="text-[11px] font-bold text-slate-500">Port</span>}
                className="col-span-1 !mb-0"
              >
                <InputNumber placeholder="9100" className="w-full rounded-xl py-1 text-xs font-mono" />
              </Form.Item>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalVisible(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Saving..." : editingKitchen ? "Update Station" : "Create Station"}
            </button>
          </div>
        </Form>
      </Modal>

      {/* 5. DRAWER: Bulk Category & Product Routing Matrix */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-indigo-600" />
            <div>
              <span className="font-black text-base text-slate-800 block leading-tight">
                Route Items to {targetKitchen?.kitchen_name}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Map entire food/beverage categories or pick individual dishes.
              </span>
            </div>
          </div>
        }
        placement="right"
        width={520}
        onClose={() => setRoutingDrawerVisible(false)}
        open={routingDrawerVisible}
      >
        <div className="space-y-6">
          {/* Quick Route By Category */}
          <div className="space-y-2">
            <label className="font-bold text-xs text-slate-700 block">
              1. Route by Entire Category (Bulk)
            </label>
            <p className="text-[11px] text-slate-400 leading-tight">
              All active items in selected categories will automatically route to <b>{targetKitchen?.kitchen_name}</b>.
            </p>
            <Select
              mode="multiple"
              placeholder="Select Categories (e.g. Mocktails, Breads, Pizzas)"
              className="w-full"
              value={selectedCategoryIds}
              onChange={setSelectedCategoryIds}
              optionFilterProp="children"
            >
              {categories.map((cat) => (
                <Option key={cat.id} value={cat.id}>
                  {cat.category_name}
                </Option>
              ))}
            </Select>
          </div>

          {/* Quick Route By Individual Products */}
          <div className="space-y-2">
            <label className="font-bold text-xs text-slate-700 block">
              2. Route Specific Individual Products
            </label>
            <p className="text-[11px] text-slate-400 leading-tight">
              Select specific menu items to assign to this station.
            </p>
            <Select
              mode="multiple"
              placeholder="Select Products..."
              className="w-full"
              value={selectedProductIds}
              onChange={setSelectedProductIds}
              optionFilterProp="children"
              showSearch
            >
              {products.map((prod) => (
                <Option key={prod.id} value={prod.id}>
                  {prod.product_name} {prod.product_code ? `(${prod.product_code})` : ""}
                </Option>
              ))}
            </Select>
          </div>

          <button
            type="button"
            disabled={assigning || (selectedCategoryIds.length === 0 && selectedProductIds.length === 0)}
            onClick={handleAssignItems}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            <Check size={16} />
            <span>{assigning ? "Assigning..." : "Apply Routing Rules"}</span>
          </button>

          {/* Currently Assigned Items List */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-xs text-slate-700">
                Currently Assigned ({kitchenDetail?.products?.length || 0} items)
              </span>
              <span className="text-[10px] text-indigo-600 font-bold">
                Live in Database
              </span>
            </div>

            {kitchenDetail?.products && kitchenDetail.products.length > 0 ? (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {kitchenDetail.products.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-700 truncate !mb-0">{item.product_name}</p>
                      <p className="text-[10px] text-slate-400 truncate !mb-0">
                        {item.category?.category_name || "Uncategorized"} • {item.product_code || "No code"}
                      </p>
                    </div>
                    <span className="font-bold text-slate-600 shrink-0">
                      ₹{parseFloat(item.price || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                <Package size={24} className="mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-bold text-slate-600 !mb-0">No Products Assigned</p>
                <p className="text-[11px] text-slate-400 !mb-0">
                  Select categories or products above to route them here.
                </p>
              </div>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
