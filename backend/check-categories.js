import { sequelize } from "./src/db/index.js";
import Category from "./src/product/models/category.model.js";
import Product from "./src/product/models/product.model.js";

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to Database");

    const categories = await Category.findAll({ raw: true });
    console.log("\n--- CATEGORIES IN DATABASE ---");
    categories.forEach(c => console.log(`- ID: ${c.id}, Name: "${c.category_name}"`));

    const products = await Product.findAll({
      where: {
        product_name: { [sequelize.Sequelize.Op.like]: "%tea%" }
      },
      raw: true
    });
    console.log("\n--- TEA PRODUCTS ---");
    products.forEach(p => {
      const cat = categories.find(c => c.id === p.category_id);
      console.log(`- Name: "${p.product_name}", Category ID: ${p.category_id}, Category Name: "${cat ? cat.category_name : 'N/A'}"`);
    });

    const milkProducts = await Product.findAll({
      where: {
        product_name: { [sequelize.Sequelize.Op.like]: "%milk%" }
      },
      raw: true
    });
    console.log("\n--- MILK PRODUCTS ---");
    milkProducts.forEach(p => {
      const cat = categories.find(c => c.id === p.category_id);
      console.log(`- Name: "${p.product_name}", Category ID: ${p.category_id}, Category Name: "${cat ? cat.category_name : 'N/A'}"`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
