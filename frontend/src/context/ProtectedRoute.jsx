// src/routes/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from '../utils/Loading';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div><Loading /></div>;
    }

    if (!user) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // Support both flat (user.role_name) and nested (user.role.role_name) structures
    const userRole = (user.role?.role_name || user.role_name || '').toLowerCase();

    // Admin roles bypass all permission checks
    if (
        userRole === 'admin' ||
        userRole === 'super admin' ||
        userRole === 'super admin' ||
        userRole === 'cluster admin' ||
        userRole === 'branch admin'
    ) {
        return children;
    }

    // For non-admin users, check if their role is in allowedRoles
    const lowerAllowed = allowedRoles.map(r => (r || '').toLowerCase());
    if (allowedRoles.length > 0 && (!userRole || !lowerAllowed.includes(userRole))) {
        if (userRole === 'order taker' || userRole === 'waiter') {
            return <Navigate to="/billing/list" replace />;
        }
        if (userRole === 'kitchen') {
            return <Navigate to="/billing/kitchen" replace />;
        }
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
};

export default ProtectedRoute;