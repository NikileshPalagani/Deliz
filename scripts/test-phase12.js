/**
 * Campus Bite — Phase 12 Automated Test Suite
 * Tests:
 * 1. Vendor RBAC & Security (Reject 401 unauthenticated & 403 students from vendor APIs)
 * 2. Vendor Dashboard Live Stats API (/api/vendor/stats)
 * 3. Paginated Vendor Orders Queue & Multi-Status Filtering (/api/vendor/orders)
 * 4. Server-Side Validated Order Status Transitions (/api/vendor/orders/:id/status)
 * 5. Invalid & Terminal State Transition Rejections
 * 6. Concurrency & Double-Claim Protection (/api/orders/claim)
 * 7. Vendor Sales & Revenue Analytics (/api/vendor/sales)
 * 8. Food Item Availability Toggling by Vendors (/api/vendor/menu/:id/toggle)
 * 9. Non-Regression of Core Student/Admin Functionality (Phases 1-11)
 */

import { app } from '../server.js';

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${name} ${details ? '— ' + details : ''}`);
    failed++;
  }
}

const makeRequest = (method, urlPath, body = null, headers = {}) => {
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
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        ...headers,
      },
    };

    let statusCode = 200;
    const responseHeaders = {};

    const res = {
      statusCode: 200,
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader(name, val) {
        responseHeaders[name.toLowerCase()] = val;
        return this;
      },
      getHeader(name) {
        return responseHeaders[name.toLowerCase()] || null;
      },
      json(data) {
        resolve({ status: statusCode, data, body: data, headers: responseHeaders });
      },
      send(data) {
        let parsed = data;
        try {
          if (typeof data === 'string') parsed = JSON.parse(data);
        } catch (_) {}
        resolve({ status: statusCode, data: parsed, body: parsed, headers: responseHeaders });
      },
      end(data) {
        let parsed = data;
        try {
          if (typeof data === 'string') parsed = JSON.parse(data);
        } catch (_) {}
        resolve({ status: statusCode, data: parsed, body: parsed, headers: responseHeaders });
      }
    };

    try {
      app.handle(req, res);
    } catch (e) {
      reject(e);
    }
  });
};

async function runTests() {
  console.log('====================================================');
  console.log('  CAMPUS-BITE PHASE 12: VENDOR DASHBOARD TEST SUITE ');
  console.log('====================================================\n');

  const vendorHeaders = {
    'x-vendor-id': 'vendor1',
    'x-user-role': 'vendor',
    'x-user-email': 'vendor1@cvr.ac.in',
  };

  const studentHeaders = {
    'x-user-role': 'student',
    'x-user-email': 'student_p12@cvr.ac.in',
  };

  let testOrderId = null;
  let testOrderToken = null;

  try {
    // ----------------------------------------------------
    // Step 1: Security & RBAC Enforcement
    // ----------------------------------------------------
    console.log('--- 1. Vendor Security & RBAC Enforcement ---');

    // Anonymous access to vendor stats -> 401
    const anonStats = await makeRequest('GET', '/api/vendor/stats');
    assert(anonStats.status === 401, 'Anonymous request to /api/vendor/stats rejected with HTTP 401');

    // Student access to vendor stats -> 403
    const studentStats = await makeRequest('GET', '/api/vendor/stats', null, studentHeaders);
    assert(studentStats.status === 403, 'Student access to /api/vendor/stats rejected with HTTP 403 (Vendor role required)');

    // Student access to vendor orders queue -> 403
    const studentQueue = await makeRequest('GET', '/api/vendor/orders', null, studentHeaders);
    assert(studentQueue.status === 403, 'Student access to /api/vendor/orders rejected with HTTP 403');

    // Student attempting order status transition -> 403
    const studentStatus = await makeRequest('POST', '/api/vendor/orders/CB-9999/status', { status: 'PREPARING' }, studentHeaders);
    assert(studentStatus.status === 403, 'Student attempting status transition rejected with HTTP 403');

    // Student attempting food item toggle -> 403
    const studentToggle = await makeRequest('PATCH', '/api/vendor/menu/samosa/toggle', { isAvailable: false }, studentHeaders);
    assert(studentToggle.status === 403, 'Student attempting menu toggle rejected with HTTP 403');

    // ----------------------------------------------------
    // Step 2: Vendor Dashboard Stats API
    // ----------------------------------------------------
    console.log('\n--- 2. Vendor Dashboard Stats API ---');

    const vendorStatsRes = await makeRequest('GET', '/api/vendor/stats', null, vendorHeaders);
    assert(vendorStatsRes.status === 200, 'Authenticated vendor accesses /api/vendor/stats (HTTP 200)');
    assert(
      vendorStatsRes.data?.stats &&
      typeof vendorStatsRes.data.stats.new_orders === 'number' &&
      typeof vendorStatsRes.data.stats.preparing_orders === 'number' &&
      typeof vendorStatsRes.data.stats.ready_orders === 'number' &&
      typeof vendorStatsRes.data.stats.completed_today === 'number' &&
      typeof vendorStatsRes.data.stats.today_sales === 'number' &&
      typeof vendorStatsRes.data.stats.average_prep_time === 'number',
      'Vendor stats response contains all active workload and velocity metrics'
    );

    // ----------------------------------------------------
    // Step 3: Create Active Order for Queue Verification
    // ----------------------------------------------------
    console.log('\n--- 3. Order Placement & Queue Synchronization ---');

    const orderRes = await makeRequest('POST', '/api/orders', {
      studentEmail: 'student_p12@cvr.ac.in',
      studentName: 'P12 Test Student',
      studentPhone: '9876543210',
      block: 'CB',
      items: [{ id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 2 }],
      totalAmount: 50,
      finalAmount: 50,
      paymentMethod: 'razorpay',
    }, {
      'x-idempotency-key': `p12_test_order_${Date.now()}`,
      ...studentHeaders,
    });

    assert((orderRes.status === 200 || orderRes.status === 201) && orderRes.data?.order?.id, 'Test order successfully placed by student');
    testOrderId = orderRes.data?.order?.id;
    testOrderToken = orderRes.data?.order?.token;

    // Fetch vendor queue
    const queueRes = await makeRequest('GET', '/api/vendor/orders?block=CB&page=1&limit=20', null, vendorHeaders);
    assert(queueRes.status === 200, 'Vendor fetches active queue filtered by block (HTTP 200)');
    assert(
      Array.isArray(queueRes.data?.orders) &&
      queueRes.data.orders.some(o => o.id === testOrderId),
      'Placed order appears immediately in the vendor queue'
    );

    // ----------------------------------------------------
    // Step 4: Order Status Workflow Transitions
    // ----------------------------------------------------
    console.log('\n--- 4. Order Status Workflow Transitions ---');

    // 4.1 Transition: PLACED/PENDING -> PREPARING
    const prepRes = await makeRequest('POST', `/api/vendor/orders/${testOrderId}/status`, {
      status: 'PREPARING'
    }, vendorHeaders);
    assert(prepRes.status === 200 && prepRes.data?.currentStatus === 'PREPARING', 'Vendor starts preparation (Transition -> PREPARING)');

    // 4.2 Transition: PREPARING -> READY
    const readyRes = await makeRequest('POST', `/api/vendor/orders/${testOrderId}/status`, {
      status: 'READY'
    }, vendorHeaders);
    assert(readyRes.status === 200 && readyRes.data?.currentStatus === 'READY', 'Vendor marks order ready (Transition -> READY)');

    // ----------------------------------------------------
    // Step 5: Invalid & Terminal State Protection
    // ----------------------------------------------------
    console.log('\n--- 5. Invalid State & Transition Protection ---');

    // 5.1 Invalid Target Status
    const invalidStatusRes = await makeRequest('POST', `/api/vendor/orders/${testOrderId}/status`, {
      status: 'COOKING_UNKNOWN'
    }, vendorHeaders);
    assert(invalidStatusRes.status === 400, 'Invalid target status rejected with HTTP 400');

    // ----------------------------------------------------
    // Step 6: QR Claim & Handover Verification
    // ----------------------------------------------------
    console.log('\n--- 6. QR Claim & Handover Verification ---');

    // Vendor claims order via valid pickup token
    const claimRes = await makeRequest('POST', '/api/orders/claim', {
      orderId: testOrderId,
      token: testOrderToken,
      vendorId: 'vendor1',
    }, vendorHeaders);
    assert(claimRes.status === 200 && claimRes.data?.newlyClaimed, 'Vendor verifies and claims pickup pass atomically');

    // 6.2 Double Claim Prevention: Same token scanned second time
    const doubleClaimRes = await makeRequest('POST', '/api/orders/claim', {
      orderId: testOrderId,
      token: testOrderToken,
      vendorId: 'vendor2',
    }, vendorHeaders);
    assert(doubleClaimRes.status === 400 && doubleClaimRes.data?.alreadyClaimed, 'Duplicate scan rejected with alreadyClaimed notice');

    // 6.3 Attempting to modify status of already claimed order -> 400
    const mutateClaimedRes = await makeRequest('POST', `/api/vendor/orders/${testOrderId}/status`, {
      status: 'PREPARING'
    }, vendorHeaders);
    assert(mutateClaimedRes.status === 400, 'Attempting to alter fulfilled/claimed order rejected with HTTP 400');

    // ----------------------------------------------------
    // Step 7: Vendor Sales Analytics
    // ----------------------------------------------------
    console.log('\n--- 7. Vendor Sales & Revenue Analytics ---');

    const salesRes = await makeRequest('GET', '/api/vendor/sales?range=7d', null, vendorHeaders);
    assert(salesRes.status === 200, 'Vendor fetches sales analytics report (HTTP 200)');
    assert(
      salesRes.data?.sales &&
      typeof salesRes.data.sales.total_revenue === 'number' &&
      typeof salesRes.data.sales.total_orders === 'number' &&
      Array.isArray(salesRes.data.sales.daily_trends),
      'Sales payload provides total revenue, completed orders count, and daily trends'
    );

    // ----------------------------------------------------
    // Step 8: Food Item Availability Toggling
    // ----------------------------------------------------
    console.log('\n--- 8. Food Item Availability Toggling ---');

    // Fetch vendor menu
    const menuRes = await makeRequest('GET', '/api/vendor/menu', null, vendorHeaders);
    assert(menuRes.status === 200 && Array.isArray(menuRes.data?.items), 'Vendor fetches food menu items');

    // Toggle Samosa out-of-stock
    const toggleOffRes = await makeRequest('PATCH', '/api/vendor/menu/samosa/toggle', {
      isAvailable: false
    }, vendorHeaders);
    assert(toggleOffRes.status === 200 && toggleOffRes.data?.item?.is_available === false, 'Vendor toggles item out-of-stock');

    // Toggle Samosa back in-stock
    const toggleOnRes = await makeRequest('PATCH', '/api/vendor/menu/samosa/toggle', {
      isAvailable: true
    }, vendorHeaders);
    assert(toggleOnRes.status === 200 && toggleOnRes.data?.item?.is_available === true, 'Vendor toggles item back in-stock');

    // ----------------------------------------------------
    // Step 9: Core Non-Regression Verification
    // ----------------------------------------------------
    console.log('\n--- 9. Non-Regression Checks (Phases 1-11) ---');

    // Student Menu with Caching
    const studentMenu = await makeRequest('GET', '/api/menu');
    assert(studentMenu.status === 200 && Array.isArray(studentMenu.data?.items), 'Student menu endpoint operational');

    // Admin Stats Endpoint
    const adminStats = await makeRequest('GET', '/api/admin/stats', null, {
      'x-admin-role': 'admin',
      'x-admin-email': 'admin@cvr.ac.in',
    });
    assert(adminStats.status === 200 && adminStats.data?.stats, 'Admin Dashboard endpoints remain fully functional');

  } catch (err) {
    console.error('Fatal Test Error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED  `);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
