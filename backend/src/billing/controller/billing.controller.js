// controllers/billing.controller.js
import billingService from "../service/billing.service.js";

const billingController = {
  // ✅ Create new Billing with items
  async create(req, res) {
    try {
      const data = req.body;

      // Attach user info from token
      if (req.user) {
        data.created_by = req.user.id;
        data.created_by_name = req.user.username || req.user.name;
        data.created_by_email = req.user.email;
      }

      const billing = await billingService.createBillingWithItems(data);
      return res.status(201).json({
        message: "Billing created successfully",
        data: billing,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // ✅ Get all Billings with filters + pagination
  async getAll(req, res) {
    try {
      let { page = 1, limit = 10, ...filters } = req.query;

      // Handle branch filtering
      if (req.branchContext) {
        if (req.branchContext.multipleBranches) {
          // User has multiple branches
          if (filters.branch_id) {
            // Verify they have access to this branch
            const hasAccess = req.branchContext.branches.some(
              b => b.branchId === filters.branch_id
            );
            if (!hasAccess) {
              return res.status(403).json({ 
                error: "You don't have access to this branch" 
              });
            }
          } else {
            // No branch selected, fetch from all their branches
            filters.branch_ids = req.branchContext.branches.map(b => b.branchId);
          }
        } else if (req.branchContext.branchId) {
          // User has single branch or specific branch selected
          filters.branch_id = req.branchContext.branchId;
        }
      }

      page = parseInt(page, 10);
      limit = parseInt(limit, 10);
      const offset = (page - 1) * limit;

      const result = await billingService.getAllBillings({
        filters,
        limit,
        offset,
      });

      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // ✅ Get Billing by ID (with items)
  async getById(req, res) {
    try {
      const billing = await billingService.getBillingById(req.params.id);
      if (!billing) {
        return res.status(404).json({ error: "Billing not found" });
      }

      // Check branch boundary: verify user has access to this bill's branch
      const userRole = (req.user?.role_name || '').toLowerCase().replace(/_/g, ' ');
      const isSuperAdminOrAdmin = userRole === 'super admin' || userRole === 'admin';
      if (!isSuperAdminOrAdmin && req.branchContext) {
        const allowedBranchIds = req.branchContext.multipleBranches
          ? (req.branchContext.branches || []).map(b => b.branchId)
          : [req.branchContext.branchId];
        if (billing.branch_id && !allowedBranchIds.includes(billing.branch_id)) {
          return res.status(403).json({ error: "Access denied: bill belongs to a different branch" });
        }
      }

      return res.json(billing);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // ✅ Update Billing (and items if provided)
  async update(req, res) {
    try {
      const existing = await billingService.getBillingById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Billing not found" });
      }

      // Enforce branch boundary
      const userRole = (req.user?.role_name || '').toLowerCase().replace(/_/g, ' ');
      const isSuperAdminOrAdmin = userRole === 'super admin' || userRole === 'admin';
      if (!isSuperAdminOrAdmin && req.branchContext) {
        const allowedBranchIds = req.branchContext.multipleBranches
          ? (req.branchContext.branches || []).map(b => b.branchId)
          : [req.branchContext.branchId];
        if (existing.branch_id && !allowedBranchIds.includes(existing.branch_id)) {
          return res.status(403).json({ error: "Access denied: cannot modify bill from a different branch" });
        }
      }

      const data = req.body;

      // Attach updater info
      if (req.user) {
        data.updated_by = req.user.id;
        data.updated_by_name = req.user.username || req.user.name;
        data.updated_by_email = req.user.email;
      }

      const billing = await billingService.updateBillingWithItems(
        req.params.id,
        data
      );

      return res.json({
        message: "Billing updated successfully",
        data: billing,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // ✅ Delete Billing (soft delete billing + items)
  async delete(req, res) {
    try {
      const existing = await billingService.getBillingById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Billing not found" });
      }

      // Enforce branch boundary
      const userRole = (req.user?.role_name || '').toLowerCase().replace(/_/g, ' ');
      const isSuperAdminOrAdmin = userRole === 'super admin' || userRole === 'admin';
      if (!isSuperAdminOrAdmin && req.branchContext) {
        const allowedBranchIds = req.branchContext.multipleBranches
          ? (req.branchContext.branches || []).map(b => b.branchId)
          : [req.branchContext.branchId];
        if (existing.branch_id && !allowedBranchIds.includes(existing.branch_id)) {
          return res.status(403).json({ error: "Access denied: cannot delete bill from a different branch" });
        }
      }

      const result = await billingService.deleteBillingWithItems(
        req.params.id,
        req.user || {}
      );

      return res.json({
        message: "Billing deleted successfully",
        data: result,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // ✅ Get active kitchen queue
  async getKitchenQueue(req, res) {
    try {
      if (!req.branchContext || !req.branchContext.branchId) {
        return res.status(400).json({ error: "Branch context required" });
      }
      
      const queue = await billingService.getKitchenQueue(req.branchContext.branchId, req.query);
      return res.json({
        success: true,
        data: queue
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // ✅ Update KOT Status
  async updateKOTStatus(req, res) {
    try {
      const { id } = req.params;
      const { kot_status, cancel_reason } = req.body;
      
      if (!kot_status) {
        return res.status(400).json({ error: "kot_status is required" });
      }

      if (!req.branchContext || !req.branchContext.branchId) {
        return res.status(400).json({ error: "Branch context required" });
      }

      const userId = req.user?.id;
      const branchId = req.branchContext.branchId;

      const result = await billingService.updateKOTStatus({
        id,
        newStatus: kot_status,
        userId,
        branchId,
        cancelReason: cancel_reason
      });

      return res.status(result.statusCode).json({
        success: result.success,
        message: result.message,
        data: result.data
      });
    } catch (err) {
      if (err.name === 'TransitionError') {
        return res.status(400).json({ error: err.message });
      }
      if (err.name === 'ConflictError') {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  },
};

export default billingController;
