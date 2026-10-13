import api from "../../api/api.js";

const dailyInventoryService = {
  // Fetch daily summary for products & ingredients
  getSummary: async (params = {}) => {
    const res = await api.get("/stock/daily/summary", { params });
    return res.data?.data || res.data;
  },

  // Record morning stock arrivals or purchases
  addMorningEntry: async (data) => {
    const res = await api.post("/stock/daily/morning-entry", data);
    return res.data?.data || res.data;
  },

  // Record evening closing stock with physical count & wastage reason
  recordEveningClosing: async (data) => {
    const res = await api.post("/stock/daily/evening-closing", data);
    return res.data?.data || res.data;
  },

  // Get historical inventory logs
  getHistory: async (params = {}) => {
    const res = await api.get("/stock/daily/history", { params });
    return res.data?.data || res.data;
  },

  // Ingredients CRUD
  getIngredients: async (params = {}) => {
    const res = await api.get("/stock/ingredients", { params });
    return res.data?.data || res.data;
  },

  createIngredient: async (data) => {
    const res = await api.post("/stock/ingredients", data);
    return res.data?.data || res.data;
  },

  updateIngredient: async (id, data) => {
    const res = await api.put(`/stock/ingredients/${id}`, data);
    return res.data?.data || res.data;
  },

  deleteIngredient: async (id) => {
    const res = await api.delete(`/stock/ingredients/${id}`);
    return res.data?.data || res.data;
  },
};

export default dailyInventoryService;
