import { sequelize } from '../src/db/index.js';

async function runMigration() {
  console.log('Connecting to database...');
  await sequelize.authenticate();
  console.log('Database connected.');

  // 1. Add quantity and served_quantity to billing_kot_items if missing
  const [cols] = await sequelize.query('DESCRIBE billing_kot_items');
  const colNames = cols.map((c) => c.Field);

  if (!colNames.includes('quantity')) {
    await sequelize.query('ALTER TABLE billing_kot_items ADD COLUMN quantity INT NOT NULL DEFAULT 1');
    console.log('Added quantity column to billing_kot_items');
  } else {
    console.log('quantity column already exists in billing_kot_items');
  }

  if (!colNames.includes('served_quantity')) {
    await sequelize.query('ALTER TABLE billing_kot_items ADD COLUMN served_quantity INT NOT NULL DEFAULT 0');
    console.log('Added served_quantity column to billing_kot_items');
  } else {
    console.log('served_quantity column already exists in billing_kot_items');
  }

  // 2. Populate quantity from billing_items for existing records
  await sequelize.query(`
    UPDATE billing_kot_items bki
    JOIN billing_items bi ON bki.billing_item_id = bi.id
    SET bki.quantity = bi.quantity
    WHERE bki.quantity = 1 AND bi.quantity > 1
  `);
  console.log('Synchronized existing item quantities');

  // If status is 'served', set served_quantity = quantity
  await sequelize.query(`
    UPDATE billing_kot_items
    SET served_quantity = quantity
    WHERE status = 'served' AND served_quantity = 0
  `);
  console.log('Synchronized served quantities for already served items');

  // 3. Update ENUM values to include 'partially_ready' and 'partially_served'
  await sequelize.query(`
    ALTER TABLE billing_kots
    MODIFY COLUMN status ENUM('pending', 'preparing', 'ready', 'partially_ready', 'partially_served', 'served', 'cancelled')
    NOT NULL DEFAULT 'pending'
  `);
  console.log('Updated billing_kots status ENUM');

  await sequelize.query(`
    ALTER TABLE billing
    MODIFY COLUMN kot_status ENUM('pending', 'preparing', 'ready', 'partially_ready', 'partially_served', 'served', 'cancelled')
    DEFAULT 'pending'
  `);
  console.log('Updated billing kot_status ENUM');

  await sequelize.query(`
    ALTER TABLE billing_kot_items
    MODIFY COLUMN status ENUM('pending', 'preparing', 'ready', 'partially_served', 'served', 'cancelled')
    NOT NULL DEFAULT 'pending'
  `);
  console.log('Updated billing_kot_items status ENUM');

  console.log('✅ KOT Separate Pickup Queues & Partial Serving Migration Complete!');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
