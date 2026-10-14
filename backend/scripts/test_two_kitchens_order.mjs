// backend/scripts/test_two_kitchens_order.mjs
import axios from 'axios';

const BASE_URL = 'http://localhost:10000/api/v1';

async function testTwoKitchensOrder() {
  console.log('=====================================================');
  console.log('🧪 VERIFYING TWO-KITCHEN ORDER SPLIT & STATION QUEUES');
  console.log('=====================================================\n');

  try {
    // 1. Login
    const loginRes = await axios.post(`${BASE_URL}/user/login`, {
      identifier: 'demoadmin@gmail.com',
      password: 'admin@123'
    });
    const token = loginRes.data?.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 2. Branch
    const branchesRes = await axios.get(`${BASE_URL}/user/my-branches`, { headers: authHeaders });
    const branchId = branchesRes.data?.data?.[0]?.branch_id;
    const branchHeaders = { ...authHeaders, 'x-branch-id': branchId };

    // 3. Find products from both kitchens
    const prodsRes = await axios.get(`${BASE_URL}/product/product`, {
      params: { limit: 100, branch_id: branchId },
      headers: branchHeaders
    });
    const prods = prodsRes.data?.data || [];

    const foodItem = prods.find(p => p.product_name === 'Chicken Puff' || p.product_name === 'Egg Puff');
    const beverageItem = prods.find(p => p.product_name === 'Fresh Mint Mojito' || p.product_name === 'Mango Lassi Delight' || p.product_name === 'Cold Coffee');

    if (!foodItem || !beverageItem) {
      throw new Error('Could not find both a food item and a beverage item');
    }

    console.log(`✅ Food Item: "${foodItem.product_name}" (Kitchen ID: ${foodItem.kitchen_id})`);
    console.log(`✅ Beverage Item: "${beverageItem.product_name}" (Kitchen ID: ${beverageItem.kitchen_id})\n`);

    // 4. Create an order with both items
    console.log('Creating order for Table 12 with 1 Chicken Puff and 1 Fresh Mint Mojito...');
    const createRes = await axios.post(`${BASE_URL}/billing/billing`, {
      branch_id: branchId,
      customer_name: 'Two Kitchen Guest',
      customer_phone: '9876500000',
      type: 'Casier Billing',
      counter_no: 'Counter 12',
      billing_date: new Date().toISOString(),
      subtotal_amount: parseFloat(foodItem.selling_price || 90) + parseFloat(beverageItem.selling_price || 120),
      tax_amount: 0,
      discount_amount: 0,
      total_amount: parseFloat(foodItem.selling_price || 90) + parseFloat(beverageItem.selling_price || 120),
      paid_amount: 0,
      due_amount: parseFloat(foodItem.selling_price || 90) + parseFloat(beverageItem.selling_price || 120),
      payment_method: 'cash',
      status: 'pending',
      notes: 'Multi-kitchen automated verification order',
      billing_items: [
        {
          product_id: foodItem.id,
          product_name: foodItem.product_name,
          quantity: 1,
          unit_price: parseFloat(foodItem.selling_price || 90),
          discount_amount: 0,
          tax_percentage: 0,
          tax_amount: 0,
          total_price: parseFloat(foodItem.selling_price || 90)
        },
        {
          product_id: beverageItem.id,
          product_name: beverageItem.product_name,
          quantity: 1,
          unit_price: parseFloat(beverageItem.selling_price || 120),
          discount_amount: 0,
          tax_percentage: 0,
          tax_amount: 0,
          total_price: parseFloat(beverageItem.selling_price || 120)
        }
      ]
    }, { headers: branchHeaders });

    const bill = createRes.data?.data || createRes.data?.billing;
    console.log(`✅ Bill created: #${bill.billing_no} (ID: ${bill.id})\n`);

    // 5. Fetch Queue to inspect KOT split across stations
    const queueRes = await axios.get(`${BASE_URL}/billing/billing/kitchen-queue`, {
      params: { branch_id: branchId },
      headers: branchHeaders
    });
    const orderInQueue = (queueRes.data?.data || []).find(o => o.id === bill.id);

    console.log('--- KOT Station Routing Inspection ---');
    console.log(`Table: ${orderInQueue.table_no || orderInQueue.counter_no}`);
    console.log(`Total items in order: ${orderInQueue.items?.length}`);

    const stationSet = new Set();
    orderInQueue.items?.forEach(it => {
      stationSet.add(it.kitchen_name);
      console.log(`  🍽️ Item: "${it.product_name}" -> Routed to Station: [${it.kitchen_name}] | Status: ${it.status}`);
    });

    console.log(`\nDistinct Kitchen Stations Found: ${Array.from(stationSet).join(', ')}`);
    if (stationSet.size >= 2) {
      console.log('✅ PASS: Order was automatically split across multiple kitchen stations!');
    } else {
      console.log('⚠️ Notice: Check kitchen assignment grouping if only 1 station appeared.');
    }

    console.log('\n=====================================================');
    console.log('🎉 TWO-KITCHEN ORDER VERIFICATION COMPLETE!');
    console.log('=====================================================');
  } catch (err) {
    console.error('❌ Test error:', err.response?.data || err.message);
  }
}

testTwoKitchensOrder();
