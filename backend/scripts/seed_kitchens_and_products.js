// backend/scripts/seed_kitchens_and_products.js
import { v4 as uuidv4 } from 'uuid';
import Kitchen from '../src/product/models/kitchen.model.js';
import Product from '../src/product/models/product.model.js';
import Branch from '../src/user/models/branch.model.js';
import Category from '../src/product/models/category.model.js';
import Stock from '../src/stock/models/stock.models.js';

async function seedKitchensAndProducts() {
  console.log('=====================================================');
  console.log('🍳 CONFIGURING MULTI-KITCHEN STATIONS & PRODUCTS');
  console.log('=====================================================\n');

  try {
    const branches = await Branch.findAll({ where: { is_active: true } });
    console.log(`Found ${branches.length} active branches.`);

    for (const branch of branches) {
      console.log(`\nConfiguring Kitchens for Branch: "${branch.branch_name}" (${branch.id})`);

      // 1. Ensure "Main Kitchen" exists
      let [mainKitchen] = await Kitchen.findOrCreate({
        where: {
          branch_id: branch.id,
          kitchen_name: 'Main Kitchen'
        },
        defaults: {
          id: uuidv4(),
          kitchen_name: 'Main Kitchen',
          branch_id: branch.id,
          is_active: true
        }
      });
      console.log(`  ✅ Station 1: "${mainKitchen.kitchen_name}" (ID: ${mainKitchen.id})`);

      // 2. Ensure "Beverage & Juice Bar" exists (The New Kitchen Station!)
      let [beverageKitchen] = await Kitchen.findOrCreate({
        where: {
          branch_id: branch.id,
          kitchen_name: 'Beverage & Juice Bar'
        },
        defaults: {
          id: uuidv4(),
          kitchen_name: 'Beverage & Juice Bar',
          branch_id: branch.id,
          is_active: true
        }
      });
      console.log(`  ✅ Station 2: "${beverageKitchen.kitchen_name}" (ID: ${beverageKitchen.id})`);

      // 3. Assign existing food products to Main Kitchen
      const foodProductNames = ['Chicken Puff', 'Egg Puff', 'Savory Mixture', 'Bread', 'Veg Curry Puff'];
      for (const name of foodProductNames) {
        const prod = await Product.findOne({ where: { product_name: name } });
        if (prod) {
          prod.kitchen_id = mainKitchen.id;
          await prod.save();
          console.log(`     -> Linked "${prod.product_name}" to "${mainKitchen.kitchen_name}"`);
        }
      }

      // 4. Assign existing drink products to Beverage & Juice Bar
      const drinkProductNames = ['Cold Coffee', 'Peach Iced Tea', 'Masala Chai', 'Classic Tea', 'Tea', 'Milk'];
      for (const name of drinkProductNames) {
        const prod = await Product.findOne({ where: { product_name: name } });
        if (prod) {
          prod.kitchen_id = beverageKitchen.id;
          await prod.save();
          console.log(`     -> Linked "${prod.product_name}" to "${beverageKitchen.kitchen_name}"`);
        }
      }

      // 5. Add brand new delicious beverages to the new Beverage & Juice Bar
      const newBeverages = [
        {
          name: 'Fresh Mint Mojito',
          code: `DRK-MOJ-${branch.branch_code || '01'}`,
          price: 120,
          categoryName: 'Cold Beverages',
          desc: 'Refreshing sparkling lime and fresh mint cooler with crushed ice',
          dietary: 'Veg',
          temp: 'Cold'
        },
        {
          name: 'Mango Lassi Delight',
          code: `DRK-LAS-${branch.branch_code || '01'}`,
          price: 110,
          categoryName: 'Cold Beverages',
          desc: 'Rich creamy yogurt blended with Alphonso mango pulp and cardamom',
          dietary: 'Veg',
          temp: 'Cold'
        },
        {
          name: 'Signature Filter Coffee',
          code: `DRK-COF-${branch.branch_code || '01'}`,
          price: 60,
          categoryName: 'Hot Beverages',
          desc: 'Authentic South Indian chicory-infused decoction with frothy steamed milk',
          dietary: 'Veg',
          temp: 'Hot'
        }
      ];

      for (const item of newBeverages) {
        let existing = await Product.findOne({ where: { product_name: item.name } });
        let category = await Category.findOne({ where: { category_name: item.categoryName } });
        if (!category) {
          category = await Category.findOne();
        }

        if (!existing) {
          const newProd = await Product.create({
            id: uuidv4(),
            product_name: item.name,
            product_code: item.code,
            category_id: category ? category.id : null,
            kitchen_id: beverageKitchen.id,
            selling_price: item.price,
            mrp: item.price,
            purchase_price: item.price * 0.5,
            dietary_preference: item.dietary,
            temperature: item.temp,
            unit: 'piece',
            is_active: true
          });
          console.log(`  🌟 Created new beverage product: "${newProd.product_name}" (₹${item.price}) -> Assigned to "${beverageKitchen.kitchen_name}"`);

          // Create stock record so it shows up in inventory
          await Stock.create({
            id: uuidv4(),
            product_id: newProd.id,
            branch_id: branch.id,
            quantity: 50,
            billing_quantity: 50,
            cost_price: item.price * 0.5,
            selling_price: item.price,
            min_stock_level: 5,
            is_active: true
          });
        } else {
          existing.kitchen_id = beverageKitchen.id;
          await existing.save();
          console.log(`  -> Updated "${existing.product_name}" to "${beverageKitchen.kitchen_name}"`);
        }
      }
    }

    console.log('\n=====================================================');
    console.log('🎉 MULTI-KITCHEN STATIONS & PRODUCTS CONFIGURED SUCCESSFULLY!');
    console.log('=====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error configuring kitchens:', err);
    process.exit(1);
  }
}

seedKitchensAndProducts();
