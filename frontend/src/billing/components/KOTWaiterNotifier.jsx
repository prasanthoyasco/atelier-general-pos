import React, { useEffect, useRef } from "react";
import { notification } from "antd";
import { UtensilsCrossed } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useBranch } from "../../context/BranchContext.jsx";
import { kotChannel, broadcastKOTEvent } from "../utils/kotBroadcast.js";
import billingService from "../service/billingService.js";

// Audio alert helper
const playNotificationSound = () => {
  try {
    const audio = new Audio("/order_placed_notification.mp3");
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => playSynthBeep());
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
    osc.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("Audio playback blocked:", e);
  }
};

export default function KOTWaiterNotifier() {
  const { user } = useAuth() || {};
  const { userRole, selectedBranch } = useBranch() || {};
  const activeNotificationsRef = useRef(new Set());

  useEffect(() => {
    if (!kotChannel) return;

    const roleStr = (userRole || user?.role_name || user?.role?.role_name || user?.role || localStorage.getItem("userRole") || "").toLowerCase();
    const isKitchen = roleStr.includes("kitchen");
    const isWaiter = !isKitchen;

    const handleBroadcast = async (e) => {
      const eventType = e.data?.type;
      const payload = e.data?.payload || {};
      const ticketId = payload.id || e.data?.id;
      const newStatus = payload.status || e.data?.status;

      // 1. KOT Created: only notify if user is kitchen user
      if (eventType === "NEW_KOT_ORDER") {
        if (isKitchen) {
          playNotificationSound();
        }
        return;
      }

      // 2. KOT / Item Served: dismiss active popup
      if (
        eventType === "KOT_SERVED" ||
        eventType === "KOT_ITEM_SERVED" ||
        (eventType === "KOT_STATUS_UPDATED" && newStatus === "served")
      ) {
        if (ticketId) {
          notification.destroy(ticketId);
          activeNotificationsRef.current.delete(ticketId);
        }
        return;
      }

      // 3. Individual Item Ready for Pickup: notify waiter/order taker
      if (eventType === "KOT_ITEM_STATUS_UPDATED" && newStatus === "ready") {
        if (isWaiter) {
          playNotificationSound();

          const prodName = payload.product_name || "Food Item";
          const kitchenName = payload.kitchen_name || "Kitchen";
          const tableLabel = payload.table_no || "Table";
          const itemId = payload.kot_item_id || payload.item_id;

          notification.success({
            message: (
              <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                <UtensilsCrossed size={16} className="text-emerald-600" />
                Item Ready at {kitchenName}!
              </span>
            ),
            description: (
              <div className="space-y-1 text-xs">
                <p className="font-black text-slate-800">
                  {prodName} • {tableLabel}
                </p>
                <p className="text-slate-600">
                  Ready at <strong>{kitchenName}</strong> pass. Please pick up and serve.
                </p>
              </div>
            ),
            btn: itemId ? (
              <button
                onClick={async () => {
                  try {
                    notification.destroy(itemId);
                    activeNotificationsRef.current.delete(itemId);
                    const branchId = selectedBranch?.id !== "all" ? selectedBranch?.id : null;
                    await billingService.serveKOTItem(itemId, null, branchId);
                    broadcastKOTEvent("KOT_ITEM_SERVED", { kot_item_id: itemId });
                    broadcastKOTEvent("KOT_STATUS_UPDATED", { kot_item_id: itemId });
                  } catch (err) {
                    console.error("Failed to mark item served:", err);
                  }
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] !text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Mark Item Served
              </button>
            ) : null,
            key: itemId || `item-ready-${Date.now()}`,
            duration: 15,
            placement: "topRight",
          });

          if (itemId) {
            activeNotificationsRef.current.add(itemId);
          }
        }
        return;
      }

      // 4. Full or Partial KOT Ready to Serve: notify waiter/order taker user
      if (eventType === "KOT_STATUS_UPDATED" && (newStatus === "ready" || newStatus === "partially_ready")) {
        if (isWaiter) {
          // Play sound
          playNotificationSound();

          const kotLabel = payload.kot_number ? `KOT #${payload.kot_number}` : (payload.billing_no || "KOT Order");
          const tableLabel = payload.table_no || "Table";
          const isPartial = newStatus === "partially_ready";

          notification.success({
            message: (
              <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                <UtensilsCrossed size={16} className="text-emerald-600" />
                {isPartial ? "Order Partially Ready!" : "Order Ready to Serve!"}
              </span>
            ),
            description: (
              <div className="space-y-1 text-xs">
                <p className="font-black text-slate-800">{kotLabel} • {tableLabel}</p>
                <p className="text-slate-600">
                  {isPartial
                    ? "Some items are cooked and waiting at kitchen pass."
                    : "All items are cooked and ready to serve to customer."}
                </p>
              </div>
            ),
            btn: ticketId ? (
              <button
                onClick={async () => {
                  try {
                    notification.destroy(ticketId);
                    activeNotificationsRef.current.delete(ticketId);
                    const branchId = selectedBranch?.id !== "all" ? selectedBranch?.id : null;
                    await billingService.updateKOTStatus(ticketId, "served", null, branchId);
                    broadcastKOTEvent("KOT_STATUS_UPDATED", { id: ticketId, status: "served" });
                    broadcastKOTEvent("KOT_SERVED", { id: ticketId });
                  } catch (err) {
                    console.error("Failed to mark order served:", err);
                  }
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] !text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Mark as Served
              </button>
            ) : null,
            key: ticketId || `ready-${Date.now()}`,
            duration: 15,
            placement: "topRight",
          });

          if (ticketId) {
            activeNotificationsRef.current.add(ticketId);
          }
        }
      }
    };

    kotChannel.addEventListener("message", handleBroadcast);
    return () => {
      kotChannel.removeEventListener("message", handleBroadcast);
    };
  }, [user, userRole, selectedBranch]);

  return null;
}
