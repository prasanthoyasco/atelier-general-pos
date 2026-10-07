import React, { useState } from "react";

// Curated high-resolution food image dictionary matching products & categories
const getStockPhoto = (categoryName = "", productName = "") => {
  const p = (productName || "").toLowerCase();
  const c = (categoryName || "").toLowerCase();

  // Specific products matching Sweets & Snacks POS catalogue
  if (p.includes("milk")) {
    return "https://organicmandya.com/cdn/shop/articles/generated-image38.jpg?v=1782296041&width=1600";
  }
  if (p.includes("bread")) {
    return "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("mixture") || p.includes("sev") || p.includes("bhujia") || p.includes("namkeen")) {
    return "https://floristchennai.com/cdn/shop/files/Bombay_mixture.jpg?v=1723985189";
  }
  if (p.includes("bun") || p.includes("cream bun")) {
    return "https://maryandblake.com/outlandercast/wp-content/uploads/2019/08/scottish-cream-buns-closeup1-500x500.jpg";
  }
  if (p.includes("coffee")) {
    return "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("tea") || p.includes("chai")) {
    return "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("samosa")) {
    return "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("donut") || p.includes("doughnut")) {
    return "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("cake") || p.includes("pastry")) {
    return "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("cookie") || p.includes("biscuit")) {
    return "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("puff") || p.includes("patties")) {
    return "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("laddu") || p.includes("ladoo") || p.includes("halwa") || p.includes("jalebi") || p.includes("gulab") || p.includes("rasgulla") || c.includes("sweet")) {
    return "https://images.unsplash.com/photo-1589119908995-c6800ffbc36b?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("juice") || p.includes("shake") || p.includes("smoothie") || c.includes("beverage")) {
    return "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop&q=80";
  }
  if (c.includes("bakery")) {
    return "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80";
  }
  if (c.includes("snack") || p.includes("chips")) {
    return "https://images.unsplash.com/photo-1599490659213-e2b9527ec087?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("rice") || p.includes("biryani")) {
    return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("pizza")) {
    return "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80";
  }
  if (p.includes("burger")) {
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80";
  }

  // General appetizing food fallback
  return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80";
};

export default function FoodThumbnail({
  src,
  alt = "Food item",
  categoryName = "",
  className = "w-full h-full object-cover rounded-full"
}) {
  const initialUrl = src || getStockPhoto(categoryName, alt);
  const [currentSrc, setCurrentSrc] = useState(initialUrl);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      // Fallback to category stock photo if custom src fails
      const fallback = getStockPhoto(categoryName, alt);
      if (fallback !== currentSrc) {
        setCurrentSrc(fallback);
      }
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
    />
  );
}
