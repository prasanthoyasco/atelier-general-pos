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
  Receipt,
  Sparkles
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
import { NetworkProvider } from "./components/common/NetworkStatusNotifier";

const routeModules = import.meta.glob("./*/AppRoutes.jsx", { eager: true });

const moduleIcons = {
  dashboard: <LayoutDashboard size={20} />,
  billing: <IndianRupee size={20} />,
  Product: <Box size={20} />,
  product: <Box size={20} />,
  Category: <Tags size={20} />,
  subcategory: <Layers size={20} />,
  inward: <ShoppingCart size={20} />,
  stock: <Database size={20} />,
  customer: <Users size={20} />,
  coupon: <Percent size={20} />,
  user: <User size={20} />,
  marketing: <Megaphone size={20} />,
  employee: <UserCheck size={20} />,
  ticket: <Ticket size={20} />,
};
import { ConfigProvider } from "antd";

const App = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4F46E5',
          colorSuccess: '#10B981',
          colorWarning: '#F59E0B',
          colorError: '#EF4444',
          colorInfo: '#3B82F6',
          colorBgLayout: '#F8FAFC',
          colorBgContainer: '#FFFFFF',
          colorBorder: '#E2E8F0',
          colorText: '#0F172A',
          colorTextSecondary: '#475569',
          borderRadius: 8,
          fontFamily: "var(--font-sans)",
        },
        components: {
          Card: {
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
            borderRadiusLG: 16,
          },
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#475569',
            rowHoverBg: '#f1f5f9',
            borderRadiusLG: 12,
          },
          Button: {
            controlHeight: 40,
          },
          Input: {
            controlHeight: 40,
          },
          Select: {
            controlHeight: 40,
          }
        }
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <EmployeeAuthProvider>
            <BranchProvider>
              <NetworkProvider>
                <Loading duration={3000} />
                <Suspense fallback={<div className="p-4"><Loading /></div>}>
                  <AppInner />
                </Suspense>
              </NetworkProvider>
            </BranchProvider>
          </EmployeeAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
};

function AppInner() {
  const { user } = useAuth();
  const userRoleName = (user?.role?.role_name || user?.role_name || '').toLowerCase();
  const isSuperAdmin = userRoleName === 'super admin' || userRoleName === 'super admin';
  const modules = Object.entries(routeModules).map(([path, mod]) => {
    const match = path.match(/\.\/(.*?)\/AppRoutes\.jsx$/);
    const name = match?.[1];

    return {
      name,
      path: `/${name}/*`,
      element: mod.default,
      menuItems: mod[`${name}MenuItems`] || [],
    };
  });

  const menuItems = useMemo(() => {
    if (userRoleName === 'kitchen') {
      return [
        {
          key: "/billing/kitchen",
          label: "Kitchen Display",
          icon: <Utensils size={20} />,
          children: null
        }
      ];
    }

    if (userRoleName === 'order taker' || userRoleName === 'waiter') {
      return [
        {
          key: "/billing/waiter",
          label: "Waiter Service",
          icon: <UtensilsCrossed size={20} />,
          children: null
        },
        {
          key: "/billing/pos",
          label: "POS Terminal",
          icon: <MonitorSmartphone size={20} />,
          children: null
        },
        {
          key: "/billing/list",
          label: "My Orders",
          icon: <Receipt size={20} />,
          children: null
        }
      ];
    }

    const items = modules
      .filter(({ name }) => name !== "Category" && name !== "subcategory")
      .map(({ name, menuItems }) => {

        // Dashboard direct route
        if (name === "dashboard") {
          return {
            key: "/dashboard",
            icon: moduleIcons[name] || null,
            label: "Dashboard",
            children: null,
          };
        }

        // ✅ If only ONE child → make it direct route
        if (menuItems && menuItems.length === 1) {
          return {
            key: menuItems[0].key,   // use actual child route
            icon: moduleIcons[name] || null,
            label: name.charAt(0).toUpperCase() + name.slice(1),
            children: null,
          };
        }

        // ✅ If MULTIPLE children → dropdown
        if (menuItems && menuItems.length > 1) {
          // For ticket module: hide Developers item for non-super-admins
          const filteredChildren = name === "ticket"
            ? menuItems.filter(item => item.key !== "/ticket/developers" || isSuperAdmin)
            : menuItems;

          return {
            key: name,
            icon: moduleIcons[name] || null,
            label: name.charAt(0).toUpperCase() + name.slice(1),
            children: filteredChildren,
          };
        }

        // ✅ If NO children → direct route fallback
        return {
          key: `/${name}`,
          icon: moduleIcons[name] || null,
          label: name.charAt(0).toUpperCase() + name.slice(1),
          children: null,
        };
      });

    // Add Business Insights Hub manually
    items.push({
      key: "/billing/insights",
      label: "Insights Hub",
      icon: <Sparkles size={20} />,
      children: null
    });

    // Add Sales Report manually
    items.push({
      key: "/billing/reports",
      label: "Sales Report",
      icon: <BarChart size={20} />,
      children: null
    });

    // Add Source-wise Report manually
    items.push({
      key: "/billing/source-wise-report",
      label: "Source-wise Report",
      icon: <TrendingUp size={20} />,
      children: null
    });

    // Keep dashboard first
    items.sort((a, b) => {
      if (a.key === "/dashboard") return -1;
      if (b.key === "/dashboard") return 1;
      return 0;
    });

    return items;
  }, [modules]);

  const getDefaultRedirect = () => {
    if (userRoleName === 'kitchen') return "/billing/kitchen";
    if (userRoleName === 'order taker' || userRoleName === 'waiter') return "/billing/waiter";
    const filteredModules = modules.filter((mod) => mod.name !== "dashboard");
    return filteredModules.length > 0
      ? `/${filteredModules[0].name}/pages/dashboard`
      : "/404";
  };

  return (
    <Routes>
      {/* Public/Login routes */}
      <Route path="/" element={<Login />} />
      <Route path="/employee-login" element={<EmployeeLogin />} />
      <Route path="/developer-login" element={<DeveloperLogin />} />
      <Route path="/developer/tickets" element={<DeveloperPortal />} />

      {/* Employee portal — outside admin layout, uses its own layout */}
      <Route
        path="/employee-dashboard"
        element={
          <ProtectedEmployeeRoute>
            <EmployeeLayout />
          </ProtectedEmployeeRoute>
        }
      >
        <Route index element={<EmployeeOverview />} />
        <Route path="attendance" element={<EmployeeAttendance />} />
        <Route path="leaves" element={<EmployeeLeaves />} />
        <Route path="balance" element={<EmployeeLeaveBalance />} />
        <Route path="documents" element={<EmployeeDocuments />} />
        <Route path="payslips" element={<EmployeePayslip />} />
        <Route path="advance" element={<EmployeeAdvance />} />
      </Route>
      {/* Routes WITHOUT sidebar/header */}
      <Route
        path="/billing/customer-copy"
        element={
          <ProtectedRoute>
            <CustomerBillCopy />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/customer-copy/:id"
        element={
          <ProtectedRoute>
            <CustomerBillCopy />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/customer-add"
        element={
          <ProtectedRoute>
            <CustomerBillForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/pos"
        element={
          <ProtectedRoute>
            <POSPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/waiter"
        element={
          <ProtectedRoute allowedRoles={['order taker', 'waiter', 'cashier', 'admin', 'super admin']}>
            <WaiterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/kitchen"
        element={
          <ProtectedRoute allowedRoles={['kitchen', 'admin', 'super admin']}>
            <KOTKitchenDashboard />
          </ProtectedRoute>
        }
      />

      {/* Routes WITH sidebar/header */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout menuItems={menuItems} />
          </ProtectedRoute>
        }
      >
        {/* Default redirect */}
        <Route path="/" element={<Navigate to={getDefaultRedirect()} replace />} />

        {modules.map(({ name, path, element: Element }) => {
          const allowedRoles = name === 'dashboard'
            ? ['admin', 'super admin', 'cluster admin', 'branch admin', 'manager']
            : undefined;

          return (
            <Route
              key={name}
              path={path}
              element={
                <ProtectedRoute allowedRoles={allowedRoles}>
                  <Element />
                </ProtectedRoute>
              }
            />
          );
        })}
        <Route
          path="/employee-dashboard"
          element={
            <ProtectedRoute>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insights"
          element={<Navigate to="/billing/insights" replace />}
        />

        <Route
          path="*"
          element={<div className="p-4 text-red-500">404 - Page Not Found</div>}
        />
      </Route>
    </Routes>
  );
}

export default App;
