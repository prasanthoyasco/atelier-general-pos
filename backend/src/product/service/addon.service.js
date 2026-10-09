import Addon from "../models/addon.model.js";

const addonService = {
  async create(data) {
    return await Addon.create(data);
  },
  async getAll(branchId, query = {}) {
    const where = {};
    if (branchId) where.branch_id = branchId;
    if (query.active_only === 'true' || query.active_only === true) {
      where.is_active = true;
    }
    return await Addon.findAll({ where, order: [['createdAt', 'DESC']] });
  },
  async getById(id, branchId) {
    const where = { id };
    if (branchId) where.branch_id = branchId;
    return await Addon.findOne({ where });
  },
  async update(id, data, branchId) {
    const addon = await this.getById(id, branchId);
    if (!addon) throw new Error("Addon not found");
    return await addon.update(data);
  },
  async delete(id, branchId) {
    const addon = await this.getById(id, branchId);
    if (!addon) throw new Error("Addon not found");
    return await addon.update({ is_active: false });
  }
};

export default addonService;
