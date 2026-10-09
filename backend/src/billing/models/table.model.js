import { DataTypes } from "sequelize";
import { sequelize } from "../../db/index.js";
import Branch from "../../user/models/branch.model.js";

const Table = sequelize.define(
  "Table",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Branch,
        key: "id",
      },
    },
    table_no: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    table_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 4,
    },
    status: {
      type: DataTypes.ENUM("available", "occupied"),
      allowNull: false,
      defaultValue: "available",
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "tables",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["branch_id", "table_no"],
      },
    ],
  }
);

// Setup association
Branch.hasMany(Table, { foreignKey: "branch_id" });
Table.belongsTo(Branch, { foreignKey: "branch_id" });

export default Table;
