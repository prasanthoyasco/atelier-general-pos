import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  CookingPot,
  ReceiptText,
  Menu,
  Sparkles,
  Boxes,
  UtensilsCrossed,
  BarChart3,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";

/**
 * MobileBottomNav - Google Material Design 3 Bottom Navigation Dock
 * Provides instant 1-thumb switching between core operational functions on mobile devices (<768px).
 * Dynamically switches between Executive Business Insights for Admins and operational tools for staff.
 */
export default function MobileBottomNav({ onOpenMenu }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { primaryColor } = useTheme();
  const { user } = useAuth();
  const { userRole } = useBranch() || {};

  // Resolve role
  const role = useMemo(() => {
    return (
      userRole ||
      user?.role?.role_name ||
      user?.role_name ||
      user?.role ||
      localStorage.getItem("userRole") ||
      ""
    ).toLowerCase();
  }, [userRole, user]);

  const isOperationalStaff = useMemo(() => {
    return (
      role === "waiter" ||
      role === "order taker" ||
      role === "kitchen"
    );
  }, [role]);

  // Dynamic Navigation Items based on user role
  const navItems = useMemo(() => {
    // 1️⃣ Waiter / Order Taker dock
    if (role === "waiter" || role === "order taker") {
      return [
        {
          key: "waiter",
          label: "Waiter",
          path: "/billing/waiter",
          icon: UtensilsCrossed,
          isPrimaryAction: true,
        },
        {
          key: "pos",
          label: "POS",
          path: "/billing/pos",
          icon: ShoppingCart,
        },
        {
          key: "bills",
          label: "Orders",
          path: "/billing/list",
          icon: ReceiptText,
        },
        {
          key: "more",
          label: "More",
          action: onOpenMenu,
          icon: Menu,
        },
      ];
    }

    // 2️⃣ Kitchen staff dock
    if (role === "kitchen") {
      return [
        {
          key: "kitchen",
          label: "Kitchen",
          path: "/billing/kitchen",
          icon: CookingPot,
          isPrimaryAction: true,
        },
        {
          key: "bills",
          label: "Orders",
          path: "/billing/list",
          icon: ReceiptText,
        },
        {
          key: "more",
          label: "More",
          action: onOpenMenu,
          icon: Menu,
        },
      ];
    }

    // 3️⃣ ADMIN / OWNER / MANAGER DOCK:
    // POS and Kitchen KDS are replaced with Unified Insights Hub and Inventory Analysis!
    return [
      {
        key: "dashboard",
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        key: "bills",
        label: "Bill",
        path: "/billing/list",
        icon: ReceiptText,
      },
      {
        key: "insights",
        label: "Insights",
        path: "/billing/insights",
        icon: Sparkles,
        isPrimaryAction: true,
      },
      {
        key: "inventory",
        label: "Inventory",
        path: "/stock/daily-inventory",
        icon: Boxes,
      },
      {
        key: "more",
        label: "More",
        action: onOpenMenu,
        icon: Menu,
      },
    ];
  }, [role, onOpenMenu]);

  const isCurrentActive = (item) => {
    if (item.path) {
      if (item.path === "/dashboard") {
        return location.pathname === "/dashboard";
      }
      if (item.path === "/billing/insights" || item.path === "/insights") {
        return location.pathname.startsWith("/billing/insights") || location.pathname === "/insights";
      }
      if (item.path === "/stock/daily-inventory") {
        return (
          location.pathname.startsWith("/stock/daily-inventory") ||
          location.pathname.startsWith("/billing/daily-inventory") ||
          location.pathname.startsWith("/stock/list")
        );
      }
      return location.pathname.startsWith(item.path);
    }
    return false;
  };

  const gridColsClass =
    navItems.length === 4 ? "grid-cols-4" : navItems.length === 3 ? "grid-cols-3" : "grid-cols-5";

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className={`grid ${gridColsClass} items-center w-full max-w-lg mx-auto`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrentActive(item);

          return (
            <button
              key={item.key}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else if (item.path) {
                  navigate(item.path);
                }
              }}
              className="relative flex flex-col items-center justify-center py-1 px-0.5 w-full min-h-[48px] rounded-xl transition-all duration-200 active:scale-90 group cursor-pointer select-none"
            >
              {/* M3 Active Tonal Pill Behind Icon */}
              <div
                className={`flex items-center justify-center transition-all duration-200 ${
                  item.isPrimaryAction
                    ? active
                      ? "w-12 h-7.5 rounded-full bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                      : "w-11 h-7 rounded-full bg-indigo-100 text-indigo-700 shadow-xs group-hover:bg-indigo-200"
                    : active
                    ? "w-11 h-7 rounded-full bg-indigo-100/90 shadow-xs"
                    : "w-11 h-7 rounded-full bg-transparent group-hover:bg-slate-100/60"
                }`}
                style={
                  active && primaryColor && !item.isPrimaryAction
                    ? { backgroundColor: `${primaryColor}18` }
                    : undefined
                }
              >
                <Icon
                  size={item.isPrimaryAction ? 18 : 19}
                  strokeWidth={active ? 2.5 : 2}
                  className={`transition-colors duration-200 ${
                    item.isPrimaryAction
                      ? active
                        ? "text-white"
                        : "text-indigo-700"
                      : active
                      ? "text-indigo-600"
                      : "text-slate-600 group-hover:text-slate-900"
                  }`}
                  style={
                    active && primaryColor && !item.isPrimaryAction
                      ? { color: primaryColor }
                      : undefined
                  }
                />
              </div>

              {/* Label */}
              <span
                className={`text-[10px] tracking-tight mt-0.5 leading-none transition-all duration-200 truncate max-w-full px-0.5 text-center ${
                  active
                    ? "font-black text-indigo-700"
                    : item.isPrimaryAction
                    ? "font-bold text-indigo-800"
                    : "font-semibold text-slate-500 group-hover:text-slate-800"
                }`}
                style={
                  active && primaryColor && !item.isPrimaryAction
                    ? { color: primaryColor }
                    : undefined
                }
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
