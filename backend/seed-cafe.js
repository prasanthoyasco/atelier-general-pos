import { sequelize } from './src/db/index.js';
import Product from './src/product/models/product.model.js';
import Category from './src/product/models/category.model.js';

const seedData = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Create Categories
    const [hotBevCategory] = await Category.findOrCreate({
      where: { category_name: 'Hot Beverages' },
      defaults: { description: 'Hot drinks like coffee and tea' }
    });

    const [coldBevCategory] = await Category.findOrCreate({
      where: { category_name: 'Cold Beverages' },
      defaults: { description: 'Refreshing cold drinks' }
    });

    const [snacksCategory] = await Category.findOrCreate({
      where: { category_name: 'Snacks' },
      defaults: { description: 'Quick bites and puffs' }
    });

    // Create Products
    const products = [
      {
        product_name: 'Espresso Coffee',
        product_code: 'CAFE-001',
        category_id: hotBevCategory.id,
        selling_price: 120,
        mrp: 120,
        dietary_preference: 'Veg',
        temperature: 'Hot',
        image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      },
      {
        product_name: 'Cafe Latte',
        product_code: 'CAFE-002',
        category_id: hotBevCategory.id,
        selling_price: 150,
        mrp: 150,
        dietary_preference: 'Veg',
        temperature: 'Hot',
        image_url: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      },
      {
        product_name: 'Cappuccino',
        product_code: 'CAFE-003',
        category_id: hotBevCategory.id,
        selling_price: 160,
        mrp: 160,
        dietary_preference: 'Veg',
        temperature: 'Hot',
        image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      },
      {
        product_name: 'Classic Tea',
        product_code: 'CAFE-004',
        category_id: hotBevCategory.id,
        selling_price: 80,
        mrp: 80,
        dietary_preference: 'Veg',
        temperature: 'Hot',
        image_url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      },
      {
        product_name: 'Masala Chai',
        product_code: 'CAFE-005',
        category_id: hotBevCategory.id,
        selling_price: 100,
        mrp: 100,
        dietary_preference: 'Veg',
        temperature: 'Hot',
        image_url: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      },
      {
        product_name: 'Cold Coffee',
        product_code: 'CAFE-006',
        category_id: coldBevCategory.id,
        selling_price: 180,
        mrp: 180,
        dietary_preference: 'Veg',
        temperature: 'Cold',
        image_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      },
      {
        product_name: 'Peach Iced Tea',
        product_code: 'CAFE-007',
        category_id: coldBevCategory.id,
        selling_price: 140,
        mrp: 140,
        dietary_preference: 'Veg',
        temperature: 'Cold',
        image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      },
      {
        product_name: 'Veg Curry Puff',
        product_code: 'CAFE-008',
        category_id: snacksCategory.id,
        selling_price: 60,
        mrp: 60,
        dietary_preference: 'Veg',
        temperature: 'Hot',
        image_url: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      },
      {
        product_name: 'Egg Puff',
        product_code: 'CAFE-009',
        category_id: snacksCategory.id,
        selling_price: 70,
        mrp: 70,
        dietary_preference: 'Non-Veg',
        temperature: 'Hot',
        image_url: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      },
      {
        product_name: 'Chicken Puff',
        product_code: 'CAFE-010',
        category_id: snacksCategory.id,
        selling_price: 90,
        mrp: 90,
        dietary_preference: 'Non-Veg',
        temperature: 'Hot',
        image_url: 'https://images.unsplash.com/photo-1600115544045-131109a13b6e?auto=format&fit=crop&q=80&w=800',
        status: 'active'
      }
    ];

    for (const prod of products) {
      await Product.findOrCreate({
        where: { product_code: prod.product_code },
        defaults: prod
      });
      console.log(`Ensured product exists: ${prod.product_name}`);
    }

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seedData();
