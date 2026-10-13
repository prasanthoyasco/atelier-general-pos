import dailyInventoryService from "../service/dailyInventory.service.js";

const dailyInventoryController = {
  // GET /api/v1/stock/daily/summary
  async getSummary(req, res) {
    try {
      const branch_id = req.query.branch_id || req.user?.branch_id || req.branch_id;
      const date = req.query.date;

      const result = await dailyInventoryService.getDailySummary({ branch_id, date });
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error("getSummary error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load daily inventory summary",
      });
    }
  },

  // POST /api/v1/stock/daily/morning-entry
  async addMorningEntry(req, res) {
    try {
      const branch_id = req.body.branch_id || req.user?.branch_id || req.branch_id;
      const { date, entries } = req.body;

      const result = await dailyInventoryService.addMorningOrPurchaseEntry({
        branch_id,
        date,
        entries,
        user: req.user,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error("addMorningEntry error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to record morning / purchase stock",
      });
    }
  },

  // POST /api/v1/stock/daily/evening-closing
  async recordEveningClosing(req, res) {
    try {
      const branch_id = req.body.branch_id || req.user?.branch_id || req.branch_id;
      const { date, closings } = req.body;

      const result = await dailyInventoryService.recordEveningClosing({
        branch_id,
        date,
        closings,
        user: req.user,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error("recordEveningClosing error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to record evening closing stock",
      });
    }
  },

  // GET /api/v1/stock/daily/history
  async getHistory(req, res) {
    try {
      const branch_id = req.query.branch_id || req.user?.branch_id || req.branch_id;
      const { startDate, endDate, item_type, status, page, limit } = req.query;

      const result = await dailyInventoryService.getHistory({
        branch_id,
        startDate,
        endDate,
        item_type,
        status,
        page,
        limit,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error("getHistory error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Failed to load inventory history",
      });
    }
  },

  // Ingredients endpoints
  async getIngredients(req, res) {
    try {
      const branch_id = req.query.branch_id || req.user?.branch_id;
      const search = req.query.search;
      const data = await dailyInventoryService.getIngredients({ branch_id, search });
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  async createIngredient(req, res) {
    try {
      const data = await dailyInventoryService.createIngredient(req.body);
      return res.status(201).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  async updateIngredient(req, res) {
    try {
      const data = await dailyInventoryService.updateIngredient(req.params.id, req.body);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  async deleteIngredient(req, res) {
    try {
      const data = await dailyInventoryService.deleteIngredient(req.params.id);
      return res.status(200).json({ success: true, message: "Ingredient deactivated", data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};

export default dailyInventoryController;
