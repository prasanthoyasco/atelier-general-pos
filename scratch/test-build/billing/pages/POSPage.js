import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Trash2,
  X,
  User,
  Plus,
  Minus,
  Check,
  Store,
  Clock,
  ScanLine,
  LayoutGrid,
  Cake,
  Utensils,
  Coffee,
  Croissant,
  Printer,
  ChevronUp,
  Settings,
  ClipboardList,
  Menu,
  Volume2,
  VolumeX,
  UtensilsCrossed,
  Bell,
  CreditCard,
  Banknote,
  QrCode,
  Split,
  Receipt,
  DollarSign,
  Armchair,
  ChevronDown,
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Eye,
  Layers,
  MoveLeft,
  ArrowLeft,
  Sparkles,
  ChefHat,
  Table
} from "lucide-react";
import { message, Drawer, Modal, Tag, Select, notification, Radio, Dropdown } from "antd";
import productService from "../../Product/services/productService.js";
import customerService from "../../customer/service/customerService.js";
import billingService from "../service/billingService.js";
import localPrintService from "../service/localPrintService.js";
import tableService from "../service/tableService.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useBranch } from "../../context/BranchContext.jsx";
import FoodThumbnail from "../utils/FoodThumbnail.jsx";
import { broadcastKOTEvent, kotChannel } from "../utils/kotBroadcast.js";
import DailyStockModal from "../components/DailyStockModal.jsx";
import dayjs from "dayjs";
const fmt = (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v || 0);
const formatTableLabel = (val) => {
  if (!val) return "Table 1";
  const str = String(val).trim();
  const matchT = str.match(/^T(\d+)$/i);
  if (matchT) {
    return `Table ${parseInt(matchT[1], 10)}`;
  }
  return str;
};
const playSoundAlert = () => {
  try {
    const audio = new Audio("/order_placed_notification.mp3");
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== void 0) {
      playPromise.catch(() => {
        playSynthBeep();
      });
    }
  } catch {
    playSynthBeep();
  }
};
const playSynthBeep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("Audio play blocked:", e);
  }
};
export default function POSPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = Boolean(editId);
  const { user } = useAuth() || {};
  const { selectedBranch, branches, changeBranch } = useBranch() || {};
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
  useEffect(() => {
    if (branches && branches.length > 0 && changeBranch) {
      if (!selectedBranch || selectedBranch.id === "all") {
        changeBranch(branches[0].branch_id);
      }
    }
  }, [branches, selectedBranch, changeBranch]);
  const [currentTime, setCurrentTime] = useState(/* @__PURE__ */ new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(/* @__PURE__ */ new Date()), 1e3);
    return () => clearInterval(t);
  }, []);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [allItems, setAllItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cart, setCart] = useState([]);
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
  const [customizingProduct, setCustomizingProduct] = useState(null);
  const [selectedCustomAddons, setSelectedCustomAddons] = useState([]);
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [custSearchQuery, setCustSearchQuery] = useState("");
  const [custSuggestions, setCustSuggestions] = useState([]);
  const [tables, setTables] = useState([]);
  const [tableNo, setTableNo] = useState("Table 1");
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [orderType, setOrderType] = useState("Dine In");
  const [loadedBillId, setLoadedBillId] = useState(null);
  const [tablesModalOpen, setTablesModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [splitPayments, setSplitPayments] = useState([
    { method: "cash", amount: 0 },
    { method: "UPI Current Account", amount: 0 }
  ]);
  const [upiTxnRef, setUpiTxnRef] = useState("");
  const [cardRefNo, setCardRefNo] = useState("");
  const [settlingPayment, setSettlingPayment] = useState(false);
  const [settledSuccessData, setSettledSuccessData] = useState(null);
  const [submittingKOT, setSubmittingKOT] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [kotDrawerOpen, setKotDrawerOpen] = useState(false);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [loadingKitchen, setLoadingKitchen] = useState(false);
  const [selectedKitchenFilter, setSelectedKitchenFilter] = useState("All");
  const [servingItemId, setServingItemId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [dailyStockModalOpen, setDailyStockModalOpen] = useState(false);
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await productService.getAll({ limit: 500 });
      const data = res?.data?.data || res?.data || [];
      setAllItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      message.error("Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  };
  const fetchTables = async () => {
    try {
      const bId = effectiveBranchId;
      const res = await tableService.getAll(bId ? { branch_id: bId } : {});
      if (res.data?.success) {
        const sorted = (res.data.data || []).sort((a, b) => {
          const valA = String(a.table_no || a.table_name || "");
          const valB = String(b.table_no || b.table_name || "");
          return valA.localeCompare(valB, void 0, { numeric: true, sensitivity: "base" });
        });
        setTables(sorted);
        if (sorted.length > 0) {
          const currentExists = sorted.some((t) => t.id === selectedTableId || t.table_no === tableNo);
          if (!currentExists) {
            setTableNo(formatTableLabel(sorted[0].table_name || sorted[0].table_no || "Table 1"));
            setSelectedTableId(sorted[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch tables:", err);
    }
  };
  useEffect(() => {
    fetchProducts();
    if (effectiveBranchId) {
      fetchTables();
      fetchKitchenQueue();
    }
  }, [effectiveBranchId]);
  const seenReadyOrderIdsRef = useRef(/* @__PURE__ */ new Set());
  const initialKdsPollRef = useRef(true);
  const kitchenStations = useMemo(() => {
    const set = /* @__PURE__ */ new Set();
    kitchenOrders.forEach((o) => {
      o.items?.forEach((i) => {
        if (i.kitchen_name) set.add(i.kitchen_name);
      });
    });
    return ["All", ...Array.from(set)];
  }, [kitchenOrders]);
  const kitchenReadyStats = useMemo(() => {
    const stats = { totalReady: 0, totalPartiallyServed: 0, byKitchen: {} };
    kitchenOrders.forEach((o) => {
      if (o.kot_status === "partially_served") stats.totalPartiallyServed++;
      o.items?.forEach((i) => {
        const kName = i.kitchen_name || "Main Kitchen";
        if (!stats.byKitchen[kName]) stats.byKitchen[kName] = { ready: 0, total: 0 };
        const totalQty = i.quantity || 1;
        const servedQty = i.served_quantity || 0;
        const remaining = Math.max(0, totalQty - servedQty);
        stats.byKitchen[kName].total += totalQty;
        if ((i.status === "ready" || o.kot_status === "ready") && remaining > 0) {
          stats.byKitchen[kName].ready += remaining;
          stats.totalReady += remaining;
        }
      });
    });
    return stats;
  }, [kitchenOrders]);
  const handleServeLineItem = async (kotItemId, servedQty = null, itemName = "Item", orderId = null) => {
    if (!kotItemId || servingItemId === kotItemId) return;
    setServingItemId(kotItemId);
    setKitchenOrders(
      (prev) => prev.map((order) => {
        if (orderId && order.id !== orderId) return order;
        const hasItem = order.items?.some((it) => it.kot_item_id === kotItemId || it.id === kotItemId);
        if (!hasItem) return order;
        const updatedItems = order.items.map((it) => {
          if (it.kot_item_id === kotItemId || it.id === kotItemId) {
            const currentServed = it.served_quantity || 0;
            const totalQty = it.quantity || 1;
            const inc = servedQty !== null && servedQty !== void 0 ? parseInt(servedQty, 10) : totalQty - currentServed;
            const newServed = Math.min(totalQty, currentServed + (isNaN(inc) ? 1 : inc));
            const isServed = newServed >= totalQty;
            return {
              ...it,
              served_quantity: newServed,
              status: isServed ? "served" : "partially_served",
              is_served: isServed
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
          kot_status: newKotStatus
        };
      })
    );
    try {
      const res = await billingService.serveKOTItem(kotItemId, servedQty, effectiveBranchId);
      message.success(res?.message || `${itemName} served!`);
      broadcastKOTEvent("KOT_ITEM_SERVED", {
        kot_item_id: kotItemId,
        served_quantity: servedQty,
        order_id: orderId,
        data: res?.data
      });
      broadcastKOTEvent("KOT_STATUS_UPDATED", {
        id: orderId,
        status: res?.data?.kot_status || "partially_served"
      });
      fetchKitchenQueue();
    } catch (err) {
      console.error("Failed to serve item:", err);
      message.error(err?.response?.data?.error || err?.message || "Failed to mark item served");
      fetchKitchenQueue();
    } finally {
      setServingItemId(null);
    }
  };
  const handleMarkOrderServed = async (orderId, orderLabel = "Order") => {
    setKitchenOrders(
      (prev) => prev.map(
        (o) => o.id === orderId ? {
          ...o,
          kot_status: "served",
          kot_served_at: (/* @__PURE__ */ new Date()).toISOString(),
          items: o.items?.map((it) => ({
            ...it,
            status: "served",
            served_quantity: it.quantity || 1,
            is_served: true
          }))
        } : o
      )
    );
    notification.destroy(orderId);
    try {
      await billingService.updateKOTStatus(orderId, "served", null, effectiveBranchId);
      message.success(`${orderLabel} marked as fully served!`);
      broadcastKOTEvent("KOT_STATUS_UPDATED", {
        id: orderId,
        status: "served",
        kot_status: "served"
      });
      broadcastKOTEvent("KOT_SERVED", { id: orderId });
      fetchKitchenQueue();
    } catch (err) {
      console.error("Failed to mark order as served:", err);
      message.error(err?.response?.data?.error || err?.message || "Failed to mark order as served");
      fetchKitchenQueue();
    }
  };
  const fetchKitchenQueue = async () => {
    if (document.hidden) return;
    setLoadingKitchen(true);
    try {
      const res = await billingService.getKitchenQueue(effectiveBranchId ? { branch_id: effectiveBranchId } : {});
      const active = res?.data || [];
      setKitchenOrders(active);
      const readyOrders = active.filter((o) => o.kot_status === "ready");
      const newlyReady = [];
      readyOrders.forEach((o) => {
        if (!seenReadyOrderIdsRef.current.has(o.id)) {
          newlyReady.push(o);
          seenReadyOrderIdsRef.current.add(o.id);
        }
      });
      if (newlyReady.length > 0 && !initialKdsPollRef.current) {
        const isKitchen = (user?.role_name || userRole || user?.role || "").toLowerCase().includes("kitchen");
        const isWaiter = !isKitchen;
        if (soundEnabled && isWaiter) {
          playSoundAlert();
        }
        if (isWaiter) {
          newlyReady.forEach((order) => {
            const kotLabel = order.kot_number ? `KOT #${order.kot_number}` : order.billing_no;
            const tableLabel = order.table_no || "Table 1";
            const itemCount = order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;
            notification.success({
              message: /* @__PURE__ */ React.createElement("span", { className: "font-bold text-emerald-800 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(UtensilsCrossed, { size: 16, className: "text-emerald-600" }), "Order Ready to Serve!"),
              description: /* @__PURE__ */ React.createElement("div", { className: "space-y-1 text-xs" }, /* @__PURE__ */ React.createElement("p", { className: "font-black text-slate-800" }, kotLabel, " \u2022 ", tableLabel), /* @__PURE__ */ React.createElement("p", { className: "text-slate-600" }, itemCount, " item(s) are cooked and ready to serve to customer.")),
              btn: /* @__PURE__ */ React.createElement(
                "button",
                {
                  onClick: () => handleMarkOrderServed(order.id, kotLabel),
                  className: "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] !text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                },
                "Mark as Served"
              ),
              key: order.id,
              duration: 15,
              placement: "topRight"
            });
          });
        }
      }
      if (initialKdsPollRef.current) {
        readyOrders.forEach((o) => seenReadyOrderIdsRef.current.add(o.id));
        initialKdsPollRef.current = false;
      }
    } catch (err) {
      console.warn("Failed to fetch kitchen orders:", err);
    } finally {
      setLoadingKitchen(false);
    }
  };
  useEffect(() => {
    fetchKitchenQueue();
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchKitchenQueue();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = setInterval(fetchKitchenQueue, 5e3);
    const handleBroadcast = (e) => {
      const eventType = e.data?.type;
      const ticketId = e.data?.payload?.id || e.data?.id;
      const newStatus = e.data?.payload?.status || e.data?.status;
      if (eventType === "KOT_SERVED" || eventType === "KOT_STATUS_UPDATED" && newStatus === "served") {
        if (ticketId) {
          notification.destroy(ticketId);
          setKitchenOrders(
            (prev) => prev.map((o) => o.id === ticketId ? { ...o, kot_status: "served" } : o)
          );
        }
      }
      if (eventType === "KOT_STATUS_UPDATED" && newStatus === "ready") {
        const isKitchen = (user?.role_name || userRole || user?.role || "").toLowerCase().includes("kitchen");
        const isWaiter = !isKitchen;
        if (isWaiter) {
          if (soundEnabled) playSoundAlert();
          const kotLabel = e.data?.payload?.kot_number ? `KOT #${e.data.payload.kot_number}` : e.data?.payload?.billing_no || "KOT Order";
          const tableLabel = e.data?.payload?.table_no || "Table";
          const count = e.data?.payload?.items_count || 1;
          notification.success({
            message: /* @__PURE__ */ React.createElement("span", { className: "font-bold text-emerald-800 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(UtensilsCrossed, { size: 16, className: "text-emerald-600" }), "Order Ready to Serve!"),
            description: /* @__PURE__ */ React.createElement("div", { className: "space-y-1 text-xs" }, /* @__PURE__ */ React.createElement("p", { className: "font-black text-slate-800" }, kotLabel, " \u2022 ", tableLabel), /* @__PURE__ */ React.createElement("p", { className: "text-slate-600" }, count, " item(s) are cooked and ready to serve.")),
            btn: ticketId ? /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => handleMarkOrderServed(ticketId, kotLabel),
                className: "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] !text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              },
              "Mark as Served"
            ) : null,
            key: ticketId || `ready-${Date.now()}`,
            duration: 15,
            placement: "topRight"
          });
        }
      }
      if (eventType === "KOT_STATUS_UPDATED" || eventType === "KOT_SERVED" || eventType === "NEW_KOT_ORDER" || eventType === "KOT_ITEM_STATUS_UPDATED" || eventType === "KOT_ITEM_SERVED") {
        fetchKitchenQueue();
      }
    };
    if (kotChannel) {
      kotChannel.addEventListener("message", handleBroadcast);
    }
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (kotChannel) {
        kotChannel.removeEventListener("message", handleBroadcast);
      }
    };
  }, [soundEnabled]);
  useEffect(() => {
    if (!editId) return;
    billingService.getById(editId).then((res) => {
      const sale = res?.data?.data ?? res?.data;
      if (!sale) return;
      setCustomerName(sale.customer_name || "");
      setCustomerPhone(sale.customer_phone || "");
      if (sale.counter_no) {
        setTableNo(sale.counter_no.replace("Counter ", "Table "));
      }
      if (Array.isArray(sale.items)) {
        setCart(
          sale.items.map((i) => ({
            id: i.product_id,
            name: i.product_name,
            category_name: i.category_name || "Item",
            image_url: i.product?.image_url || i.image_url,
            price: parseFloat(i.unit_price || 0),
            qty: i.quantity || 1,
            tax_rate: parseFloat(i.tax_percentage || 0)
          }))
        );
      }
    }).catch(() => message.error("Failed to load bill"));
  }, [editId]);
  const categoryTabs = useMemo(() => {
    const rawCategories = Array.from(
      new Set(
        allItems.map((i) => i.category_name || i.category?.category_name).filter(Boolean)
      )
    );
    const categoryStyles = {
      all: { label: "All", icon: /* @__PURE__ */ React.createElement(LayoutGrid, { size: 22 }), bg: "bg-blue-600 !text-white", activeBorder: "ring-2 ring-blue-500" },
      sweets: { label: "Sweets", icon: /* @__PURE__ */ React.createElement(Cake, { size: 22 }), bg: "bg-pink-50 text-pink-700 border-pink-100", activeBg: "bg-pink-100 ring-2 ring-pink-400" },
      sweet: { label: "Sweets", icon: /* @__PURE__ */ React.createElement(Cake, { size: 22 }), bg: "bg-pink-50 text-pink-700 border-pink-100", activeBg: "bg-pink-100 ring-2 ring-pink-400" },
      snacks: { label: "Snacks", icon: /* @__PURE__ */ React.createElement(Utensils, { size: 22 }), bg: "bg-orange-50 text-orange-700 border-orange-100", activeBg: "bg-orange-100 ring-2 ring-orange-400" },
      snack: { label: "Snacks", icon: /* @__PURE__ */ React.createElement(Utensils, { size: 22 }), bg: "bg-orange-50 text-orange-700 border-orange-100", activeBg: "bg-orange-100 ring-2 ring-orange-400" },
      beverages: { label: "Beverages", icon: /* @__PURE__ */ React.createElement(Coffee, { size: 22 }), bg: "bg-emerald-50 text-emerald-700 border-emerald-100", activeBg: "bg-emerald-100 ring-2 ring-emerald-400" },
      beverage: { label: "Beverages", icon: /* @__PURE__ */ React.createElement(Coffee, { size: 22 }), bg: "bg-emerald-50 text-emerald-700 border-emerald-100", activeBg: "bg-emerald-100 ring-2 ring-emerald-400" },
      bakery: { label: "Bakery", icon: /* @__PURE__ */ React.createElement(Croissant, { size: 22 }), bg: "bg-purple-50 text-purple-700 border-purple-100", activeBg: "bg-purple-100 ring-2 ring-purple-400" }
    };
    const tabs = [{ key: "all", label: "All", icon: /* @__PURE__ */ React.createElement(LayoutGrid, { size: 22 }), bg: categoryStyles.all.bg }];
    const preferredOrder = ["sweets", "snacks", "beverages", "bakery"];
    const addedKeys = /* @__PURE__ */ new Set(["all"]);
    preferredOrder.forEach((pref) => {
      const match = rawCategories.find((c) => c.toLowerCase().includes(pref));
      if (match && !addedKeys.has(match.toLowerCase())) {
        addedKeys.add(match.toLowerCase());
        const style = categoryStyles[pref] || {
          label: match,
          icon: /* @__PURE__ */ React.createElement(Utensils, { size: 22 }),
          bg: "bg-slate-50 text-slate-700 border-slate-200"
        };
        tabs.push({ key: match.toLowerCase(), label: match, icon: style.icon, bg: style.bg });
      }
    });
    rawCategories.forEach((cat) => {
      if (!addedKeys.has(cat.toLowerCase())) {
        addedKeys.add(cat.toLowerCase());
        tabs.push({
          key: cat.toLowerCase(),
          label: cat,
          icon: /* @__PURE__ */ React.createElement(Utensils, { size: 22 }),
          bg: "bg-slate-50 text-slate-700 border-slate-200"
        });
      }
    });
    return tabs;
  }, [allItems]);
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const cat = (item.category_name || item.category?.category_name || "").toLowerCase();
      const matchCategory = activeCategory === "all" || cat.includes(activeCategory);
      const name = (item.product_name || "").toLowerCase();
      const code = (item.product_code || "").toLowerCase();
      const query = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || name.includes(query) || code.includes(query);
      return matchCategory && matchSearch;
    });
  }, [allItems, activeCategory, searchTerm]);
  const getCartItemKey = (productId, addons = []) => {
    if (!addons || addons.length === 0) return `${productId}`;
    const sortedAddonKeys = [...addons].sort((a, b) => (a.id || "").localeCompare(b.id || "")).map((a) => `${a.id}:${a.qty || 1}`).join("|");
    return `${productId}_addons_${sortedAddonKeys}`;
  };
  const handleProductClick = (product) => {
    if (product.addons && product.addons.length > 0) {
      setCustomizingProduct(product);
      setSelectedCustomAddons([]);
      setCustomItemQty(1);
      setCustomizeModalOpen(true);
    } else {
      addToCart(product);
    }
  };
  const addToCart = (product, chosenAddons = [], qtyToAdd = 1) => {
    setCart((prev) => {
      const cartKey = getCartItemKey(product.id, chosenAddons);
      const exists = prev.find((p) => (p.cart_key || p.id) === cartKey);
      if (exists) {
        return prev.map(
          (p) => (p.cart_key || p.id) === cartKey ? { ...p, qty: p.qty + qtyToAdd } : p
        );
      }
      const basePrice = parseFloat(product.selling_price || product.unit_price || 0);
      const addonsTotal = (chosenAddons || []).reduce(
        (sum, a) => sum + parseFloat(a.price || 0) * (a.qty || 1),
        0
      );
      const unitPrice = basePrice + addonsTotal;
      const taxRate = parseFloat((product.tax_percentage || "0").toString().replace("%", "")) || 0;
      return [
        ...prev,
        {
          cart_key: cartKey,
          id: product.id,
          name: product.product_name,
          category_name: product.category_name || "Item",
          image_url: product.image_url,
          base_price: basePrice,
          addons: chosenAddons,
          price: unitPrice,
          qty: qtyToAdd,
          tax_rate: taxRate
        }
      ];
    });
  };
  const updateQty = (keyOrId, delta) => {
    setCart(
      (prev) => prev.map((p) => {
        if ((p.cart_key || p.id) === keyOrId) {
          const nextQty = p.qty + delta;
          return nextQty > 0 ? { ...p, qty: nextQty } : null;
        }
        return p;
      }).filter(Boolean)
    );
  };
  const removeItem = (keyOrId) => {
    setCart((prev) => prev.filter((p) => (p.cart_key || p.id) !== keyOrId));
  };
  const toggleAddon = (addon) => {
    setSelectedCustomAddons((prev) => {
      const exists = prev.find((a) => a.id === addon.id);
      if (exists) {
        return prev.filter((a) => a.id !== addon.id);
      } else {
        return [...prev, { id: addon.id, addon_name: addon.addon_name, price: parseFloat(addon.price || 0), qty: 1 }];
      }
    });
  };
  const updateAddonQty = (addonId, delta) => {
    setSelectedCustomAddons(
      (prev) => prev.map((a) => {
        if (a.id === addonId) {
          const newQty = (a.qty || 1) + delta;
          return newQty > 0 ? { ...a, qty: newQty } : null;
        }
        return a;
      }).filter(Boolean)
    );
  };
  const computedCustomUnitPrice = useMemo(() => {
    if (!customizingProduct) return 0;
    const base = parseFloat(customizingProduct.selling_price || customizingProduct.unit_price || 0);
    const addonsSum = selectedCustomAddons.reduce(
      (sum, a) => sum + parseFloat(a.price || 0) * (a.qty || 1),
      0
    );
    return base + addonsSum;
  }, [customizingProduct, selectedCustomAddons]);
  const handleAddCustomizedToCart = () => {
    if (!customizingProduct) return;
    addToCart(customizingProduct, selectedCustomAddons, customItemQty);
    setCustomizeModalOpen(false);
    message.success(`Added ${customizingProduct.product_name} with customizations`);
  };
  const handleAddPlainToCart = () => {
    if (!customizingProduct) return;
    addToCart(customizingProduct, [], customItemQty);
    setCustomizeModalOpen(false);
    message.success(`Added ${customizingProduct.product_name}`);
  };
  const clearCart = () => {
    setCart([]);
  };
  const totalItemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = cart.reduce((sum, item) => sum + item.price * item.qty * (item.tax_rate / 100), 0);
  const total = subtotal + tax;
  const readyOrdersCount = kitchenOrders.filter((o) => o.kot_status === "ready").length;
  const handleCustSearch = async (query) => {
    setCustSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setCustSuggestions([]);
      return;
    }
    try {
      const res = await customerService.getAllCustomers({ search: query.trim(), limit: 5 });
      const rows = res?.data?.data ?? res?.data ?? [];
      setCustSuggestions(Array.isArray(rows) ? rows : rows?.data ?? []);
    } catch {
      setCustSuggestions([]);
    }
  };
  const selectCustomer = (cust) => {
    setCustomerName(cust.customer_name || cust.name || `${cust.first_name || ""} ${cust.last_name || ""}`.trim());
    setCustomerPhone(cust.customer_phone || cust.phone || "");
    setCustomerModalOpen(false);
  };
  const clearCustomer = () => {
    setCustomerName("");
    setCustomerPhone("");
  };
  const handleBarcodeSubmit = (e) => {
    if (e) e.preventDefault();
    if (!manualBarcode.trim()) return;
    const found = allItems.find(
      (item) => item.product_code === manualBarcode.trim() || item.barcode === manualBarcode.trim()
    );
    if (found) {
      addToCart(found);
      message.success(`Added ${found.product_name} to order`);
      setManualBarcode("");
      setScanModalOpen(false);
    } else {
      message.warning(`No product found with code "${manualBarcode}"`);
    }
  };
  const ALL_TABLES = useMemo(() => {
    if (tables.length === 0) {
      return [
        "Table 1",
        "Table 2",
        "Table 3",
        "Table 4",
        "Table 5",
        "Table 6",
        "Table 7",
        "Table 8",
        "Table 9",
        "Table 10",
        "Counter 1",
        "Counter 2",
        "Takeaway"
      ];
    }
    const list = tables.map((t) => formatTableLabel(t.table_name || t.table_no)).filter(Boolean);
    return list.sort(
      (a, b) => a.localeCompare(b, void 0, { numeric: true, sensitivity: "base" })
    );
  }, [tables]);
  const activeTableMap = useMemo(() => {
    const map = {};
    kitchenOrders.forEach((order) => {
      let rawTbl = order.table_no;
      if (!rawTbl && order.counter_no) {
        rawTbl = order.counter_no.startsWith("Counter ") ? order.counter_no.replace("Counter ", "Table ") : order.counter_no;
      }
      const tbl = formatTableLabel(rawTbl || "Table 1");
      if (!map[tbl]) map[tbl] = [];
      map[tbl].push(order);
    });
    return map;
  }, [kitchenOrders]);
  const activeTablesCount = Object.keys(activeTableMap).length;
  const currentLoadedOrder = useMemo(() => {
    if (!loadedBillId) return null;
    return kitchenOrders.find((o) => o.id === loadedBillId) || null;
  }, [loadedBillId, kitchenOrders]);
  const handleSelectTable = (tbl) => {
    const formattedTbl = formatTableLabel(tbl);
    setTableNo(formattedTbl);
    const selectedTblObj = tables.find((t) => formatTableLabel(t.table_name || t.table_no) === formattedTbl || t.table_name === tbl || t.table_no === tbl);
    setSelectedTableId(selectedTblObj ? selectedTblObj.id : null);
    const existingOrders = activeTableMap[tbl];
    if (existingOrders && existingOrders.length > 0) {
      loadBillIntoCart(existingOrders[0]);
    } else {
      setLoadedBillId(null);
      setCart([]);
      clearCustomer();
    }
    setTablesModalOpen(false);
  };
  const mapOrderItemsToCart = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map((i) => {
      const prodId = i.product_id || i.product?.id || i.id;
      const matchedProduct = allItems.find(
        (p) => p.id === prodId || p.product_name && (i.product_name || i.product?.product_name) && p.product_name.trim().toLowerCase() === (i.product_name || i.product?.product_name || "").trim().toLowerCase()
      );
      const parsedPrice = parseFloat(
        i.unit_price ?? i.price ?? i.product?.selling_price ?? matchedProduct?.selling_price ?? matchedProduct?.unit_price ?? 0
      );
      const parsedTax = parseFloat(
        i.tax_percentage ?? i.tax_rate ?? i.product?.tax_percentage ?? matchedProduct?.tax_percentage ?? 0
      );
      const itemAddons = Array.isArray(i.addons) ? i.addons : [];
      const cartKey = getCartItemKey(prodId || matchedProduct?.id, itemAddons);
      return {
        cart_key: cartKey,
        id: prodId || matchedProduct?.id || `item-${Date.now()}-${Math.random()}`,
        name: i.product_name || i.product?.product_name || matchedProduct?.product_name || "Item",
        category_name: i.category_name || matchedProduct?.category_name || "Item",
        image_url: i.image_url || i.product?.image_url || matchedProduct?.image_url || null,
        base_price: parseFloat(matchedProduct?.selling_price || parsedPrice),
        addons: itemAddons,
        price: isNaN(parsedPrice) ? 0 : parsedPrice,
        qty: parseInt(i.quantity || i.qty || 1, 10),
        tax_rate: isNaN(parsedTax) ? 0 : parsedTax
      };
    });
  };
  const loadBillIntoCart = async (order) => {
    if (!order) return;
    setLoadedBillId(order.id);
    const tbl = order.table_no || (order.counter_no ? order.counter_no.replace("Counter ", "Table ") : "Table 1");
    setTableNo(tbl);
    if (order.customer_name) setCustomerName(order.customer_name);
    if (order.customer_phone) setCustomerPhone(order.customer_phone);
    if (Array.isArray(order.items) && order.items.length > 0) {
      setCart(mapOrderItemsToCart(order.items));
    }
    setTablesModalOpen(false);
    message.success(`Loaded active order for ${tbl}`);
    if (order.id) {
      try {
        const res = await billingService.getById(order.id);
        const fullBill = res?.data?.data ?? res?.data ?? res;
        if (fullBill) {
          if (fullBill.customer_name) setCustomerName(fullBill.customer_name);
          if (fullBill.customer_phone) setCustomerPhone(fullBill.customer_phone);
          if (Array.isArray(fullBill.items) && fullBill.items.length > 0) {
            setCart(mapOrderItemsToCart(fullBill.items));
          }
        }
      } catch (err) {
        console.warn("Could not refresh full bill details:", err);
      }
    }
  };
  const handleStartFreshOrder = () => {
    setLoadedBillId(null);
    setCart([]);
    clearCustomer();
    message.info(`Ready for new order on ${tableNo}`);
  };
  const handleOpenPayment = async (targetOrder = null) => {
    let orderToLoad = targetOrder;
    let targetTotal = total;
    if (orderToLoad) {
      loadBillIntoCart(orderToLoad);
      const parsedTotal = parseFloat(orderToLoad.total_amount);
      if (!isNaN(parsedTotal) && parsedTotal > 0) {
        targetTotal = parsedTotal;
      } else if (Array.isArray(orderToLoad.items)) {
        const mapped = mapOrderItemsToCart(orderToLoad.items);
        const st = mapped.reduce((sum, item) => sum + item.price * item.qty, 0);
        const tx = mapped.reduce((sum, item) => sum + item.price * item.qty * (item.tax_rate / 100), 0);
        targetTotal = st + tx;
      }
    }
    if (cart.length === 0 && !targetOrder) {
      message.warning("Cart is empty! Select an active table or add items first.");
      return;
    }
    setPaymentMethod("cash");
    setDiscountAmount(0);
    setTenderedAmount(targetTotal.toString());
    setSplitPayments([
      { method: "cash", amount: Math.floor(targetTotal / 2) },
      { method: "UPI Current Account", amount: targetTotal - Math.floor(targetTotal / 2) }
    ]);
    setPaymentModalOpen(true);
  };
  const handleConfirmSettlement = async (shouldPrint = true) => {
    if (cart.length === 0) return;
    setSettlingPayment(true);
    try {
      const discount = parseFloat(discountAmount) || 0;
      const finalTotal = Math.max(0, total - discount);
      let splitPayload = null;
      if (paymentMethod === "split") {
        const splitSum = splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        if (Math.abs(splitSum - finalTotal) > 0.5) {
          message.error(`Split amounts sum (\u20B9${splitSum}) must equal final total (\u20B9${finalTotal})`);
          setSettlingPayment(false);
          return;
        }
        splitPayload = splitPayments.map((p) => ({
          method: p.method,
          amount: parseFloat(p.amount) || 0,
          reference_no: p.reference_no || null
        }));
      }
      let settledBillData = null;
      const billId = loadedBillId || editId;
      if (billId) {
        const updatePayload = {
          branch_id: effectiveBranchId,
          customer_name: customerName.trim() || "Walk-in Customer",
          customer_phone: customerPhone.trim() || "9999999999",
          payment_method: paymentMethod,
          payment_details: splitPayload,
          status: "paid",
          paid_amount: finalTotal,
          due_amount: 0,
          discount_amount: discount,
          total_amount: finalTotal,
          table_id: selectedTableId,
          order_type: orderType,
          notes: `Order Type: ${orderType} | Table: ${tableNo}`,
          billing_items: cart.map((item) => ({
            product_id: item.id,
            product_name: item.name,
            quantity: item.qty,
            unit_price: item.price,
            discount_amount: 0,
            tax_percentage: item.tax_rate,
            tax_amount: item.price * item.qty * (item.tax_rate / 100),
            total_price: item.price * item.qty * (1 + item.tax_rate / 100),
            addons: item.addons || []
          }))
        };
        const res = await billingService.update(billId, updatePayload);
        settledBillData = res?.data || { id: billId, ...updatePayload };
        message.success("\u{1F4B3} Bill Paid & Settled Successfully!");
      } else {
        const createPayload = {
          branch_id: effectiveBranchId,
          customer_name: customerName.trim() || "Walk-in Customer",
          customer_phone: customerPhone.trim() || "9999999999",
          type: "Casier Billing",
          counter_no: tableNo ? tableNo.replace("Table ", "Counter ") : "Counter 1",
          billing_date: (/* @__PURE__ */ new Date()).toISOString(),
          subtotal_amount: subtotal,
          tax_amount: tax,
          discount_amount: discount,
          total_amount: finalTotal,
          paid_amount: finalTotal,
          due_amount: 0,
          payment_method: paymentMethod,
          payment_details: splitPayload,
          status: "paid",
          table_id: selectedTableId,
          order_type: orderType,
          notes: `Order Type: ${orderType} | Table: ${tableNo}`,
          billing_items: cart.map((item) => ({
            product_id: item.id,
            product_name: item.name,
            quantity: item.qty,
            unit_price: item.price,
            discount_amount: 0,
            tax_percentage: item.tax_rate,
            tax_amount: item.price * item.qty * (item.tax_rate / 100),
            total_price: item.price * item.qty * (1 + item.tax_rate / 100),
            addons: item.addons || []
          }))
        };
        const res = await billingService.create(createPayload);
        settledBillData = res?.data || createPayload;
        message.success("\u{1F4B3} Payment received & Bill created!");
      }
      broadcastKOTEvent("KOT_STATUS_UPDATED");
      if (shouldPrint && settledBillData) {
        try {
          await localPrintService.printReceiptLocally(settledBillData);
        } catch (err) {
          console.warn("Local printer not available, opening customer copy preview:", err);
          if (settledBillData.id) {
            window.open(`/billing/customer-copy/${settledBillData.id}`, "_blank");
          }
        }
      }
      setSettledSuccessData(settledBillData);
      setPaymentModalOpen(false);
      setCart([]);
      clearCustomer();
      setLoadedBillId(null);
      fetchKitchenQueue();
    } catch (err) {
      console.error("Payment settlement error:", err);
      message.error(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to settle payment");
    } finally {
      setSettlingPayment(false);
    }
  };
  const handleCreateKOT = async () => {
    if (cart.length === 0) {
      message.warning("Order is empty! Please select products.");
      return;
    }
    setSubmittingKOT(true);
    try {
      const payload = {
        branch_id: effectiveBranchId,
        customer_name: customerName.trim() || "Walk-in Customer",
        customer_phone: customerPhone.trim() || "9999999999",
        type: "Casier Billing",
        counter_no: tableNo ? tableNo.replace("Table ", "Counter ") : "Counter 1",
        billing_date: (/* @__PURE__ */ new Date()).toISOString(),
        subtotal_amount: subtotal,
        tax_amount: tax,
        discount_amount: 0,
        total_amount: total,
        paid_amount: 0,
        due_amount: total,
        payment_method: "cash",
        status: "pending",
        table_id: selectedTableId,
        order_type: orderType,
        notes: `Order Type: ${orderType} | Table: ${tableNo}`,
        billing_items: cart.map((item) => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.qty,
          unit_price: item.price,
          discount_amount: 0,
          tax_percentage: item.tax_rate,
          tax_amount: item.price * item.qty * (item.tax_rate / 100),
          total_price: item.price * item.qty * (1 + item.tax_rate / 100),
          addons: item.addons || []
        }))
      };
      const billId = loadedBillId || editId;
      if (billId) {
        await billingService.update(billId, payload);
        message.success("KOT order updated successfully!");
      } else {
        await billingService.create(payload);
        message.success("\u{1F389} KOT Created! Order sent directly to Kitchen.");
      }
      broadcastKOTEvent("NEW_KOT_ORDER");
      const isKitchen = (user?.role_name || userRole || user?.role || "").toLowerCase().includes("kitchen") || window.location.pathname.includes("/billing/kitchen");
      if (soundEnabled && isKitchen) {
        playSoundAlert();
      }
      setCart([]);
      clearCustomer();
      setLoadedBillId(null);
      setMobileCartOpen(false);
      fetchKitchenQueue();
    } catch (err) {
      console.error("Failed to create KOT:", err);
      message.error(err?.response?.data?.message || err?.message || "Failed to create KOT order");
    } finally {
      setSubmittingKOT(false);
    }
  };
  const branchMenuItems = useMemo(() => {
    if (!branches || branches.length === 0) {
      return [
        {
          key: "single-branch",
          disabled: true,
          label: /* @__PURE__ */ React.createElement("div", { className: "py-1 px-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-700 block" }, effectiveBranchName), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-slate-400" }, "Only 1 branch assigned"))
        }
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
            clearCustomer();
          }
        },
        label: /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 py-1.5 px-1 min-w-[210px]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
          "div",
          {
            className: `w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isCurrent ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`
          },
          /* @__PURE__ */ React.createElement(Store, { size: 14 })
        ), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement(
          "p",
          {
            className: `text-xs font-bold leading-tight mb-0 truncate max-w-[150px] ${isCurrent ? "text-emerald-700 font-black" : "text-slate-800"}`
          },
          bName
        ), bCode && /* @__PURE__ */ React.createElement("p", { className: "text-[10px] text-slate-400 mb-0 font-medium" }, "Code: ", bCode))), isCurrent && /* @__PURE__ */ React.createElement("span", { className: "w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Check, { size: 12, strokeWidth: 3 })))
      };
    });
  }, [branches, effectiveBranchId, effectiveBranchName, changeBranch]);
  const userMenuItems = [
    {
      key: "user-info",
      disabled: true,
      label: /* @__PURE__ */ React.createElement("div", { className: "py-1 px-1" }, /* @__PURE__ */ React.createElement("p", { className: "font-bold text-slate-800 text-sm mb-0" }, user?.username || "Staff"), /* @__PURE__ */ React.createElement("p", { className: "text-[11px] text-slate-500 uppercase tracking-wider mb-0 font-medium" }, user?.role?.role_name || user?.role_name || "Staff"))
    },
    { type: "divider" },
    {
      key: "switch-branch",
      icon: /* @__PURE__ */ React.createElement(Store, { size: 16, className: "text-emerald-600" }),
      label: `Switch Branch (${effectiveBranchName})`,
      children: branches && branches.length > 0 ? branchMenuItems : void 0
    },
    {
      key: "daily-stock",
      icon: /* @__PURE__ */ React.createElement(ClipboardList, { size: 16, className: "text-indigo-600" }),
      label: "Daily Stock & Inventory",
      onClick: () => setDailyStockModalOpen(true)
    },
    {
      key: "tables",
      icon: /* @__PURE__ */ React.createElement(Armchair, { size: 16, className: "text-amber-600" }),
      label: `Tables (${tableNo})`,
      onClick: () => setTablesModalOpen(true)
    },
    {
      key: "billing-list",
      icon: /* @__PURE__ */ React.createElement(Receipt, { size: 16, className: "text-emerald-600" }),
      label: "Billing & Order List",
      onClick: () => navigate("/billing/list")
    },
    {
      key: "waiter-service",
      icon: /* @__PURE__ */ React.createElement(UtensilsCrossed, { size: 16, className: "text-teal-600" }),
      label: "Waiter Handheld Service",
      onClick: () => navigate("/billing/waiter")
    },
    {
      key: "kitchen",
      icon: /* @__PURE__ */ React.createElement(UtensilsCrossed, { size: 16, className: "text-rose-600" }),
      label: "Kitchen KOT Display",
      onClick: () => navigate("/billing/kitchen")
    },
    { type: "divider" },
    {
      key: "logout",
      danger: true,
      icon: /* @__PURE__ */ React.createElement(ArrowRight, { size: 16 }),
      label: "Exit POS",
      onClick: () => navigate("/billing/list")
    }
  ];
  return /* @__PURE__ */ React.createElement("div", { className: "h-screen w-full bg-[#F8FAFC] flex flex-col overflow-hidden font-sans select-none" }, /* @__PURE__ */ React.createElement("header", { className: "h-13 sm:h-16 bg-white border-b border-slate-200/90 px-2 sm:px-4 md:px-6 flex items-center justify-between shrink-0 z-20 gap-1.5 sm:gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 sm:gap-2 min-w-0 shrink" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => navigate("/billing/list"),
      "aria-label": "Back to Billing List",
      title: "Back to Orders List",
      className: "h-8 sm:h-10 px-2 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 flex items-center justify-center gap-1.5 text-slate-700 transition cursor-pointer shrink-0 border border-slate-200/80 shadow-2xs group"
    },
    /* @__PURE__ */ React.createElement(ArrowLeft, { size: 17, className: "sm:w-5 sm:h-5 group-hover:-translate-x-0.5 transition-transform" }),
    /* @__PURE__ */ React.createElement("span", { className: "hidden md:inline text-xs font-bold text-slate-700" }, "Orders")
  ), /* @__PURE__ */ React.createElement(
    Dropdown,
    {
      menu: { items: branchMenuItems },
      trigger: ["click"],
      placement: "bottomLeft"
    },
    /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 h-8 sm:h-10 rounded-xl border border-slate-200/90 bg-slate-50/90 hover:bg-slate-100 hover:border-slate-300 active:scale-[0.98] text-slate-800 transition cursor-pointer select-none group shrink-0 shadow-2xs",
        title: "Click to switch branch"
      },
      /* @__PURE__ */ React.createElement("div", { className: "w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-600 flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Store, { size: 12, className: "sm:w-4 sm:h-4" })),
      /* @__PURE__ */ React.createElement("div", { className: "text-left min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: "text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:block leading-none" }, "Branch"), /* @__PURE__ */ React.createElement("span", { className: "text-xs sm:text-sm font-black text-slate-800 truncate block leading-tight max-w-[65px] xs:max-w-[85px] sm:max-w-[150px] md:max-w-[200px]" }, effectiveBranchName)),
      /* @__PURE__ */ React.createElement(
        ChevronDown,
        {
          size: 12,
          className: "text-slate-400 group-hover:text-slate-700 transition shrink-0 ml-0.5"
        }
      )
    )
  )), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setTablesModalOpen(true),
      className: `h-8 sm:h-9 px-1.5 sm:px-3 rounded-xl border font-bold text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 transition cursor-pointer shadow-xs shrink-0 ${activeTablesCount > 0 ? "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`
    },
    /* @__PURE__ */ React.createElement(Table, { size: 13, className: activeTablesCount > 0 ? "text-amber-600 shrink-0" : "text-slate-500 shrink-0" }),
    /* @__PURE__ */ React.createElement("span", { className: "truncate max-w-[55px] sm:max-w-none text-[11px] sm:text-xs md:text-sm" }, formatTableLabel(tableNo)),
    activeTablesCount > 0 && /* @__PURE__ */ React.createElement("span", { className: "px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded-full bg-amber-500 text-white text-[8px] sm:text-[9px] font-black leading-none animate-pulse" }, activeTablesCount),
    /* @__PURE__ */ React.createElement(ChevronDown, { size: 11, className: "text-slate-400 shrink-0" })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setDailyStockModalOpen(true),
      className: "h-8 sm:h-9 w-8 sm:w-auto px-0 sm:px-3 rounded-xl border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-indigo-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs shrink-0",
      title: "Daily Stock: Morning purchase arrivals & evening closing count"
    },
    /* @__PURE__ */ React.createElement(ClipboardList, { size: 14, className: "text-indigo-600 shrink-0" }),
    /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline" }, "Daily Stock")
  ), /* @__PURE__ */ React.createElement("div", { className: "hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50/80 px-2.5 py-1 rounded-full border border-emerald-100 shrink-0" }, /* @__PURE__ */ React.createElement("span", { className: "w-2 h-2 rounded-full bg-emerald-500 animate-pulse" }), /* @__PURE__ */ React.createElement("span", null, "Online")), /* @__PURE__ */ React.createElement("div", { className: "hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-medium shrink-0" }, /* @__PURE__ */ React.createElement(Clock, { size: 14, className: "text-slate-400" }), /* @__PURE__ */ React.createElement("span", null, dayjs(currentTime).format("DD MMM YYYY  hh:mm A"))), /* @__PURE__ */ React.createElement(Dropdown, { menu: { items: userMenuItems }, placement: "bottomRight", trigger: ["click"] }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      className: "h-8 sm:h-9 flex items-center gap-1 sm:gap-2 pl-0.5 sm:pl-2 sm:border-l sm:border-slate-200 cursor-pointer group bg-transparent border-0 outline-none shrink-0",
      title: "User profile & shortcuts"
    },
    /* @__PURE__ */ React.createElement("div", { className: "w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#1E293B] group-hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold shrink-0 transition shadow-xs" }, /* @__PURE__ */ React.createElement(User, { size: 13, className: "sm:w-3.5 sm:h-3.5" })),
    /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold text-slate-800 hidden sm:inline truncate max-w-[80px]" }, user?.username || "Staff")
  )))), /* @__PURE__ */ React.createElement("div", { className: "flex-1 flex overflow-hidden min-h-0 p-2.5 sm:p-3 md:p-4 gap-3 md:gap-4" }, /* @__PURE__ */ React.createElement("div", { className: "hidden md:flex w-[330px] lg:w-[370px] xl:w-[410px] bg-white rounded-2xl border border-slate-200/90 shadow-sm flex-col overflow-hidden shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "px-4 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 min-w-0" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setTablesModalOpen(true),
      className: "px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-800 flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shadow-sm"
    },
    /* @__PURE__ */ React.createElement(Table, { size: 14, className: "text-blue-600 shrink-0" }),
    /* @__PURE__ */ React.createElement("span", { className: "truncate" }, formatTableLabel(tableNo)),
    /* @__PURE__ */ React.createElement(ChevronDown, { size: 12, className: "text-slate-400" })
  ), loadedBillId && currentLoadedOrder && /* @__PURE__ */ React.createElement(
    Tag,
    {
      color: currentLoadedOrder.kot_status === "ready" ? "success" : currentLoadedOrder.kot_status === "preparing" ? "warning" : currentLoadedOrder.kot_status === "served" ? "purple" : "error",
      className: "font-bold text-[10px] rounded-md m-0 truncate"
    },
    currentLoadedOrder.kot_number ? `KOT #${currentLoadedOrder.kot_number}` : currentLoadedOrder.billing_no
  )), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 shrink-0" }, loadedBillId ? /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: handleStartFreshOrder,
      className: "text-[11px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded-md cursor-pointer transition"
    },
    "+ New Bill"
  ) : /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: clearCart,
      disabled: cart.length === 0,
      className: "text-[11px] font-bold text-slate-500 hover:text-red-600 px-2 py-1 rounded-md disabled:opacity-40 cursor-pointer transition"
    },
    "Clear"
  ))), /* @__PURE__ */ React.createElement("div", { className: "px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0 bg-white" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 text-xs" }, /* @__PURE__ */ React.createElement(User, { size: 14 })), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-700 truncate" }, customerName || "Walk-in Customer")), customerName ? /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: clearCustomer,
      className: "text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 cursor-pointer"
    },
    "Reset"
  ) : /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setCustomerModalOpen(true),
      className: "min-h-[32px] px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
    },
    /* @__PURE__ */ React.createElement(Plus, { size: 13 }),
    " Add"
  )), /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto p-3.5 space-y-2.5 min-h-0 divide-y divide-slate-100" }, cart.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-2.5 text-slate-300" }, /* @__PURE__ */ React.createElement(Utensils, { size: 26 })), /* @__PURE__ */ React.createElement("p", { className: "text-sm font-bold text-slate-600" }, "No items in cart"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400 mt-0.5" }, "Select a table or tap items on catalogue to add")) : cart.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.cart_key || item.id, className: "pt-2 first:pt-0 flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "w-11 h-11 rounded-full overflow-hidden border border-slate-100 shrink-0 bg-slate-50 flex items-center justify-center" }, /* @__PURE__ */ React.createElement(
    FoodThumbnail,
    {
      src: item.image_url,
      alt: item.name,
      categoryName: item.category_name,
      fallbackSize: "sm"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs md:text-sm font-bold text-slate-800 truncate leading-tight" }, item.name), item.addons && item.addons.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1 mt-1" }, item.addons.map((ad, idx) => /* @__PURE__ */ React.createElement(
    "span",
    {
      key: idx,
      className: "inline-flex items-center text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100"
    },
    "+ ",
    ad.addon_name || ad.name,
    " (",
    fmt(ad.price),
    ")"
  ))), /* @__PURE__ */ React.createElement("p", { className: "text-xs font-bold text-emerald-600 mt-0.5" }, fmt(item.price))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center border border-slate-200 rounded-lg bg-white shrink-0 overflow-hidden shadow-sm" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => updateQty(item.cart_key || item.id, -1),
      "aria-label": "Decrease quantity",
      className: "min-w-[28px] min-h-[28px] flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
    },
    /* @__PURE__ */ React.createElement(Minus, { size: 13, strokeWidth: 2.5 })
  ), /* @__PURE__ */ React.createElement("span", { className: "w-7 text-center text-xs font-bold text-slate-800 select-none" }, item.qty), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => updateQty(item.cart_key || item.id, 1),
      "aria-label": "Increase quantity",
      className: "min-w-[28px] min-h-[28px] flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
    },
    /* @__PURE__ */ React.createElement(Plus, { size: 13, strokeWidth: 2.5 })
  )), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0 min-w-[60px]" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs md:text-sm font-bold text-slate-900" }, fmt(item.price * item.qty))), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => removeItem(item.cart_key || item.id),
      "aria-label": "Remove item",
      className: "w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 transition cursor-pointer"
    },
    /* @__PURE__ */ React.createElement(X, { size: 16 })
  )))), /* @__PURE__ */ React.createElement("div", { className: "p-4 border-t border-slate-200/90 bg-white space-y-2 shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs text-slate-500 font-medium" }, /* @__PURE__ */ React.createElement("span", null, "Items"), /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-700" }, totalItemCount)), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs text-slate-500 font-medium" }, /* @__PURE__ */ React.createElement("span", null, "Subtotal"), /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-700" }, fmt(subtotal))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs text-slate-500 font-medium" }, /* @__PURE__ */ React.createElement("span", null, "Tax"), /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-700" }, fmt(tax))), /* @__PURE__ */ React.createElement("div", { className: "pt-1.5 border-t border-slate-100 flex justify-between items-baseline" }, /* @__PURE__ */ React.createElement("span", { className: "text-base font-bold text-slate-800" }, "Total"), /* @__PURE__ */ React.createElement("span", { className: "text-2xl font-black text-emerald-600" }, fmt(total))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 pt-1" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: handleCreateKOT,
      disabled: submittingKOT || cart.length === 0,
      className: "min-h-[52px] py-2 px-2.5 bg-[#F97316] hover:bg-[#EA580C] active:scale-[0.99] !text-white rounded-xl flex flex-col items-center justify-center shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    },
    /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(Printer, { size: 17, strokeWidth: 2.4 }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-black uppercase tracking-tight" }, submittingKOT ? "Sending..." : loadedBillId ? "Update KOT" : "Create KOT")),
    /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-orange-100 font-medium leading-none mt-0.5" }, "Send to Kitchen")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => handleOpenPayment(),
      disabled: cart.length === 0,
      className: "min-h-[52px] py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] !text-white rounded-xl flex flex-col items-center justify-center shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    },
    /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(CreditCard, { size: 17, strokeWidth: 2.4 }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-black uppercase tracking-tight" }, "Pay & Settle")),
    /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-emerald-100 font-bold leading-none mt-0.5" }, fmt(total))
  )))), /* @__PURE__ */ React.createElement("div", { className: "flex-1 flex flex-col overflow-hidden min-h-0 gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "relative flex-1" }, /* @__PURE__ */ React.createElement(
    Search,
    {
      size: 18,
      className: "absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
    }
  ), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      value: searchTerm,
      onChange: (e) => setSearchTerm(e.target.value),
      placeholder: "Search product...",
      className: "w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
    }
  ), searchTerm && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSearchTerm(""),
      className: "absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
    },
    /* @__PURE__ */ React.createElement(X, { size: 16 })
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setScanModalOpen(true),
      className: "min-h-[48px] px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2 transition cursor-pointer shadow-sm shrink-0"
    },
    /* @__PURE__ */ React.createElement(ScanLine, { size: 18, className: "text-slate-600" }),
    /* @__PURE__ */ React.createElement("span", null, "Scan")
  )), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 overflow-x-auto py-1 shrink-0 scrollbar-none snap-x snap-mandatory scroll-smooth" }, categoryTabs.map((tab) => {
    const isActive = activeCategory === tab.key;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: tab.key,
        onClick: () => setActiveCategory(tab.key),
        className: `snap-start min-w-[78px] sm:min-w-[88px] md:min-w-[96px] min-h-[54px] py-1.5 px-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer select-none shrink-0 ${tab.key === "all" ? isActive ? "bg-blue-600 !text-white shadow-md shadow-blue-500/20 scale-[1.02]" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50" : isActive ? `${tab.bg} ring-2 ring-blue-500 shadow-sm scale-[1.02]` : `${tab.bg} hover:brightness-95 border border-transparent`}`
      },
      /* @__PURE__ */ React.createElement("div", { className: "shrink-0" }, tab.icon),
      /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold capitalize truncate max-w-[85px]" }, tab.label)
    );
  })), /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto min-h-0 pr-1" }, loadingProducts ? /* @__PURE__ */ React.createElement("div", { className: "h-64 flex flex-col items-center justify-center text-slate-400" }, /* @__PURE__ */ React.createElement("div", { className: "w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" }), /* @__PURE__ */ React.createElement("p", { className: "text-sm font-semibold" }, "Loading catalogue...")) : filteredItems.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "h-64 flex flex-col items-center justify-center text-slate-400" }, /* @__PURE__ */ React.createElement(Utensils, { size: 36, className: "text-slate-300 mb-2" }), /* @__PURE__ */ React.createElement("p", { className: "text-sm font-bold text-slate-600" }, "No products found"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400" }, "Try selecting another category or clear search")) : /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-3.5 pb-24 md:pb-4" }, filteredItems.map((item) => {
    const hasAddons = item.addons && item.addons.length > 0;
    const inCartCount = cart.filter((c) => c.id === item.id).reduce((s, c) => s + c.qty, 0);
    const price = parseFloat(item.selling_price || item.unit_price || 0);
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: item.id,
        onClick: () => handleProductClick(item),
        className: `bg-white rounded-2xl border !pb-2 p-3.5 flex flex-col items-center justify-between cursor-pointer relative select-none transition-all duration-150 shadow-xs hover:shadow-md hover:border-slate-300 active:scale-[0.96] ${inCartCount > 0 ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200/80"}`
      },
      /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-full bg-emerald-500 absolute top-3.5 right-3.5" }),
      /* @__PURE__ */ React.createElement("div", { className: "w-20 h-20 sm:w-24 sm:h-24 md:w-24 md:h-24 rounded-full overflow-hidden flex items-center justify-center my-1.5 p-1 group-hover:scale-105 transition-transform duration-200" }, /* @__PURE__ */ React.createElement(
        FoodThumbnail,
        {
          src: item.image_url,
          alt: item.product_name,
          categoryName: item.category_name,
          fallbackSize: "lg"
        }
      )),
      /* @__PURE__ */ React.createElement("div", { className: "w-full text-center mt-1" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xs sm:text-sm font-bold text-slate-800 leading-tight truncate" }, item.product_name), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-center gap-1.5 mt-1 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs sm:text-sm font-bold text-emerald-600" }, fmt(price)), hasAddons && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5" }, /* @__PURE__ */ React.createElement(Sparkles, { size: 10 }), " +Customise"))),
      inCartCount > 0 && /* @__PURE__ */ React.createElement("div", { className: "absolute top-2.5 left-2.5 bg-emerald-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs" }, inCartCount)
    );
  }))), /* @__PURE__ */ React.createElement("div", { className: "hidden md:flex items-center justify-between pt-2 border-t border-slate-200/80 shrink-0" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setKotDrawerOpen(true),
      className: "min-h-[46px] px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
    },
    /* @__PURE__ */ React.createElement(ClipboardList, { size: 18, className: "text-slate-600" }),
    /* @__PURE__ */ React.createElement("span", null, "View KOTs"),
    readyOrdersCount > 0 && /* @__PURE__ */ React.createElement("span", { className: "ml-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-black animate-pulse flex items-center gap-1" }, /* @__PURE__ */ React.createElement(UtensilsCrossed, { size: 12 }), " ", readyOrdersCount, " Ready")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSettingsOpen(true),
      className: "min-h-[46px] px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
    },
    /* @__PURE__ */ React.createElement(Settings, { size: 18, className: "text-slate-600" }),
    /* @__PURE__ */ React.createElement("span", null, "Settings")
  )))), /* @__PURE__ */ React.createElement("div", { className: "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2" }, readyOrdersCount > 0 && /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: () => setKotDrawerOpen(true),
      className: "bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-xl flex items-center justify-between cursor-pointer animate-pulse"
    },
    /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(UtensilsCrossed, { size: 14 }), " ", readyOrdersCount, " Order(s) Ready to Serve!"),
    /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-bold flex items-center gap-1" }, /* @__PURE__ */ React.createElement("span", null, "View & Serve"), /* @__PURE__ */ React.createElement(ArrowRight, { size: 12, className: "shrink-0" }))
  ), /* @__PURE__ */ React.createElement(
    "div",
    {
      onClick: () => setMobileCartOpen(true),
      className: "flex items-center justify-between px-3 py-1 cursor-pointer active:scale-[0.99] transition-transform"
    },
    /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-slate-800" }, /* @__PURE__ */ React.createElement(Utensils, { size: 18, className: "text-orange-500" }), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black" }, totalItemCount, " ", totalItemCount === 1 ? "item" : "items")),
    /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-base font-black text-emerald-600" }, fmt(total)), /* @__PURE__ */ React.createElement(ChevronUp, { size: 18, className: "text-slate-400" }))
  ), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: handleCreateKOT,
      disabled: submittingKOT || cart.length === 0,
      className: "min-h-[48px] py-2.5 px-3 bg-[#F97316] hover:bg-[#EA580C] active:scale-[0.98] !text-white rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-black text-xs uppercase"
    },
    /* @__PURE__ */ React.createElement(Printer, { size: 18, strokeWidth: 2.2 }),
    /* @__PURE__ */ React.createElement("span", { className: "tracking-tight leading-tight" }, submittingKOT ? "Sending..." : loadedBillId ? "Update KOT" : "Create KOT")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => handleOpenPayment(),
      disabled: cart.length === 0,
      className: "min-h-[48px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] !text-white rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-black text-xs uppercase"
    },
    /* @__PURE__ */ React.createElement(CreditCard, { size: 18, strokeWidth: 2.2 }),
    /* @__PURE__ */ React.createElement("span", { className: "tracking-tight leading-tight" }, "Pay & Settle")
  ))), /* @__PURE__ */ React.createElement(
    Drawer,
    {
      placement: "bottom",
      height: "84vh",
      onClose: () => setMobileCartOpen(false),
      open: mobileCartOpen,
      title: /* @__PURE__ */ React.createElement("div", { className: "w-full" }, /* @__PURE__ */ React.createElement("div", { className: "w-12 h-1 bg-slate-300 rounded-full mx-auto -mt-1 mb-2" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between w-full" }, /* @__PURE__ */ React.createElement("h2", { className: "text-base font-bold text-slate-800" }, "Current Order (", tableNo, ")"), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: clearCart,
          disabled: cart.length === 0,
          className: "text-xs text-red-500 font-bold px-2 py-1 cursor-pointer"
        },
        "Clear"
      )))
    },
    /* @__PURE__ */ React.createElement("div", { className: "flex flex-col h-full" }, /* @__PURE__ */ React.createElement("div", { className: "p-3 bg-slate-50 rounded-xl border border-slate-200 mb-3 flex justify-between items-center" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(User, { size: 16, className: "text-slate-500" }), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-700" }, customerName || "Walk-in Customer")), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          setMobileCartOpen(false);
          setCustomerModalOpen(true);
        },
        className: "text-xs text-blue-600 font-bold"
      },
      customerName ? "Change" : "+ Add"
    )), /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto space-y-3 min-h-0 divide-y divide-slate-100" }, cart.map((item) => /* @__PURE__ */ React.createElement("div", { key: item.cart_key || item.id, className: "pt-2.5 flex items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs font-bold text-slate-800 truncate" }, item.name), item.addons && item.addons.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1 mt-0.5" }, item.addons.map((ad, idx) => /* @__PURE__ */ React.createElement(
      "span",
      {
        key: idx,
        className: "inline-flex items-center text-[9px] font-semibold bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded border border-indigo-100"
      },
      "+ ",
      ad.addon_name || ad.name
    ))), /* @__PURE__ */ React.createElement("p", { className: "text-xs font-semibold text-emerald-600" }, fmt(item.price))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center border border-slate-200 rounded-lg" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => updateQty(item.cart_key || item.id, -1),
        className: "min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-600"
      },
      /* @__PURE__ */ React.createElement(Minus, { size: 14 })
    ), /* @__PURE__ */ React.createElement("span", { className: "w-6 text-center text-xs font-bold" }, item.qty), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => updateQty(item.cart_key || item.id, 1),
        className: "min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-600"
      },
      /* @__PURE__ */ React.createElement(Plus, { size: 14 })
    )), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-900 w-14 text-right" }, fmt(item.price * item.qty)), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => removeItem(item.cart_key || item.id),
        className: "w-8 h-8 flex items-center justify-center text-slate-400"
      },
      /* @__PURE__ */ React.createElement(X, { size: 16 })
    )))), /* @__PURE__ */ React.createElement("div", { className: "pt-3 border-t border-slate-100 space-y-2 mt-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs text-slate-500" }, /* @__PURE__ */ React.createElement("span", null, "Subtotal:"), /* @__PURE__ */ React.createElement("span", { className: "font-bold" }, fmt(subtotal))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs text-slate-500" }, /* @__PURE__ */ React.createElement("span", null, "Tax:"), /* @__PURE__ */ React.createElement("span", { className: "font-bold" }, fmt(tax))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-100" }, /* @__PURE__ */ React.createElement("span", null, "Total:"), /* @__PURE__ */ React.createElement("span", { className: "text-emerald-600" }, fmt(total))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 pt-2 border-t border-slate-100" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          setMobileCartOpen(false);
          handleCreateKOT();
        },
        disabled: submittingKOT || cart.length === 0,
        className: "py-3 px-2 bg-[#F97316] hover:bg-[#EA580C] !text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
      },
      /* @__PURE__ */ React.createElement(Printer, { size: 16 }),
      /* @__PURE__ */ React.createElement("span", null, loadedBillId ? "Update KOT" : "Create KOT")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          setMobileCartOpen(false);
          handleOpenPayment();
        },
        disabled: cart.length === 0,
        className: "py-3 px-2 bg-emerald-600 hover:bg-emerald-700 !text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
      },
      /* @__PURE__ */ React.createElement(CreditCard, { size: 16 }),
      /* @__PURE__ */ React.createElement("span", null, "Pay & Settle")
    ))))
  ), /* @__PURE__ */ React.createElement(
    Modal,
    {
      title: /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-800" }, "Select / Add Customer"),
      open: customerModalOpen,
      onCancel: () => setCustomerModalOpen(false),
      footer: null,
      width: isMobile ? "100%" : 420,
      style: isMobile ? { maxWidth: "100%", margin: "0 auto", top: 12 } : void 0
    },
    /* @__PURE__ */ React.createElement("div", { className: "space-y-4 py-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-bold text-slate-500 mb-1.5 block" }, "Search by Name or Phone"), /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: custSearchQuery,
        onChange: (e) => handleCustSearch(e.target.value),
        placeholder: "Type customer phone or name...",
        className: "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      }
    )), custSuggestions.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-2 border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100" }, custSuggestions.map((cust) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: cust.id,
        onClick: () => selectCustomer(cust),
        className: "p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs"
      },
      /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-800 block" }, cust.customer_name || cust.name), /* @__PURE__ */ React.createElement("span", { className: "text-slate-400 font-medium" }, cust.customer_phone || cust.phone)),
      /* @__PURE__ */ React.createElement(Check, { size: 14, className: "text-emerald-500" })
    )))), /* @__PURE__ */ React.createElement("div", { className: "border-t border-slate-100 pt-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2" }, "Or Quick Walk-in Info"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: customerName,
        onChange: (e) => setCustomerName(e.target.value),
        placeholder: "Customer Name",
        className: "border border-slate-200 rounded-xl px-3 py-2 text-xs"
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: customerPhone,
        onChange: (e) => setCustomerPhone(e.target.value),
        placeholder: "Phone (Optional)",
        className: "border border-slate-200 rounded-xl px-3 py-2 text-xs"
      }
    ))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 pt-2" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          clearCustomer();
          setCustomerModalOpen(false);
        },
        className: "flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
      },
      "Set Walk-in"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setCustomerModalOpen(false),
        className: "flex-1 py-2.5 rounded-xl bg-blue-600 !text-white text-xs font-bold hover:bg-blue-700"
      },
      "Done"
    )))
  ), /* @__PURE__ */ React.createElement(
    Drawer,
    {
      placement: "right",
      width: isMobile ? "100%" : 460,
      onClose: () => setKotDrawerOpen(false),
      open: kotDrawerOpen,
      title: /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between w-full pr-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold" }, /* @__PURE__ */ React.createElement(ClipboardList, { size: 17 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "font-black text-slate-800 text-sm block leading-tight" }, "Waiter Pickup Queue"), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-medium text-slate-400" }, "Separate Kitchen Queues & Item Serving"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: fetchKitchenQueue,
          disabled: loadingKitchen,
          title: "Refresh pickup queue",
          className: "p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
        },
        /* @__PURE__ */ React.createElement(RefreshCw, { size: 14, className: loadingKitchen ? "animate-spin text-blue-600" : "" })
      ), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => navigate("/billing/kitchen"),
          className: "text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/80 flex items-center gap-1 cursor-pointer transition"
        },
        /* @__PURE__ */ React.createElement("span", null, "Open KDS"),
        /* @__PURE__ */ React.createElement(ArrowRight, { size: 12 })
      )))
    },
    /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "pb-3 border-b border-slate-100 space-y-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider" }, /* @__PURE__ */ React.createElement("span", null, "Filter by Kitchen Station"), kitchenReadyStats.totalReady > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-extrabold flex items-center gap-1" }, /* @__PURE__ */ React.createElement("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" }), kitchenReadyStats.totalReady, " ready for pickup")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" }, kitchenStations.map((station) => {
      const isSelected = selectedKitchenFilter === station;
      const stationReady = station === "All" ? kitchenReadyStats.totalReady : kitchenReadyStats.byKitchen[station]?.ready || 0;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: station,
          onClick: () => setSelectedKitchenFilter(station),
          className: `px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer select-none ${isSelected ? "bg-slate-900 !text-white shadow-xs" : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/60"}`
        },
        /* @__PURE__ */ React.createElement(ChefHat, { size: 13, className: isSelected ? "text-orange-400" : "text-slate-400" }),
        /* @__PURE__ */ React.createElement("span", null, station === "All" ? "All Kitchens" : station),
        stationReady > 0 && /* @__PURE__ */ React.createElement(
          "span",
          {
            className: `text-[10px] px-1.5 py-0.2 rounded-full font-black ${isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-800"}`
          },
          stationReady
        )
      );
    }))), loadingKitchen && kitchenOrders.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "py-12 text-center text-slate-400 text-xs font-semibold" }, "Loading kitchen orders...") : kitchenOrders.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "py-12 text-center text-slate-400 text-xs font-semibold" }, "No active KOT orders in kitchen") : [...kitchenOrders].filter((order) => {
      if (selectedKitchenFilter === "All") return true;
      return order.items?.some(
        (it) => (it.kitchen_name || "Main Kitchen") === selectedKitchenFilter
      );
    }).sort((a, b) => {
      const rank = { ready: 1, partially_ready: 2, preparing: 3, partially_served: 4, pending: 5, served: 6 };
      return (rank[a.kot_status] || 99) - (rank[b.kot_status] || 99);
    }).map((order) => {
      const isOrderFullyServed = order.kot_status === "served";
      const isOrderPartiallyServed = order.kot_status === "partially_served";
      const isOrderReady = order.kot_status === "ready";
      const isOrderPartiallyReady = order.kot_status === "partially_ready";
      const isOrderCooking = order.kot_status === "preparing";
      const displayItems = selectedKitchenFilter === "All" ? order.items || [] : (order.items || []).filter(
        (it) => (it.kitchen_name || "Main Kitchen") === selectedKitchenFilter
      );
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: order.id,
          className: `p-3.5 rounded-2xl border space-y-3 transition-all duration-200 ${isOrderReady ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20" : isOrderPartiallyReady ? "bg-teal-50/70 border-teal-300 ring-2 ring-teal-400/20" : isOrderPartiallyServed ? "bg-indigo-50/60 border-indigo-200 ring-2 ring-indigo-400/15" : isOrderFullyServed ? "bg-slate-50/60 border-slate-200 opacity-80" : "bg-slate-50 border-slate-200/90"}`
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "font-black text-slate-900 text-sm" }, order.kot_number ? `KOT #${order.kot_number}` : order.billing_no), /* @__PURE__ */ React.createElement("span", { className: "font-bold text-xs bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Table, { size: 12, className: "text-slate-500 shrink-0" }), /* @__PURE__ */ React.createElement("span", null, formatTableLabel(order.table_no) || "Counter"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
          Tag,
          {
            color: order.status === "paid" ? "green" : "default",
            className: "font-bold text-[10px] m-0 rounded-md"
          },
          order.status === "paid" ? "Paid" : "Unpaid"
        ), isOrderFullyServed ? /* @__PURE__ */ React.createElement(Tag, { color: "purple", className: "font-bold text-[10px] m-0 rounded-md flex items-center gap-1" }, /* @__PURE__ */ React.createElement(CheckCircle2, { size: 11, strokeWidth: 3 }), " Served") : isOrderPartiallyServed ? /* @__PURE__ */ React.createElement(Tag, { color: "geekblue", className: "font-bold text-[10px] m-0 rounded-md" }, "Partially Served") : isOrderReady ? /* @__PURE__ */ React.createElement(Tag, { color: "success", className: "font-bold text-[10px] m-0 rounded-md flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Check, { size: 11, strokeWidth: 3 }), " Ready to Serve") : isOrderPartiallyReady ? /* @__PURE__ */ React.createElement(Tag, { color: "cyan", className: "font-bold text-[10px] m-0 rounded-md" }, "Partially Ready") : isOrderCooking ? /* @__PURE__ */ React.createElement(Tag, { color: "warning", className: "font-bold text-[10px] m-0 rounded-md animate-pulse" }, "Cooking") : /* @__PURE__ */ React.createElement(Tag, { color: "error", className: "font-bold text-[10px] m-0 rounded-md" }, "New"))),
        /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-slate-500 font-medium flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", null, order.customer_name ? `Customer: ${order.customer_name}` : "Dine-in Order"), /* @__PURE__ */ React.createElement("span", null, order.items?.length || 0, " line item(s)")),
        /* @__PURE__ */ React.createElement("div", { className: "pt-2 border-t border-slate-200/60 space-y-2" }, displayItems.map((it, idx) => {
          const totalQty = it.quantity || 1;
          const servedQty = it.served_quantity || 0;
          const remaining = Math.max(0, totalQty - servedQty);
          const isLineFullyServed = it.is_served || remaining === 0;
          const isLinePartiallyServed = servedQty > 0 && remaining > 0;
          const isLineReady = it.status === "ready" || isOrderReady;
          const isLineCooking = it.status === "preparing";
          const isBeingServed = servingItemId === it.kot_item_id;
          return /* @__PURE__ */ React.createElement(
            "div",
            {
              key: it.kot_item_id || idx,
              className: `p-2.5 rounded-xl border text-xs transition-all ${isLineFullyServed ? "bg-slate-100/70 border-slate-200 text-slate-500 opacity-80" : isLineReady ? "bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400/20 shadow-2xs" : isLinePartiallyServed ? "bg-indigo-50/80 border-indigo-200" : "bg-white border-slate-200/90"}`
            },
            /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(ChefHat, { size: 11, className: "text-orange-500" }), it.kitchen_name || "Main Kitchen"), /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-800 text-xs truncate" }, it.product_name)), it.addons && it.addons.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[10px] text-slate-400 font-medium mt-0.5" }, "+ ", it.addons.map((a) => a.addon_name || a.name).join(", "))), /* @__PURE__ */ React.createElement("div", null, isLineFullyServed ? /* @__PURE__ */ React.createElement(Tag, { color: "default", className: "font-bold text-[10px] m-0 rounded-md" }, "\u2713 Served") : isLinePartiallyServed ? /* @__PURE__ */ React.createElement(Tag, { color: "geekblue", className: "font-bold text-[10px] m-0 rounded-md" }, servedQty, "/", totalQty, " Served") : isLineReady ? /* @__PURE__ */ React.createElement(Tag, { color: "success", className: "font-bold text-[10px] m-0 rounded-md animate-pulse" }, "Ready") : isLineCooking ? /* @__PURE__ */ React.createElement(Tag, { color: "warning", className: "font-bold text-[10px] m-0 rounded-md" }, "Cooking") : /* @__PURE__ */ React.createElement(Tag, { color: "default", className: "font-bold text-[10px] m-0 rounded-md" }, "Queued"))),
            /* @__PURE__ */ React.createElement("div", { className: "pt-2 mt-1.5 border-t border-slate-200/60 flex items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 text-[11px] font-bold text-slate-600" }, /* @__PURE__ */ React.createElement("span", null, "Total: ", totalQty), totalQty > 1 && /* @__PURE__ */ React.createElement("span", { className: "text-slate-400" }, "\u2022 Served: ", /* @__PURE__ */ React.createElement("strong", { className: "text-slate-800" }, servedQty), "/", totalQty)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 shrink-0" }, isLineFullyServed ? /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-bold text-slate-400 flex items-center gap-1 px-2 py-1" }, /* @__PURE__ */ React.createElement(Check, { size: 12, strokeWidth: 2.5 }), " Line Done") : /* @__PURE__ */ React.createElement(React.Fragment, null, totalQty > 1 && /* @__PURE__ */ React.createElement(
              "button",
              {
                type: "button",
                disabled: isBeingServed || remaining <= 0,
                onClick: () => handleServeLineItem(it.kot_item_id, 1, it.product_name, order.id),
                className: "py-1 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-black text-[11px] border border-blue-200 transition cursor-pointer disabled:opacity-50",
                title: "Serve 1 unit"
              },
              "+1 Serve"
            ), /* @__PURE__ */ React.createElement(
              "button",
              {
                type: "button",
                disabled: isBeingServed || remaining <= 0,
                onClick: () => handleServeLineItem(it.kot_item_id, null, it.product_name, order.id),
                className: "py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 !text-white font-black text-[11px] flex items-center gap-1 shadow-2xs transition cursor-pointer disabled:opacity-50"
              },
              /* @__PURE__ */ React.createElement(Check, { size: 12, strokeWidth: 2.5 }),
              /* @__PURE__ */ React.createElement("span", null, totalQty > 1 ? `Serve Line (${remaining})` : "Serve")
            ))))
          );
        })),
        /* @__PURE__ */ React.createElement("div", { className: "pt-2 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              setKotDrawerOpen(false);
              loadBillIntoCart(order);
            },
            className: "flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
          },
          "Load Order"
        ), !isOrderFullyServed && /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => handleMarkOrderServed(
              order.id,
              order.kot_number ? `KOT #${order.kot_number}` : order.billing_no
            ),
            className: "flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] !text-white rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
          },
          /* @__PURE__ */ React.createElement(CheckCircle2, { size: 13, strokeWidth: 2.5 }),
          " Serve Entire Order"
        ))
      );
    }))
  ), /* @__PURE__ */ React.createElement(
    Modal,
    {
      title: /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-800" }, "POS Settings"),
      open: settingsOpen,
      onCancel: () => setSettingsOpen(false),
      footer: null,
      width: 380
    },
    /* @__PURE__ */ React.createElement("div", { className: "space-y-4 py-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5" }, "Default Table / Counter"), /* @__PURE__ */ React.createElement(
      Select,
      {
        value: tableNo,
        onChange: (val) => setTableNo(val),
        className: "w-full text-xs font-bold",
        style: { height: "42px" },
        options: ALL_TABLES.map((t) => ({ value: t, label: t }))
      }
    )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5" }, "Order Type"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2" }, ["Dine In", "Takeaway", "Delivery"].map((type) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: type,
        onClick: () => setOrderType(type),
        className: `py-2 rounded-xl text-xs font-bold transition ${orderType === type ? "bg-blue-600 !text-white shadow-sm" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`
      },
      type
    )))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between pt-2 border-t border-slate-100" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-700" }, "Audio Feedback Beep"), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setSoundEnabled((prev) => !prev),
        className: `p-2 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition ${soundEnabled ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"}`
      },
      soundEnabled ? /* @__PURE__ */ React.createElement(Volume2, { size: 16 }) : /* @__PURE__ */ React.createElement(VolumeX, { size: 16 }),
      soundEnabled ? "Enabled" : "Muted"
    )), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setSettingsOpen(false),
        className: "w-full py-2.5 bg-slate-900 !text-white rounded-xl text-xs font-bold hover:bg-slate-800 mt-2"
      },
      "Save Settings"
    ))
  ), /* @__PURE__ */ React.createElement(
    Modal,
    {
      title: /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-800" }, "Scan Barcode / Product Code"),
      open: scanModalOpen,
      onCancel: () => setScanModalOpen(false),
      footer: null,
      width: 360
    },
    /* @__PURE__ */ React.createElement("form", { onSubmit: handleBarcodeSubmit, className: "space-y-4 py-2" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 font-medium" }, "Scan barcode or enter product SKU / code:"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        autoFocus: true,
        value: manualBarcode,
        onChange: (e) => setManualBarcode(e.target.value),
        placeholder: "e.g. 1001 or scan...",
        className: "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setScanModalOpen(false),
        className: "flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
      },
      "Cancel"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "submit",
        className: "flex-1 py-2.5 rounded-xl bg-blue-600 !text-white text-xs font-bold hover:bg-blue-700"
      },
      "Add Item"
    )))
  ), /* @__PURE__ */ React.createElement(
    Modal,
    {
      title: /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between pr-6" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-800 text-base flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Armchair, { size: 18, className: "text-blue-600" }), " Tables & Active Orders"), /* @__PURE__ */ React.createElement(Tag, { color: activeTablesCount > 0 ? "error" : "default", className: "font-bold" }, activeTablesCount, " Active / ", ALL_TABLES.length, " Total")),
      open: tablesModalOpen,
      onCancel: () => setTablesModalOpen(false),
      footer: null,
      width: isMobile ? "100%" : 760,
      style: isMobile ? { maxWidth: "100%", margin: "0 auto", top: 12 } : void 0
    },
    /* @__PURE__ */ React.createElement("div", { className: "py-2 space-y-4" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 font-medium" }, "Select a table to start a new order, load an ongoing order, or collect payment directly."), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1" }, ALL_TABLES.map((tbl) => {
      const activeOrders = activeTableMap[tbl] || [];
      const isOccupied = activeOrders.length > 0;
      const isSelected = tableNo === tbl;
      const primaryOrder = activeOrders[0];
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: tbl,
          className: `p-3.5 rounded-2xl border flex flex-col justify-between transition-all select-none ${isOccupied ? primaryOrder?.kot_status === "ready" ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/30" : primaryOrder?.kot_status === "partially_ready" ? "bg-teal-50/80 border-teal-300 ring-2 ring-teal-400/20" : primaryOrder?.kot_status === "partially_served" ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-400/20" : primaryOrder?.kot_status === "served" ? "bg-purple-50/80 border-purple-300 ring-2 ring-purple-400/20" : primaryOrder?.kot_status === "preparing" ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20" : "bg-red-50/80 border-red-300 ring-2 ring-red-400/20" : isSelected ? "bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"}`
        },
        /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "font-black text-sm text-slate-900 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
          Table,
          {
            size: 15,
            className: isOccupied ? primaryOrder?.kot_status === "ready" ? "text-emerald-600" : primaryOrder?.kot_status === "partially_ready" ? "text-teal-600" : primaryOrder?.kot_status === "partially_served" ? "text-indigo-600" : primaryOrder?.kot_status === "served" ? "text-purple-600" : primaryOrder?.kot_status === "preparing" ? "text-amber-600" : "text-red-500" : "text-slate-400"
          }
        ), formatTableLabel(tbl)), isOccupied ? /* @__PURE__ */ React.createElement(
          Tag,
          {
            color: primaryOrder?.kot_status === "ready" ? "success" : primaryOrder?.kot_status === "partially_ready" ? "cyan" : primaryOrder?.kot_status === "preparing" ? "warning" : primaryOrder?.kot_status === "partially_served" ? "geekblue" : primaryOrder?.kot_status === "served" ? "purple" : "error",
            className: "font-bold text-[10px] m-0 rounded-md"
          },
          primaryOrder?.kot_status === "ready" ? "Ready" : primaryOrder?.kot_status === "partially_ready" ? "Part Ready" : primaryOrder?.kot_status === "preparing" ? "Cooking" : primaryOrder?.kot_status === "partially_served" ? "Part Served" : primaryOrder?.kot_status === "served" ? "Served" : "New"
        ) : /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-slate-400" }, "Vacant")), isOccupied && primaryOrder && /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-200/60" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold text-slate-800 truncate" }, primaryOrder.kot_number ? `KOT #${primaryOrder.kot_number}` : primaryOrder.billing_no), /* @__PURE__ */ React.createElement("div", { className: "truncate text-slate-500" }, primaryOrder.customer_name || "Walk-in"), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-baseline font-black text-emerald-700 pt-0.5" }, /* @__PURE__ */ React.createElement("span", null, primaryOrder.items?.length || 0, " items"), /* @__PURE__ */ React.createElement("span", { className: "text-xs" }, fmt(
          primaryOrder.total_amount || primaryOrder.items?.reduce((s, i) => {
            const p = parseFloat(i.unit_price || i.price || 0);
            const q = i.quantity || i.qty || 1;
            const tr = parseFloat(i.tax_percentage || i.tax_rate || 0);
            return s + p * q * (1 + tr / 100);
          }, 0)
        ))))),
        /* @__PURE__ */ React.createElement("div", { className: "pt-3 flex flex-col gap-1.5 mt-2 border-t border-slate-100" }, isOccupied && primaryOrder ? /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-1.5" }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => loadBillIntoCart(primaryOrder),
            className: "py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-[11px] font-bold transition cursor-pointer"
          },
          "Load Order"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              setTablesModalOpen(false);
              handleOpenPayment(primaryOrder);
            },
            className: "py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 !text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer"
          },
          "Pay"
        )) : /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => handleSelectTable(tbl),
            className: `w-full py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${isSelected ? "bg-blue-600 !text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`
          },
          isSelected ? "Selected" : "Start Order"
        ))
      );
    })))
  ), /* @__PURE__ */ React.createElement(
    Modal,
    {
      title: /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between pr-6" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold text-slate-800 text-base flex items-center gap-2" }, /* @__PURE__ */ React.createElement(CreditCard, { size: 18, className: "text-emerald-600" }), " Settle & Pay Bill"), /* @__PURE__ */ React.createElement(Tag, { color: "blue", className: "font-bold" }, tableNo, " \u2022 ", loadedBillId ? currentLoadedOrder?.kot_number ? `KOT #${currentLoadedOrder.kot_number}` : currentLoadedOrder?.billing_no : "Counter Order")),
      open: paymentModalOpen,
      onCancel: () => setPaymentModalOpen(false),
      footer: null,
      width: isMobile ? "100%" : 580,
      style: isMobile ? { maxWidth: "100%", margin: "0 auto", top: 12 } : void 0
    },
    /* @__PURE__ */ React.createElement("div", { className: "space-y-4 py-1" }, /* @__PURE__ */ React.createElement("div", { className: "bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-4 text-white shadow-md flex justify-between items-center" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "text-xs text-emerald-100 font-bold uppercase tracking-wider" }, "Total Payable"), /* @__PURE__ */ React.createElement("h2", { className: "text-3xl font-black !text-white !mb-0 tracking-tight" }, fmt(Math.max(0, total - (parseFloat(discountAmount) || 0)))), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-emerald-100 font-medium mt-0.5" }, totalItemCount, " items \u2022 Subtotal: ", fmt(subtotal), " \u2022 Tax: ", fmt(tax))), parseFloat(discountAmount) > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-right bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-xs" }, /* @__PURE__ */ React.createElement("span", { className: "text-[11px] block font-bold text-emerald-100" }, "Discount"), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-white" }, "-", fmt(discountAmount)))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2" }, "Select Payment Method"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-5 gap-2" }, [
      { key: "cash", label: "Cash", icon: /* @__PURE__ */ React.createElement(Banknote, { size: 16 }) },
      { key: "UPI Current Account", label: "UPI Current", icon: /* @__PURE__ */ React.createElement(QrCode, { size: 16 }) },
      { key: "UPI Normal Account", label: "UPI Normal", icon: /* @__PURE__ */ React.createElement(QrCode, { size: 16 }) },
      { key: "credit_card", label: "Card", icon: /* @__PURE__ */ React.createElement(CreditCard, { size: 16 }) },
      { key: "split", label: "Split Pay", icon: /* @__PURE__ */ React.createElement(Split, { size: 16 }) }
    ].map((m) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: m.key,
        type: "button",
        onClick: () => setPaymentMethod(m.key),
        className: `py-2 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all cursor-pointer ${paymentMethod === m.key ? "bg-emerald-600 !text-white border-emerald-600 shadow-sm shadow-emerald-500/20 scale-[1.02]" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`
      },
      /* @__PURE__ */ React.createElement("div", null, m.icon),
      /* @__PURE__ */ React.createElement("span", { className: "text-[11px]" }, m.label)
    )))), paymentMethod === "cash" && /* @__PURE__ */ React.createElement("div", { className: "p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-bold text-slate-700 block mb-1" }, "Cash Tendered (\u20B9)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        inputMode: "decimal",
        value: tenderedAmount,
        onChange: (e) => setTenderedAmount(e.target.value),
        placeholder: "Enter cash received...",
        className: "w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5" }, [
      { label: "Exact", val: Math.max(0, total - (parseFloat(discountAmount) || 0)) },
      { label: "\u20B9100", val: 100 },
      { label: "\u20B9200", val: 200 },
      { label: "\u20B9500", val: 500 },
      { label: "\u20B91000", val: 1e3 },
      { label: "\u20B92000", val: 2e3 }
    ].map((chip) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: chip.label,
        type: "button",
        onClick: () => setTenderedAmount(chip.val.toString()),
        className: "px-2.5 py-1 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg text-xs font-bold text-slate-700 transition cursor-pointer active:scale-95"
      },
      chip.label
    ))), parseFloat(tenderedAmount) >= Math.max(0, total - (parseFloat(discountAmount) || 0)) && /* @__PURE__ */ React.createElement("div", { className: "p-2.5 bg-emerald-100/70 border border-emerald-300 rounded-xl flex justify-between items-center text-emerald-900" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold" }, "Return Change to Customer:"), /* @__PURE__ */ React.createElement("span", { className: "text-base font-black" }, fmt(parseFloat(tenderedAmount) - Math.max(0, total - (parseFloat(discountAmount) || 0)))))), (paymentMethod === "UPI Current Account" || paymentMethod === "UPI Normal Account") && /* @__PURE__ */ React.createElement("div", { className: "p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-xs font-bold text-emerald-700" }, /* @__PURE__ */ React.createElement(QrCode, { size: 18 }), /* @__PURE__ */ React.createElement("span", null, "Scan branch UPI QR code on billing counter to receive payment.")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-bold text-slate-600 block mb-1" }, "UPI UTR / Reference ID (Optional)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: upiTxnRef,
        onChange: (e) => setUpiTxnRef(e.target.value),
        placeholder: "e.g. 423985729182",
        className: "w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
      }
    ))), paymentMethod === "credit_card" && /* @__PURE__ */ React.createElement("div", { className: "p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-xs font-bold text-slate-700" }, /* @__PURE__ */ React.createElement(CreditCard, { size: 18, className: "text-blue-600" }), /* @__PURE__ */ React.createElement("span", null, "Swipe or tap customer card on POS EDC machine.")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-bold text-slate-600 block mb-1" }, "Card Approval Code / Ref No (Optional)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: cardRefNo,
        onChange: (e) => setCardRefNo(e.target.value),
        placeholder: "e.g. 984512",
        className: "w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
      }
    ))), paymentMethod === "split" && /* @__PURE__ */ React.createElement("div", { className: "p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs font-bold text-slate-700" }, "Split Payment Breakdown"), splitPayments.map((sp, idx) => /* @__PURE__ */ React.createElement("div", { key: idx, className: "flex gap-2 items-center" }, /* @__PURE__ */ React.createElement(
      Select,
      {
        value: sp.method,
        onChange: (val) => {
          const next = [...splitPayments];
          next[idx].method = val;
          setSplitPayments(next);
        },
        className: "w-44 text-xs font-bold",
        options: [
          { value: "cash", label: "Cash" },
          { value: "UPI Current Account", label: "UPI Current" },
          { value: "UPI Normal Account", label: "UPI Normal" },
          { value: "credit_card", label: "Card" }
        ]
      }
    ), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        value: sp.amount,
        onChange: (e) => {
          const next = [...splitPayments];
          next[idx].amount = parseFloat(e.target.value) || 0;
          setSplitPayments(next);
        },
        placeholder: "Amount",
        className: "flex-1 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold"
      }
    ), splitPayments.length > 1 && /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setSplitPayments(splitPayments.filter((_, i) => i !== idx)),
        className: "text-red-500 p-1 hover:bg-red-50 rounded"
      },
      /* @__PURE__ */ React.createElement(Trash2, { size: 15 })
    ))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center pt-2 border-t border-slate-200 text-xs font-bold" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setSplitPayments([...splitPayments, { method: "cash", amount: 0 }]),
        className: "text-blue-600 hover:underline"
      },
      "+ Add Split Row"
    ), /* @__PURE__ */ React.createElement("span", null, "Split Total: ", fmt(splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)), " /", " ", fmt(Math.max(0, total - (parseFloat(discountAmount) || 0)))))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 items-center pt-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-bold text-slate-600 whitespace-nowrap" }, "Discount (\u20B9):"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        value: discountAmount,
        onChange: (e) => setDiscountAmount(parseFloat(e.target.value) || 0),
        min: 0,
        max: total,
        placeholder: "0",
        className: "w-32 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "pt-3 border-t border-slate-200 flex gap-2.5" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setPaymentModalOpen(false),
        "aria-label": "Cancel payment",
        className: "px-3 sm:px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100/80 cursor-pointer flex items-center justify-center shrink-0 transition",
        title: "Cancel payment"
      },
      /* @__PURE__ */ React.createElement(X, { size: 16, className: "sm:hidden" }),
      /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline" }, "Cancel")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => handleConfirmSettlement(false),
        disabled: settlingPayment,
        className: "flex-1 py-3 bg-slate-800 hover:bg-slate-900 !text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
      },
      settlingPayment ? "Settling..." : "Pay (No Print)"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => handleConfirmSettlement(true),
        disabled: settlingPayment,
        className: "flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 !text-white rounded-xl text-xs font-black uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 cursor-pointer disabled:opacity-50"
      },
      /* @__PURE__ */ React.createElement(Printer, { size: 16 }),
      /* @__PURE__ */ React.createElement("span", null, settlingPayment ? "Processing..." : "Pay & Print")
    )))
  ), settledSuccessData && /* @__PURE__ */ React.createElement(
    Modal,
    {
      title: null,
      open: Boolean(settledSuccessData),
      onCancel: () => setSettledSuccessData(null),
      footer: null,
      width: 420
    },
    /* @__PURE__ */ React.createElement("div", { className: "py-4 text-center space-y-4" }, /* @__PURE__ */ React.createElement("div", { className: "w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm" }, /* @__PURE__ */ React.createElement(CheckCircle2, { size: 36 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-black text-slate-900" }, "Bill Settled Successfully!"), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 mt-1" }, settledSuccessData.billing_no || "Bill Completed", " \u2022 Table: ", settledSuccessData.counter_no || tableNo), /* @__PURE__ */ React.createElement("p", { className: "text-2xl font-black text-emerald-600 mt-2" }, fmt(settledSuccessData.total_amount))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-2 pt-2" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          if (settledSuccessData.id) {
            window.open(`/billing/customer-copy/${settledSuccessData.id}`, "_blank");
          }
        },
        className: "w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 !text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
      },
      /* @__PURE__ */ React.createElement(Printer, { size: 16 }),
      " View & Print Receipt"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setSettledSuccessData(null),
        className: "w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
      },
      "Start Next Order"
    )))
  ), /* @__PURE__ */ React.createElement(
    Modal,
    {
      title: /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5 pb-2 border-b border-slate-100" }, /* @__PURE__ */ React.createElement("div", { className: "w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold" }, /* @__PURE__ */ React.createElement(Sparkles, { size: 20 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "text-base font-bold text-slate-800 leading-tight" }, "Customize ", customizingProduct?.product_name), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 font-normal" }, "Base Price: ", fmt(parseFloat(customizingProduct?.selling_price || customizingProduct?.unit_price || 0))))),
      open: customizeModalOpen,
      onCancel: () => setCustomizeModalOpen(false),
      footer: null,
      width: isMobile ? "100%" : 480,
      style: isMobile ? { maxWidth: "100%", margin: "0 auto", top: 12 } : void 0,
      centered: true,
      destroyOnHidden: true
    },
    customizingProduct && /* @__PURE__ */ React.createElement("div", { className: "py-2 space-y-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2" }, "Available Add-ons & Extras"), /* @__PURE__ */ React.createElement("div", { className: "space-y-2 max-h-60 overflow-y-auto pr-1" }, customizingProduct.addons && customizingProduct.addons.length > 0 ? customizingProduct.addons.map((addon) => {
      const isSelected = selectedCustomAddons.some((a) => a.id === addon.id);
      const selectedItem = selectedCustomAddons.find((a) => a.id === addon.id);
      const qty = selectedItem?.qty || 1;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: addon.id,
          onClick: () => toggleAddon(addon),
          className: `p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${isSelected ? "border-indigo-500 bg-indigo-50/50 shadow-xs" : "border-slate-200 bg-white hover:border-slate-300"}`
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement(
          "div",
          {
            className: `w-5 h-5 rounded-md flex items-center justify-center border transition-all ${isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"}`
          },
          isSelected && /* @__PURE__ */ React.createElement(Check, { size: 13, strokeWidth: 3 })
        ), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-slate-800 block" }, addon.addon_name), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold text-emerald-600" }, "+", fmt(addon.price)))),
        isSelected && /* @__PURE__ */ React.createElement(
          "div",
          {
            className: "flex items-center border border-indigo-200 rounded-lg bg-white overflow-hidden shadow-xs",
            onClick: (e) => e.stopPropagation()
          },
          /* @__PURE__ */ React.createElement(
            "button",
            {
              onClick: () => updateAddonQty(addon.id, -1),
              className: "w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
            },
            /* @__PURE__ */ React.createElement(Minus, { size: 12, strokeWidth: 2.5 })
          ),
          /* @__PURE__ */ React.createElement("span", { className: "w-6 text-center text-xs font-bold text-slate-800" }, qty),
          /* @__PURE__ */ React.createElement(
            "button",
            {
              onClick: () => updateAddonQty(addon.id, 1),
              className: "w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
            },
            /* @__PURE__ */ React.createElement(Plus, { size: 12, strokeWidth: 2.5 })
          )
        )
      );
    }) : /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400 py-3 text-center" }, "No add-ons available for this item."))), /* @__PURE__ */ React.createElement("div", { className: "pt-2 border-t border-slate-100 flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-600" }, "Item Quantity"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setCustomItemQty((q) => Math.max(1, q - 1)),
        className: "w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
      },
      /* @__PURE__ */ React.createElement(Minus, { size: 14, strokeWidth: 2.5 })
    ), /* @__PURE__ */ React.createElement("span", { className: "w-8 text-center text-sm font-bold text-slate-800" }, customItemQty), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setCustomItemQty((q) => q + 1),
        className: "w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
      },
      /* @__PURE__ */ React.createElement(Plus, { size: 14, strokeWidth: 2.5 })
    ))), /* @__PURE__ */ React.createElement("div", { className: "p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-500 font-medium" }, "Computed Unit Price"), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-black text-slate-800" }, fmt(computedCustomUnitPrice))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 pt-1" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleAddPlainToCart,
        className: "flex-1 py-2.5 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
      },
      "Add Regular (No Add-ons)"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleAddCustomizedToCart,
        className: "flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 !text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/20 transition cursor-pointer flex items-center justify-center gap-1.5"
      },
      /* @__PURE__ */ React.createElement("span", null, "Add with Add-ons"),
      /* @__PURE__ */ React.createElement("span", { className: "font-extrabold text-indigo-100" }, "\u2022 ", fmt(computedCustomUnitPrice * customItemQty))
    )))
  ), /* @__PURE__ */ React.createElement(
    DailyStockModal,
    {
      open: dailyStockModalOpen,
      onCancel: () => setDailyStockModalOpen(false),
      onUpdated: fetchProducts,
      branchId: effectiveBranchId,
      branchName: effectiveBranchName
    }
  ));
}
