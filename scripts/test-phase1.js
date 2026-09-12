/**
 * ==============================================================================
 * Phase 1 Comprehensive In-Process Test Suite
 * Tests all endpoints & business logic:
 * 1. Health check endpoint (GET /api/health)
 * 2. Order creation (POST /api/orders)
 * 3. Order query & filtering (GET /api/orders)
 * 4. Razorpay payment verification & idempotency (POST /api/verify-payment)
 * 5. Atomic single-use order claiming (POST /api/orders/claim)
 * 6. Duplicate/concurrent claim rejection test (Atomicity check)
 * 7. Admin statistics endpoint (GET /api/admin/stats)
 * 8. Supabase Admin Data Mapping and Schema Transformations
 * ==============================================================================
 */

import crypto from 'crypto';
import { app } from '../server.js';
import {
  mapOrderToDb,
  mapOrderFromDb,
  mapPaymentToDb,
  mapPaymentFromDb,
} from '../server/supabaseAdmin.js';

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
        resolve({ status: statusCode, body: data });
      },
      send(data) {
        resolve({ status: statusCode, body: data });
      },
      end() {
        resolve({ status: statusCode, body: null });
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
  console.log('🧪 Starting Campus Bite Phase 1 Test Suite...');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  };

  try {
    // 1. Health Check
    console.log('\n--- 1. Health Check Test ---');
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthRes.body?.status === 'ok', 'Health response status is "ok"');
    console.log(`   Database Backend: ${healthRes.body?.database}`);

    // 2. Order Creation
    console.log('\n--- 2. Order Creation Test (POST /api/orders) ---');
    const orderPayload = {
      studentEmail: 'teststudent@cvr.ac.in',
      studentName: 'Test Student',
      studentPhone: '+91 9999988888',
      block: 'CM',
      items: [
        { id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 2, isVeg: true },
        { id: 'samosa', name: 'Samosa', price: 12, quantity: 1, isVeg: true },
      ],
      totalAmount: 62,
      discount: 2,
      finalAmount: 60,
      coinsEarned: 1,
      coinsRedeemed: 2,
      paymentMethod: 'UPI',
      transactionId: `TXN_TEST_${Date.now()}`
    };

    const createRes = await makeRequest('POST', '/api/orders', orderPayload);
    assert(createRes.status === 201, 'Order creation returns HTTP 201 Created');
    assert(createRes.body?.success === true, 'Order created successfully');
    assert(Boolean(createRes.body?.order?.id), `Order ID assigned: ${createRes.body?.order?.id}`);
    assert(Boolean(createRes.body?.order?.token), `Token assigned: ${createRes.body?.order?.token}`);
    assert(createRes.body?.order?.finalAmount === 60, 'Final amount matches ₹60');
    assert(createRes.body?.order?.orderStatus === 'PENDING_PICKUP', 'Initial status is PENDING_PICKUP');

    const createdOrder = createRes.body?.order;

    // 3. Order Query & Filtering
    console.log('\n--- 3. Order Query & Filtering Test (GET /api/orders) ---');
    const studentOrdersRes = await makeRequest('GET', `/api/orders?email=teststudent@cvr.ac.in`);
    assert(studentOrdersRes.status === 200, 'GET /api/orders returns HTTP 200');
    assert(studentOrdersRes.body?.success === true, 'GET /api/orders succeeds');
    const foundOrder = (studentOrdersRes.body?.orders || []).find(o => o.id === createdOrder.id);
    assert(Boolean(foundOrder), `Order #${createdOrder.id} successfully found in student orders list`);

    // 4. Razorpay Verification & Idempotency
    console.log('\n--- 4. Razorpay Signature Verification & Idempotency Test ---');
    const testSecret = (process.env.RAZORPAY_KEY_SECRET || 'test_secret').trim();
    const rzpOrderId = `order_test_${Date.now()}`;
    const rzpPaymentId = `pay_test_${Date.now()}`;
    const validSignature = crypto
      .createHmac('sha256', testSecret)
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest('hex');

    const verifyPayload = {
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: validSignature,
      orderPayload: {
        studentEmail: 'rzp_buyer@cvr.ac.in',
        studentName: 'Razorpay Student',
        block: 'FB',
        items: [{ id: 'chicken_puff', name: 'Chicken Puff', price: 30, quantity: 1, isVeg: false }],
        totalAmount: 30,
        discount: 0,
        finalAmount: 30,
        coinsEarned: 1,
        coinsRedeemed: 0,
      }
    };

    // First attempt
    const firstVerifyRes = await makeRequest('POST', '/api/verify-payment', verifyPayload);
    assert(firstVerifyRes.status === 200, 'First payment verification returns HTTP 200');
    assert(firstVerifyRes.body?.success === true, 'First payment verified and confirmed');
    const firstOrder = firstVerifyRes.body?.order;
    assert(Boolean(firstOrder?.id), `Order #${firstOrder?.id} generated`);

    // Second attempt (Idempotent replay test)
    const secondVerifyRes = await makeRequest('POST', '/api/verify-payment', verifyPayload);
    assert(secondVerifyRes.status === 200, 'Second payment verification returns HTTP 200');
    assert(secondVerifyRes.body?.isDuplicate === true, 'Idempotency correctly flagged duplicate transaction');
    assert(secondVerifyRes.body?.order?.id === firstOrder?.id, 'Returned exact existing order without creating duplicates');

    // 5. Atomic Order Claiming
    console.log('\n--- 5. Atomic Order Claiming Test (POST /api/orders/claim) ---');
    const claimRes = await makeRequest('POST', '/api/orders/claim', {
      token: createdOrder.token,
      vendorId: 'vendor1'
    });

    assert(claimRes.status === 200, 'Claim endpoint returns HTTP 200');
    assert(claimRes.body?.success === true, 'First claim request succeeds');
    assert(claimRes.body?.newlyClaimed === true, 'Marked as newlyClaimed: true');
    assert(claimRes.body?.order?.orderStatus === 'CLAIMED', 'Status changed to CLAIMED');
    assert(claimRes.body?.order?.claimedBy === 'vendor1', 'claimedBy recorded as vendor1');

    // 6. Duplicate Claim Attempt Rejection (Atomic Protection)
    console.log('\n--- 6. Duplicate Claim Rejection Test ---');
    const secondClaimRes = await makeRequest('POST', '/api/orders/claim', {
      token: createdOrder.token,
      vendorId: 'vendor2'
    });

    assert(secondClaimRes.status === 400, 'Duplicate claim rejected with HTTP 400 Bad Request');
    assert(secondClaimRes.body?.success === false, 'Duplicate claim success is false');
    assert(secondClaimRes.body?.alreadyClaimed === true, 'alreadyClaimed flag is true');
    assert(secondClaimRes.body?.message?.includes('ALREADY EXPIRED'), 'Clear expiration message returned to vendor');

    // 7. Admin Statistics
    console.log('\n--- 7. Admin Statistics Test (GET /api/admin/stats) ---');
    const statsRes = await makeRequest('GET', '/api/admin/stats');
    assert(statsRes.status === 200, 'Admin stats returns HTTP 200');
    assert(statsRes.body?.success === true, 'Admin stats response is successful');
    assert(typeof statsRes.body?.stats?.totalOrders === 'number', 'totalOrders count is valid');
    assert(typeof statsRes.body?.stats?.totalRevenue === 'number', 'totalRevenue is valid');
    assert(typeof statsRes.body?.stats?.claimedOrders === 'number', 'claimedOrders count is valid');
    assert(Boolean(statsRes.body?.stats?.blockDistribution), 'Block distribution breakdown present');
    assert(Boolean(statsRes.body?.stats?.itemPopularity), 'Item popularity telemetry present');

    // 8. Data Mapping & Schema Transformation Unit Tests
    console.log('\n--- 8. Supabase PostgreSQL Data Mapping Unit Tests ---');
    const dbRow = mapOrderToDb(createdOrder);
    assert(dbRow.student_email === createdOrder.studentEmail.toLowerCase(), 'student_email mapped correctly to snake_case');
    assert(dbRow.total_amount === createdOrder.totalAmount, 'total_amount mapped correctly');
    assert(dbRow.order_status === createdOrder.orderStatus, 'order_status mapped correctly');

    const mappedBack = mapOrderFromDb(dbRow);
    assert(mappedBack.studentEmail === createdOrder.studentEmail.toLowerCase(), 'studentEmail mapped back to camelCase');
    assert(mappedBack.totalAmount === createdOrder.totalAmount, 'totalAmount mapped back');
    assert(mappedBack.id === createdOrder.id, 'id mapped back');

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`📊 Phase 1 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
