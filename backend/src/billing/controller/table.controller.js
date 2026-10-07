import tableService from "../service/table.service.js";

const tableController = {
  async createTable(req, res) {
    try {
      const branchId = req.branchContext?.branchId || req.body.branch_id;
      if (!branchId) return res.status(400).json({ success: false, message: "Branch ID required" });

      const data = { ...req.body, branch_id: branchId };
      const table = await tableService.createTable(data);
      res.status(201).json({ success: true, data: table, message: "Table created" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async getTables(req, res) {
    try {
      const branchId = req.branchContext?.branchId || req.query.branch_id;
      if (!branchId) return res.status(400).json({ success: false, message: "Branch ID required" });

      const tables = await tableService.getTablesByBranch(branchId);
      res.status(200).json({ success: true, data: tables });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateTable(req, res) {
    try {
      const branchId = req.branchContext?.branchId || req.body.branch_id;
      const { id } = req.params;
      if (!branchId) return res.status(400).json({ success: false, message: "Branch ID required" });

      const table = await tableService.updateTable(id, branchId, req.body);
      res.status(200).json({ success: true, data: table, message: "Table updated" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteTable(req, res) {
    try {
      const branchId = req.branchContext?.branchId || req.query.branch_id;
      const { id } = req.params;
      if (!branchId) return res.status(400).json({ success: false, message: "Branch ID required" });

      await tableService.deleteTable(id, branchId);
      res.status(200).json({ success: true, message: "Table deleted" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

export default tableController;
