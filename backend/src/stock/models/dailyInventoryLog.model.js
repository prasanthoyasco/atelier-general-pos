import { sequelize } from '../../db/index.js';
import { DataTypes } from 'sequelize';

const DailyInventoryLog = sequelize.define('DailyInventoryLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  item_type: {
    type: DataTypes.ENUM('product', 'ingredient'),
    allowNull: false,
    defaultValue: 'product',
  },
  item_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  item_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  unit: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'piece',
  },
  opening_stock: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0.0,
  },
  added_stock: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0.0,
  },
  billed_qty: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0.0,
  },
  expected_stock: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0.0,
  },
  closing_stock: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: true,
  },
  discrepancy: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: true,
  },
  wastage_qty: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0.0,
  },
  wastage_reason: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  morning_logged_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  morning_logged_by_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  evening_logged_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  evening_logged_by_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'CLOSED'),
    allowNull: false,
    defaultValue: 'OPEN',
  },
}, {
  tableName: 'daily_inventory_logs',
  timestamps: true,
  indexes: [
    {
      fields: ['branch_id', 'date'],
    },
    {
      fields: ['item_id', 'item_type'],
    },
  ],
});

export default DailyInventoryLog;
