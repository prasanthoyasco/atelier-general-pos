import { sequelize } from './src/db/index.js';

async function addKOTColumns() {
    try {
        console.log('Connecting securely to database...');
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        // 1. Check if the columns already exist
        const [columns] = await sequelize.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'billing' AND COLUMN_NAME = 'kot_status'
        `);

        if (columns.length > 0) {
            console.log('Columns already exist on "billing" table. Skipping column creation.');
        } else {
            console.log('Adding KOT columns to "billing" table...');
            
            // Add columns atomically
            await sequelize.query(`
                ALTER TABLE billing 
                ADD COLUMN kot_status ENUM('pending', 'preparing', 'ready', 'served', 'cancelled') NULL DEFAULT NULL AFTER status,
                ADD COLUMN kot_created_at DATETIME NULL AFTER kot_status,
                ADD COLUMN kot_preparing_at DATETIME NULL AFTER kot_created_at,
                ADD COLUMN kot_ready_at DATETIME NULL AFTER kot_preparing_at,
                ADD COLUMN kot_served_at DATETIME NULL AFTER kot_ready_at,
                ADD COLUMN kot_cancelled_at DATETIME NULL AFTER kot_served_at,
                ADD COLUMN kot_preparing_by CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER kot_cancelled_at,
                ADD COLUMN kot_ready_by CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER kot_preparing_by,
                ADD COLUMN kot_served_by CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER kot_ready_by,
                ADD COLUMN kot_cancelled_by CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL AFTER kot_served_by,
                ADD COLUMN kot_cancel_reason VARCHAR(255) NULL AFTER kot_cancelled_by
            `);
            console.log('✅ KOT columns successfully added.');
        }

        // 2. Add composite index on (branch_id, kot_status)
        const [indexes] = await sequelize.query(`
            SHOW INDEX FROM billing WHERE Key_name = 'idx_branch_kot_status'
        `);

        if (indexes.length > 0) {
            console.log('Index "idx_branch_kot_status" already exists. Skipping index creation.');
        } else {
            console.log('Creating composite index "idx_branch_kot_status" on (branch_id, kot_status)...');
            await sequelize.query(`
                CREATE INDEX idx_branch_kot_status ON billing (branch_id, kot_status)
            `);
            console.log('✅ Composite index successfully created.');
        }

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

addKOTColumns();
