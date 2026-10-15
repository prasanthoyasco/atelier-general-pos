import { Suspense, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./components/layout/Mainlayout";
import { useAuth } from "./context/AuthContext";
import {
  LayoutDashboard,
  IndianRupee,
  Box,
  Tags,
  Layers,
  ShoppingCart,
  Database,
  Users,
  Percent,
  User,
  BarChart,
  Megaphone,
  UserCheck,
  TrendingUp,
  Ticket,
  Utensils,
  MonitorSmartphone,
  List,
  UtensilsCrossed,
  Receipt
} from "lucide-react";
import CustomerBillCopy from "./billing/pages/CustomerBillCopy";
import CustomerBillForm from "./billing/pages/CustomerBillingForm";
import POSPage from "./billing/pages/POSPage";
import WaiterPage from "./billing/pages/WaiterPage";
import KOTKitchenDashboard from "./billing/pages/KOTKitchenDashboard";
import Login from "./login/Login";
import EmployeeLogin from "./login/EmployeeLogin";
import ProtectedRoute from "./context/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { BranchProvider } from "./context/BranchContext";
import { EmployeeAuthProvider } from "./context/EmployeeAuthContext";
import ProtectedEmployeeRoute from "./context/ProtectedEmployeeRoute";
import EmployeeLayout from "./components/layout/EmployeeLayout";
import EmployeeDashboard from "./employee/EmployeeDashboard";
import EmployeeOverview from "./employee/pages/EmployeeOverview";
import EmployeeAttendance from "./employee/pages/EmployeeAttendance";
import EmployeeLeaves from "./employee/pages/EmployeeLeaves";
import EmployeeLeaveBalance from "./employee/pages/EmployeeLeaveBalance";
import EmployeeDocuments from "./employee/pages/EmployeeDocuments";
import EmployeePayslip from "./employee/pages/EmployeePayslip";
import EmployeeAdvance from "./employee/pages/EmployeeAdvance";
import Loading from "./utils/Loading";
import Settings from "./components/pages/Settings";
import ComingSoon from "./billing/pages/ComingSoon";
import DeveloperLogin from "./ticket/pages/DeveloperLogin";
import DeveloperPortal from "./ticket/pages/DeveloperPortal";
const routeModules = import.meta.glob("./*/AppRoutes.jsx", { eager: true });
const moduleIcons = {
  dashboard: /* @__PURE__ */ React.createElement(LayoutDashboard, { size: 20 }),
  billing: /* @__PURE__ */ React.createElement(IndianRupee, { size: 20 }),
  Product: /* @__PURE__ */ React.createElement(Box, { size: 20 }),
  Category: /* @__PURE__ */ React.createElement(Tags, { size: 20 }),
  subcategory: /* @__PURE__ */ React.createElement(Layers, { size: 20 }),
  inward: /* @__PURE__ */ React.createElement(ShoppingCart, { size: 20 }),
  stock: /* @__PURE__ */ React.createElement(Database, { size: 20 }),
  customer: /* @__PURE__ */ React.createElement(Users, { size: 20 }),
  coupon: /* @__PURE__ */ React.createElement(Percent, { size: 20 }),
  user: /* @__PURE__ */ React.createElement(User, { size: 20 }),
  marketing: /* @__PURE__ */ React.createElement(Megaphone, { size: 20 }),
  employee: /* @__PURE__ */ React.createElement(UserCheck, { size: 20 }),
  ticket: /* @__PURE__ */ React.createElement(Ticket, { size: 20 })
};
import { ConfigProvider } from "antd";
const App = () => {
  return /* @__PURE__ */ React.createElement(
    ConfigProvider,
    {
      theme: {
        token: {
          colorPrimary: "#4F46E5",
          colorSuccess: "#10B981",
          colorWarning: "#F59E0B",
          colorError: "#EF4444",
          colorInfo: "#3B82F6",
          colorBgLayout: "#F8FAFC",
          colorBgContainer: "#FFFFFF",
          colorBorder: "#E2E8F0",
          colorText: "#0F172A",
          colorTextSecondary: "#475569",
          borderRadius: 8,
          fontFamily: "var(--font-sans)"
        },
        components: {
          Card: {
            boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
            borderRadiusLG: 16
          },
          Table: {
            headerBg: "#f8fafc",
            headerColor: "#475569",
            rowHoverBg: "#f1f5f9",
            borderRadiusLG: 12
          },
          Button: {
            controlHeight: 40
          },
          Input: {
            controlHeight: 40
          },
          Select: {
            controlHeight: 40
          }
        }
      }
    },
    /* @__PURE__ */ React.createElement(BrowserRouter, null, /* @__PURE__ */ React.createElement(AuthProvider, null, /* @__PURE__ */ React.createElement(EmployeeAuthProvider, null, /* @__PURE__ */ React.createElement(BranchProvider, null, /* @__PURE__ */ React.createElement(Loading, { duration: 3e3 }), /* @__PURE__ */ React.createElement(Suspense, { fallback: /* @__PURE__ */ React.createElement("div", { className: "p-4" }, /* @__PURE__ */ React.createElement(Loading, null)) }, /* @__PURE__ */ React.createElement(AppInner, null))))))
  );
};
function AppInner() {
  const { user } = useAuth();
  const userRoleName = (user?.role?.role_name || user?.role_name || "").toLowerCase();
  const isSuperAdmin = userRoleName === "super admin" || userRoleName === "super admin";
  const modules = Object.entries(routeModules).map(([path, mod]) => {
    const match = path.match(/\.\/(.*?)\/AppRoutes\.jsx$/);
    const name = match?.[1];
    return {
      name,
      path: `/${name}/*`,
      element: mod.default,
      menuItems: mod[`${name}MenuItems`] || []
    };
  });
  const menuItems = useMemo(() => {
    if (userRoleName === "kitchen") {
      return [
        {
          key: "/billing/kitchen",
          label: "Kitchen Display",
          icon: /* @__PURE__ */ React.createElement(Utensils, { size: 20 }),
          children: null
        }
      ];
    }
    if (userRoleName === "order taker" || userRoleName === "waiter") {
      return [
        {
          key: "/billing/waiter",
          label: "Waiter Service",
          icon: /* @__PURE__ */ React.createElement(UtensilsCrossed, { size: 20 }),
          children: null
        },
        {
          key: "/billing/pos",
          label: "POS Terminal",
          icon: /* @__PURE__ */ React.createElement(MonitorSmartphone, { size: 20 }),
          children: null
        },
        {
          key: "/billing/list",
          label: "My Orders",
          icon: /* @__PURE__ */ React.createElement(Receipt, { size: 20 }),
          children: null
        }
      ];
    }
    const items = modules.filter(({ name }) => name !== "Category" && name !== "subcategory").map(({ name, menuItems: menuItems2 }) => {
      if (name === "dashboard") {
        return {
          key: "/dashboard",
          icon: moduleIcons[name] || null,
          label: "Dashboard",
          children: null
        };
      }
      if (menuItems2 && menuItems2.length === 1) {
        return {
          key: menuItems2[0].key,
          // use actual child route
          icon: moduleIcons[name] || null,
          label: name.charAt(0).toUpperCase() + name.slice(1),
          children: null
        };
      }
      if (menuItems2 && menuItems2.length > 1) {
        const filteredChildren = name === "ticket" ? menuItems2.filter((item) => item.key !== "/ticket/developers" || isSuperAdmin) : menuItems2;
        return {
          key: name,
          icon: moduleIcons[name] || null,
          label: name.charAt(0).toUpperCase() + name.slice(1),
          children: filteredChildren
        };
      }
      return {
        key: `/${name}`,
        icon: moduleIcons[name] || null,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        children: null
      };
    });
    items.push({
      key: "/billing/reports",
      label: "Sales Report",
      icon: /* @__PURE__ */ React.createElement(BarChart, { size: 20 }),
      children: null
    });
    items.push({
      key: "/billing/source-wise-report",
      label: "Source-wise Report",
      icon: /* @__PURE__ */ React.createElement(TrendingUp, { size: 20 }),
      children: null
    });
    items.sort((a, b) => {
      if (a.key === "/dashboard") return -1;
      if (b.key === "/dashboard") return 1;
      return 0;
    });
    return items;
  }, [modules]);
  const getDefaultRedirect = () => {
    if (userRoleName === "kitchen") return "/billing/kitchen";
    if (userRoleName === "order taker" || userRoleName === "waiter") return "/billing/waiter";
    const filteredModules = modules.filter((mod) => mod.name !== "dashboard");
    return filteredModules.length > 0 ? `/${filteredModules[0].name}/pages/dashboard` : "/404";
  };
  return /* @__PURE__ */ React.createElement(Routes, null, /* @__PURE__ */ React.createElement(Route, { path: "/", element: /* @__PURE__ */ React.createElement(Login, null) }), /* @__PURE__ */ React.createElement(Route, { path: "/employee-login", element: /* @__PURE__ */ React.createElement(EmployeeLogin, null) }), /* @__PURE__ */ React.createElement(Route, { path: "/developer-login", element: /* @__PURE__ */ React.createElement(DeveloperLogin, null) }), /* @__PURE__ */ React.createElement(Route, { path: "/developer/tickets", element: /* @__PURE__ */ React.createElement(DeveloperPortal, null) }), /* @__PURE__ */ React.createElement(
    Route,
    {
      path: "/employee-dashboard",
      element: /* @__PURE__ */ React.createElement(ProtectedEmployeeRoute, null, /* @__PURE__ */ React.createElement(EmployeeLayout, null))
    },
    /* @__PURE__ */ React.createElement(Route, { index: true, element: /* @__PURE__ */ React.createElement(EmployeeOverview, null) }),
    /* @__PURE__ */ React.createElement(Route, { path: "attendance", element: /* @__PURE__ */ React.createElement(EmployeeAttendance, null) }),
    /* @__PURE__ */ React.createElement(Route, { path: "leaves", element: /* @__PURE__ */ React.createElement(EmployeeLeaves, null) }),
    /* @__PURE__ */ React.createElement(Route, { path: "balance", element: /* @__PURE__ */ React.createElement(EmployeeLeaveBalance, null) }),
    /* @__PURE__ */ React.createElement(Route, { path: "documents", element: /* @__PURE__ */ React.createElement(EmployeeDocuments, null) }),
    /* @__PURE__ */ React.createElement(Route, { path: "payslips", element: /* @__PURE__ */ React.createElement(EmployeePayslip, null) }),
    /* @__PURE__ */ React.createElement(Route, { path: "advance", element: /* @__PURE__ */ React.createElement(EmployeeAdvance, null) })
  ), /* @__PURE__ */ React.createElement(
    Route,
    {
      path: "/billing/customer-copy",
      element: /* @__PURE__ */ React.createElement(ProtectedRoute, null, /* @__PURE__ */ React.createElement(CustomerBillCopy, null))
    }
  ), /* @__PURE__ */ React.createElement(
    Route,
    {
      path: "/billing/customer-copy/:id",
      element: /* @__PURE__ */ React.createElement(ProtectedRoute, null, /* @__PURE__ */ React.createElement(CustomerBillCopy, null))
    }
  ), /* @__PURE__ */ React.createElement(
    Route,
    {
      path: "/billing/customer-add",
      element: /* @__PURE__ */ React.createElement(ProtectedRoute, null, /* @__PURE__ */ React.createElement(CustomerBillForm, null))
    }
  ), /* @__PURE__ */ React.createElement(
    Route,
    {
      path: "/billing/pos",
      element: /* @__PURE__ */ React.createElement(ProtectedRoute, null, /* @__PURE__ */ React.createElement(POSPage, null))
    }
  ), /* @__PURE__ */ React.createElement(
    Route,
    {
      path: "/billing/waiter",
      element: /* @__PURE__ */ React.createElement(ProtectedRoute, { allowedRoles: ["order taker", "waiter", "cashier", "admin", "super admin"] }, /* @__PURE__ */ React.createElement(WaiterPage, null))
    }
  ), /* @__PURE__ */ React.createElement(
    Route,
    {
      path: "/billing/kitchen",
      element: /* @__PURE__ */ React.createElement(ProtectedRoute, { allowedRoles: ["kitchen", "admin", "super admin"] }, /* @__PURE__ */ React.createElement(KOTKitchenDashboard, null))
    }
  ), /* @__PURE__ */ React.createElement(
    Route,
    {
      element: /* @__PURE__ */ React.createElement(ProtectedRoute, null, /* @__PURE__ */ React.createElement(MainLayout, { menuItems }))
    },
    /* @__PURE__ */ React.createElement(Route, { path: "/", element: /* @__PURE__ */ React.createElement(Navigate, { to: getDefaultRedirect(), replace: true }) }),
    modules.map(({ name, path, element: Element }) => {
      const allowedRoles = name === "dashboard" ? ["admin", "super admin", "cluster admin", "branch admin", "manager"] : void 0;
      return /* @__PURE__ */ React.createElement(
        Route,
        {
          key: name,
          path,
          element: /* @__PURE__ */ React.createElement(ProtectedRoute, { allowedRoles }, /* @__PURE__ */ React.createElement(Element, null))
        }
      );
    }),
    /* @__PURE__ */ React.createElement(
      Route,
      {
        path: "/employee-dashboard",
        element: /* @__PURE__ */ React.createElement(ProtectedRoute, null, /* @__PURE__ */ React.createElement(EmployeeDashboard, null))
      }
    ),
    /* @__PURE__ */ React.createElement(
      Route,
      {
        path: "/settings",
        element: /* @__PURE__ */ React.createElement(ProtectedRoute, null, /* @__PURE__ */ React.createElement(Settings, null))
      }
    ),
    /* @__PURE__ */ React.createElement(
      Route,
      {
        path: "*",
        element: /* @__PURE__ */ React.createElement("div", { className: "p-4 text-red-500" }, "404 - Page Not Found")
      }
    )
  ));
}
export default App;
