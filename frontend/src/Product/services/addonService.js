import api from "../../api/api.js";

const getBranchId = () => {
  const branchId = localStorage.getItem("selectedBranchId");
  return branchId === 'all' ? null : branchId;
};

const addonService = {
  async getAll(params = {}) {
    const branchId = getBranchId();
    return await api.get("/product/addons", { params: { branch_id: branchId, ...params } });
  },
  async create(data) {
    const branchId = getBranchId();
    return await api.post("/product/addons", { ...data, branch_id: branchId });
  },
  async update(id, data) {
    const branchId = getBranchId();
    return await api.put(`/product/addons/${id}`, { ...data, branch_id: branchId });
  },
  async delete(id) {
    const branchId = getBranchId();
    return await api.delete(`/product/addons/${id}`, { params: { branch_id: branchId } });
  }
};

export default addonService;
