import { sequelize } from "./src/db/index.js";
import User from "./src/user/models/user.model.js";
import Role from "./src/user/models/role.model.js";
import Branch from "./src/user/models/branch.model.js";
import UserBranch from "./src/user/models/userbranch.model.js";

// Load associations
import "./src/user/models/associations.js";

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Database Connected");

    const roles = await Role.findAll();
    console.log("\n--- ROLES ---");
    roles.forEach(r => console.log(`- ID: ${r.id}, Name: ${r.role_name}`));

    const branches = await Branch.findAll();
    console.log("\n--- BRANCHES ---");
    branches.forEach(b => console.log(`- ID: ${b.id}, Name: ${b.branch_name}`));

    const users = await User.findAll({ include: [{ model: Role, as: 'role' }] });
    console.log("\n--- USERS ---");
    users.forEach(u => console.log(`- ID: ${u.id}, Username: ${u.username}, Email: ${u.email}, Role: ${u.role?.role_name}`));

    const userBranches = await UserBranch.findAll();
    console.log("\n--- USER BRANCHES ---");
    userBranches.forEach(ub => console.log(`- UserID: ${ub.user_id}, BranchID: ${ub.branch_id}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
