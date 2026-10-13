import { sequelize } from '../src/db/index.js';
import Ingredient from '../src/stock/models/ingredient.model.js';
import DailyInventoryLog from '../src/stock/models/dailyInventoryLog.model.js';

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Sync models with database
    await Ingredient.sync({ alter: true });
    console.log('Ingredient table synced.');

    await DailyInventoryLog.sync({ alter: true });
    console.log('DailyInventoryLog table synced.');

    // Seed default ingredients if empty
    const count = await Ingredient.count();
    if (count === 0) {
      console.log('Seeding initial ingredients...');
      const defaultIngredients = [
        { name: 'Fresh Milk', stock_quantity: 25.0, base_unit: 'litre', low_stock_threshold: 5.0, cost_per_unit: 48.0 },
        { name: 'Coffee Beans / Powder', stock_quantity: 8.0, base_unit: 'kg', low_stock_threshold: 2.0, cost_per_unit: 420.0 },
        { name: 'White Sugar', stock_quantity: 15.0, base_unit: 'kg', low_stock_threshold: 3.0, cost_per_unit: 42.0 },
        { name: 'Tea Leaves (Assam)', stock_quantity: 4.0, base_unit: 'kg', low_stock_threshold: 1.0, cost_per_unit: 340.0 },
        { name: 'Sandwich Bread', stock_quantity: 20.0, base_unit: 'packet', low_stock_threshold: 4.0, cost_per_unit: 40.0 },
        { name: 'Cheese Slices', stock_quantity: 60.0, base_unit: 'nos', low_stock_threshold: 15.0, cost_per_unit: 12.0 },
        { name: 'Butter', stock_quantity: 6.0, base_unit: 'kg', low_stock_threshold: 1.5, cost_per_unit: 290.0 },
        { name: 'Paper Cups (250ml)', stock_quantity: 250.0, base_unit: 'nos', low_stock_threshold: 50.0, cost_per_unit: 2.5 },
        { name: 'Chocolate Syrup', stock_quantity: 5.0, base_unit: 'bottle', low_stock_threshold: 1.0, cost_per_unit: 180.0 },
        { name: 'Takeaway Paper Bags', stock_quantity: 200.0, base_unit: 'nos', low_stock_threshold: 40.0, cost_per_unit: 3.0 },
      ];

      await Ingredient.bulkCreate(defaultIngredients);
      console.log(`Successfully seeded ${defaultIngredients.length} ingredients.`);
    } else {
      console.log(`Ingredients table already has ${count} records.`);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
