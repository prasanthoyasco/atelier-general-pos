import { sequelize } from './src/db/index.js';
import Kitchen from './src/product/models/kitchen.model.js';
import Billing from './src/billing/models/billing.models.js';
import BillingItem from './src/billing/models/billingiteam.models.js';
import BillingKOT from './src/billing/models/billingkot.model.js';
import BillingKOTItem from './src/billing/models/billingkotitem.model.js';
import Branch from './src/user/models/branch.model.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    try {
        console.log("Starting Multi-Kitchen Migration...");

        // 1. Run the SQL schema migration
        const sqlPath = path.join(process.cwd(), 'migrations', 'add_multi_kitchen_kots.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split and execute SQL statements
        const statements = sql.split(';').filter(stmt => stmt.trim());
        for (const stmt of statements) {
            try {
                await sequelize.query(stmt);
                console.log("Executed SQL statement.");
            } catch (err) {
                if (err.message.includes("Duplicate column name") || err.message.includes("already exists")) {
                    console.log("Schema changes already applied, skipping statement.");
                } else {
                    console.error("Error executing SQL:", err.message);
                }
            }
        }

        console.log("Schema migration completed. Starting data migration...");

        // 2. Data Migration
        // Find all billings that have KOT status
        const billings = await Billing.findAll({
            where: {
                kot_status: ['pending', 'preparing', 'ready', 'served', 'cancelled']
            },
            include: [{ model: BillingItem, as: 'items' }]
        });

        console.log(`Found ${billings.length} billings with existing KOT data to migrate.`);

        // Process each billing
        for (const bill of billings) {
            // Check if it already has KOTs
            const existingKOTs = await BillingKOT.count({ where: { billing_id: bill.id } });
            if (existingKOTs > 0) {
                continue; // Already migrated
            }

            // Get or create a Default Kitchen for this branch
            let kitchen = await Kitchen.findOne({
                where: { branch_id: bill.branch_id, kitchen_name: 'Main Kitchen' }
            });

            if (!kitchen) {
                kitchen = await Kitchen.create({
                    kitchen_name: 'Main Kitchen',
                    branch_id: bill.branch_id,
                    is_active: true
                });
            }

            // Create KOT for the bill
            const kotNumber = bill.billing_no ? `${bill.billing_no.split('-').pop()}-K1` : `KOT-${Date.now().toString().slice(-4)}`;
            
            const kot = await BillingKOT.create({
                billing_id: bill.id,
                kitchen_id: kitchen.id,
                kitchen_name: kitchen.kitchen_name,
                kot_number: kotNumber,
                status: bill.kot_status,
                branch_id: bill.branch_id,
                preparing_at: bill.kot_preparing_at,
                preparing_by: bill.kot_preparing_by,
                ready_at: bill.kot_ready_at,
                ready_by: bill.kot_ready_by,
                served_at: bill.kot_served_at,
                served_by: bill.kot_served_by,
                cancelled_at: bill.kot_cancelled_at,
                cancelled_by: bill.kot_cancelled_by,
                cancel_reason: bill.kot_cancel_reason,
                createdAt: bill.kot_created_at || bill.createdAt
            });

            // Create KOT Items
            for (const item of bill.items) {
                await BillingKOTItem.create({
                    kot_id: kot.id,
                    billing_item_id: item.id,
                    status: bill.kot_status
                });
            }
        }

        console.log("Data migration completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

runMigration();
