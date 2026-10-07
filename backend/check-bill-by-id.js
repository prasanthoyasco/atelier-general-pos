import { sequelize } from "./src/db/index.js";
import Billing from "./src/billing/models/billing.models.js";

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to Database");

    const billId = "d12dc555-2832-4aa1-b388-9573137bd381";
    const bill = await Billing.findByPk(billId, { raw: true });

    if (!bill) {
      console.log(`\n❌ Bill with ID ${billId} NOT found in the database.`);
    } else {
      console.log(`\n✅ Bill Found:`);
      console.log(`- ID: ${bill.id}`);
      console.log(`- Bill No: ${bill.billing_no}`);
      console.log(`- Branch ID: ${bill.branch_id}`);
      console.log(`- Payment Status: "${bill.status}"`);
      console.log(`- KOT Status: "${bill.kot_status}"`);
      console.log(`- KOT Created At: ${bill.kot_created_at}`);
      console.log(`- KOT Preparing At: ${bill.kot_preparing_at}`);
      console.log(`- KOT Ready At: ${bill.kot_ready_at}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
