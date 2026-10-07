import Table from "../models/table.model.js";

const tableService = {
  async createTable(data) {
    return await Table.create(data);
  },
  
  async getTablesByBranch(branchId) {
    return await Table.findAll({
      where: { branch_id: branchId, active: true },
      order: [['table_no', 'ASC']]
    });
  },

  async updateTable(id, branchId, data) {
    const table = await Table.findOne({ where: { id, branch_id: branchId } });
    if (!table) throw new Error("Table not found");
    return await table.update(data);
  },

  async deleteTable(id, branchId) {
    const table = await Table.findOne({ where: { id, branch_id: branchId } });
    if (!table) throw new Error("Table not found");
    return await table.update({ active: false });
  },

  async updateTableStatus(id, branchId, status) {
    const table = await Table.findOne({ where: { id, branch_id: branchId } });
    if (!table) throw new Error("Table not found");
    return await table.update({ status });
  }
};

export default tableService;
