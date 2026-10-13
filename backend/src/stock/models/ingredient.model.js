import { sequelize } from '../../db/index.js';
import { DataTypes } from 'sequelize';

const Ingredient = sequelize.define('Ingredient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  stock_quantity: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: false,
    defaultValue: 0.0,
  },
  base_unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'kg',
  },
  low_stock_threshold: {
    type: DataTypes.DECIMAL(15, 3),
    allowNull: true,
    defaultValue: 5.0,
  },
  cost_per_unit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.0,
  },
  branch_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'ingredients',
  timestamps: true,
});

export default Ingredient;
