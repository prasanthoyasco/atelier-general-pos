import Billing from './billing.models.js';
import BillingItem from './billingiteam.models.js';
import Customer from './customer.model.js';
import Product from '../../product/models/product.model.js';
import Branch from '../../user/models/branch.model.js';
import BillingKOT from './billingkot.model.js';
import BillingKOTItem from './billingkotitem.model.js';
import Table from './table.model.js';

// Billing has many BillingItems
Billing.hasMany(BillingItem, { foreignKey: 'billing_id', as: 'items' });
BillingItem.belongsTo(Billing, { foreignKey: 'billing_id', as: 'billing' });

// BillingItem belongs to Product
BillingItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(BillingItem, { foreignKey: 'product_id', as: 'billingItems' });

// Billing belongs to Customer (using customer_phone as foreign key)
Billing.belongsTo(Customer, { 
    foreignKey: 'customer_phone', 
    targetKey: 'customer_phone',
    as: 'customer' 
});
Customer.hasMany(Billing, { 
    foreignKey: 'customer_phone',
    sourceKey: 'customer_phone',
    as: 'billings' 
});

// Billing belongs to Branch
Billing.belongsTo(Branch, {
    foreignKey: 'branch_id',
    as: 'branch'
});
Branch.hasMany(Billing, {
    foreignKey: 'branch_id',
    as: 'billings'
});

// Billing belongs to Table
Billing.belongsTo(Table, {
    foreignKey: 'table_id',
    as: 'table'
});
Table.hasMany(Billing, {
    foreignKey: 'table_id',
    as: 'billings'
});

// BillingKOT and BillingKOTItem associations
Billing.hasMany(BillingKOT, { foreignKey: 'billing_id', as: 'kots' });
BillingKOT.belongsTo(Billing, { foreignKey: 'billing_id', as: 'billing' });

BillingKOT.hasMany(BillingKOTItem, { foreignKey: 'kot_id', as: 'kotItems' });
BillingKOTItem.belongsTo(BillingKOT, { foreignKey: 'kot_id', as: 'kot' });

BillingItem.hasOne(BillingKOTItem, { foreignKey: 'billing_item_id', as: 'kotItem' });
BillingKOTItem.belongsTo(BillingItem, { foreignKey: 'billing_item_id', as: 'billingItem' });

// Export everything
export { Billing, BillingItem, Customer, Product, Branch, BillingKOT, BillingKOTItem, Table };
