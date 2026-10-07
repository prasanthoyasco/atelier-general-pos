import api from "../../api/api.js";

const getBranchId = () => {
  const branchId = localStorage.getItem("selectedBranchId");
  return branchId === 'all' ? null : branchId;
};

const tableService = {
  async getAll() {
    const branchId = getBranchId();
    return await api.get("/billing/tables", { params: { branch_id: branchId } });
  },
  async create(data) {
    const branchId = getBranchId();
    return await api.post("/billing/tables", { ...data, branch_id: branchId });
  },
  async update(id, data) {
    const branchId = getBranchId();
    return await api.put(`/billing/tables/${id}`, { ...data, branch_id: branchId });
  },
  async delete(id) {
    const branchId = getBranchId();
    return await api.delete(`/billing/tables/${id}`, { params: { branch_id: branchId } });
  }
};

export default tableService;
