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
