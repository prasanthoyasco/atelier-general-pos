import { Routes, Route } from "react-router-dom";
import ProductList from "./pages/ProductList";
import ProductForm from "./pages/ProductForm";
import ProductBulkUpload from "./pages/ProductBulkUpload";
import CategoryList from "./pages/CategoryList";
import CategoryAdd from "./pages/CategoryAdd";
import SubcategoryList from "./pages/SubcategoryList";
import SubcategoryForm from "./pages/SubcategoryForm";
import AddonList from "./pages/AddonList";
import { List, Tags, Layers, Upload, Sparkles } from "lucide-react";

export const productMenuItems = [
  {
    key: "/product/list",
    label: "Products",
    icon: <List size={18} />,
  },
  {
    key: "/product/addons",
    label: "Add-ons",
    icon: <Sparkles size={18} />,
  },
  {
    key: "/product/bulk-upload",
    label: "Bulk Upload",
    icon: <Upload size={18} />,
  },
  {
    key: "/product/categories",
    label: "Categories",
    icon: <Tags size={18} />,
  },
  {
    key: "/product/subcategories",
    label: "Subcategories",
    icon: <Layers size={18} />,
  },
];
export const ProductMenuItems = productMenuItems;

const ProductRoutes = () => {
  return (
    <Routes>
      <Route path="list" element={<ProductList />} />
      <Route path="add" element={<ProductForm />} />
      <Route path="edit/:id" element={<ProductForm />} />
      <Route path="addons" element={<AddonList />} />
      <Route path="bulk-upload" element={<ProductBulkUpload />} />

      <Route path="categories" element={<CategoryList />} />
      <Route path="categories/add" element={<CategoryAdd />} />
      <Route path="categories/edit/:id" element={<CategoryAdd />} />

      <Route path="subcategories" element={<SubcategoryList />} />
      <Route path="subcategories/add" element={<SubcategoryForm />} />
      <Route path="subcategories/edit/:id" element={<SubcategoryForm />} />
    </Routes>
  );
};

export default ProductRoutes;
