import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext
} from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  ServerOff,
  AlertTriangle,
  X
} from "lucide-react";
import { notification as staticNotification, App } from "antd";
import { BASE_API } from "../../api/api.js";

// Network Status Context for consumption across POS, Waiter, KDS, Billing, and Admin pages
export const NetworkContext = createContext({
  status: "ONLINE", // 'ONLINE' | 'INTERNET_OFFLINE' | 'SERVER_OFFLINE'
  isConnected: true,
  isInternetDown: false,
  isServerDown: false,
  checkStatus: async () => true,
});

export const useNetworkStatus = () => useContext(NetworkContext);

const DEDUPE_TOAST_KEY = "NETWORK_STATUS_ALERT_TOAST";

/**
 * Production-Grade Network Status Provider & Notifier
 *
 * Key Architectural Highlights:
 * 1. Wraps children properly: All routes have access to useNetworkStatus().
 * 2. Primary Health Check: First verifies POS Backend /health (HTTP 200 + { status: 'ok' }).
 *    If backend is reachable, never falsely declares internet outage (immune to corporate firewall/CSP probe blocks).
 * 3. Supplementary Internet Probes: When backend fails, probes Google/Cloudflare to differentiate
 *    between WAN internet failure (🔴 INTERNET_OFFLINE) vs Backend crash (🟡 SERVER_OFFLINE).
 * 4. Request Sequencing & In-Flight Guard: Prevents overlapping checks and discards stale out-of-order results.
 * 5. Prompt Probe Cancellation: Uses AbortController to immediately cancel remaining probes once one succeeds.
 * 6. POS Safe: Purely a notifier; never wipes carts, orders, or local storage.
 */
export function NetworkProvider({ children }) {
  const antdApp = App.useApp ? App.useApp() : null;
  const notify = antdApp?.notification || staticNotification;
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  const [status, setStatus] = useState("ONLINE");
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Refs for tracking state, race prevention, and in-flight deduplication
  const statusRef = useRef("ONLINE");
  const consecutiveFailuresRef = useRef(0);
  const recoveryTimerRef = useRef(null);
  const pollTimerRef = useRef(null);
  const checkSeqRef = useRef(0);
  const inFlightPromiseRef = useRef(null);

  // Helper to safely transition state without duplicate toasts
  const transitionTo = useCallback((newStatus, options = {}) => {
    const prevStatus = statusRef.current;
    if (prevStatus === newStatus && !options.forceToast) {
      return;
    }

    statusRef.current = newStatus;
    setStatus(newStatus);

    if (newStatus === "ONLINE") {
      // Clear any persistent error toast
      notifyRef.current?.destroy(DEDUPE_TOAST_KEY);

      // Only show recovery banner if recovering from a previous outage
      if (prevStatus !== "ONLINE" || options.isRecovery) {
        if (recoveryTimerRef.current) {
          clearTimeout(recoveryTimerRef.current);
        }

        setShowRecoveryBanner(true);
        notifyRef.current?.success({
          key: "NETWORK_RECOVERY_TOAST",
          message: "Connection Restored",
          description: "Connected to internet and backend services. System is online.",
          placement: "topRight",
          duration: 4,
        });

        // Hide recovery banner after 4 seconds
        recoveryTimerRef.current = setTimeout(() => {
          setShowRecoveryBanner(false);
        }, 4000);
      }
    } else {
      // If going offline, immediately cancel any active recovery banner
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
      }
      setShowRecoveryBanner(false);
      setDismissed(false);

      if (newStatus === "INTERNET_OFFLINE") {
        notifyRef.current?.error({
          key: DEDUPE_TOAST_KEY,
          message: "No Internet Connection",
          description: "Your device is connected to local network/Wi-Fi, but there is no internet access. Check router or WAN connection.",
          placement: "topRight",
          duration: 0, // Persistent until reconnected
        });
      } else if (newStatus === "SERVER_OFFLINE") {
        notifyRef.current?.warning({
          key: DEDUPE_TOAST_KEY,
          message: "POS Server Unavailable",
          description: "Internet is working, but the POS backend server is unreachable. Reconnecting...",
          placement: "topRight",
          duration: 0, // Persistent until reconnected
        });
      }
    }
  }, []);

  /**
   * Primary Backend Health Check
   * Validates that the POS backend is strictly responding with HTTP 200 and { status: 'ok' }.
   * Promptly aborts request and clears timer in finally block.
   */
  const checkServerAccess = useCallback(async (timeoutMs = 2500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const healthUrl = `${BASE_API.replace(/\/api\/v1\/?$/, "")}/health?_t=${Date.now()}`;
      const res = await fetch(healthUrl, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (res.status === 200) {
        const data = await res.json().catch(() => null);
        return data?.status === "ok";
      }
      return false;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }, []);

  /**
   * Supplementary Public Internet Probe
   * Concurrently probes four high-availability public endpoints using Promise.any.
   * As soon as ANY probe succeeds, remaining probes are immediately aborted.
   */
  const checkInternetAccess = useCallback(async (timeoutMs = 2500) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return false;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const probes = [
        fetch(`https://www.google.com/generate_204?_t=${Date.now()}`, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch(`https://1.1.1.1/cdn-cgi/trace?_t=${Date.now()}`, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch(`https://connectivitycheck.gstatic.com/generate_204?_t=${Date.now()}`, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch(`https://dns.google/resolve?name=example.com&_t=${Date.now()}`, {
          method: "GET",
          mode: "cors",
          cache: "no-store",
          signal: controller.signal,
        }),
      ];

      await Promise.any(probes);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
      // Cancel remaining pending probes to avoid lingering network requests
      controller.abort();
    }
  }, []);

  /**
   * Dual Probe Connectivity Test
   * 1. Check POS backend health first (primary). If healthy, the app is 100% ONLINE.
   * 2. If backend fails, check public internet to differentiate WAN outage vs Backend outage.
   */
  const performConnectivityTest = useCallback(async () => {
    // Physical hardware disconnect
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { internetOk: false, serverOk: false };
    }

    // 1. Primary Check: POS Backend Server
    const serverOk = await checkServerAccess(2500);

    // If POS backend is healthy, application connectivity is 100% working!
    // Never declare an internet outage when the POS backend is responding normally.
    if (serverOk) {
      return { internetOk: true, serverOk: true };
    }

    // 2. Secondary Check: Backend is unreachable.
    // Probe public endpoints to distinguish between "No Internet" vs "POS Server Down".
    const internetOk = await checkInternetAccess(2500);

    return { internetOk, serverOk: false };
  }, [checkServerAccess, checkInternetAccess]);

  /**
   * Evaluates connection with in-flight deduplication & request sequence guard
   */
  const evaluateConnection = useCallback(
    async (isImmediate = false) => {
      // Deduplicate background checks if already in flight
      if (inFlightPromiseRef.current && !isImmediate) {
        return inFlightPromiseRef.current;
      }

      const seq = ++checkSeqRef.current;

      const runCheck = async () => {
        try {
          const { internetOk, serverOk } = await performConnectivityTest();

          // Sequence Guard: Discard stale result if a newer check was started
          if (seq !== checkSeqRef.current) {
            return statusRef.current === "ONLINE";
          }

          if (internetOk && serverOk) {
            consecutiveFailuresRef.current = 0;
            transitionTo("ONLINE", { isRecovery: statusRef.current !== "ONLINE" });
            return true;
          }

          // Immediate failure transition (manual retry, failed API request, hardware disconnect)
          if (isImmediate || (typeof navigator !== "undefined" && navigator.onLine === false)) {
            consecutiveFailuresRef.current = 2;
            if (!internetOk) {
              transitionTo("INTERNET_OFFLINE", { forceToast: isImmediate });
            } else {
              transitionTo("SERVER_OFFLINE", { forceToast: isImmediate });
            }
            return false;
          }

          // Routine background heartbeat dampening: require 2 consecutive failures
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current >= 2) {
            if (!internetOk) {
              transitionTo("INTERNET_OFFLINE");
            } else {
              transitionTo("SERVER_OFFLINE");
            }
          }

          return false;
        } finally {
          if (inFlightPromiseRef.current === runningPromise) {
            inFlightPromiseRef.current = null;
          }
        }
      };

      const runningPromise = runCheck();
      inFlightPromiseRef.current = runningPromise;
      return runningPromise;
    },
    [performConnectivityTest, transitionTo]
  );

  // Manual Retry Handler with spinner feedback
  const handleManualRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const isHealthy = await evaluateConnection(true);
      if (!isHealthy) {
        const errorMsg =
          statusRef.current === "SERVER_OFFLINE"
            ? "POS Backend server is still unreachable. Please verify server status."
            : "Internet connection is still unavailable. Please check your router / Wi-Fi.";

        notifyRef.current?.info({
          key: "RETRY_FEEDBACK_TOAST",
          message: "Connectivity Check Result",
          description: errorMsg,
          duration: 3,
        });
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // Browser & Application Event Listeners
  useEffect(() => {
    const handleBrowserOffline = () => {
      consecutiveFailuresRef.current = 2; // Immediate offline
      transitionTo("INTERNET_OFFLINE");
    };

    const handleBrowserOnline = () => {
      // Browser says network interface is back up; verify true internet immediately
      evaluateConnection(true);
    };

    const handleAppNetworkOffline = () => {
      // Axios request failed: immediately evaluate connection without waiting
      evaluateConnection(true);
    };

    const handleAppNetworkOnline = () => {
      if (statusRef.current !== "ONLINE") {
        evaluateConnection(true);
      }
    };

    window.addEventListener("offline", handleBrowserOffline);
    window.addEventListener("online", handleBrowserOnline);
    window.addEventListener("app:network-offline", handleAppNetworkOffline);
    window.addEventListener("app:network-online", handleAppNetworkOnline);

    return () => {
      window.removeEventListener("offline", handleBrowserOffline);
      window.removeEventListener("online", handleBrowserOnline);
      window.removeEventListener("app:network-offline", handleAppNetworkOffline);
      window.removeEventListener("app:network-online", handleAppNetworkOnline);
    };
  }, [evaluateConnection, transitionTo]);

  // Initial mount check: immediately verify connectivity upon application load
  useEffect(() => {
    evaluateConnection(true);
  }, [evaluateConnection]);

  // Periodic heartbeat polling: poll every 12s if online, every 5s if offline
  useEffect(() => {
    const pollInterval = status === "ONLINE" ? 12000 : 5000;

    pollTimerRef.current = setInterval(() => {
      evaluateConnection(false);
    }, pollInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [status, evaluateConnection]);

  // Cleanup timers and notifications on unmount
  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      notifyRef.current?.destroy(DEDUPE_TOAST_KEY);
    };
  }, []);

  const contextValue = {
    status,
    isConnected: status === "ONLINE",
    isInternetDown: status === "INTERNET_OFFLINE",
    isServerDown: status === "SERVER_OFFLINE",
    checkStatus: () => evaluateConnection(true),
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {/* Banner Layer: Fixed on top, pointer-events-none on backdrop, pointer-events-auto on banner */}
      {(status !== "ONLINE" || showRecoveryBanner) && (
        <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none flex justify-center px-3 pt-2 sm:pt-3">
          {/* 🔴 INTERNET OUTAGE BANNER */}
          {status === "INTERNET_OFFLINE" && !dismissed && (
            <div
              role="alert"
              aria-live="assertive"
              className="pointer-events-auto max-w-xl w-full bg-rose-600/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-rose-400/40 p-3 sm:px-4 sm:py-3 animate-in slide-in-from-top-4 duration-300 transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
                  <WifiOff size={19} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs sm:text-sm tracking-tight leading-tight">
                      No Internet Connection
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-900/60 border border-rose-400/50 uppercase tracking-wider">
                      Offline
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-100 font-medium truncate mt-0.5">
                    Device is connected to network/Wi-Fi, but internet is not available. Please check router or WAN.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isRetrying}
                  onClick={handleManualRetry}
                  className="px-2.5 py-1.5 rounded-xl bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw size={13} className={isRetrying ? "animate-spin" : ""} />
                  <span className="hidden sm:inline">{isRetrying ? "Checking..." : "Retry"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-rose-200 hover:text-white transition cursor-pointer"
                  title="Dismiss banner"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* 🟡 BACKEND SERVER OUTAGE BANNER */}
          {status === "SERVER_OFFLINE" && !dismissed && (
            <div
              role="alert"
              aria-live="assertive"
              className="pointer-events-auto max-w-xl w-full bg-amber-600/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-amber-400/40 p-3 sm:px-4 sm:py-3 animate-in slide-in-from-top-4 duration-300 transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
                  <ServerOff size={19} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs sm:text-sm tracking-tight leading-tight">
                      POS Server Unavailable
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-900/60 border border-amber-400/50 uppercase tracking-wider">
                      Server Error
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-100 font-medium truncate mt-0.5">
                    Internet is connected, but the backend server is unreachable. Reconnecting...
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isRetrying}
                  onClick={handleManualRetry}
                  className="px-2.5 py-1.5 rounded-xl bg-white text-amber-800 hover:bg-amber-50 text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw size={13} className={isRetrying ? "animate-spin" : ""} />
                  <span className="hidden sm:inline">{isRetrying ? "Checking..." : "Retry"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-amber-200 hover:text-white transition cursor-pointer"
                  title="Dismiss banner"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* 🟢 CONNECTION RESTORED SUCCESS BANNER */}
          {showRecoveryBanner && status === "ONLINE" && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-auto max-w-md w-full bg-emerald-600/95 backdrop-blur-md text-white rounded-2xl shadow-xl border border-emerald-400/40 px-4 py-2.5 animate-in slide-in-from-top-4 duration-300 transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Wifi size={17} className="text-white" />
                </div>
                <div>
                  <span className="font-black text-xs sm:text-sm block leading-tight">
                    Connection Restored!
                  </span>
                  <span className="text-[11px] text-emerald-100 font-medium">
                    You are back online. All operations connected.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecoveryBanner(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 text-emerald-200 hover:text-white transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Render children so all child components can consume useNetworkStatus() */}
      {children}
    </NetworkContext.Provider>
  );
}

// Default export and backward-compatible alias
export const NetworkStatusNotifier = NetworkProvider;
export default NetworkProvider;
