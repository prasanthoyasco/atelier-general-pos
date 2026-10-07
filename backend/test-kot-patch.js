import axios from "axios";

async function run() {
  try {
    console.log("1. Logging in as kitchen staff...");
    const loginRes = await axios.post("http://localhost:10000/api/v1/user/login", {
      identifier: "kitchen@example.com",
      password: "password123"
    });

    const token = loginRes.data.token;
    console.log("✅ Logged in successfully. Token acquired.");

    console.log("\n2. Sending PATCH request to update KOT status to 'served'...");
    try {
      const patchRes = await axios.patch(
        "http://localhost:10000/api/v1/billing/billing/d12dc555-2832-4aa1-b388-9573137bd381/kot-status",
        { kot_status: "served" },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log("\n✅ PATCH Success!");
      console.log("Status Code:", patchRes.status);
      console.log("Response Data:", JSON.stringify(patchRes.data, null, 2));
    } catch (patchErr) {
      console.error("\n❌ PATCH Failed!");
      if (patchErr.response) {
        console.log("Status Code:", patchErr.response.status);
        console.log("Response Headers:", JSON.stringify(patchErr.response.headers, null, 2));
        console.log("Response Body:", JSON.stringify(patchErr.response.data, null, 2));
      } else {
        console.error(patchErr.message);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error("Setup error:", err.message);
    process.exit(1);
  }
}

run();
