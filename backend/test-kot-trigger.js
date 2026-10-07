import { sequelize } from "./src/db/index.js";
import billingService from "./src/billing/service/billing.service.js";

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to Database");

    // Coffee product id: c4d3a3dd-dbcf-41db-b682-b4e543df6e34 (Beverages category)
    const testPayload = {
      branch_id: "ad16ec0e-7025-4b3f-989c-758c07921ea6",
      customer_name: "KOT Test Customer",
      customer_phone: "9999999999",
      type: "Dine In",
      payment_method: "Cash",
      status: "paid",
      items: [
        {
          product_id: "c4d3a3dd-dbcf-41db-b682-b4e543df6e34",
          quantity: 2,
          unit_price: 15.00
        }
      ]
    };

    console.log("\nCalling createBillingWithItems with Coffee...");
    const bill = await billingService.createBillingWithItems(testPayload);
    console.log("\n--- RESULT ---");
    console.log(`Created Bill No: ${bill.billing_no}`);
    console.log(`KOT Status: "${bill.kot_status}"`);
    console.log(`KOT Created At: ${bill.kot_created_at}`);

    process.exit(0);
  } catch (err) {
    console.error("\nError creating bill:", err);
    process.exit(1);
  }
}

run();
