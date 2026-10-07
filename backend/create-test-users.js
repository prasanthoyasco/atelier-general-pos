import { sequelize } from "./src/db/index.js";
import User from "./src/user/models/user.model.js";
import Role from "./src/user/models/role.model.js";
import Branch from "./src/user/models/branch.model.js";
import UserBranch from "./src/user/models/userbranch.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Load associations
import "./src/user/models/associations.js";

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to Database");

    const branch = await Branch.findOne({ where: { branch_name: "Main Branch" } });
    if (!branch) {
      console.error("Main Branch not found!");
      process.exit(1);
    }

    const kitchenRole = await Role.findOne({ where: { role_name: "kitchen" } });
    const orderTakerRole = await Role.findOne({ where: { role_name: "order taker" } });

    if (!kitchenRole || !orderTakerRole) {
      console.error("Kitchen or Order Taker role not found! Run seed-permissions.js first.");
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash("password123", 10);

    // 1. Create Kitchen User
    let kitchenUser = await User.findOne({ where: { email: "kitchen@example.com" } });
    if (!kitchenUser) {
      kitchenUser = await User.create({
        id: crypto.randomUUID(),
        username: "Kitchen Staff",
        email: "kitchen@example.com",
        password: hashedPassword,
        phone: "1111111111",
        role_id: kitchenRole.id,
        is_active: 1
      });
      console.log("Kitchen user created.");
    } else {
      await kitchenUser.update({ password: hashedPassword, role_id: kitchenRole.id });
      console.log("Kitchen user updated.");
    }

    // Assign to branch
    await UserBranch.findOrCreate({
      where: { user_id: kitchenUser.id, branch_id: branch.id },
      defaults: { role_id: kitchenRole.id }
    });
    console.log("Kitchen user assigned to Main Branch.");

    // 2. Create Order Taker User
    let orderTakerUser = await User.findOne({ where: { email: "ordertaker@example.com" } });
    if (!orderTakerUser) {
      orderTakerUser = await User.create({
        id: crypto.randomUUID(),
        username: "Order Taker",
        email: "ordertaker@example.com",
        password: hashedPassword,
        phone: "2222222222",
        role_id: orderTakerRole.id,
        is_active: 1
      });
      console.log("Order Taker user created.");
    } else {
      await orderTakerUser.update({ password: hashedPassword, role_id: orderTakerRole.id });
      console.log("Order Taker user updated.");
    }

    // Assign to branch
    await UserBranch.findOrCreate({
      where: { user_id: orderTakerUser.id, branch_id: branch.id },
      defaults: { role_id: orderTakerRole.id }
    });
    console.log("Order Taker user assigned to Main Branch.");

    console.log("\nTest Users Setup Completed!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
