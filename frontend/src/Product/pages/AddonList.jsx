import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Table, Button, Space, Popconfirm, message, Input, InputNumber, Switch, Modal, Form, Tag, Tooltip } from "antd";
import { 
  Plus, Edit2, Trash2, Search, Layers, CheckCircle2, XCircle, 
  IndianRupee, Sparkles, Filter, RefreshCw 
} from "lucide-react";
import addonService from "../services/addonService.js";

const fmt = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v || 0);

export default function AddonList() {
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchAddons = useCallback(async () => {
    setLoading(true);
    try {
      const response = await addonService.getAll();
      const result = response.data?.data || response.data || [];
      setAddons(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error("Failed to load addons:", err);
      message.error("Failed to load add-ons list");
      setAddons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddons();
  }, [fetchAddons]);

  // Filtered addons
  const filteredAddons = useMemo(() => {
    return addons.filter((item) => {
      const matchesSearch = 
        !searchText || 
        (item.addon_name || "").toLowerCase().includes(searchText.toLowerCase());
      
      const matchesStatus = 
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active) ||
        (statusFilter === "inactive" && !item.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [addons, searchText, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = addons.length;
    const active = addons.filter(a => a.is_active).length;
    const inactive = total - active;
    const avgPrice = total > 0 
      ? addons.reduce((sum, a) => sum + parseFloat(a.price || 0), 0) / total 
      : 0;
    return { total, active, inactive, avgPrice };
  }, [addons]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingAddon(null);
    form.resetFields();
    form.setFieldsValue({
      addon_name: "",
      price: 0,
      is_active: true,
    });
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (record) => {
    setEditingAddon(record);
    form.resetFields();
    form.setFieldsValue({
      addon_name: record.addon_name,
      price: parseFloat(record.price || 0),
      is_active: record.is_active,
    });
    setModalOpen(true);
  };

  // Submit Modal (Create or Update)
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editingAddon) {
        await addonService.update(editingAddon.id, values);
        message.success("Add-on updated successfully");
      } else {
        await addonService.create(values);
        message.success("Add-on created successfully");
      }

      setModalOpen(false);
      fetchAddons();
    } catch (err) {
      if (err.errorFields) return;
      console.error("Save error:", err);
      message.error(err?.response?.data?.message || "Failed to save add-on");
    } finally {
      setSaving(false);
    }
  };

  // Toggle Status directly from table
  const handleToggleStatus = async (record, checked) => {
    try {
      await addonService.update(record.id, { is_active: checked });
      message.success(`Add-on marked as ${checked ? "active" : "inactive"}`);
      setAddons((prev) =>
        prev.map((a) => (a.id === record.id ? { ...a, is_active: checked } : a))
      );
    } catch (err) {
      console.error("Status toggle error:", err);
      message.error("Failed to update status");
    }
  };

  // Soft Delete
  const handleDelete = async (id) => {
    try {
      await addonService.delete(id);
      message.success("Add-on removed successfully");
      fetchAddons();
    } catch (err) {
      console.error("Delete error:", err);
      message.error("Failed to delete add-on");
    }
  };

  const columns = [
    {
      title: "Add-on Name",
      dataIndex: "addon_name",
      key: "addon_name",
      render: (text) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <span className="font-semibold text-slate-800 text-sm block">{text}</span>
            <span className="text-[11px] text-slate-400">Customization / Extra</span>
          </div>
        </div>
      ),
    },
    {
      title: "Price (₹)",
      dataIndex: "price",
      key: "price",
      sorter: (a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0),
      render: (price) => (
        <span className="font-bold text-slate-800 text-sm">
          {fmt(price)}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (isActive, record) => (
        <div className="flex items-center gap-2">
          <Switch
            size="small"
            checked={isActive}
            onChange={(checked) => handleToggleStatus(record, checked)}
            className={isActive ? "bg-emerald-500" : "bg-slate-300"}
          />
          <Tag color={isActive ? "success" : "default"} className="rounded-full text-xs font-medium px-2.5 py-0.5">
            {isActive ? "Active" : "Inactive"}
          </Tag>
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit Add-on">
            <Button
              type="text"
              size="small"
              icon={<Edit2 size={15} className="text-blue-600" />}
              onClick={() => handleOpenEdit(record)}
              className="hover:bg-blue-50"
            />
          </Tooltip>
          <Popconfirm
            title="Deactivate Add-on"
            description="Are you sure you want to delete/deactivate this add-on?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete Add-on">
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 size={15} />}
                className="hover:bg-red-50"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-3 sm:p-4 lg:p-6 pb-28 md:pb-6 relative bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Add-on Management</h1>
              <p className="text-xs text-slate-500">Configure item customizations, extras, and additional pricing</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            icon={<RefreshCw size={15} className={loading ? "animate-spin" : ""} />}
            onClick={fetchAddons}
            className="rounded-xl flex items-center gap-1.5 h-10 border-slate-200 text-slate-600 hover:text-slate-800"
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleOpenCreate}
            className="rounded-xl flex items-center gap-1.5 h-10 bg-indigo-600 hover:bg-indigo-700 shadow-md font-semibold px-4"
          >
            Add New Add-on
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Add-ons</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{metrics.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Active Add-ons</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">{metrics.active}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Inactive</span>
            <span className="text-2xl font-black text-slate-400 mt-1 block">{metrics.inactive}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <XCircle size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Average Price</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{fmt(metrics.avgPrice)}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <IndianRupee size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search add-on name..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              {searchText && (
                <button
                  onClick={() => setSearchText("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full md:w-auto justify-center">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All ({metrics.total})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Active ({metrics.active})
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === "inactive"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Inactive ({metrics.inactive})
            </button>
          </div>
        </div>

        {/* Mobile View: High-density Cards */}
        <div className="block md:hidden p-3 space-y-3">
          {filteredAddons.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Layers size={32} className="mx-auto mb-2 opacity-50 text-indigo-400" />
              <p className="text-sm font-bold text-slate-600">No add-ons found</p>
            </div>
          ) : (
            filteredAddons.map((item) => (
              <div 
                key={item.id} 
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 !mb-0">{item.addon_name}</h4>
                      <span className="text-[11px] text-slate-400">Customization / Extra</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition active:scale-95 cursor-pointer"
                      aria-label="Edit add-on"
                    >
                      <Edit2 size={15} />
                    </button>
                    <Popconfirm
                      title="Deactivate Add-on"
                      description="Delete or deactivate this add-on?"
                      onConfirm={() => handleDelete(item.id)}
                      okText="Yes"
                      cancelText="No"
                      okButtonProps={{ danger: true }}
                    >
                      <button
                        className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 flex items-center justify-center transition active:scale-95 cursor-pointer"
                        aria-label="Delete add-on"
                      >
                        <Trash2 size={15} />
                      </button>
                    </Popconfirm>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Price</span>
                    <span className="text-sm font-black text-slate-800">{fmt(item.price)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      size="small"
                      checked={item.is_active}
                      onChange={(checked) => handleToggleStatus(item, checked)}
                      className={item.is_active ? "bg-emerald-500" : "bg-slate-300"}
                    />
                    <Tag color={item.is_active ? "success" : "default"} className="rounded-full text-xs font-semibold px-2 py-0.5 !mr-0">
                      {item.is_active ? "Active" : "Inactive"}
                    </Tag>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table
            columns={columns}
            dataSource={filteredAddons}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 12, showSizeChanger: true }}
            className="pos-addon-table"
          />
        </div>
      </div>

      {/* Mobile Floating Action Button (FAB) */}
      <button
        onClick={handleOpenCreate}
        aria-label="Add New Add-on"
        className="fixed bottom-24 right-5 md:hidden z-30 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition shadow-indigo-600/30"
      >
        <Plus size={24} />
      </button>

      {/* Create / Edit Add-on Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {editingAddon ? "Edit Add-on" : "Create New Add-on"}
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                {editingAddon ? "Update name, pricing, or status" : "Define an item customization with extra pricing"}
              </p>
            </div>
          </div>
        }
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editingAddon ? "Update Add-on" : "Create Add-on"}
        okButtonProps={{ className: "bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold h-9" }}
        cancelButtonProps={{ className: "rounded-xl h-9" }}
        centered
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="addon_name"
            label={<span className="font-semibold text-slate-700 text-xs">Add-on Name</span>}
            rules={[{ required: true, message: "Please enter add-on name" }]}
          >
            <Input
              placeholder="e.g. Extra Cheese, Oat Milk, Vanilla Syrup"
              className="rounded-xl py-2"
              maxLength={100}
            />
          </Form.Item>

          <Form.Item
            name="price"
            label={<span className="font-semibold text-slate-700 text-xs">Price (₹)</span>}
            rules={[{ required: true, message: "Please specify add-on price" }]}
          >
            <InputNumber
              min={0}
              step={5}
              placeholder="0.00"
              prefix="₹"
              className="w-full rounded-xl py-1 text-sm font-bold"
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label={<span className="font-semibold text-slate-700 text-xs">Status</span>}
            valuePropName="checked"
          >
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Available in POS & Menu</span>
                <span className="text-[11px] text-slate-500">Allow cashiers to add this add-on to orders</span>
              </div>
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
