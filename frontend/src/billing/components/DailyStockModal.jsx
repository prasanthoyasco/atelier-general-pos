import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Tabs,
  Table,
  Button,
  Input,
  InputNumber,
  Select,
  Tag,
  Alert,
  message,
  Space,
} from "antd";
import {
  SunOutlined,
  MoonOutlined,
  CheckCircleOutlined,
  SaveOutlined,
  WarningOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import dailyInventoryService from "../../stock/service/dailyInventoryService";
import { useBranch } from "../../context/BranchContext";

const { Option } = Select;

const WASTAGE_REASONS = [
  "Spoiled / Sour",
  "Expired",
  "Damaged / Crushed",
  "Spillage",
  "Kitchen Waste",
  "Staff Meal",
  "Theft / Missing",
  "Normal Loss / Trimming",
  "Other",
];

const DailyStockModal = ({ open, onCancel, onUpdated, branchId, branchName }) => {
  const { selectedBranch: contextBranch, branches } = useBranch();
  const [activeTab, setActiveTab] = useState("morning");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [morningInputs, setMorningInputs] = useState({});
  const [eveningInputs, setEveningInputs] = useState({});

  // Dynamic effective branch ID
  const effectiveBranchId = useMemo(() => {
    if (branchId && branchId !== "all") return branchId;
    if (contextBranch && contextBranch.id && contextBranch.id !== "all") return contextBranch.id;
    const saved = localStorage.getItem("selectedBranchId");
    if (saved && saved !== "all") return saved;
    if (branches && branches.length > 0) return branches[0].branch_id;
    return null;
  }, [branchId, contextBranch, branches]);

  // Dynamic effective branch display name
  const effectiveBranchName = useMemo(() => {
    if (branchName) return branchName;
    if (effectiveBranchId && branches && branches.length > 0) {
      const match = branches.find((b) => b.branch_id === effectiveBranchId);
      if (match) return match.branch?.branch_name || match.branch?.name || match.name;
    }
    return contextBranch?.branch_name || contextBranch?.name || "Branch";
  }, [branchName, effectiveBranchId, branches, contextBranch]);

  const fetchData = async () => {
    if (!effectiveBranchId || effectiveBranchId === "all") return;
    setLoading(true);
    try {
      const todayStr = dayjs().format("YYYY-MM-DD");
      const res = await dailyInventoryService.getSummary({
        branch_id: effectiveBranchId,
        date: todayStr,
      });

      const prods = res.products || [];
      const ings = res.ingredients || [];
      setProducts(prods);
      setIngredients(ings);

      const ev = {};
      [...prods, ...ings].forEach((i) => {
        ev[i.id] = {
          closing_stock: i.closing_stock !== null ? i.closing_stock : undefined,
          wastage_qty: i.wastage_qty || 0,
          wastage_reason: i.wastage_reason || undefined,
        };
      });
      setEveningInputs(ev);
    } catch (err) {
      console.error(err);
      message.error("Failed to load today's stock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && effectiveBranchId && effectiveBranchId !== "all") {
      fetchData();
      setMorningInputs({});
    }
  }, [open, effectiveBranchId]);

  const allItems = [...products, ...ingredients];
  const filtered = allItems.filter((i) =>
    search ? i.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const handleMorningSave = async () => {
    const entries = [];
    Object.keys(morningInputs).forEach((id) => {
      const val = Number(morningInputs[id]?.added_qty);
      if (val > 0) {
        const item = allItems.find((i) => i.id === id);
        if (item) {
          entries.push({
            item_id: id,
            item_type: item.item_type,
            added_qty: val,
          });
        }
      }
    });

    if (entries.length === 0) {
      message.warning("Please enter quantity added for at least one item");
      return;
    }

    setSaving(true);
    try {
      await dailyInventoryService.addMorningEntry({
        branch_id: effectiveBranchId,
        date: dayjs().format("YYYY-MM-DD"),
        entries,
      });
      message.success(`Recorded stock additions for ${entries.length} items!`);
      setMorningInputs({});
      fetchData();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error(err);
      message.error("Failed to save stock");
    } finally {
      setSaving(false);
    }
  };

  const handleEveningSave = async () => {
    const closings = [];
    Object.keys(eveningInputs).forEach((id) => {
      const input = eveningInputs[id];
      if (input?.closing_stock !== undefined && input?.closing_stock !== "") {
        const item = allItems.find((i) => i.id === id);
        if (item) {
          const closing = Number(input.closing_stock);
          const diff = closing - Number(item.expected_stock);
          closings.push({
            item_id: id,
            item_type: item.item_type,
            closing_stock: closing,
            wastage_qty: diff < 0 ? Math.abs(diff) : 0,
            wastage_reason: input.wastage_reason || (diff < 0 ? "Normal Loss / Trimming" : undefined),
          });
        }
      }
    });

    if (closings.length === 0) {
      message.warning("Please enter closing count for at least one item");
      return;
    }

    setSaving(true);
    try {
      await dailyInventoryService.recordEveningClosing({
        branch_id: effectiveBranchId,
        date: dayjs().format("YYYY-MM-DD"),
        closings,
      });
      message.success(`Reconciled evening stock for ${closings.length} items!`);
      fetchData();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error(err);
      message.error("Failed to record closing count");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-base font-bold text-gray-800">
          <span>📦 Fast Daily Stock Entry</span>
          <Tag color="blue" className="text-xs">
            {dayjs().format("DD MMM YYYY")}
          </Tag>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={780}
      footer={null}
      destroyOnHidden
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Input
          placeholder="Search items..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded-lg"
          size="small"
        />
        <span className="text-xs text-gray-500">
          Branch: <strong className="text-slate-800 font-semibold">{effectiveBranchName}</strong>
        </span>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "morning",
            label: (
              <span className="flex items-center gap-1 font-semibold">
                <SunOutlined className="text-amber-500" /> Morning / Add Stock
              </span>
            ),
            children: (
              <div>
                <Alert
                  message="Enter stock purchased or received today to increment available balance."
                  type="info"
                  showIcon
                  className="mb-3 py-1.5 px-3 text-xs"
                />
                <Table
                  dataSource={filtered}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 6 }}
                  size="small"
                  columns={[
                    {
                      title: "Item",
                      key: "name",
                      render: (_, r) => (
                        <div>
                          <span className="font-semibold text-gray-800">{r.name}</span>
                          <span className="block text-xs text-gray-400">{r.unit}</span>
                        </div>
                      ),
                    },
                    {
                      title: "Current",
                      key: "current",
                      render: (_, r) => `${r.current_stock} ${r.unit}`,
                    },
                    {
                      title: "Add (+)",
                      key: "add",
                      width: 140,
                      render: (_, r) => (
                        <InputNumber
                          min={0}
                          size="small"
                          placeholder="+ Qty"
                          value={morningInputs[r.id]?.added_qty}
                          onChange={(val) =>
                            setMorningInputs((prev) => ({
                              ...prev,
                              [r.id]: { ...prev[r.id], added_qty: val },
                            }))
                          }
                          className="w-full"
                          addonAfter={r.unit}
                        />
                      ),
                    },
                  ]}
                />
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                  <Button onClick={onCancel}>Cancel</Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleMorningSave}
                    loading={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                  >
                    Save Added Stock
                  </Button>
                </div>
              </div>
            ),
          },
          {
            key: "evening",
            label: (
              <span className="flex items-center gap-1 font-semibold">
                <MoonOutlined className="text-indigo-600" /> Evening Remaining Count
              </span>
            ),
            children: (
              <div>
                <Alert
                  message="Count remaining items at closing. If less than expected, pick a reason."
                  type="warning"
                  showIcon
                  className="mb-3 py-1.5 px-3 text-xs"
                />
                <Table
                  dataSource={filtered}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 6 }}
                  size="small"
                  columns={[
                    {
                      title: "Item",
                      key: "name",
                      render: (_, r) => (
                        <div>
                          <span className="font-semibold text-gray-800">{r.name}</span>
                          <span className="block text-xs text-gray-400">
                            Sold today: {r.billed_qty || 0}
                          </span>
                        </div>
                      ),
                    },
                    {
                      title: "Expected",
                      key: "expected",
                      render: (_, r) => (
                        <span className="font-bold text-gray-700">
                          {r.expected_stock} {r.unit}
                        </span>
                      ),
                    },
                    {
                      title: "Actual Remaining",
                      key: "actual",
                      width: 140,
                      render: (_, r) => (
                        <InputNumber
                          min={0}
                          size="small"
                          placeholder="Count"
                          value={eveningInputs[r.id]?.closing_stock}
                          onChange={(val) =>
                            setEveningInputs((prev) => ({
                              ...prev,
                              [r.id]: { ...prev[r.id], closing_stock: val },
                            }))
                          }
                          className="w-full"
                          addonAfter={r.unit}
                        />
                      ),
                    },
                    {
                      title: "Reason (If Shortage)",
                      key: "reason",
                      width: 160,
                      render: (_, r) => {
                        const val = eveningInputs[r.id]?.closing_stock;
                        const diff = val !== undefined ? Number(val) - Number(r.expected_stock) : 0;
                        return diff < 0 ? (
                          <Select
                            placeholder="Reason"
                            size="small"
                            className="w-full"
                            value={eveningInputs[r.id]?.wastage_reason}
                            onChange={(res) =>
                              setEveningInputs((prev) => ({
                                ...prev,
                                [r.id]: { ...prev[r.id], wastage_reason: res },
                              }))
                            }
                          >
                            {WASTAGE_REASONS.map((reason) => (
                              <Option key={reason} value={reason}>
                                {reason}
                              </Option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        );
                      },
                    },
                  ]}
                />
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                  <Button onClick={onCancel}>Cancel</Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleEveningSave}
                    loading={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                  >
                    Confirm Evening Count
                  </Button>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default DailyStockModal;
