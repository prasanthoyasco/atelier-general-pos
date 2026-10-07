import Product from './product.model.js';
import Category from './category.model.js';
import SubCategory from './subcategory.models.js';
import Kitchen from './kitchen.model.js';
import Addon from './addon.model.js';
import ProductAddon from './productaddon.model.js';

// Category -> SubCategory
Category.hasMany(SubCategory, { foreignKey: 'category_id', as: 'subcategories' });
SubCategory.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// Product -> Category
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });

// Product -> SubCategory
Product.belongsTo(SubCategory, { foreignKey: 'sub_category_id', as: 'subcategory' });
SubCategory.hasMany(Product, { foreignKey: 'sub_category_id', as: 'products' });

// Product -> Kitchen
Product.belongsTo(Kitchen, { foreignKey: 'kitchen_id', as: 'kitchen' });
Kitchen.hasMany(Product, { foreignKey: 'kitchen_id', as: 'products' });

// Product <-> Addon (Many-to-Many)
Product.belongsToMany(Addon, { through: ProductAddon, foreignKey: 'product_id', as: 'addons' });
Addon.belongsToMany(Product, { through: ProductAddon, foreignKey: 'addon_id', as: 'products' });

export { Product, Category, SubCategory, Kitchen, Addon, ProductAddon };
