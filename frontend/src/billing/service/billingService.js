// billingService.js
import api from "../../api/api.js";

// Function to get branch from localStorage
const getBranchId = () => {
  const branchId = localStorage.getItem("selectedBranchId");
  // Don't send branch_id if "all" is selected
  return branchId === "all" ? null : branchId;
};

const billingService = {
  async getAll(params = {}) {
    const branchId = params?.branch_id || getBranchId();
    const queryParams = { ...params };

    if (branchId) {
      queryParams.branch_id = branchId;
    }

    const res = await api.get("/billing/billing", { params: queryParams });
    return res.data;
  },

  async getById(id, params = {}) {
    const branchId = params?.branch_id || getBranchId();
    const queryParams = { ...params };

    if (branchId) {
      queryParams.branch_id = branchId;
    }

    const res = await api.get(`/billing/billing/${id}`, { params: queryParams });
    return res.data;
  },

  async get(id, params = {}) {
    return this.getById(id, params);
  },

  async create(data) {
    const branchId = data?.branch_id || getBranchId();

    if (!branchId) {
      throw new Error("Please select a specific branch to create billing");
    }

    const res = await api.post("/billing/billing", { ...data, branch_id: branchId });
    return res.data;
  },

  async update(id, data) {
    const branchId = data?.branch_id || getBranchId();
    const payload = { ...data };

    if (branchId) {
      payload.branch_id = branchId;
    }

    const res = await api.put(`/billing/billing/${id}`, payload);
    return res.data;
  },

  async remove(id, params = {}) {
    const branchId = params?.branch_id || getBranchId();
    const queryParams = { ...params };

    if (branchId) {
      queryParams.branch_id = branchId;
    }

    const res = await api.delete(`/billing/billing/${id}`, { params: queryParams });
    return res.data;
  },

  async getKitchenQueue(params = {}) {
    const branchId = params?.branch_id || getBranchId();
    const queryParams = { ...params };

    if (branchId) {
      queryParams.branch_id = branchId;
    }

    const res = await api.get("/billing/billing/kitchen-queue", { params: queryParams });
    return res.data;
  },

  async updateKOTStatus(id, status, cancelReason = null, customBranchId = null) {
    const branchId = customBranchId || getBranchId();
    const payload = { kot_status: status };
    if (branchId) {
      payload.branch_id = branchId;
    }
    if (cancelReason) {
      payload.cancel_reason = cancelReason;
    }
    const queryParams = branchId ? { branch_id: branchId } : {};
    const res = await api.patch(`/billing/billing/${id}/kot-status`, payload, { params: queryParams });
    return res.data;
  },

  async serveKOTItem(itemId, servedQty = null, customBranchId = null) {
    const branchId = customBranchId || getBranchId();
    const payload = {};
    if (servedQty !== null && servedQty !== undefined) {
      payload.served_quantity = servedQty;
    }
    if (branchId) {
      payload.branch_id = branchId;
    }
    const queryParams = branchId ? { branch_id: branchId } : {};
    const res = await api.patch(`/billing/billing/kot-items/${itemId}/serve`, payload, { params: queryParams });
    return res.data;
  },

  async updateKOTItemStatus(itemId, status, customBranchId = null) {
    const branchId = customBranchId || getBranchId();
    const payload = { status };
    if (branchId) {
      payload.branch_id = branchId;
    }
    const queryParams = branchId ? { branch_id: branchId } : {};
    const res = await api.patch(`/billing/billing/kot-items/${itemId}/status`, payload, { params: queryParams });
    return res.data;
  },

  async getKitchenInsights(params = {}) {
    const branchId = params?.branch_id || getBranchId();
    const queryParams = { ...params };
    if (branchId) {
      queryParams.branch_id = branchId;
    }
    const res = await api.get('/billing/billing/kitchen-insights', { params: queryParams });
    return res.data;
  },
};

export default billingService;
