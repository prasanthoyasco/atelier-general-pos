// Real-time zero-delay cross-tab synchronization channel for POS and Kitchen Display
export const kotChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("kot_kitchen_sync_channel")
    : null;

export const broadcastKOTEvent = (type, payload = {}) => {
  try {
    if (kotChannel) {
      kotChannel.postMessage({ type, payload, timestamp: Date.now() });
    }
  } catch (err) {
    console.warn("BroadcastChannel postMessage error:", err);
  }
};
