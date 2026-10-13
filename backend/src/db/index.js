import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("FATAL: DATABASE_URL environment variable is missing. Database connection cannot be established.");
}

const sequelize = new Sequelize(dbUrl || "mysql://localhost:3306/general_pos", {
  dialect: "mysql",
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    connectTimeout: 30000,
  },
  logging: false,
});

sequelize.authenticate()
  .then(() => console.log("Database is Connected"))
  .catch((err) => console.warn(`DB connection warning: ${err.message}`));

export { sequelize };
