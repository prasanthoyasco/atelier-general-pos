import { sequelize } from '../src/db/index.js';

async function migrate() {
  try {
    console.log("Connecting to database...");
    await sequelize.authenticate();
    console.log("Database connected successfully.");

    // 1. Check if 'addons' exists in 'billing_items'
    const [cols] = await sequelize.query("SHOW COLUMNS FROM billing_items LIKE 'addons'");
    if (cols.length === 0) {
      console.log("Adding 'addons' JSON column to billing_items table...");
      await sequelize.query("ALTER TABLE billing_items ADD COLUMN addons JSON NULL COMMENT 'Selected addons for item'");
      console.log("Successfully added 'addons' column to billing_items table!");
    } else {
      console.log("'addons' column already exists in billing_items table.");
    }

    // 2. Ensure product_addons table exists
    console.log("Ensuring product_addons table exists...");
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS product_addons (
        product_id CHAR(36) NOT NULL,
        addon_id CHAR(36) NOT NULL,
        PRIMARY KEY (product_id, addon_id),
        INDEX idx_pa_product (product_id),
        INDEX idx_pa_addon (addon_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("product_addons table verified/created successfully!");

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    process.exit(0);
  }
}

migrate();
