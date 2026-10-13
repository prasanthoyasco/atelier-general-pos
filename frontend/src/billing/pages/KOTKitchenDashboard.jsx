import React, { useState, useEffect, useRef } from "react";
import {
  Bell, CookingPot, UtensilsCrossed, Clock, Check, X, AlertTriangle,
  Volume2, VolumeX, Maximize, Minimize, RefreshCw, ChefHat, Calendar,
  CheckCircle, Play, Ban, Armchair, Sparkles, Heart
} from "lucide-react";
import { message, Modal, Input, Select } from "antd";
import billingService from "../service/billingService.js";
import productService from "../../Product/services/productService.js";
import { useBranch } from "../../context/BranchContext.jsx";
import FoodThumbnail from "../utils/FoodThumbnail.jsx";
import { broadcastKOTEvent, kotChannel } from "../utils/kotBroadcast.js";
import dayjs from "dayjs";

// Play custom order notification sound from public/order_placed_notification.mp3
const playNewOrderNotification = () => {
  try {
    const audio = new Audio("/order_placed_notification.mp3");
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        console.warn("Custom audio play blocked or failed, using synth fallback:", e);
        playKitchenBeepFallback();
      });
    }
  } catch (err) {
    console.warn("Audio element error, using synth fallback:", err);
    playKitchenBeepFallback();
  }
};

const playKitchenBeepFallback = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn("Audio play blocked:", e);
  }
};

export default function KOTKitchenDashboard() {
  const { selectedBranch } = useBranch() || {};

  // Tickets state
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Sync / Polling status
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Audio alerts & deduplicated new orders tracking (Unmuted by default on open)
  const [soundEnabled, setSoundEnabled] = useState(true);
  const seenOrderIdsRef = useRef(new Set());
  const initialLoadRef = useRef(true);
  const [pulsingOrderIds, setPulsingOrderIds] = useState(new Set());
  const lastOverdueAlertRef = useRef(0); // Timestamp of last 5+ min reminder audio alert

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mobile Active Tab: 'new' | 'preparing' | 'ready'
  const [mobileActiveTab, setMobileActiveTab] = useState("new");

  // Kitchen Filter State (persisted in localStorage for dedicated station kiosks)
  const [selectedKitchen, setSelectedKitchen] = useState(() => {
    return localStorage.getItem("kot_selected_kitchen") || "All";
  });
  const [masterKitchens, setMasterKitchens] = useState([]);

  // Fetch registered kitchens from master
  useEffect(() => {
    productService
      .getKitchens()
      .then((res) => {
        const list = res?.data?.data || res?.data || [];
        if (Array.isArray(list)) {
          setMasterKitchens(list.map((k) => k.name || k.kitchen_name || k));
        }
      })
      .catch((err) => console.warn("Failed to fetch master kitchens:", err));
  }, []);

  // Combined list of kitchens from master and active tickets
  const availableKitchens = Array.from(
    new Set([
      ...masterKitchens,
      ...tickets.map((t) => t.kitchen_name).filter(Boolean),
    ])
  );

  const handleKitchenChange = (val) => {
    setSelectedKitchen(val);
    try {
      localStorage.setItem("kot_selected_kitchen", val);
    } catch (e) {
      // Ignore storage errors
    }
  };

  // Filtered tickets
  const filteredTickets = selectedKitchen === "All" 
    ? tickets 
    : tickets.filter(t => t.kitchen_name === selectedKitchen);

  // Cancellation Modal
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Fetch kitchen queue
  const fetchQueue = async (isManual = false) => {
    if (document.hidden) return;
    if (isManual) setLoading(true);
    try {
      const res = await billingService.getKitchenQueue({ only_kitchen: true });
      const activeTickets = res?.data || [];
      setTickets(activeTickets);
      setSecondsSinceSync(0);

      // Check for new pending tickets to alert
      const pendingTickets = activeTickets.filter((t) => t.kot_status === "pending");
      const newPendingIds = [];

      pendingTickets.forEach((ticket) => {
        if (!seenOrderIdsRef.current.has(ticket.id)) {
          newPendingIds.push(ticket.id);
          seenOrderIdsRef.current.add(ticket.id);
        }
      });

      if (newPendingIds.length > 0 && !initialLoadRef.current) {
        // Highlight new cards briefly
        setPulsingOrderIds((prev) => {
          const next = new Set(prev);
          newPendingIds.forEach((id) => next.add(id));
          return next;
        });

        setTimeout(() => {
          setPulsingOrderIds((prev) => {
            const next = new Set(prev);
            newPendingIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 4000);

        if (soundEnabled) {
          playNewOrderNotification();
        }
      }

      if (initialLoadRef.current) {
        initialLoadRef.current = false;
      }
    } catch (err) {
      console.error("Failed to sync kitchen queue:", err);
      if (isManual) message.error("Failed to sync kitchen queue");
    } finally {
      if (isManual) setLoading(false);
    }
  };

  // Sync intervals & real-time broadcast listener
  useEffect(() => {
    fetchQueue(true);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchQueue(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const pollTimer = setInterval(() => {
      fetchQueue(false);
    }, 5000); // 5s cross-device fallback poll

    const clockTimer = setInterval(() => {
      const now = Date.now();
      setSecondsSinceSync((prev) => prev + 1);
      setCurrentTime(new Date(now));

      // Attention Seeker: Check for new pending orders waiting >= 5 minutes (300,000 ms)
      setTickets((currentTickets) => {
        const overdueNewOrders = currentTickets.filter((t) => {
          if (t.kot_status !== "pending") return false;
          const createdTime = new Date(t.kot_created_at || t.createdAt).getTime();
          return now - createdTime >= 5 * 60 * 1000;
        });

        if (overdueNewOrders.length > 0) {
          // Play sound reminder every 45 seconds while pending orders remain waiting >= 5 min
          if (now - lastOverdueAlertRef.current >= 45000) {
            lastOverdueAlertRef.current = now;
            if (soundEnabled) {
              playNewOrderNotification();
            }
          }
        } else {
          lastOverdueAlertRef.current = 0;
        }

        return currentTickets;
      });
    }, 1000);

    // Instant cross-tab sync when new KOT is placed or status changes
    let handleBroadcast;
    if (kotChannel) {
      handleBroadcast = (e) => {
        const eventType = e.data?.type;
        const ticketId = e.data?.payload?.id || e.data?.id;
        const newStatus = e.data?.payload?.status || e.data?.status;

        // When order is marked as served from POS (or anywhere), instantly remove it from tickets state
        // This makes it immediately disappear from Column 3 ("Ready to Serve") with zero lag!
        if (eventType === "KOT_SERVED" || (eventType === "KOT_STATUS_UPDATED" && newStatus === "served")) {
          if (ticketId) {
            setTickets((prev) => prev.filter((t) => t.id !== ticketId));
          }
        }

        if (eventType === "NEW_KOT_ORDER") {
          if (soundEnabled) {
            playNewOrderNotification();
          }
          fetchQueue(false);
        } else if (eventType === "KOT_SERVED" || eventType === "KOT_STATUS_UPDATED") {
          fetchQueue(false);
        }
      };
      kotChannel.addEventListener("message", handleBroadcast);
    }

    return () => {
      clearInterval(pollTimer);
      clearInterval(clockTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (kotChannel && handleBroadcast) {
        kotChannel.removeEventListener("message", handleBroadcast);
      }
    };
  }, [soundEnabled]);

  // Audio Toggle
  const handleToggleSound = () => {
    if (!soundEnabled) {
      playNewOrderNotification();
      setSoundEnabled(true);
      message.success("Kitchen audio alerts enabled");
    } else {
      setSoundEnabled(false);
      message.warning("Kitchen audio alerts muted");
    }
  };

  // Status transitions with OPTIMISTIC UPDATE & ROLLBACK
  const handleTransition = async (ticketId, nextStatus) => {
    if (actionLoadingId) return; // In-flight lockout
    setActionLoadingId(ticketId);

    // Save previous snapshot for rollback
    const previousSnapshot = [...tickets];

    // Optimistically update UI
    setTickets((prev) =>
      prev
        .map((t) => {
          if (t.id === ticketId) {
            const updated = { ...t, kot_status: nextStatus, status: nextStatus }; // Ensure both are updated for safety
            if (nextStatus === "preparing") updated.kot_preparing_at = new Date().toISOString();
            if (nextStatus === "ready") updated.kot_ready_at = new Date().toISOString();
            return updated;
          }
          return t;
        })
        .filter((t) => (nextStatus === "served" ? t.id !== ticketId : true))
    );

    try {
      const ticketObj = tickets.find((t) => t.id === ticketId);
      await billingService.updateKOTStatus(ticketId, nextStatus);
      broadcastKOTEvent("KOT_STATUS_UPDATED", {
        id: ticketId,
        status: nextStatus,
        kot_number: ticketObj?.kot_number,
        table_no: ticketObj?.table_no || (ticketObj?.counter_no ? ticketObj.counter_no.replace("Counter ", "Table ") : "Table"),
        billing_no: ticketObj?.billing_no,
        items_count: ticketObj?.items?.length || 0,
      });
      if (nextStatus === "preparing") message.success("Started cooking!");
      else if (nextStatus === "ready") message.success("Marked ready to serve!");
      else if (nextStatus === "served") message.success("Order served & completed!");
      fetchQueue(false);
    } catch (err) {
      // ROLLBACK on failure
      console.error(`Transition to ${nextStatus} failed:`, err);
      setTickets(previousSnapshot);
      const errMsg = err?.response?.data?.error || err?.message || "Action failed";
      message.error(`Failed to update ticket: ${errMsg}. Reverted to previous status.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cancellation
  const openCancelModal = (id) => {
    setCancelTargetId(id);
    setCancelReason("");
    setCancelModalVisible(true);
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      message.warning("Please provide a reason for cancellation");
      return;
    }
    setCancelling(true);
    try {
      await billingService.updateKOTStatus(cancelTargetId, "cancelled", cancelReason.trim());
      broadcastKOTEvent("KOT_STATUS_UPDATED", { id: cancelTargetId, status: "cancelled" });
      message.success("KOT Ticket cancelled successfully.");
      setCancelModalVisible(false);
      fetchQueue(false);
    } catch (err) {
      message.error(err?.response?.data?.error || err?.message || "Failed to cancel ticket");
    } finally {
      setCancelling(false);
      setCancelTargetId(null);
    }
  };

  // Dynamic Elapsed Timers
  const getElapsedDuration = (timestamp) => {
    if (!timestamp) return { text: "0 min", minutes: 0 };
    const elapsedMs = Math.max(0, currentTime - new Date(timestamp));
    const totalMinutes = Math.floor(elapsedMs / (60 * 1000));
    return {
      text: totalMinutes > 0 ? `${totalMinutes} min` : "< 1 min",
      minutes: totalMinutes,
    };
  };

  // Categorize tickets
  const pendingTickets = filteredTickets.filter((t) => t.kot_status === "pending");
  const preparingTickets = filteredTickets.filter((t) => t.kot_status === "preparing");
  const readyTickets = filteredTickets.filter((t) => t.kot_status === "ready");

  return (
    <div className="min-h-screen w-full bg-[#F4F6F9] flex flex-col font-sans select-none overflow-x-hidden">
      {/* 1. TOP HEADER BAR */}
      <header className="h-16 md:h-18 bg-white border-b border-slate-200/90 px-3 md:px-6 flex items-center justify-between shrink-0 shadow-2xs z-20">
        {/* Left: Chef Hat Logo & Title */}
        <div className="flex items-center gap-2.5 md:gap-3">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-[#EF4444] text-white flex items-center justify-center shadow-sm shadow-red-500/20 shrink-0">
            <ChefHat size={24} className="md:w-[26px] md:h-[26px]" strokeWidth={2.3} />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-black text-slate-800 uppercase !mb-0 tracking-tight leading-tight">
              Kitchen Orders
            </h1>
            <p className="text-[11px] md:text-xs text-slate-400 !mb-0 font-semibold leading-none truncate max-w-[120px] sm:max-w-none">
              {selectedBranch?.name || "Annaporani Branch"}
            </p>
          </div>
        </div>

        {/* Center / Right: Online Status, Date, Clock, Sound, Fullscreen */}
        <div className="flex items-center gap-2 md:gap-4 lg:gap-5">
          {/* Online badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-full border border-emerald-200/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Online</span>
          </div>

          {/* Date */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <Calendar size={14} className="text-slate-400" />
            <span>{dayjs(currentTime).format("DD MMM YYYY")}</span>
          </div>

          {/* Clock */}
          <div className="hidden md:flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <Clock size={14} className="text-slate-400" />
            <span>{dayjs(currentTime).format("hh:mm A")}</span>
          </div>

          {/* Kitchen Filter Ant Design Select */}
          <div className="flex items-center">
            <Select
              value={selectedKitchen}
              onChange={handleKitchenChange}
              popupMatchSelectWidth={false}
              suffixIcon={<ChefHat size={14} className="text-slate-400" />}
              className="kot-kitchen-filter-select"
              style={{ minWidth: 125 }}
              options={[
                { value: "All", label: "All Kitchens" },
                ...availableKitchens.map((k) => ({
                  value: k,
                  label: k,
                })),
              ]}
            />
          </div>

          {/* Sound Toggle Button (Min 48px) */}
          <button
            onClick={handleToggleSound}
            aria-label="Toggle Sound"
            className={`min-h-[44px] md:min-h-[48px] px-2.5 md:px-3.5 rounded-xl border flex items-center gap-1.5 md:gap-2 text-xs font-black transition cursor-pointer active:scale-95 ${
              soundEnabled
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span className="hidden xl:inline">{soundEnabled ? "SOUND ON" : "MUTED"}</span>
          </button>

          {/* Fullscreen Button (Min 48px) */}
          <button
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            className="min-w-[44px] min-h-[44px] md:min-w-[48px] md:min-h-[48px] rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* 2. MAIN BODY */}
      <main className="flex-1 p-2.5 md:p-4 lg:p-6 overflow-hidden min-h-0 flex flex-col">
        {/* ================= DESKTOP & TABLET: 3-COLUMN KANBAN BOARD ================= */}
        <div className="hidden md:grid md:grid-cols-3 gap-3 lg:gap-5 flex-1 min-h-0">
          {/* COLUMN 1: NEW ORDERS (Red Theme) */}
          <div className="flex flex-col bg-[#FEF2F2] border border-red-200/80 rounded-2xl md:rounded-3xl overflow-hidden shadow-sm">
            {/* Header Banner */}
            <div className="bg-[#EF4444] px-4 md:px-5 py-3 md:py-3.5 flex items-center justify-between text-white shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <Bell size={20} className="md:w-[22px] md:h-[22px]" strokeWidth={2.4} />
                <h2 className="text-sm md:text-base !font-bold tracking-wide !mb-0 uppercase">New Orders</h2>
              </div>
              <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white text-[#EF4444] font-black text-xs md:text-sm flex items-center justify-center shadow-xs">
                {pendingTickets.length}
              </span>
            </div>

            {/* Column Cards List */}
            <div className="flex-1 overflow-y-auto p-2.5 md:p-3.5 lg:p-4 space-y-3 md:space-y-4 min-h-0">
              {pendingTickets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-red-300 py-16 text-center">
                  <Bell size={42} strokeWidth={1.5} className="mb-2 opacity-50" />
                  <p className="text-sm font-bold text-slate-600">No new orders</p>
                  <p className="text-xs text-slate-400">Incoming tickets will appear here</p>
                </div>
              ) : (
                pendingTickets.map((order) => {
                  const timer = getElapsedDuration(order.kot_created_at);
                  const isDelayed = timer.minutes >= 10;
                  const isOverdue = timer.minutes >= 5;
                  const isPulsing = pulsingOrderIds.has(order.id) || isOverdue;

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-2xl border p-4.5 space-y-3.5 shadow-sm transition-all duration-200 ${
                        isDelayed
                          ? "ring-4 ring-red-400/60 animate-pulse border-red-400"
                          : isOverdue
                          ? "ring-4 ring-amber-400/50 animate-pulse border-amber-400"
                          : isPulsing
                          ? "ring-4 ring-red-400/50 animate-pulse border-red-400"
                          : "border-slate-200/80 hover:border-slate-300"
                      }`}
                    >
                      {/* Top row: KOT # + Timer */}
                      <div className="flex items-center justify-between">
                        <span className="text-base font-black text-slate-900 tracking-tight">
                          {order.kot_number ? `KOT #${order.kot_number}` : order.billing_no}
                          {order.kitchen_name && selectedKitchen === "All" && (
                            <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                {order.kitchen_name}
                            </span>
                          )}
                        </span>
                        <div
                          className={`flex items-center gap-1 text-xs font-black ${
                            isDelayed
                              ? "text-red-600"
                              : isOverdue
                              ? "text-amber-600"
                              : "text-slate-500"
                          }`}
                        >
                          <Clock size={15} />
                          <span>{timer.text}</span>
                        </div>
                      </div>

                      {/* Sub-header: Table pill + DELAYED / OVERDUE badge */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200/60 inline-flex items-center gap-1.5">
                          <Armchair size={13} className="text-slate-500 shrink-0" />
                          <span>{order.table_no || "Table 1"}</span>
                        </span>
                        {isDelayed ? (
                          <span className="text-[11px] font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={12} /> DELAYED
                          </span>
                        ) : isOverdue ? (
                          <span className="text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={12} /> WAITING &gt; 5 MIN
                          </span>
                        ) : null}
                      </div>

                      {/* Items Row with large thumbnails */}
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-100 shrink-0 bg-slate-50 flex items-center justify-center">
                              <FoodThumbnail
                                src={item.image_url}
                                alt={item.product_name}
                                fallbackSize="sm"
                              />
                            </div>
                            <span className="text-sm font-bold text-slate-800 truncate">
                              {item.quantity} × {item.product_name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Primary Action (56px) + Secondary Cancel */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleTransition(order.id, "preparing")}
                          disabled={actionLoadingId === order.id}
                          className="flex-1 min-h-[56px] bg-[#EF4444] hover:bg-red-600 active:scale-[0.99] !text-white rounded-xl font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-sm shadow-red-500/20 transition cursor-pointer disabled:opacity-50"
                        >
                          <Play size={18} fill="currentColor" />
                          <span>Start Cooking</span>
                        </button>

                        <button
                          onClick={() => openCancelModal(order.id)}
                          aria-label="Cancel ticket"
                          className="min-h-[56px] min-w-[56px] rounded-xl border border-red-200 text-red-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition cursor-pointer"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 2: PREPARING (Amber Theme) */}
          <div className="flex flex-col bg-[#FFFBEB] border border-amber-200/80 rounded-2xl md:rounded-3xl overflow-hidden shadow-sm">
            {/* Header Banner */}
            <div className="bg-[#F59E0B] px-4 md:px-5 py-3 md:py-3.5 flex items-center justify-between text-white shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <CookingPot size={20} className="md:w-[22px] md:h-[22px]" strokeWidth={2.4} />
                <h2 className="text-sm md:text-base !font-bold tracking-wide !mb-0 uppercase">Preparing</h2>
              </div>
              <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white text-[#F59E0B] font-black text-xs md:text-sm flex items-center justify-center shadow-xs">
                {preparingTickets.length}
              </span>
            </div>

            {/* Column Cards List */}
            <div className="flex-1 overflow-y-auto p-2.5 md:p-3.5 lg:p-4 space-y-3 md:space-y-4 min-h-0">
              {preparingTickets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-amber-300 py-16 text-center">
                  <CookingPot size={42} strokeWidth={1.5} className="mb-2 opacity-50" />
                  <p className="text-sm font-bold text-slate-600">No active cooking</p>
                  <p className="text-xs text-slate-400">Tap "Start Cooking" on a new ticket</p>
                </div>
              ) : (
                preparingTickets.map((order) => {
                  const timer = getElapsedDuration(order.kot_preparing_at || order.kot_created_at);

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-3.5 lg:p-4.5 space-y-3 lg:space-y-3.5 shadow-sm hover:border-slate-300 transition-all duration-200"
                    >
                      {/* Top row: KOT # + Elapsed Cooking Timer */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm md:text-base font-black text-slate-900 tracking-tight">
                          {order.kot_number ? `KOT #${order.kot_number}` : order.billing_no}
                          {order.kitchen_name && selectedKitchen === "All" && (
                            <span className="ml-2 text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200">
                                {order.kitchen_name}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1 text-xs font-black text-amber-600">
                          <Clock size={15} />
                          <span>{timer.text}</span>
                        </div>
                      </div>

                      {/* Table pill */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200/60 inline-flex items-center gap-1.5">
                          <Armchair size={13} className="text-slate-500 shrink-0" />
                          <span>{order.table_no || "Table 1"}</span>
                        </span>
                      </div>

                      {/* Items Row */}
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border border-slate-100 shrink-0 bg-slate-50 flex items-center justify-center">
                              <FoodThumbnail
                                src={item.image_url}
                                alt={item.product_name}
                                fallbackSize="sm"
                              />
                            </div>
                            <span className="text-xs md:text-sm font-bold text-slate-800 truncate">
                              {item.quantity} × {item.product_name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Primary Action: Mark Ready (56px) */}
                      <button
                        onClick={() => handleTransition(order.id, "ready")}
                        disabled={actionLoadingId === order.id}
                        className="w-full min-h-[52px] md:min-h-[56px] bg-[#FEF3C7] hover:bg-amber-200 active:scale-[0.98] text-amber-950 border border-amber-300 rounded-xl font-black text-xs md:text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        <CheckCircle size={18} strokeWidth={2.5} />
                        <span>Mark Ready</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COLUMN 3: READY TO SERVE (Emerald Green Theme) */}
          <div className="flex flex-col bg-[#F0FDF4] border border-emerald-200/80 rounded-2xl md:rounded-3xl overflow-hidden shadow-sm">
            {/* Header Banner */}
            <div className="bg-[#10B981] px-4 md:px-5 py-3 md:py-3.5 flex items-center justify-between text-white shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <UtensilsCrossed size={20} className="md:w-[22px] md:h-[22px]" strokeWidth={2.4} />
                <h2 className="text-sm md:text-base !font-bold tracking-wide !mb-0 uppercase">Ready to Serve</h2>
              </div>
              <span className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white text-[#10B981] font-black text-xs md:text-sm flex items-center justify-center shadow-xs">
                {readyTickets.length}
              </span>
            </div>

            {/* Column Cards List */}
            <div className="flex-1 overflow-y-auto p-2.5 md:p-3.5 lg:p-4 space-y-3 md:space-y-4 min-h-0">
              {readyTickets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-emerald-400/80 py-16 text-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-dashed border-emerald-300 flex items-center justify-center mb-3">
                    <ChefHat size={30} className="text-emerald-500 opacity-60" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">No more orders</p>
                  <div className="flex items-center justify-center gap-1 text-xs text-slate-400 mt-0.5">
                    <Sparkles size={13} className="text-emerald-500" />
                    <span>Great job!</span>
                  </div>
                </div>
              ) : (
                readyTickets.map((order) => {
                  const timer = getElapsedDuration(order.kot_ready_at || order.kot_created_at);

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-3.5 lg:p-4.5 space-y-3 lg:space-y-3.5 shadow-sm hover:border-slate-300 transition-all duration-200"
                    >
                      {/* Top row: KOT # + Ready badge */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm md:text-base font-black text-slate-900 tracking-tight">
                          {order.kot_number ? `KOT #${order.kot_number}` : order.billing_no}
                          {order.kitchen_name && selectedKitchen === "All" && (
                            <span className="ml-2 text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-200">
                                {order.kitchen_name}
                            </span>
                          )}
                        </span>
                        <div className="text-right">
                          <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                            <Check size={15} strokeWidth={3} /> Ready
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            {timer.text} ago
                          </span>
                        </div>
                      </div>

                      {/* Table pill */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200/60 inline-flex items-center gap-1.5">
                          <Armchair size={13} className="text-slate-500 shrink-0" />
                          <span>{order.table_no || "Table 1"}</span>
                        </span>
                      </div>

                      {/* Items Row */}
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border border-slate-100 shrink-0 bg-slate-50 flex items-center justify-center">
                              <FoodThumbnail
                                src={item.image_url}
                                alt={item.product_name}
                                fallbackSize="sm"
                              />
                            </div>
                            <span className="text-xs md:text-sm font-bold text-slate-800 truncate">
                              {item.quantity} × {item.product_name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Primary Action: Served (56px) */}
                      <button
                        onClick={() => handleTransition(order.id, "served")}
                        disabled={actionLoadingId === order.id}
                        className="w-full min-h-[52px] md:min-h-[56px] bg-[#059669] hover:bg-emerald-700 active:scale-[0.98] !text-white rounded-xl font-black text-xs md:text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition cursor-pointer shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                      >
                        <Check size={20} strokeWidth={2.8} />
                        <span>Served</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ================= MOBILE VIEW (Single Column with Bottom Tabs) ================= */}
        <div className="md:hidden flex-1 flex flex-col min-h-0 pb-36">
          {/* Active Mobile Column Content */}
          {mobileActiveTab === "new" && (
            <div className="flex-1 overflow-y-auto space-y-3">
              {pendingTickets.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <Bell size={36} className="mx-auto mb-2 opacity-40 text-red-500" />
                  <p className="text-sm font-bold text-slate-600">No new orders</p>
                </div>
              ) : (
                pendingTickets.map((order) => {
                  const timer = getElapsedDuration(order.kot_created_at);
                  const isDelayed = timer.minutes >= 10;
                  const isOverdue = timer.minutes >= 5;

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-2xl border p-4 space-y-3 shadow-xs transition-all ${
                        isDelayed
                          ? "border-red-400 ring-2 ring-red-400/50 animate-pulse"
                          : isOverdue
                          ? "border-amber-400 ring-2 ring-amber-400/50 animate-pulse"
                          : "border-red-200/80"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-black text-base text-slate-900">
                          {order.kot_number ? `KOT #${order.kot_number}` : order.billing_no}
                          {order.kitchen_name && selectedKitchen === "All" && (
                            <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                {order.kitchen_name}
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-xs font-black inline-flex items-center gap-1 ${
                            isDelayed
                              ? "text-red-600"
                              : isOverdue
                              ? "text-amber-600"
                              : "text-slate-500"
                          }`}
                        >
                          <Clock size={13} />
                          <span>{timer.text}</span>
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                          <Armchair size={12} className="text-slate-500" />
                          <span>{order.table_no || "Table 1"}</span>
                        </span>
                        {isDelayed ? (
                          <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={11} /> DELAYED
                          </span>
                        ) : isOverdue ? (
                          <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={11} /> &gt; 5 MIN
                          </span>
                        ) : null}
                      </div>

                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 shrink-0 bg-slate-50 flex items-center justify-center">
                              <FoodThumbnail src={item.image_url} alt={item.product_name} fallbackSize="sm" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">
                              {item.quantity} × {item.product_name}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-1 flex gap-2">
                        <button
                          onClick={() => handleTransition(order.id, "preparing")}
                          disabled={actionLoadingId === order.id}
                          className="flex-1 min-h-[56px] bg-[#EF4444] !text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5"
                        >
                          <Play size={16} fill="currentColor" /> Start Cooking
                        </button>
                        <button
                          onClick={() => openCancelModal(order.id)}
                          className="min-h-[56px] min-w-[56px] border border-red-200 text-red-400 rounded-xl flex items-center justify-center"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {mobileActiveTab === "preparing" && (
            <div className="flex-1 overflow-y-auto space-y-3">
              {preparingTickets.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <CookingPot size={36} className="mx-auto mb-2 opacity-40 text-amber-500" />
                  <p className="text-sm font-bold text-slate-600">No active cooking</p>
                </div>
              ) : (
                preparingTickets.map((order) => {
                  const timer = getElapsedDuration(order.kot_preparing_at || order.kot_created_at);

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-amber-200/80 p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-black text-base text-slate-900">
                          {order.kot_number ? `KOT #${order.kot_number}` : order.billing_no}
                        </span>
                        <span className="text-xs font-black text-amber-600 inline-flex items-center gap-1">
                          <Clock size={13} />
                          <span>{timer.text}</span>
                        </span>
                      </div>

                      <div>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                          <Armchair size={12} className="text-slate-500" />
                          <span>{order.table_no || "Table 1"}</span>
                        </span>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 shrink-0 bg-slate-50 flex items-center justify-center">
                              <FoodThumbnail src={item.image_url} alt={item.product_name} fallbackSize="sm" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">
                              {item.quantity} × {item.product_name}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => handleTransition(order.id, "ready")}
                        disabled={actionLoadingId === order.id}
                        className="w-full min-h-[56px] bg-[#FEF3C7] text-amber-950 border border-amber-300 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle size={16} /> Mark Ready
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {mobileActiveTab === "ready" && (
            <div className="flex-1 overflow-y-auto space-y-3">
              {readyTickets.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <UtensilsCrossed size={36} className="mx-auto mb-2 opacity-40 text-emerald-500" />
                  <p className="text-sm font-bold text-slate-600">No orders ready</p>
                  <div className="flex items-center justify-center gap-1 text-xs text-slate-400 mt-0.5">
                    <Sparkles size={13} className="text-emerald-500" />
                    <span>Great job!</span>
                  </div>
                </div>
              ) : (
                readyTickets.map((order) => {
                  const timer = getElapsedDuration(order.kot_ready_at || order.kot_created_at);

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-emerald-200/80 p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-black text-base text-slate-900">
                          {order.kot_number ? `KOT #${order.kot_number}` : order.billing_no}
                        </span>
                        <span className="text-xs font-black text-emerald-600">
                          Ready ({timer.text} ago)
                        </span>
                      </div>

                      <div>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                          <Armchair size={12} className="text-slate-500" />
                          <span>{order.table_no || "Table 1"}</span>
                        </span>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-100 shrink-0 bg-slate-50 flex items-center justify-center">
                              <FoodThumbnail src={item.image_url} alt={item.product_name} fallbackSize="sm" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">
                              {item.quantity} × {item.product_name}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => handleTransition(order.id, "served")}
                        disabled={actionLoadingId === order.id}
                        className="w-full min-h-[56px] bg-[#059669] !text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5"
                      >
                        <Check size={18} strokeWidth={2.8} /> Served
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>

      {/* 3. MOBILE BOTTOM NAVIGATION (Tab Bar matching mobile design) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-2xl flex flex-col pb-safe">
        {/* Helper Guide strip with clean numbered indicators */}
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 text-[11px] font-bold text-center flex items-center justify-center">
          {mobileActiveTab === "new" && (
            <span className="text-red-600 inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
              <span>NEW ORDERS — Tap to start cooking</span>
            </span>
          )}
          {mobileActiveTab === "preparing" && (
            <span className="text-amber-600 inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
              <span>PREPARING — Tap when ready</span>
            </span>
          )}
          {mobileActiveTab === "ready" && (
            <span className="text-emerald-600 inline-flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">3</span>
              <span>READY TO SERVE — Tap after serving</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 p-1.5">
          <button
            onClick={() => setMobileActiveTab("new")}
            className={`min-h-[52px] rounded-xl flex flex-col items-center justify-center relative transition active:scale-95 cursor-pointer ${
              mobileActiveTab === "new" ? "bg-red-50 text-red-600 font-black" : "text-slate-500 font-bold"
            }`}
          >
            <Bell size={20} />
            <span className="text-[11px] mt-0.5">New</span>
            {pendingTickets.length > 0 && (
              <span className="absolute top-1 right-5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {pendingTickets.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileActiveTab("preparing")}
            className={`min-h-[52px] rounded-xl flex flex-col items-center justify-center relative transition active:scale-95 cursor-pointer ${
              mobileActiveTab === "preparing" ? "bg-amber-50 text-amber-700 font-black" : "text-slate-500 font-bold"
            }`}
          >
            <CookingPot size={20} />
            <span className="text-[11px] mt-0.5">Preparing</span>
            {preparingTickets.length > 0 && (
              <span className="absolute top-1 right-5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                {preparingTickets.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileActiveTab("ready")}
            className={`min-h-[52px] rounded-xl flex flex-col items-center justify-center relative transition active:scale-95 cursor-pointer ${
              mobileActiveTab === "ready" ? "bg-emerald-50 text-emerald-700 font-black" : "text-slate-500 font-bold"
            }`}
          >
            <UtensilsCrossed size={20} />
            <span className="text-[11px] mt-0.5">Ready</span>
            {readyTickets.length > 0 && (
              <span className="absolute top-1 right-5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">
                {readyTickets.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 4. FOOTER BAR (Desktop & Tablet) */}
      <footer className="hidden md:flex h-12 bg-white border-t border-slate-200/90 px-6 items-center justify-between text-xs text-slate-500 shrink-0">
        <div className="flex items-center gap-2">
          <ChefHat size={16} className="text-slate-400" />
          <span className="font-semibold text-slate-600 inline-flex items-center gap-1">
            Cook with Love <Heart size={13} className="text-red-500 fill-red-500 inline mx-0.5" /> &nbsp;|&nbsp; Good Food, Happy Customers!
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchQueue(true)}
            disabled={loading}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Last sync: {secondsSinceSync}s ago</span>
          </button>
        </div>
      </footer>

      {/* 5. CANCELLATION MODAL */}
      <Modal
        title={
          <span className="font-black text-red-600 flex items-center gap-2">
            <Ban size={18} /> Cancel Kitchen Order Ticket
          </span>
        }
        open={cancelModalVisible}
        onCancel={() => {
          setCancelModalVisible(false);
          setCancelTargetId(null);
        }}
        footer={null}
        width={380}
        centered
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-600 font-medium">
            Are you sure you want to cancel this KOT? Please enter a cancellation reason for kitchen records:
          </p>

          <Input.TextArea
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Customer changed mind, out of stock..."
            className="rounded-xl text-xs font-medium"
          />

          <div className="flex gap-2.5 pt-2">
            <button
              onClick={() => {
                setCancelModalVisible(false);
                setCancelTargetId(null);
              }}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={handleCancelSubmit}
              disabled={cancelling}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 !text-white text-xs font-bold shadow-sm shadow-red-500/20 disabled:opacity-50 cursor-pointer"
            >
              {cancelling ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
