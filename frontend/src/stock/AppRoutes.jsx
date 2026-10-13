import { Routes, Route } from "react-router-dom";
import StockList from "./pages/StockList";
import DailyInventory from "./pages/DailyInventory";
import { List, CalendarCheck } from "lucide-react";

export const stockMenuItems = [
  {
    key: "/stock/daily",
    label: "Daily Stock Log",
    icon: <CalendarCheck size={18} />
  },
  {
    key: "/stock/list",
    label: "Stock Master List",
    icon: <List size={18} />
  }
];

const StockRoutes = () => {
  return (
    <Routes>
      <Route path="daily" element={<DailyInventory />} />
      <Route path="list" element={<StockList />} />
    </Routes>
  );
};

export default StockRoutes;