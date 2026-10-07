import { sequelize } from '../../db/index.js';
import { DataTypes } from 'sequelize';

const Billing = sequelize.define("Billing", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  billing_no: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  customer_name: { type: DataTypes.STRING(100), allowNull: true },
  type: {
    type: DataTypes.ENUM('Casier Billing','Customer Billing','other'),
    allowNull: false,
    defaultValue: 'Casier Billing',
  },
  counter_no: { type: DataTypes.STRING(50), allowNull: true },
  customer_phone: { type: DataTypes.STRING(15), allowNull: false },
  billing_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  inward_id: { type: DataTypes.UUID, allowNull: true },
  table_id: { type: DataTypes.INTEGER, allowNull: true },
  order_type: { 
    type: DataTypes.ENUM('Dine In', 'Takeaway', 'Delivery'), 
    allowNull: false, 
    defaultValue: 'Dine In' 
  },
  total_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  subtotal_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
  discount_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
  tax_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
  total_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
  paid_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
  due_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.0 },
  payment_method: {
    type: DataTypes.ENUM('cash','credit_card','debit_card','UPI Current Account','UPI Normal Account','net_banking','split'),
    allowNull: false,
    defaultValue: 'cash',
  },
  payment_details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'For split payments: [{method: "cash", amount: 1000}, {method: "UPI", amount: 500}]'
  },
  status: {
    type: DataTypes.ENUM('pending','paid','partially_paid','cancelled'),
    allowNull: false,
  },
  kot_status: {
    type: DataTypes.ENUM('pending', 'preparing', 'ready', 'served', 'cancelled'),
    allowNull: true,
    defaultValue: null
  },
  kot_created_at: { type: DataTypes.DATE, allowNull: true },
  kot_preparing_at: { type: DataTypes.DATE, allowNull: true },
  kot_ready_at: { type: DataTypes.DATE, allowNull: true },
  kot_served_at: { type: DataTypes.DATE, allowNull: true },
  kot_cancelled_at: { type: DataTypes.DATE, allowNull: true },
  kot_preparing_by: { type: DataTypes.UUID, allowNull: true },
  kot_ready_by: { type: DataTypes.UUID, allowNull: true },
  kot_served_by: { type: DataTypes.UUID, allowNull: true },
  kot_cancelled_by: { type: DataTypes.UUID, allowNull: true },
  kot_cancel_reason: { type: DataTypes.STRING(255), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  source: { type: DataTypes.STRING(50), allowNull: true, comment: 'Customer acquisition source at time of billing' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: "billing",
  timestamps: true,
});

export default Billing;
