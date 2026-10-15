import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loading from "../utils/Loading";
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(Loading, null));
  }
  if (!user) {
    return /* @__PURE__ */ React.createElement(Navigate, { to: "/", state: { from: location }, replace: true });
  }
  const userRole = (user.role?.role_name || user.role_name || "").toLowerCase();
  if (userRole === "admin" || userRole === "super admin" || userRole === "super admin" || userRole === "cluster admin" || userRole === "branch admin") {
    return children;
  }
  const lowerAllowed = allowedRoles.map((r) => (r || "").toLowerCase());
  if (allowedRoles.length > 0 && (!userRole || !lowerAllowed.includes(userRole))) {
    if (userRole === "order taker" || userRole === "waiter") {
      return /* @__PURE__ */ React.createElement(Navigate, { to: "/billing/list", replace: true });
    }
    if (userRole === "kitchen") {
      return /* @__PURE__ */ React.createElement(Navigate, { to: "/billing/kitchen", replace: true });
    }
    return /* @__PURE__ */ React.createElement(Navigate, { to: "/unauthorized", replace: true });
  }
  return children;
};
export default ProtectedRoute;
