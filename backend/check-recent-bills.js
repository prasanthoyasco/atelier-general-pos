import { sequelize } from "./src/db/index.js";
import Billing from "./src/billing/models/billing.models.js";

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to Database");

    const recentBills = await Billing.findAll({
      limit: 10,
      order: [["createdAt", "DESC"]],
      raw: true
    });

    console.log("\n--- RECENT BILLS ---");
    recentBills.forEach(b => {
      console.log(`- ID: ${b.id}, Bill No: ${b.billing_no}, Status: "${b.status}", KOT Status: "${b.kot_status}", Created At: ${b.createdAt}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
