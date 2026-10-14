import { sequelize } from '../../db/index.js';
import { DataTypes } from 'sequelize';

const BillingKOT = sequelize.define("BillingKOT", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    billing_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    kitchen_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    kitchen_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    kot_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('pending', 'preparing', 'ready', 'partially_ready', 'partially_served', 'served', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false,
    },
    branch_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    preparing_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    preparing_by: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    ready_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    ready_by: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    served_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    served_by: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    cancelled_by: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    cancel_reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
    }
}, {
    tableName: "billing_kots",
    timestamps: true,
});

export default BillingKOT;
