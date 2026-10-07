import { sequelize } from "./src/db/index.js";
import Product from "./src/product/models/product.model.js";
import Category from "./src/product/models/category.model.js";

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to Database");

    const categories = await Category.findAll({ raw: true });
    const products = await Product.findAll({ raw: true });

    console.log("\n--- PRODUCTS IN DATABASE ---");
    products.forEach(p => {
      const cat = categories.find(c => c.id === p.category_id);
      console.log(`- ID: ${p.id}`);
      console.log(`  Name: "${p.product_name}"`);
      console.log(`  Category ID: "${p.category_id}"`);
      console.log(`  Category Name: "${cat ? cat.category_name : 'NULL / NOT FOUND'}"`);
      console.log(`  Status: "${p.status}"`);
      console.log(`  Is Active: ${p.is_active}`);
      console.log("-----------------------------------");
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
