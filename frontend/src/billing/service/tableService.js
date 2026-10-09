import api from "../../api/api.js";

const getBranchId = () => {
  const branchId = localStorage.getItem("selectedBranchId");
  return branchId === "all" ? null : branchId;
};

const tableService = {
  async getAll(params = {}) {
    const branchId = params?.branch_id || getBranchId();
    const queryParams = { ...params };
    if (branchId) {
      queryParams.branch_id = branchId;
    }
    return await api.get("/billing/tables", { params: queryParams });
  },
  async create(data = {}) {
    const branchId = data?.branch_id || getBranchId();
    return await api.post("/billing/tables", { ...data, ...(branchId ? { branch_id: branchId } : {}) });
  },
  async update(id, data = {}) {
    const branchId = data?.branch_id || getBranchId();
    return await api.put(`/billing/tables/${id}`, { ...data, ...(branchId ? { branch_id: branchId } : {}) });
  },
  async delete(id, params = {}) {
    const branchId = params?.branch_id || getBranchId();
    return await api.delete(`/billing/tables/${id}`, { params: { ...params, ...(branchId ? { branch_id: branchId } : {}) } });
  }
};

export default tableService;
