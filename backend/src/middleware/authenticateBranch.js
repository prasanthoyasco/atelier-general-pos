import UserBranch from '../user/models/userbranch.model.js';
import Branch from '../user/models/branch.model.js';
import Role from '../user/models/role.model.js';

/**
 * Middleware to verify user has access to a specific branch
 * If branch_id is not provided and user has only one branch, automatically use it
 * Otherwise, expects branch_id in request body, query, or params
 * 
 * @param {boolean} allowMultipleBranches - If true, allows requests without branch_id for users with multiple branches
 */
export const authenticateBranch = (options = false) => {
    const allowMultipleBranches = (typeof options === 'object' && options !== null)
        ? Boolean(options.allowMultipleBranches)
        : Boolean(options);

    return async (req, res, next) => {
        try {
            const userId = req.user?.id;
            // Handle branch_id from header, query, body, or params
            const headerBranchId = req.headers && req.headers['x-branch-id'] ? req.headers['x-branch-id'] : null;
            const queryBranchId = req.query && req.query.branch_id ? req.query.branch_id : null;
            const bodyBranchId = req.body && req.body.branch_id ? req.body.branch_id : null;
            const paramsBranchId = req.params && req.params.branch_id ? req.params.branch_id : null;
            
            let branchId = headerBranchId || bodyBranchId || queryBranchId || paramsBranchId;

        if (!userId) {
            return res.status(401).json({ 
                success: false,
                message: 'User not authenticated' 
            });
        }

        const userRole = (req.user?.role_name || '').toLowerCase().replace(/_/g, ' ');
        const isSuperAdminOrAdmin = userRole === 'super admin' || userRole === 'admin';

        // Super admin / Admin has global access to all branches
        if (isSuperAdminOrAdmin) {
            if (!branchId && allowMultipleBranches) {
                const allActiveBranches = await Branch.findAll({ where: { is_active: true } });
                req.branchContext = {
                    multipleBranches: true,
                    branches: allActiveBranches.map(b => ({
                        branchId: b.id,
                        branchName: b.branch_name,
                        branchCode: b.branch_code,
                        roleId: req.user.role_id,
                        roleName: req.user.role_name || 'super admin'
                    }))
                };
                return next();
            }

            if (!branchId) {
                const defaultBranch = await Branch.findOne({ where: { is_active: true } });
                if (defaultBranch) branchId = defaultBranch.id;
            }
            if (branchId) {
                const targetBranch = await Branch.findOne({ where: { id: branchId } });
                if (targetBranch && targetBranch.is_active) {
                    req.branchContext = {
                        branchId: targetBranch.id,
                        branchName: targetBranch.branch_name,
                        branchCode: targetBranch.branch_code,
                        roleId: req.user.role_id,
                        roleName: req.user.role_name || 'super admin'
                    };
                    return next();
                }
            }
        }

        // If no branch_id provided, check if user has only one branch
        if (!branchId) {
            const userBranches = await UserBranch.findAll({
                where: { 
                    user_id: userId, 
                    is_active: true 
                },
                include: [
                    { 
                        model: Branch, 
                        as: 'branch', 
                        where: { is_active: true },
                        required: true
                    }
                ]
            });

            if (userBranches.length === 0) {
                return res.status(403).json({ 
                    success: false,
                    message: 'You are not assigned to any branch. Please contact administrator.' 
                });
            }

            if (userBranches.length === 1) {
                // User has only one branch, use it automatically
                branchId = userBranches[0].branch_id;
            } else if (allowMultipleBranches) {
                // User has multiple branches, but we allow fetching from all
                req.branchContext = {
                    multipleBranches: true,
                    branches: userBranches.map(ub => ({
                        branchId: ub.branch_id,
                        branchName: ub.branch?.branch_name || 'Unknown',
                        branchCode: ub.branch?.branch_code || 'Unknown',
                        roleId: ub.role_id,
                        roleName: ub.role?.role_name || 'unknown'
                    }))
                };
                return next();
            } else {
                // User has multiple branches, branch_id is required
                return res.status(400).json({ 
                    success: false,
                    message: 'Branch ID is required. You have access to multiple branches.',
                    availableBranches: userBranches.map(ub => ({
                        branch_id: ub.branch_id,
                        branch_name: ub.branch?.branch_name || 'Unknown',
                        branch_code: ub.branch?.branch_code || 'Unknown'
                    }))
                });
            }
        }

        // Check if user has access to this branch
        const userBranch = await UserBranch.findOne({
            where: { 
                user_id: userId, 
                branch_id: branchId, 
                is_active: true 
            },
            include: [
                { 
                    model: Branch, 
                    as: 'branch', 
                    required: false
                },
                { 
                    model: Role, 
                    as: 'role', 
                    required: false
                }
            ]
        });

        if (!userBranch) {
            return res.status(403).json({ 
                success: false,
                message: 'Access denied: You do not have access to this branch' 
            });
        }

        // Check if branch exists and is active
        if (!userBranch.branch) {
            return res.status(404).json({ 
                success: false,
                message: 'Branch not found' 
            });
        }

        if (!userBranch.branch.is_active) {
            return res.status(403).json({ 
                success: false,
                message: 'This branch is currently inactive' 
            });
        }

        // Attach branch context to request
        req.branchContext = {
            branchId: userBranch.branch_id,
            branchName: userBranch.branch.branch_name,
            branchCode: userBranch.branch.branch_code,
            roleId: userBranch.role_id,
            roleName: userBranch.role?.role_name || 'unknown'
        };

        next();
    } catch (error) {
        console.error('Branch authentication error:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ 
            success: false,
            message: 'Error verifying branch access',
            error: error.message 
        });
    }
  };
};

/**
 * Middleware to verify user has specific role in a branch
 * Usage: authenticateBranchRole(['admin', 'manager'])
 */
export const authenticateBranchRole = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            if (!req.branchContext) {
                return res.status(403).json({ 
                    success: false,
                    message: 'Branch context not found. Use authenticateBranch middleware first.' 
                });
            }

            const userRole = req.branchContext.roleName;

            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({ 
                    success: false,
                    message: `Access denied: Required role(s): ${allowedRoles.join(', ')}` 
                });
            }

            next();
        } catch (error) {
            console.error('Branch role authentication error:', error);
            return res.status(500).json({ 
                success: false,
                message: 'Error verifying branch role',
                error: error.message 
            });
        }
    };
};
