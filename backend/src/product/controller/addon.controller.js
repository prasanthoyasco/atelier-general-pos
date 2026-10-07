import addonService from "../service/addon.service.js";

const addonController = {
  async create(req, res) {
    try {
      const branchId = req.branchContext?.branchId || req.body.branch_id;
      if (!branchId) return res.status(400).json({ success: false, message: "Branch ID required" });

      const data = { ...req.body, branch_id: branchId };
      const addon = await addonService.create(data);
      res.status(201).json({ success: true, data: addon, message: "Addon created" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  async getAll(req, res) {
    try {
      const branchId = req.branchContext?.branchId || req.query.branch_id;
      const addons = await addonService.getAll(branchId);
      res.status(200).json({ success: true, data: addons });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  async update(req, res) {
    try {
      const branchId = req.branchContext?.branchId || req.body.branch_id;
      const { id } = req.params;
      const addon = await addonService.update(id, req.body, branchId);
      res.status(200).json({ success: true, data: addon, message: "Addon updated" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  async delete(req, res) {
    try {
      const branchId = req.branchContext?.branchId || req.query.branch_id;
      const { id } = req.params;
      await addonService.delete(id, branchId);
      res.status(200).json({ success: true, message: "Addon deleted" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

export default addonController;
