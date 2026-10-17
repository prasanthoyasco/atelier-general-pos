import api from "../../api/api";

const productService = {
  getAll: (params = {}) => api.get("/product/product", { params }),
  getById: (id) => api.get(`/product/product/${id}`),
  getByCode: (code) => api.get(`/product/product/code/${code}`),
  create: (data) => api.post("/product/product", data),
  update: (id, data) => api.put(`/product/product/${id}`, data),
  remove: (id) => api.delete(`/product/product/${id}`),
  bulkUpload: (data) => api.post("/product/product/bulk-upload", data),
  // Kitchen Stations & Routing Management
  getKitchens: (params = {}) => api.get("/product/kitchens", { params }),
  getKitchenById: (id) => api.get(`/product/kitchens/${id}`),
  createKitchen: (data) => api.post("/product/kitchens", data),
  updateKitchen: (id, data) => api.put(`/product/kitchens/${id}`, data),
  deleteKitchen: (id) => api.delete(`/product/kitchens/${id}`),
  assignKitchenItems: (id, data) => api.post(`/product/kitchens/${id}/assign-items`, data),
  getKitchenStats: (params = {}) => api.get("/product/kitchens/stats", { params }),

  // Upload image to DigitalOcean Spaces
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return api.post("/product/product/upload-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export default productService;
