import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  CookingPot,
  ReceiptText,
  Menu,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

/**
 * MobileBottomNav - Google Material Design 3 Bottom Navigation Dock
 * Provides instant 1-thumb switching between core operational functions on mobile devices (<768px).
 */
export default function MobileBottomNav({ onOpenMenu }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { primaryColor } = useTheme();

  const navItems = [
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
      key: "pos",
      label: "POS",
      path: "/billing/pos",
      icon: ShoppingCart,
      isPrimaryAction: true,
    },
    {
      key: "kitchen",
      label: "Kitchen",
      path: "/billing/kitchen",
      icon: CookingPot,
    },
    {
      key: "more",
      label: "More",
      action: onOpenMenu,
      icon: Menu,
    },
  ];

  const isCurrentActive = (item) => {
    if (item.path) {
      if (item.path === "/dashboard") {
        return location.pathname === "/dashboard";
      }
      return location.pathname.startsWith(item.path);
    }
    return false;
  };

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-5 items-center w-full max-w-lg mx-auto">
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
                className={`flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200 ${active
                    ? "bg-indigo-100/90 shadow-xs"
                    : item.isPrimaryAction
                      ? "bg-blue-50/80 group-hover:bg-blue-100/60"
                      : "bg-transparent group-hover:bg-slate-100/60"
                  }`}
                style={
                  active && primaryColor
                    ? { backgroundColor: `${primaryColor}18` }
                    : undefined
                }
              >
                <Icon
                  size={19}
                  strokeWidth={active ? 2.5 : 2}
                  className={`transition-colors duration-200 ${active
                      ? "text-indigo-600"
                      : item.isPrimaryAction
                        ? "text-blue-600"
                        : "text-slate-600 group-hover:text-slate-900"
                    }`}
                  style={active && primaryColor ? { color: primaryColor } : undefined}
                />
              </div>

              {/* Label */}
              <span
                className={`text-[10px] tracking-tight mt-0.5 leading-none transition-all duration-200 truncate max-w-full px-0.5 text-center ${active
                    ? "font-black text-indigo-700"
                    : "font-semibold text-slate-500 group-hover:text-slate-800"
                  }`}
                style={active && primaryColor ? { color: primaryColor } : undefined}
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
