import jwt from 'jsonwebtoken';

// Get secret at runtime, not at module load time
const getSecretKey = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('FATAL: JWT_SECRET environment variable is missing');
        }
        console.warn('WARNING: JWT_SECRET is not set in environment.');
    }
    return secret || 'dev-fallback-local-only-secret-key-change-in-prod';
};

export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Missing or malformed token' });
    }

    const token = authHeader.split(' ')[1];
    const SECRET_KEY = getSecretKey();

    try {
        const decoded = jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] });
        req.user = decoded; // Attach decoded user payload to request

        // Auto-enrich user role & permissions from DB if missing or empty (for legacy or active cached tokens)
        if (!req.user.role_name || !req.user.permissions || req.user.permissions.length === 0) {
            try {
                const User = (await import('../user/models/user.model.js')).default;
                const Role = (await import('../user/models/role.model.js')).default;
                const { Permission } = await import('../user/models/associations.js');

                const dbUser = await User.findByPk(decoded.id, {
                    include: [{
                        model: Role,
                        as: 'role',
                        include: [{
                            model: Permission,
                            as: 'permissions',
                            through: { attributes: [] }
                        }]
                    }]
                });

                if (dbUser) {
                    req.user.role_name = dbUser.role?.role_name || req.user.role_name;
                    req.user.role_id = dbUser.role_id || req.user.role_id;
                    req.user.permissions = dbUser.role?.permissions?.map(p => p.code) || req.user.permissions || [];
                }
            } catch (enrichErr) {
                console.warn('Could not enrich token from DB:', enrichErr.message);
            }
        }

        next(); // Token is valid, proceed
    } catch (err) {
        console.error('Token verification failed:', err.message);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

/**
 * authorize(codes) — permission-based access control middleware.
 *
 * Usage example:
 *   router.get('/billing', verifyToken, authorize(['billing.view']), billingController.getAll);
 *
 * The JWT payload must include a `permissions` array of permission codes.
 * The user is granted access if they have AT LEAST ONE of the required codes.
 * Super Admin (role_name === 'super admin') bypasses all permission checks.
 *
 * @param {string[]} codes - Required permission codes (at least one must match)
 */
export const authorize = (codes = []) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    // Super admin and admin bypass all permission checks
    const role = (req.user.role_name || '').toLowerCase().replace(/_/g, ' ');
    if (role === 'super admin' || role === 'admin') {
        return next();
    }

    const userPermissions = req.user.permissions || [];
    const hasAccess = codes.some(code => userPermissions.includes(code));

    if (!hasAccess) {
        return res.status(403).json({
            message: 'Forbidden: insufficient permissions',
            required: codes,
        });
    }

    next();
};
