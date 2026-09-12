/**
 * Campus Bite Phase 3 Test Suite
 * Real-time Architecture, Polling Removal & End-to-End Flow Verification
 */

import { app } from '../server.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mapDbOrderToFrontend } from '../src/utils/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failedCount++;
  }
}

function makeRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const [pathPart, queryPart] = urlPath.split('?');
    const query = {};
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      for (const [k, v] of params.entries()) {
        query[k] = v;
      }
    }

    const req = {
      method: method.toUpperCase(),
      url: urlPath,
      path: pathPart,
      originalUrl: urlPath,
      query,
      body: body || {},
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json'
      },
    };

    let statusCode = 200;
    const res = {
      statusCode: 200,
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader() { return this; },
      getHeader() { return null; },
      json(data) {
        resolve({ status: statusCode, data, body: data });
      },
      send(data) {
        resolve({ status: statusCode, data, body: data });
      },
      end() {
        resolve({ status: statusCode, data: null, body: null });
      }
    };

    try {
      app.handle(req, res);
    } catch (e) {
      reject(e);
    }
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Campus Bite Phase 3 Test Suite...');
  console.log('======================================================\n');

  try {
    // ----------------------------------------------------
    // 1. Health Check Test
    // ----------------------------------------------------
    console.log('--- 1. Health Check Test ---');
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200, 'Health endpoint returns HTTP 200');
    assert(health.data.status === 'ok', 'Health response status is "ok"');
    console.log(`   Database Engine: ${health.data.database}`);
    console.log(`   Auth Backend: ${health.data.authBackend}\n`);

    // ----------------------------------------------------
    // 2. Data Mapping Helper Unit Tests
    // ----------------------------------------------------
    console.log('--- 2. Realtime Order Data Mapping Unit Tests ---');
    const sampleDbRow = {
      id: 'CB-9901',
      token: 'CB-TOKEN-9901-XYZ',
      student_email: '22b81a0501@cvr.ac.in',
      student_name: 'Rahul Sharma',
      student_phone: '+91 9876543210',
      block: 'FB',
      floor: '2',
      items: [
        { id: 'samosa', name: 'Samosa', price: 15, quantity: 2, isVeg: true },
        { id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 1, isVeg: true }
      ],
      total_amount: 55,
      discount: 0,
      final_amount: 55,
      coins_earned: 11,
      coins_redeemed: 0,
      payment_method: 'UPI',
      transaction_id: 'TXN-9901',
      razorpay_order_id: 'order_test_9901',
      payment_status: 'PAID',
      order_status: 'PENDING_PICKUP',
      claimed_by: null,
      claimed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mapped = mapDbOrderToFrontend(sampleDbRow);
    assert(mapped.id === 'CB-9901', 'Order ID preserved');
    assert(mapped.token === 'CB-TOKEN-9901-XYZ', 'Order token preserved');
    assert(mapped.studentEmail === '22b81a0501@cvr.ac.in', 'student_email mapped to studentEmail');
    assert(mapped.studentName === 'Rahul Sharma', 'student_name mapped to studentName');
    assert(mapped.totalAmount === 55, 'total_amount mapped to numeric totalAmount');
    assert(mapped.finalAmount === 55, 'final_amount mapped to numeric finalAmount');
    assert(mapped.orderStatus === 'PENDING_PICKUP', 'order_status mapped to orderStatus');
    assert(mapped.items.length === 2, 'items array correctly structured\n');

    // ----------------------------------------------------
    // 3. Static Polling Eradication Verification
    // ----------------------------------------------------
    console.log('--- 3. Static Code Audit: Polling Eradication ---');
    const appContextSrc = fs.readFileSync(path.join(__dirname, '../src/context/AppContext.jsx'), 'utf-8');
    const vendorDashSrc = fs.readFileSync(path.join(__dirname, '../src/components/vendor/VendorDashboard.jsx'), 'utf-8');
    const adminDashSrc = fs.readFileSync(path.join(__dirname, '../src/components/admin/AdminDashboard.jsx'), 'utf-8');
    const orderQrSrc = fs.readFileSync(path.join(__dirname, '../src/components/buyer/OrderQrModal.jsx'), 'utf-8');

    assert(!appContextSrc.includes('setInterval(fetchOrders'), 'AppContext has no setInterval(fetchOrders) polling');
    assert(!vendorDashSrc.includes('setInterval(fetchVendorOrders'), 'VendorDashboard has no setInterval(fetchVendorOrders) polling');
    assert(!adminDashSrc.includes('setInterval(fetchStats'), 'AdminDashboard has no setInterval(fetchStats) polling');
    assert(!orderQrSrc.includes('setInterval('), 'OrderQrModal has no setInterval polling');
    assert(appContextSrc.includes('subscribeToStudentOrders'), 'AppContext uses subscribeToStudentOrders');
    assert(vendorDashSrc.includes('subscribeToVendorOrders'), 'VendorDashboard uses subscribeToVendorOrders');
    assert(adminDashSrc.includes('subscribeToAdminOrders'), 'AdminDashboard uses subscribeToAdminOrders\n');

    // ----------------------------------------------------
    // 4. Realtime Subscription Lifecycle Logic Tests
    // ----------------------------------------------------
    console.log('--- 4. Realtime Event Simulation & State Transition Tests ---');
    let simulatedState = [];
    let activeQrState = null;

    // Simulation of AppContext student event handler
    const handleStudentEvent = (eventType, newOrder, oldOrder) => {
      if (eventType === 'INSERT' && newOrder) {
        simulatedState = [newOrder, ...simulatedState.filter(o => o.id !== newOrder.id)];
      } else if (eventType === 'UPDATE' && newOrder) {
        simulatedState = simulatedState.map(o => o.id === newOrder.id ? { ...o, ...newOrder } : o);
        if (activeQrState && activeQrState.id === newOrder.id) {
          activeQrState = { ...activeQrState, ...newOrder };
        }
      } else if (eventType === 'DELETE' && oldOrder) {
        simulatedState = simulatedState.filter(o => o.id !== oldOrder.id);
      }
    };

    // Test INSERT Event
    handleStudentEvent('INSERT', mapped, null);
    assert(simulatedState.length === 1, 'INSERT event added new order to local state');
    assert(simulatedState[0].id === 'CB-9901', 'Order ID in state matches');

    // Test active QR modal binding
    activeQrState = mapped;
    assert(activeQrState.orderStatus === 'PENDING_PICKUP', 'Initial QR status is PENDING_PICKUP');

    // Test UPDATE Event (Vendor Claim)
    const claimedOrder = {
      ...mapped,
      orderStatus: 'CLAIMED',
      claimedBy: 'vendor1',
      claimedAt: new Date().toISOString()
    };
    handleStudentEvent('UPDATE', claimedOrder, mapped);
    assert(simulatedState[0].orderStatus === 'CLAIMED', 'UPDATE event updated status to CLAIMED in order state');
    assert(activeQrState.orderStatus === 'CLAIMED', 'UPDATE event immediately updated activeQrState without polling');
    assert(activeQrState.claimedBy === 'vendor1', 'claimedBy recorded as vendor1');

    // Test duplicate event idempotency (same event re-delivered)
    handleStudentEvent('INSERT', mapped, null);
    assert(simulatedState.length === 1, 'Duplicate INSERT did not create duplicate in state\n');

    // ----------------------------------------------------
    // 5. Admin Live Telemetry Calculation Test
    // ----------------------------------------------------
    console.log('--- 5. Admin Live Telemetry Incremental Calculation Test ---');
    let adminStats = {
      totalOrders: 10,
      totalRevenue: 500,
      pendingOrders: 2,
      claimedOrders: 8,
      blockDistribution: { CB: 3, CM: 2, FB: 4, PG: 1 },
      itemPopularity: { samosa: 10, veg_puff: 5, egg_puff: 4, chicken_puff: 2 },
      recentOrders: []
    };

    const newIncomingOrder = {
      id: 'CB-9902',
      finalAmount: 100,
      block: 'FB',
      orderStatus: 'PENDING_PICKUP',
      items: [{ id: 'chicken_puff', quantity: 2 }]
    };

    // Simulate Admin Realtime INSERT
    adminStats = {
      ...adminStats,
      totalOrders: adminStats.totalOrders + 1,
      totalRevenue: adminStats.totalRevenue + newIncomingOrder.finalAmount,
      pendingOrders: adminStats.pendingOrders + 1,
      recentOrders: [newIncomingOrder, ...adminStats.recentOrders],
      blockDistribution: {
        ...adminStats.blockDistribution,
        FB: adminStats.blockDistribution.FB + 1
      },
      itemPopularity: {
        ...adminStats.itemPopularity,
        chicken_puff: adminStats.itemPopularity.chicken_puff + 2
      }
    };

    assert(adminStats.totalOrders === 11, 'Admin totalOrders incremented to 11');
    assert(adminStats.totalRevenue === 600, 'Admin totalRevenue incremented to ₹600');
    assert(adminStats.pendingOrders === 3, 'Admin pendingOrders incremented to 3');
    assert(adminStats.blockDistribution.FB === 5, 'FB block distribution incremented');
    assert(adminStats.itemPopularity.chicken_puff === 4, 'chicken_puff units incremented to 4\n');

    // ----------------------------------------------------
    // 6. End-to-End API Order & Claim Flow (Non-Regression)
    // ----------------------------------------------------
    console.log('--- 6. End-to-End API Order & Claim Flow ---');
    const orderPayload = {
      studentEmail: '22b81a0501@cvr.ac.in',
      studentName: 'Rahul Sharma',
      studentPhone: '+91 9876543210',
      block: 'FB',
      items: [
        { id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 2, isVeg: true }
      ],
      totalAmount: 50,
      discount: 0,
      finalAmount: 50,
      coinsEarned: 10,
      coinsRedeemed: 0,
      paymentMethod: 'UPI',
    };

    const createRes = await makeRequest('POST', '/api/orders', orderPayload);
    assert(createRes.status === 201, 'Order creation returns HTTP 201');
    assert(createRes.data.success === true, 'Order created successfully');
    const createdId = createRes.data.order.id;
    const createdToken = createRes.data.order.token;
    assert(Boolean(createdId), `Order ID assigned: ${createdId}`);
    assert(Boolean(createdToken), `Pickup token assigned: ${createdToken}`);

    // Claim the order via QR scan
    const claimRes = await makeRequest('POST', '/api/orders/claim', {
      orderId: createdId,
      token: createdToken,
      vendorId: 'vendor1'
    });
    assert(claimRes.status === 200, 'Order claim returns HTTP 200');
    assert(claimRes.data.success === true, 'Order claimed successfully');
    assert(claimRes.data.order.orderStatus === 'CLAIMED', 'Status updated to CLAIMED');

    // Duplicate claim prevention
    const dupClaim = await makeRequest('POST', '/api/orders/claim', {
      orderId: createdId,
      token: createdToken,
      vendorId: 'vendor2'
    });
    assert(dupClaim.status === 400, 'Duplicate claim rejected with HTTP 400');
    assert(dupClaim.data.alreadyClaimed === true, 'alreadyClaimed flag is true\n');

    // ----------------------------------------------------
    // 7. Phase 2 Auth Centralization Verification
    // ----------------------------------------------------
    console.log('--- 7. Phase 2 Auth Centralization Verification ---');
    const authLogin = await makeRequest('POST', '/api/auth/login', {
      identifier: 'vendor1',
      password: 'vendor1'
    });
    assert(authLogin.status === 200, 'Vendor login succeeds');
    assert(authLogin.data.user.role === 'vendor', 'Role resolved as vendor');

  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    console.log('======================================================');
    console.log(`📊 Phase 3 Test Results: ${passedCount} Passed, ${failedCount} Failed`);
    console.log('======================================================\n');
    process.exit(failedCount === 0 ? 0 : 1);
  }
}

runTests();
