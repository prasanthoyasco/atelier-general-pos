import { sequelize } from '../../db/index.js';
import { DataTypes } from 'sequelize';
import Product from './product.model.js';
import Addon from './addon.model.js';

const ProductAddon = sequelize.define("ProductAddon", {
    product_id: {
        type: DataTypes.UUID,
        references: {
            model: Product,
            key: 'id'
        },
        primaryKey: true,
    },
    addon_id: {
        type: DataTypes.UUID,
        references: {
            model: Addon,
            key: 'id'
        },
        primaryKey: true,
    }
}, {
    tableName: "product_addons",
    timestamps: false,
});

export default ProductAddon;
