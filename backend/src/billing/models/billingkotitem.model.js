import { sequelize } from '../../db/index.js';
import { DataTypes } from 'sequelize';

const BillingKOTItem = sequelize.define("BillingKOTItem", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    kot_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    billing_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('pending', 'preparing', 'ready', 'served', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false,
    }
}, {
    tableName: "billing_kot_items",
    timestamps: true,
});

export default BillingKOTItem;
