import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Armchair, UtensilsCrossed, ClipboardList, CheckCircle2,
  Clock, AlertCircle, Search, Plus, Minus, Trash2, Check,
  Store, RefreshCw, Volume2, VolumeX, ArrowLeft, ArrowRight, ChevronDown,
  Layers, User, LogOut, Flame, Sparkles, ChefHat, Bell,
  Coffee, Utensils, Table
} from "lucide-react";
import { message, Drawer, Modal, Tag, Dropdown, notification } from "antd";
import productService from "../../Product/services/productService.js";
import billingService from "../service/billingService.js";
import tableService from "../service/tableService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useBranch } from "../../context/BranchContext.jsx";
import FoodThumbnail from "../utils/FoodThumbnail.jsx";
import { broadcastKOTEvent, kotChannel } from "../utils/kotBroadcast.js";
import dayjs from "dayjs";

const fmt = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v || 0);

// Helper to format table identifiers: "T1" -> "Table 1", "T2" -> "Table 2"
const formatTableLabel = (val) => {
  if (!val) return "Table 1";
  const str = String(val).trim();
  const matchT = str.match(/^T(\d+)$/i);
  if (matchT) {
    return `Table ${parseInt(matchT[1], 10)}`;
  }
  return str;
};

export default function WaiterPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth() || {};
  const { selectedBranch, branches, changeBranch } = useBranch() || {};

  // Active Branch Resolution
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
    return selectedBranch?.branch_name || selectedBranch?.name || "Branch";
  }, [effectiveBranchId, branches, selectedBranch]);

  // Primary Navigation Tab: 'tables' | 'order' | 'pickup'
  const [activeTab, setActiveTab] = useState("pickup");

  // Audio Notifications
  const [soundEnabled, setSoundEnabled] = useState(true);
  const playSoundAlert = () => {
    try {
      const audio = new Audio("/order_placed_notification.mp3");
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (_) {}
  };

  // State: Tables
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableFilter, setTableFilter] = useState("all"); // 'all' | 'available' | 'occupied' | 'ready'
  const [selectedTable, setSelectedTable] = useState(null); // { id, table_no }

  // State: Kitchen Queue / Active Orders & Pickup
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [loadingKitchen, setLoadingKitchen] = useState(false);
  const [selectedStationFilter, setSelectedStationFilter] = useState("All");
  const [selectedTablePickupFilter, setSelectedTablePickupFilter] = useState("All");
  const [servingItemId, setServingItemId] = useState(null);
  const [pickupSubView, setPickupSubView] = useState("active"); // 'active' | 'history'

  // State: Catalogue & Order Taking
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [submittingKOT, setSubmittingKOT] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [loadedBillId, setLoadedBillId] = useState(null);

  // Ref tracking newly ready orders for sound alerts
  const seenReadyItemIdsRef = useRef(new Set());
  const initialPollRef = useRef(true);

  // 1. Fetch Tables for Branch
  const fetchTables = async () => {
    setLoadingTables(true);
    try {
      const bId = effectiveBranchId;
      const res = await tableService.getAll(bId ? { branch_id: bId } : {});
      if (res.data?.success) {
        const sorted = (res.data.data || []).sort((a, b) => {
          const valA = String(a.table_no || a.table_name || "");
          const valB = String(b.table_no || b.table_name || "");
          return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        });
        setTables(sorted);
        // Default selected table if not set
        if (!selectedTable && sorted.length > 0) {
          setSelectedTable({ id: sorted[0].id, table_no: formatTableLabel(sorted[0].table_name || sorted[0].table_no || "Table 1") });
        }
      }
    } catch (err) {
      console.error("Failed to fetch tables:", err);
    } finally {
      setLoadingTables(false);
    }
  };

  // 2. Fetch Kitchen Queue for Branch
  const fetchKitchenQueue = async () => {
    if (document.hidden) return;
    setLoadingKitchen(true);
    try {
      const res = await billingService.getKitchenQueue(effectiveBranchId ? { branch_id: effectiveBranchId } : {});
      const active = res?.data || [];
      setKitchenOrders(active);

      // Check for newly ready items to play audio bell
      let hasNewReady = false;
      active.forEach((order) => {
        order.items?.forEach((it) => {
          const itId = it.kot_item_id || it.id;
          const isReady = (it.status === "ready" || order.kot_status === "ready") && (it.quantity - (it.served_quantity || 0)) > 0;
          if (isReady && !seenReadyItemIdsRef.current.has(itId)) {
            seenReadyItemIdsRef.current.add(itId);
            if (!initialPollRef.current) {
              hasNewReady = true;
            }
          }
        });
      });

      if (hasNewReady && soundEnabled) {
        playSoundAlert();
        message.info({
          content: "🔔 New items ready for pickup in the kitchen!",
          key: "ready-pickup-alert",
          duration: 3,
        });
      }
      initialPollRef.current = false;
    } catch (err) {
      console.error("Failed to fetch kitchen queue:", err);
    } finally {
      setLoadingKitchen(false);
    }
  };

  // 3. Fetch Products for Catalogue
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await productService.getAll(effectiveBranchId ? { limit: 500, branch_id: effectiveBranchId } : { limit: 500 });
      const data = res?.data?.data || res?.data || [];
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Reload data when branch changes
  useEffect(() => {
    fetchProducts();
    if (effectiveBranchId) {
      fetchTables();
      fetchKitchenQueue();
    }
    // Clear in-flight cart on branch change
    setCart([]);
    setLoadedBillId(null);
  }, [effectiveBranchId]);

  // Polling & Real-time cross-tab synchronization
  useEffect(() => {
    const interval = setInterval(() => {
      fetchKitchenQueue();
    }, 7000);

    const handleBroadcast = (event) => {
      const data = event?.data;
      if (!data) return;
      if (
        data.type === "KOT_STATUS_UPDATED" ||
        data.type === "KOT_ITEM_SERVED" ||
        data.type === "KOT_CREATED" ||
        data.type === "KOT_READY"
      ) {
        fetchKitchenQueue();
        fetchTables();
      }
    };

    kotChannel.addEventListener("message", handleBroadcast);
    return () => {
      clearInterval(interval);
      kotChannel.removeEventListener("message", handleBroadcast);
    };
  }, [effectiveBranchId]);

  // Computed Kitchen Stations
  const kitchenStations = useMemo(() => {
    const set = new Set();
    kitchenOrders.forEach((o) => {
      o.items?.forEach((i) => {
        if (i.kitchen_name) set.add(i.kitchen_name);
      });
    });
    return ["All", ...Array.from(set)];
  }, [kitchenOrders]);

  // Real-time ready item metrics per station and table
  const queueStats = useMemo(() => {
    const stats = {
      totalReadyItems: 0,
      totalOrders: kitchenOrders.length,
      byKitchen: {},
      byTable: {},
      readyTableSet: new Set(),
    };

    kitchenOrders.forEach((order) => {
      const rawTNo = order.table_no || (order.counter_no ? order.counter_no.replace("Counter ", "Table ") : "Walk-in");
      const tNo = formatTableLabel(rawTNo);
      if (!stats.byTable[tNo]) stats.byTable[tNo] = { ready: 0, total: 0 };

      order.items?.forEach((i) => {
        const kName = i.kitchen_name || "Main Kitchen";
        if (!stats.byKitchen[kName]) stats.byKitchen[kName] = { ready: 0, total: 0 };

        const totalQty = i.quantity || 1;
        const servedQty = i.served_quantity || 0;
        const remaining = Math.max(0, totalQty - servedQty);

        stats.byKitchen[kName].total += totalQty;
        stats.byTable[tNo].total += totalQty;

        const isItemReady = (i.status === "ready" || order.kot_status === "ready") && remaining > 0;
        if (isItemReady) {
          stats.byKitchen[kName].ready += remaining;
          stats.byTable[tNo].ready += remaining;
          stats.totalReadyItems += remaining;
          stats.readyTableSet.add(tNo);
        }
      });
    });

    return stats;
  }, [kitchenOrders]);

  // Separate active pickup queue from fully served completed orders
  const activePickupOrders = useMemo(() => {
    return kitchenOrders.filter((order) => order.kot_status !== "served");
  }, [kitchenOrders]);

  const servedHistoryOrders = useMemo(() => {
    return kitchenOrders.filter((order) => order.kot_status === "served");
  }, [kitchenOrders]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      const cat = p.category?.category_name || p.category_name;
      if (cat) set.add(cat);
    });
    return ["all", ...Array.from(set)];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat =
        activeCategory === "all" ||
        (p.category?.category_name || p.category_name) === activeCategory;
      const q = productSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (p.product_name && p.product_name.toLowerCase().includes(q)) ||
        (p.product_code && p.product_code.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [products, activeCategory, productSearch]);

  // Cart Calculations
  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let totalQty = 0;
    cart.forEach((it) => {
      const lineTotal = it.price * it.qty;
      subtotal += lineTotal;
      tax += lineTotal * ((it.tax_rate || 0) / 100);
      totalQty += it.qty;
    });
    return { subtotal, tax, total: subtotal + tax, totalQty };
  }, [cart]);

  // Cart Handlers
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.product_name,
          price: parseFloat(product.selling_price || product.mrp || 0),
          tax_rate: parseFloat(product.tax_percentage || 0),
          image_url: product.image_url,
          qty: 1,
        },
      ];
    });
  };

  const updateCartQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === productId) {
            const nextQty = item.qty + delta;
            return nextQty > 0 ? { ...item, qty: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  // ================= 4. CORE ACTION: SUBMIT KOT =================
  const handleSendKOT = async () => {
    if (cart.length === 0) {
      message.warning("Cart is empty! Add products first.");
      return;
    }
    if (!selectedTable) {
      message.warning("Please select a table before sending KOT.");
      setActiveTab("tables");
      return;
    }

    setSubmittingKOT(true);
    try {
      const tableLabel = selectedTable.table_no || `Table ${selectedTable.id}`;
      const payload = {
        branch_id: effectiveBranchId,
        customer_name: "Dine-in Guest",
        customer_phone: "9999999999",
        type: "Casier Billing",
        counter_no: tableLabel ? tableLabel.replace("Table ", "Counter ") : "Counter 1",
        billing_date: new Date().toISOString(),
        subtotal_amount: cartTotals.subtotal,
        tax_amount: cartTotals.tax,
        discount_amount: 0,
        total_amount: cartTotals.total,
        paid_amount: 0,
        due_amount: cartTotals.total,
        payment_method: "cash",
        status: "pending",
        table_id: selectedTable.id,
        order_type: "Dine In",
        notes: `Waiter Order | Table: ${tableLabel} ${orderNotes ? `| Notes: ${orderNotes}` : ""}`,
        billing_items: cart.map((item) => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.qty,
          unit_price: item.price,
          discount_amount: 0,
          tax_percentage: item.tax_rate,
          tax_amount: item.price * item.qty * (item.tax_rate / 100),
          total_price: item.price * item.qty * (1 + item.tax_rate / 100),
        })),
      };

      if (loadedBillId) {
        await billingService.update(loadedBillId, payload);
        message.success(`KOT updated for ${tableLabel}!`);
      } else {
        await billingService.create(payload);
        message.success(`KOT sent to kitchen for ${tableLabel}!`);
      }

      // Broadcast and reset
      broadcastKOTEvent("KOT_CREATED", { table: tableLabel });
      setCart([]);
      setOrderNotes("");
      setLoadedBillId(null);
      setCartDrawerOpen(false);

      // Refresh queues & switch to Pickup or Tables tab
      fetchKitchenQueue();
      fetchTables();
      setActiveTab("pickup");
    } catch (err) {
      console.error("Failed to send KOT:", err);
      message.error(err?.response?.data?.message || err?.message || "Failed to send KOT to kitchen");
    } finally {
      setSubmittingKOT(false);
    }
  };

  // ================= 5. CORE ACTION: SERVE ITEM OR UNIT =================
  const handleServeItem = async (kotItemId, servedQty = null, itemName = "Item", orderId = null) => {
    if (!kotItemId || servingItemId === kotItemId) return;
    setServingItemId(kotItemId);

    // 1. Optimistic local update
    setKitchenOrders((prev) =>
      prev.map((order) => {
        if (orderId && order.id !== orderId) return order;
        const hasItem = order.items?.some((it) => it.kot_item_id === kotItemId || it.id === kotItemId);
        if (!hasItem) return order;

        const updatedItems = order.items.map((it) => {
          if (it.kot_item_id === kotItemId || it.id === kotItemId) {
            const currentServed = it.served_quantity || 0;
            const totalQty = it.quantity || 1;
            const inc = servedQty !== null && servedQty !== undefined ? parseInt(servedQty, 10) : totalQty - currentServed;
            const newServed = Math.min(totalQty, currentServed + (isNaN(inc) ? 1 : inc));
            const isServed = newServed >= totalQty;
            return {
              ...it,
              served_quantity: newServed,
              status: isServed ? "served" : "partially_served",
              is_served: isServed,
            };
          }
          return it;
        });

        const allServed = updatedItems.every((it) => it.is_served);
        const anyServed = updatedItems.some((it) => it.served_quantity > 0 || it.is_served);
        const newKotStatus = allServed ? "served" : anyServed ? "partially_served" : order.kot_status;

        return {
          ...order,
          items: updatedItems,
          kot_status: newKotStatus,
        };
      })
    );

    try {
      const res = await billingService.serveKOTItem(kotItemId, servedQty, effectiveBranchId);
      message.success(res?.message || `${itemName} marked as served!`);

      // 2. Broadcast to Kitchen KDS and other waiter devices
      broadcastKOTEvent("KOT_ITEM_SERVED", {
        kot_item_id: kotItemId,
        served_quantity: servedQty,
        order_id: orderId,
        data: res?.data,
      });
      broadcastKOTEvent("KOT_STATUS_UPDATED", {
        id: orderId,
        status: res?.data?.kot_status || "partially_served",
      });

      // Background sync
      fetchKitchenQueue();
      fetchTables();
    } catch (err) {
      console.error("Failed to serve item:", err);
      message.error(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to mark item served");
      fetchKitchenQueue();
    } finally {
      setServingItemId(null);
    }
  };

  // Serve entire order in 1 tap
  const handleServeEntireOrder = async (orderId, orderLabel = "Order") => {
    try {
      await billingService.updateKOTStatus(orderId, "served", null, effectiveBranchId);
      message.success(`${orderLabel} fully served!`);
      broadcastKOTEvent("KOT_STATUS_UPDATED", { id: orderId, status: "served" });
      fetchKitchenQueue();
      fetchTables();
    } catch (err) {
      console.error("Failed to serve entire order:", err);
      message.error(err?.response?.data?.error || err?.message || "Failed to serve order");
      fetchKitchenQueue();
    }
  };

  // Branch switcher menu items
  const branchMenuItems = useMemo(() => {
    if (!branches || branches.length === 0) {
      return [
        {
          key: "single-branch",
          disabled: true,
          label: (
            <div className="py-1 px-1">
              <span className="text-xs font-bold text-slate-700 block">{effectiveBranchName}</span>
              <span className="text-[10px] text-slate-400">Only 1 branch assigned</span>
            </div>
          ),
        },
      ];
    }
    return branches.map((b) => {
      const bId = b.branch_id;
      const bName = b.branch?.branch_name || b.branch?.name || b.name || "Branch";
      const bCode = b.branch?.branch_code || b.branch?.code || "";
      const isCurrent = bId === effectiveBranchId;
      return {
        key: bId,
        onClick: () => {
          if (bId !== effectiveBranchId && changeBranch) {
            changeBranch(bId);
            setCart([]);
            setLoadedBillId(null);
          }
        },
        label: (
          <div className="flex items-center justify-between gap-3 py-1.5 px-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <Store size={14} className={isCurrent ? "text-emerald-600" : "text-slate-400"} />
              <span className={`text-xs ${isCurrent ? "font-black text-emerald-700" : "font-semibold text-slate-800"}`}>
                {bName}
              </span>
            </div>
            {isCurrent && <Check size={14} className="text-emerald-600" />}
          </div>
        ),
      };
    });
  }, [branches, effectiveBranchId, effectiveBranchName, changeBranch]);

  // User menu items
  const userMenuItems = [
    {
      key: "user-name",
      disabled: true,
      label: (
        <div className="py-1 px-1">
          <p className="font-bold text-slate-800 text-sm mb-0">{user?.username || "Waiter"}</p>
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-0">Order Taker / Waitstaff</p>
        </div>
      ),
    },
    { type: "divider" },
    {
      key: "branch-sub",
      icon: <Store size={15} className="text-emerald-600" />,
      label: `Branch: ${effectiveBranchName}`,
      children: branches && branches.length > 0 ? branchMenuItems : undefined,
    },
    {
      key: "refresh",
      icon: <RefreshCw size={15} className="text-indigo-600" />,
      label: "Refresh Orders & Tables",
      onClick: () => {
        fetchKitchenQueue();
        fetchTables();
        message.success("Refreshed!");
      },
    },
    {
      key: "pos-link",
      icon: <Layers size={15} className="text-slate-600" />,
      label: "Open POS Terminal",
      onClick: () => navigate("/billing/pos"),
    },
    { type: "divider" },
    {
      key: "logout",
      danger: true,
      icon: <LogOut size={15} />,
      label: "Log Out",
      onClick: () => {
        if (logout) logout();
        navigate("/");
      },
    },
  ];

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden font-sans select-none">
      {/* ================= 1. COMPACT TOP HEADER ================= */}
      <header className="h-13 bg-white border-b border-slate-200/90 px-3 flex items-center justify-between shrink-0 z-20 gap-2">
        {/* Left: App Identity & Branch Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
            <UtensilsCrossed size={16} />
          </div>

          <Dropdown menu={{ items: branchMenuItems }} trigger={["click"]} placement="bottomLeft">
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1 h-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition cursor-pointer shrink-0"
              title="Change Branch"
            >
              <Store size={13} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-black truncate max-w-[85px] xs:max-w-[120px]">
                {effectiveBranchName}
              </span>
              <ChevronDown size={11} className="text-slate-400 shrink-0" />
            </button>
          </Dropdown>
        </div>

        {/* Center / Right: Live Status & Staff Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Audio Mute/Unmute */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label="Toggle Alert Audio"
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer ${
              soundEnabled
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-slate-100 border-slate-200 text-slate-400"
            }`}
            title={soundEnabled ? "Alert Sound: ON" : "Alert Sound: MUTED"}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {/* Quick Refresh Queue */}
          <button
            onClick={() => {
              fetchKitchenQueue();
              fetchTables();
            }}
            aria-label="Refresh Queue"
            className="w-8 h-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition cursor-pointer"
            title="Refresh Kitchen Orders"
          >
            <RefreshCw size={14} className={loadingKitchen ? "animate-spin text-emerald-600" : ""} />
          </button>

          {/* Staff Profile Dropdown */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={["click"]}>
            <button
              type="button"
              className="h-8 flex items-center gap-1.5 pl-1 cursor-pointer bg-transparent border-0 outline-none"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                <User size={14} />
              </div>
            </button>
          </Dropdown>
        </div>
      </header>

      {/* ================= 2. ACTIVE VIEW CONTAINER ================= */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-16">
        {/* ========================================================================= */}
        {/* TAB 1: TABLES VIEW                                                        */}
        {/* ========================================================================= */}
        {activeTab === "tables" && (
          <div className="p-3 max-w-5xl mx-auto space-y-3">
            {/* Filter Chips */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
              <div className="flex items-center gap-1.5">
                {[
                  { key: "all", label: "All Tables", count: tables.length },
                  {
                    key: "ready",
                    label: "Food Ready",
                    count: queueStats.readyTableSet.size,
                    color: "bg-emerald-500 text-white",
                  },
                  {
                    key: "occupied",
                    label: "Occupied",
                    count: tables.filter((t) => queueStats.byTable[formatTableLabel(t.table_name || t.table_no)]?.total > 0).length,
                  },
                  {
                    key: "available",
                    label: "Available",
                    count: tables.filter((t) => !(queueStats.byTable[formatTableLabel(t.table_name || t.table_no)]?.total > 0)).length,
                  },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setTableFilter(f.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      tableFilter === f.key
                        ? f.color || "bg-slate-900 !text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        tableFilter === f.key
                          ? "bg-white/20 !text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {tables
                .filter((t) => {
                  const tNo = formatTableLabel(t.table_name || t.table_no);
                  const stats = queueStats.byTable[tNo];
                  const isOccupied = stats && stats.total > 0;
                  const hasReady = stats && stats.ready > 0;
                  if (tableFilter === "ready") return hasReady;
                  if (tableFilter === "occupied") return isOccupied;
                  if (tableFilter === "available") return !isOccupied;
                  return true;
                })
                .map((table) => {
                  const tNo = formatTableLabel(table.table_name || table.table_no || `Table ${table.id}`);
                  const tableStats = queueStats.byTable[tNo] || { ready: 0, total: 0 };
                  const isOccupied = tableStats.total > 0;
                  const hasReady = tableStats.ready > 0;

                  // Find primary active order for table if occupied
                  const activeOrder = kitchenOrders.find((o) => {
                    const oTable = formatTableLabel(o.table_no || (o.counter_no ? o.counter_no.replace("Counter ", "Table ") : ""));
                    return oTable === tNo;
                  });

                  return (
                    <div
                      key={table.id}
                      onClick={() => {
                        setSelectedTable({ id: table.id, table_no: tNo });
                        if (hasReady) {
                          // Jump to pickup view filtered to this table
                          setSelectedTablePickupFilter(tNo);
                          setActiveTab("pickup");
                        } else {
                          // Jump to take order view
                          setActiveTab("order");
                        }
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between min-h-[110px] active:scale-[0.98] ${
                        hasReady
                          ? "bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/40 shadow-sm"
                          : isOccupied
                          ? "bg-amber-50/70 border-amber-300 shadow-xs"
                          : "bg-white border-slate-200/90 hover:border-slate-300 shadow-xs"
                      }`}
                    >
                      {/* Top row: Table name & Status tag */}
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Table
                              size={16}
                              className={
                                hasReady
                                  ? "text-emerald-600"
                                  : isOccupied
                                  ? "text-amber-600"
                                  : "text-slate-400"
                              }
                            />
                            <h3 className="font-black text-sm text-slate-800 leading-none mb-0">
                              {tNo}
                            </h3>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 block mt-1">
                            {table.capacity ? `${table.capacity} Seats` : "Table"}
                          </span>
                        </div>

                        {hasReady ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black animate-pulse flex items-center gap-1 shadow-xs">
                            <Bell size={10} /> {tableStats.ready} Ready
                          </span>
                        ) : isOccupied ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 text-[10px] font-bold">
                            Occupied
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                            Free
                          </span>
                        )}
                      </div>

                      {/* Bottom status note or action */}
                      <div className="pt-2 border-t border-slate-200/40 flex items-center justify-between text-[11px]">
                        {hasReady ? (
                          <span className="text-emerald-700 font-black flex items-center gap-1">
                            <span>Tap to Pick Up</span>
                            <ArrowRight size={12} className="shrink-0" />
                          </span>
                        ) : isOccupied ? (
                          <span className="text-amber-800 font-semibold truncate max-w-[130px]">
                            {activeOrder?.items?.length || 0} dishes ordered
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">Tap to Take Order</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TAKE ORDER VIEW                                                    */}
        {/* ========================================================================= */}
        {activeTab === "order" && (
          <div className="flex flex-col h-full">
            {/* Table Selection Strip */}
            <div className="bg-white border-b border-slate-200/90 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Table size={16} className="text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-500">Table:</span>
                <Dropdown
                  menu={{
                    items: tables.map((t) => {
                      const tLabel = formatTableLabel(t.table_name || t.table_no || `Table ${t.id}`);
                      return {
                        key: t.id,
                        label: (
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <Table size={13} className="text-slate-400 shrink-0" />
                            <span>{tLabel}</span>
                          </span>
                        ),
                        onClick: () => setSelectedTable({ id: t.id, table_no: tLabel }),
                      };
                    }),
                  }}
                  trigger={["click"]}
                >
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black cursor-pointer"
                  >
                    <Table size={13} className="text-emerald-700 shrink-0" />
                    <span>{formatTableLabel(selectedTable?.table_no) || "Select Table"}</span>
                    <ChevronDown size={12} />
                  </button>
                </Dropdown>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Search Box & Category Pills */}
            <div className="bg-white border-b border-slate-200/80 p-2.5 space-y-2 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search dish or beverage..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition shrink-0 cursor-pointer ${
                      activeCategory === cat
                        ? "bg-slate-900 !text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Catalogue Grid */}
            <div className="p-2.5 grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto">
              {filteredProducts.map((p) => {
                const inCart = cart.find((item) => item.id === p.id);
                const price = parseFloat(p.selling_price || p.mrp || 0);

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl border p-2 flex flex-col justify-between transition-all ${
                      inCart ? "border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        <FoodThumbnail
                          imageUrl={p.image_url}
                          title={p.product_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 leading-tight mb-0.5 truncate">
                          {p.product_name}
                        </h4>
                        <span className="text-xs font-black text-emerald-600 block">
                          {fmt(price)}
                        </span>
                      </div>
                    </div>

                    {/* Stepper or Add button */}
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      {inCart ? (
                        <div className="flex items-center justify-between bg-emerald-50 rounded-xl p-1 border border-emerald-200">
                          <button
                            onClick={() => updateCartQty(p.id, -1)}
                            className="w-7 h-7 rounded-lg bg-white text-emerald-700 flex items-center justify-center font-bold text-sm shadow-2xs hover:bg-emerald-100 active:scale-95 transition cursor-pointer"
                          >
                            <Minus size={13} strokeWidth={2.5} />
                          </button>
                          <span className="text-xs font-black text-emerald-900 px-2">
                            {inCart.qty}
                          </span>
                          <button
                            onClick={() => updateCartQty(p.id, 1)}
                            className="w-7 h-7 rounded-lg bg-emerald-600 !text-white flex items-center justify-center font-bold text-sm shadow-2xs hover:bg-emerald-700 active:scale-95 transition cursor-pointer"
                          >
                            <Plus size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(p)}
                          className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:!text-white text-slate-800 text-xs font-bold flex items-center justify-center gap-1 transition active:scale-98 cursor-pointer"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Floating Cart Drawer Trigger */}
            {cart.length > 0 && (
              <div className="fixed bottom-16 left-0 right-0 z-30 px-3 py-2 bg-gradient-to-t from-slate-900/40 to-transparent pointer-events-none">
                <div
                  onClick={() => setCartDrawerOpen(true)}
                  className="max-w-md mx-auto bg-slate-900 !text-white rounded-2xl p-3 shadow-lg flex items-center justify-between cursor-pointer pointer-events-auto active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black">
                      {cartTotals.totalQty}
                    </span>
                    <div>
                      <span className="text-xs font-bold block leading-none flex items-center gap-1">
                        <Table size={12} className="text-emerald-400 shrink-0" />
                        <span>{formatTableLabel(selectedTable?.table_no) || "Table"} Order</span>
                      </span>
                      <span className="text-sm font-black text-emerald-400">
                        {fmt(cartTotals.total)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 group-hover:text-white transition">
                    <span>Review & Send KOT</span>
                    <ArrowRight size={14} className="shrink-0 text-emerald-400" />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PICKUP & SERVE VIEW (STAR OPERATIONAL SCREEN)                      */}
        {/* ========================================================================= */}
        {activeTab === "pickup" && (
          <div className="p-3 max-w-4xl mx-auto space-y-3">
            {/* Active Queue vs Served History Segmented Control */}
            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setPickupSubView("active")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  pickupSubView === "active"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Bell size={13} className={queueStats.totalReadyItems > 0 ? "text-emerald-500 animate-bounce" : ""} />
                <span>Active Pickup</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  pickupSubView === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                }`}>
                  {activePickupOrders.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPickupSubView("history")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  pickupSubView === "history"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 size={13} className="text-indigo-500" />
                <span>Served History</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  pickupSubView === "history" ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-700"
                }`}>
                  {servedHistoryOrders.length}
                </span>
              </button>
            </div>

            {pickupSubView === "active" ? (
              <>
                {/* Header Metrics Banner */}
                <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100 block">
                      Kitchen Pickup Queue
                    </span>
                    <h2 className="text-xl font-black mb-0 leading-tight">
                      {queueStats.totalReadyItems} Items Ready to Serve
                    </h2>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Bell size={20} className={queueStats.totalReadyItems > 0 ? "animate-bounce" : ""} />
                  </div>
                </div>

            {/* Station Filter Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Filter by Kitchen Station
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {kitchenStations.map((st) => {
                  const count = st === "All" ? queueStats.totalReadyItems : queueStats.byKitchen[st]?.ready || 0;
                  return (
                    <button
                      key={st}
                      onClick={() => setSelectedStationFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        selectedStationFilter === st
                          ? "bg-slate-900 !text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <ChefHat size={13} className={selectedStationFilter === st ? "text-emerald-400" : "text-slate-400"} />
                      <span>{st}</span>
                      {count > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 !text-white text-[10px] font-black">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table Pickup Filter */}
            {queueStats.readyTableSet.size > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                  Table:
                </span>
                {["All", ...Array.from(queueStats.readyTableSet)].map((tLabel) => {
                  const isAll = tLabel === "All";
                  const displayLabel = isAll ? "All Tables" : formatTableLabel(tLabel);
                  return (
                    <button
                      key={tLabel}
                      onClick={() => setSelectedTablePickupFilter(tLabel)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        selectedTablePickupFilter === tLabel
                          ? "bg-emerald-600 !text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {!isAll && (
                        <Table
                          size={12}
                          className={selectedTablePickupFilter === tLabel ? "text-white" : "text-slate-500"}
                        />
                      )}
                      <span>{displayLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active Orders List with Multi-Kitchen Item Breakdown */}
            <div className="space-y-3">
              {activePickupOrders
                .filter((order) => {
                  const rawTNo = order.table_no || (order.counter_no ? order.counter_no.replace("Counter ", "Table ") : "");
                  const tNo = formatTableLabel(rawTNo);
                  if (selectedTablePickupFilter !== "All" && tNo !== selectedTablePickupFilter) {
                    return false;
                  }
                  if (selectedStationFilter !== "All") {
                    return order.items?.some((it) => it.kitchen_name === selectedStationFilter);
                  }
                  return true;
                })
                .map((order) => {
                  const rawTNo = order.table_no || (order.counter_no ? order.counter_no.replace("Counter ", "Table ") : "Walk-in");
                  const tNo = formatTableLabel(rawTNo);
                  const orderItems = order.items || [];
                  const isOrderFullyServed = order.kot_status === "served";

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
                    >
                      {/* Order Header: Table & KOT Number */}
                      <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-900 !text-white font-black text-xs flex items-center gap-1.5 shadow-xs">
                            <Table size={13} className="text-emerald-400 shrink-0" />
                            <span>{tNo}</span>
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {order.kot_number ? `KOT #${order.kot_number}` : order.billing_no}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            order.kot_status === "ready"
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-300 animate-pulse"
                              : order.kot_status === "partially_ready"
                              ? "bg-teal-100 text-teal-800 border border-teal-300"
                              : order.kot_status === "partially_served"
                              ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                              : order.kot_status === "served"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {order.kot_status === "ready"
                            ? "All Ready"
                            : order.kot_status === "partially_ready"
                            ? "Part Ready"
                            : order.kot_status === "partially_served"
                            ? "Part Served"
                            : order.kot_status === "served"
                            ? "Fully Served"
                            : "Cooking"}
                        </span>
                      </div>

                      {/* Items List grouped by Kitchen Location */}
                      <div className="divide-y divide-slate-100 p-2 space-y-2">
                        {orderItems
                          .filter((it) => {
                            if (selectedStationFilter === "All") return true;
                            return it.kitchen_name === selectedStationFilter;
                          })
                          .map((it) => {
                            const totalQty = it.quantity || 1;
                            const servedQty = it.served_quantity || 0;
                            const remaining = Math.max(0, totalQty - servedQty);
                            const isLineServed = servedQty >= totalQty || it.status === "served";
                            const isLineReady = (it.status === "ready" || order.kot_status === "ready") && !isLineServed;
                            const isLineCooking = it.status === "preparing" || it.status === "pending";
                            const kStation = it.kitchen_name || "Main Kitchen";

                            return (
                              <div
                                key={it.kot_item_id || it.id}
                                className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
                                  isLineReady
                                    ? "bg-emerald-50/70 border-emerald-300/80"
                                    : isLineServed
                                    ? "bg-slate-50/80 border-slate-200 opacity-60"
                                    : "bg-white border-slate-200"
                                }`}
                              >
                                {/* Left: Kitchen Badge & Dish Info */}
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {/* Crucial: Visible Kitchen Location Badge */}
                                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black flex items-center gap-1">
                                      <ChefHat size={11} /> {kStation}
                                    </span>

                                    {isLineReady && (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-black flex items-center gap-1">
                                        <Bell size={10} /> Ready for Pickup!
                                      </span>
                                    )}
                                    {isLineCooking && (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                                        <Flame size={10} /> Cooking
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-slate-800 mb-0 truncate">
                                      {it.product_name}
                                    </h4>
                                    <span className="text-xs font-bold text-slate-500">
                                      &times; {totalQty}
                                    </span>
                                  </div>

                                  <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-2">
                                    <span>Served: {servedQty} / {totalQty}</span>
                                    {remaining > 0 && (
                                      <span className="text-emerald-700 font-bold">
                                        ({remaining} remaining)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Serving Actions */}
                                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                                  {isLineServed ? (
                                    <div className="flex items-center gap-1 text-purple-700 font-bold text-xs bg-purple-50 px-2.5 py-1 rounded-lg">
                                      <CheckCircle2 size={14} />
                                      <span>Served</span>
                                    </div>
                                  ) : isLineCooking ? (
                                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                                      Waiting on Kitchen
                                    </span>
                                  ) : (
                                    <>
                                      {/* +1 Unit Serving */}
                                      {totalQty > 1 && remaining > 1 && (
                                        <button
                                          type="button"
                                          disabled={servingItemId === it.kot_item_id}
                                          onClick={() =>
                                            handleServeItem(
                                              it.kot_item_id,
                                              1,
                                              it.product_name,
                                              order.id
                                            )
                                          }
                                          className="py-1.5 px-2.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 font-black text-xs active:scale-95 transition cursor-pointer disabled:opacity-50"
                                        >
                                          +1 Serve
                                        </button>
                                      )}

                                      {/* Serve Remaining Units */}
                                      <button
                                        type="button"
                                        disabled={servingItemId === it.kot_item_id}
                                        onClick={() =>
                                          handleServeItem(
                                            it.kot_item_id,
                                            null,
                                            it.product_name,
                                            order.id
                                          )
                                        }
                                        className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 !text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                                      >
                                        <Check size={14} strokeWidth={2.5} />
                                        <span>{remaining > 1 ? `Serve All (${remaining})` : "Mark Served"}</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {/* Serve Entire Order Button if all ready */}
                      {!isOrderFullyServed && (
                        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                          <button
                            onClick={() =>
                              handleServeEntireOrder(
                                order.id,
                                order.kot_number ? `KOT #${order.kot_number}` : order.billing_no
                              )
                            }
                            className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] !text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 size={13} strokeWidth={2.5} />
                            <span>Serve Entire Table Order</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

              {activePickupOrders.length === 0 && (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                  <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 mb-0.5">All Active Orders Served</h4>
                  <p className="text-xs text-slate-400 mb-3">No pending or ready items in the active queue.</p>
                  {servedHistoryOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickupSubView("history")}
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition border border-indigo-200/80"
                    >
                      <CheckCircle2 size={14} />
                      <span>View Completed Order History ({servedHistoryOrders.length})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            </>
          ) : (
            /* ================= SERVED ORDER HISTORY VIEW ================= */
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-r from-indigo-700 to-slate-800 text-white rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-200 block">
                    Order History (Fully Served)
                  </span>
                  <h2 className="text-xl font-black mb-0 leading-tight">
                    {servedHistoryOrders.length} Orders Completed
                  </h2>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <CheckCircle2 size={22} className="text-emerald-400" />
                </div>
              </div>

              {servedHistoryOrders.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                  <ClipboardList size={36} className="text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-slate-800 mb-0.5">No Served History Yet</h4>
                  <p className="text-xs text-slate-400 mb-0">Orders will automatically move here once all food items have been served.</p>
                </div>
              ) : (
                servedHistoryOrders.map((order) => {
                  const rawTNo = order.table_no || (order.counter_no ? order.counter_no.replace("Counter ", "Table ") : "Walk-in");
                  const tNo = formatTableLabel(rawTNo);
                  const isPaid = order.status === "paid";
                  return (
                    <div key={order.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                      <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-900 !text-white font-black text-xs flex items-center gap-1.5 shadow-xs">
                            <Table size={13} className="text-emerald-400 shrink-0" />
                            <span>{tNo}</span>
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {order.kot_number ? `KOT #${order.kot_number}` : order.billing_no}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Tag color="purple" className="font-bold text-[10px] m-0">Fully Served</Tag>
                          <Tag color={isPaid ? "success" : "warning"} className="font-bold text-[10px] m-0">
                            {isPaid ? "Paid" : "Awaiting Bill"}
                          </Tag>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100 p-2.5 space-y-1.5">
                        {(order.items || []).map((it) => (
                          <div key={it.kot_item_id || it.id} className="flex items-center justify-between text-xs py-1">
                            <div className="flex items-center gap-2">
                              <Check size={14} className="text-emerald-600 shrink-0" strokeWidth={3} />
                              <span className="font-bold text-slate-800">{it.product_name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[9px] font-bold text-indigo-700">
                                {it.kitchen_name || "Main Kitchen"}
                              </span>
                            </div>
                            <span className="font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              × {it.served_quantity || it.quantity || 1} served
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
          </div>
        )}
      </main>

      {/* ================= 3. CART REVIEW DRAWER ================= */}
      <Drawer
        title={
          <div className="flex items-center justify-between">
            <span className="font-black text-sm flex items-center gap-1.5">
              <Table size={15} className="text-emerald-600 shrink-0" />
              <span>Order Review: {formatTableLabel(selectedTable?.table_no)}</span>
            </span>
            <span className="text-xs font-black text-emerald-600">{fmt(cartTotals.total)}</span>
          </div>
        }
        open={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        placement="bottom"
        height="80%"
      >
        <div className="flex flex-col h-full space-y-3">
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {cart.map((it) => (
              <div key={it.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-0">{it.name}</h4>
                  <span className="text-xs text-slate-500 font-semibold">
                    {fmt(it.price)} &times; {it.qty} = {fmt(it.price * it.qty)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 rounded-lg p-0.5">
                    <button
                      onClick={() => updateCartQty(it.id, -1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="px-2 text-xs font-bold">{it.qty}</span>
                    <button
                      onClick={() => updateCartQty(it.id, 1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(it.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Notes input */}
          <div className="pt-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Chef / Kitchen Notes
            </label>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="e.g. Less spicy, Serve starters first..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
            />
          </div>

          {/* Big Action: Send KOT to Kitchen */}
          <button
            type="button"
            disabled={submittingKOT || cart.length === 0}
            onClick={handleSendKOT}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] !text-white rounded-xl text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 cursor-pointer disabled:opacity-50"
          >
            <ChefHat size={18} />
            <span>{submittingKOT ? "Sending to Kitchen..." : "Send KOT to Kitchen"}</span>
          </button>
        </div>
      </Drawer>

      {/* ================= 4. BOTTOM 3-TAB NAVIGATION BAR ================= */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] grid grid-cols-3 z-40">
        {/* Tab 1: Tables */}
        <button
          onClick={() => setActiveTab("tables")}
          className={`flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
            activeTab === "tables" ? "text-emerald-600 font-black" : "text-slate-400 font-bold"
          }`}
        >
          <Table size={19} strokeWidth={activeTab === "tables" ? 2.5 : 2} />
          <span className="text-[10px]">Tables</span>
        </button>

        {/* Tab 2: Take Order */}
        <button
          onClick={() => setActiveTab("order")}
          className={`flex flex-col items-center justify-center gap-0.5 transition cursor-pointer relative ${
            activeTab === "order" ? "text-emerald-600 font-black" : "text-slate-400 font-bold"
          }`}
        >
          <div className="relative">
            <ClipboardList size={19} strokeWidth={activeTab === "order" ? 2.5 : 2} />
            {cartTotals.totalQty > 0 && (
              <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full bg-slate-900 text-white text-[9px] font-black leading-none">
                {cartTotals.totalQty}
              </span>
            )}
          </div>
          <span className="text-[10px]">Take Order</span>
        </button>

        {/* Tab 3: Pickup & Serve (Star operational view!) */}
        <button
          onClick={() => setActiveTab("pickup")}
          className={`flex flex-col items-center justify-center gap-0.5 transition cursor-pointer relative ${
            activeTab === "pickup" ? "text-emerald-600 font-black" : "text-slate-400 font-bold"
          }`}
        >
          <div className="relative">
            <UtensilsCrossed size={19} strokeWidth={activeTab === "pickup" ? 2.5 : 2} />
            {queueStats.totalReadyItems > 0 && (
              <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 rounded-full bg-emerald-500 !text-white text-[9px] font-black leading-none animate-pulse">
                {queueStats.totalReadyItems}
              </span>
            )}
          </div>
          <span className="text-[10px]">Pickup & Serve</span>
        </button>
      </nav>
    </div>
  );
}
