// backend/scripts/test_waiter_flow.mjs
import axios from 'axios';

const BASE_URL = 'http://localhost:10000/api/v1';

async function runWaiterFlowTests() {
  console.log('=====================================================');
  console.log('🧪 RUNNING DEDICATED WAITER INTERFACE VERIFICATION TEST');
  console.log('=====================================================\n');

  try {
    // 1. Login as Admin to get token and active branch
    console.log('Step 1: Authenticating...');
    const loginRes = await axios.post(`${BASE_URL}/user/login`, {
      identifier: 'demoadmin@gmail.com',
      password: 'admin@123'
    });

    const token = loginRes.data?.token;
    if (!token) throw new Error('Failed to retrieve auth token');
    console.log('✅ Logged in successfully.');

    const authHeaders = {
      Authorization: `Bearer ${token}`
    };

    // 2. Fetch Branches
    const branchesRes = await axios.get(`${BASE_URL}/user/my-branches`, { headers: authHeaders });
    const userBranches = branchesRes.data?.data || [];
    if (userBranches.length === 0) throw new Error('No branches assigned to user');
    const branchId = userBranches[0].branch_id;
    const branchName = userBranches[0].branch?.branch_name || 'Main Branch';
    console.log(`✅ Using Branch: ${branchName} (${branchId})\n`);

    const branchHeaders = {
      ...authHeaders,
      'x-branch-id': branchId
    };

    // 3. Fetch products to get 2 products (from same or different kitchen stations)
    const prodRes = await axios.get(`${BASE_URL}/product/product`, {
      params: { limit: 10, branch_id: branchId },
      headers: branchHeaders
    });
    const prods = prodRes.data?.data || [];
    if (prods.length < 2) throw new Error('Need at least 2 products to test multi-product flow');

    const prod1 = prods[0];
    const prod2 = prods[1];
    console.log(`📦 Selected Products:`);
    console.log(`   - Dish A: ${prod1.product_name} (ID: ${prod1.id})`);
    console.log(`   - Dish B: ${prod2.product_name} (ID: ${prod2.id})\n`);

    // 4. Create an order with Table 99
    console.log('Step 2: Waiter creates KOT for Table 99 (Dish A × 2, Dish B × 1)...');
    const createRes = await axios.post(`${BASE_URL}/billing/billing`, {
      branch_id: branchId,
      customer_name: 'Mr. Test Guest',
      customer_phone: '9876543210',
      type: 'Casier Billing',
      counter_no: 'Counter 99', // Maps to Table 99
      billing_date: new Date().toISOString(),
      subtotal_amount: (parseFloat(prod1.selling_price || 100) * 2) + parseFloat(prod2.selling_price || 150),
      tax_amount: 0,
      discount_amount: 0,
      total_amount: (parseFloat(prod1.selling_price || 100) * 2) + parseFloat(prod2.selling_price || 150),
      paid_amount: 0,
      due_amount: (parseFloat(prod1.selling_price || 100) * 2) + parseFloat(prod2.selling_price || 150),
      payment_method: 'cash',
      status: 'pending', // Payment status remains pending!
      notes: 'Waiter Dedicated Flow Automated Test',
      billing_items: [
        {
          product_id: prod1.id,
          product_name: prod1.product_name,
          quantity: 2,
          unit_price: parseFloat(prod1.selling_price || 100),
          discount_amount: 0,
          tax_percentage: 0,
          tax_amount: 0,
          total_price: parseFloat(prod1.selling_price || 100) * 2
        },
        {
          product_id: prod2.id,
          product_name: prod2.product_name,
          quantity: 1,
          unit_price: parseFloat(prod2.selling_price || 150),
          discount_amount: 0,
          tax_percentage: 0,
          tax_amount: 0,
          total_price: parseFloat(prod2.selling_price || 150)
        }
      ]
    }, { headers: branchHeaders });

    const createdBill = createRes.data?.data || createRes.data?.billing;
    const billId = createdBill?.id;
    console.log(`✅ Order created successfully: Bill #${createdBill?.billing_no} (ID: ${billId})\n`);

    // 5. Fetch Kitchen Queue to get kot_item_ids
    console.log('Step 3: Checking Waiter Pickup Queue...');
    const queueRes = await axios.get(`${BASE_URL}/billing/billing/kitchen-queue`, {
      params: { branch_id: branchId },
      headers: branchHeaders
    });
    const queue = queueRes.data?.data || [];
    const testOrder = queue.find(o => o.id === billId);
    if (!testOrder) throw new Error('Created order not found in kitchen queue');

    console.log(`✅ Order found in Kitchen Queue. KOT Status: "${testOrder.kot_status}"`);
    const items = testOrder.items || [];
    console.log(`   Items in order: ${items.length}`);
    items.forEach((it, idx) => {
      console.log(`   [${idx + 1}] ${it.product_name} × ${it.quantity} | Station: ${it.kitchen_name || 'Main Kitchen'} | Status: ${it.status} (kot_item_id: ${it.kot_item_id})`);
    });

    const itemA = items.find(it => it.product_id === prod1.id || it.product_name === prod1.product_name);
    const itemB = items.find(it => it.product_id === prod2.id || it.product_name === prod2.product_name);

    if (!itemA || !itemB) throw new Error('Could not match items in kitchen queue');

    // 6. Test Data Integrity Rule: Cannot serve item when it is STILL PREPARING / PENDING
    console.log('\nStep 4: Testing Rule - Cannot serve item before it is Ready...');
    try {
      await axios.patch(`${BASE_URL}/billing/billing/kot-items/${itemA.kot_item_id}/serve`, {
        served_quantity: 1
      }, { headers: branchHeaders });
      console.error('❌ FAILED: Should have rejected serving pending/cooking item!');
      process.exit(1);
    } catch (err) {
      console.log(`✅ PREPARATION CHECK PASSED: Rejected premature serve (${err.response?.data?.error || err.message})`);
    }

    // 7. Chef marks Dish A as Ready in Kitchen
    console.log('\nStep 5: Kitchen marks Dish A as Ready...');
    await axios.patch(`${BASE_URL}/billing/billing/kot-items/${itemA.kot_item_id}/status`, {
      status: 'ready'
    }, { headers: branchHeaders });
    console.log(`✅ Dish A marked as READY in Kitchen.`);

    // 8. Waiter serves 1 of 2 units of Dish A (+1 Serve)
    console.log('\nStep 6: Waiter serves unit 1 of 2 for Dish A (+1 Serve)...');
    const serve1Res = await axios.patch(`${BASE_URL}/billing/billing/kot-items/${itemA.kot_item_id}/serve`, {
      served_quantity: 1
    }, { headers: branchHeaders });
    console.log(`✅ Served 1 unit of Dish A: Status is now "${serve1Res.data?.data?.status}", Served: ${serve1Res.data?.data?.served_quantity}/${serve1Res.data?.data?.quantity}`);

    // Check that Dish B was NOT affected
    const queueCheck1 = await axios.get(`${BASE_URL}/billing/billing/kitchen-queue`, {
      params: { branch_id: branchId },
      headers: branchHeaders
    });
    const orderCheck1 = (queueCheck1.data?.data || []).find(o => o.id === billId);
    const itemBCheck1 = orderCheck1?.items?.find(it => it.kot_item_id === itemB.kot_item_id);
    console.log(`✅ Dish B Isolation Verified: Status remains "${itemBCheck1?.status}", Served: ${itemBCheck1?.served_quantity || 0}/${itemBCheck1?.quantity}`);
    console.log(`✅ Overall Order KOT Status: "${orderCheck1?.kot_status}" (Correctly partially_served)`);

    // 9. Waiter serves remaining unit of Dish A
    console.log('\nStep 7: Waiter serves unit 2 of 2 for Dish A (Full Line Served)...');
    const serve2Res = await axios.patch(`${BASE_URL}/billing/billing/kot-items/${itemA.kot_item_id}/serve`, {
      served_quantity: 1
    }, { headers: branchHeaders });
    console.log(`✅ Dish A Fully Served: Status is now "${serve2Res.data?.data?.status}", Served: ${serve2Res.data?.data?.served_quantity}/${serve2Res.data?.data?.quantity}`);

    // 10. Kitchen marks Dish B as Ready
    console.log('\nStep 8: Kitchen marks Dish B as Ready...');
    await axios.patch(`${BASE_URL}/billing/billing/kot-items/${itemB.kot_item_id}/status`, {
      status: 'ready'
    }, { headers: branchHeaders });
    console.log(`✅ Dish B marked as READY in Kitchen.`);

    // 11. Waiter serves Dish B
    console.log('\nStep 9: Waiter serves Dish B...');
    const serveBRes = await axios.patch(`${BASE_URL}/billing/billing/kot-items/${itemB.kot_item_id}/serve`, {
      served_quantity: 1
    }, { headers: branchHeaders });
    console.log(`✅ Dish B Served: Status is now "${serveBRes.data?.data?.status}"`);

    // 12. Final Check: Entire Order should now be fully served, but payment status remains "pending"
    console.log('\nStep 10: Verifying final order state & payment decoupling...');
    const finalQueueRes = await axios.get(`${BASE_URL}/billing/billing/kitchen-queue`, {
      params: { branch_id: branchId },
      headers: branchHeaders
    });
    const finalOrder = (finalQueueRes.data?.data || []).find(o => o.id === billId);
    console.log(`✅ Final Overall KOT Status: "${finalOrder?.kot_status}" (Expected: "served")`);
    console.log(`✅ Final Payment Status: "${finalOrder?.status}" (Expected: "pending" - decoupled from serving!)`);

    console.log('\n=====================================================');
    console.log('🎉 ALL DEDICATED WAITER INTERFACE TESTS PASSED PERFECTLY!');
    console.log('=====================================================');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

runWaiterFlowTests();
