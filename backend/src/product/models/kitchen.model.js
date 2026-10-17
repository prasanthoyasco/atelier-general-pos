import { sequelize } from '../../db/index.js';
import { DataTypes } from 'sequelize';

const Kitchen = sequelize.define("Kitchen", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    kitchen_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    code: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    color_tag: {
        type: DataTypes.STRING(20),
        defaultValue: "#4F46E5",
    },
    default_prep_time: {
        type: DataTypes.INTEGER,
        defaultValue: 15, // in minutes
    },
    printer_ip: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    printer_port: {
        type: DataTypes.INTEGER,
        defaultValue: 9100,
    },
    auto_print: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    branch_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
    }
}, {
    tableName: "kitchens",
    timestamps: true,
});

export default Kitchen;
