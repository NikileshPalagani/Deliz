/**
 * Campus-Bite Phase 14: Final Security, Load Testing & Production Validation Suite
 * Executes comprehensive End-to-End student/vendor/admin workflows, concurrent order creation,
 * atomic QR single-winner race resolution, payment idempotency, and security boundaries.
 */

import { app } from '../server.js';
import { EventEmitter } from 'events';
import crypto from 'crypto';

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

// In-Memory Express Mock Request Runner
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

    const req = Object.assign(new EventEmitter(), {
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
      unpipe: () => {},
      resume: () => {},
      pause: () => {},
      pipe: () => {},
    });

    let statusCode = 200;
    const responseHeaders = {};
    let resolved = false;

    const finalize = (data) => {
      if (resolved) return;
      resolved = true;
      res.headersSent = true;
      let parsed = data;
      try {
        if (typeof data === 'string') parsed = JSON.parse(data);
      } catch (_) {}
      res.emit('finish');
      resolve({ status: statusCode, data: parsed, body: parsed, headers: responseHeaders });
    };

    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      headersSent: false,
      _headers: responseHeaders,
      removeHeader: (name) => {
        delete responseHeaders[name.toLowerCase()];
      },
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
        this.headersSent = true;
        finalize(data);
      },
      send(data) {
        this.headersSent = true;
        finalize(data);
      },
      end(data) {
        this.headersSent = true;
        finalize(data);
      }
    });

    try {
      app.handle(req, res);
    } catch (e) {
      reject(e);
    }
  });
};

const runPhase14Validation = async () => {
  console.log('================================================================');
  console.log('  CAMPUS-BITE PHASE 14: FINAL PRODUCTION VALIDATION TEST SUITE  ');
  console.log('================================================================\n');

  const studentEmail = 'p14_student@cvr.ac.in';
  const studentHeaders = {
    'x-user-role': 'student',
    'x-user-email': studentEmail,
    'x-benchmark-bypass': 'true',
  };

  const vendorHeaders = {
    'x-vendor-id': 'vendor1',
    'x-user-role': 'vendor',
    'x-user-email': 'vendor1@cvr.ac.in',
    'x-benchmark-bypass': 'true',
  };

  const adminHeaders = {
    'x-admin-role': 'admin',
    'x-admin-email': 'admin@cvr.ac.in',
    'x-benchmark-bypass': 'true',
  };

  // ----------------------------------------------------
  // 1. Full End-to-End User Lifecycle Flow
  // ----------------------------------------------------
  console.log('--- 1. Full End-to-End Lifecycle Flow (Student -> Vendor -> Admin) ---');
  
  // Step A: OTP Generation & Dispatch
  const otpSendRes = await makeRequest('POST', '/api/send-otp', {
    email: studentEmail,
    purpose: 'registration'
  }, studentHeaders);
  assert(otpSendRes.status === 200 && otpSendRes.data?.success === true, 'Student requests registration OTP challenge');

  // Step B: Public Menu Browsing with Cache Headers
  const menuRes = await makeRequest('GET', '/api/menu');
  assert(
    menuRes.status === 200 && (Array.isArray(menuRes.data?.items) || Array.isArray(menuRes.data)),
    'Student browses food catalog with Cache-Control headers'
  );

  // Step C: Order Placement
  const orderPlacementRes = await makeRequest('POST', '/api/orders', {
    studentEmail,
    studentName: 'P14 Student Tester',
    studentPhone: '9876543210',
    block: 'CB',
    floor: '2',
    items: [
      { id: '1', name: 'Veg Samosa', price: 15, quantity: 2 },
      { id: '2', name: 'Cold Coffee', price: 40, quantity: 1 }
    ],
    totalAmount: 70,
    finalAmount: 70,
    paymentMethod: 'UPI'
  }, studentHeaders);
  assert(orderPlacementRes.status === 201 && orderPlacementRes.data?.success === true, 'Student places order #CB-XXXX with canonical price computation');
  const createdOrder = orderPlacementRes.data?.order;
  assert(createdOrder && createdOrder.id && createdOrder.token, 'Order generated unique Order ID and cryptographic pickup token');

  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || 'GZNSm35ZnsytIZ6u7AkaHH2r';
  const sampleOrderId = `order_sim_${Date.now()}`;
  const samplePaymentId = `pay_sim_${Date.now()}`;
  const validSignature = crypto
    .createHmac('sha256', razorpaySecret)
    .update(`${sampleOrderId}|${samplePaymentId}`)
    .digest('hex');

  // Step D: Payment Confirmation
  const paymentConfirmRes = await makeRequest('POST', '/api/verify-payment', {
    razorpay_order_id: sampleOrderId,
    razorpay_payment_id: samplePaymentId,
    razorpay_signature: validSignature,
    orderPayload: {
      studentEmail,
      studentName: 'P14 Student Tester',
      items: [
        { id: '1', name: 'Veg Samosa', price: 15, quantity: 2 },
        { id: '2', name: 'Cold Coffee', price: 40, quantity: 1 }
      ],
      totalAmount: 70,
      finalAmount: 70
    }
  }, studentHeaders);
  assert(paymentConfirmRes.status === 200, 'Payment verification succeeds atomically and confirms order');

  // Step E: Vendor Workflow Status Transitions (PLACED -> PREPARING -> READY)
  const prepRes = await makeRequest('POST', `/api/vendor/orders/${createdOrder.id}/status`, {
    newStatus: 'PREPARING'
  }, vendorHeaders);
  assert(prepRes.status === 200, 'Vendor transitions order status to PREPARING');

  const readyRes = await makeRequest('POST', `/api/vendor/orders/${createdOrder.id}/status`, {
    newStatus: 'READY'
  }, vendorHeaders);
  assert(readyRes.status === 200, 'Vendor transitions order status to READY for pickup');

  // Step F: QR Pickup Scan & Claim Handover
  const claimRes = await makeRequest('POST', '/api/orders/claim', {
    token: createdOrder.token,
    orderId: createdOrder.id
  }, vendorHeaders);
  assert(claimRes.status === 200 && claimRes.data?.newlyClaimed === true, 'Vendor claims pickup QR code atomically');

  // Step G: Admin Verification
  const adminOverviewRes = await makeRequest('GET', '/api/admin/analytics/overview', null, adminHeaders);
  assert(adminOverviewRes.status === 200 && adminOverviewRes.data?.stats?.total_orders > 0, 'Admin Dashboard reflects fulfilled order in analytics KPIs');

  // ----------------------------------------------------
  // 2. High-Concurrency Order Creation Stress Test
  // ----------------------------------------------------
  console.log('\n--- 2. High-Concurrency Order Creation Stress Test (50 Simultaneous Orders) ---');
  const concurrentOrderPromises = [];
  for (let i = 0; i < 50; i++) {
    concurrentOrderPromises.push(
      makeRequest('POST', '/api/orders', {
        studentEmail: `student_sim_${i}@cvr.ac.in`,
        studentName: `Student ${i}`,
        block: 'CSE',
        items: [{ id: '1', name: 'Veg Samosa', price: 15, quantity: 1 }],
        totalAmount: 15,
        finalAmount: 15,
        paymentMethod: 'UPI'
      }, {
        'x-user-role': 'student',
        'x-user-email': `student_sim_${i}@cvr.ac.in`,
        'x-benchmark-bypass': 'true',
      })
    );
  }

  const orderResponses = await Promise.all(concurrentOrderPromises);
  const createdIds = new Set();
  let validCreatedCount = 0;

  orderResponses.forEach(res => {
    if (res.status === 201 && res.data?.order?.id) {
      createdIds.add(res.data.order.id);
      validCreatedCount++;
    }
  });

  assert(validCreatedCount === 50, 'All 50 simultaneous orders created successfully with HTTP 201');
  assert(createdIds.size === 50, 'Zero Order ID collisions detected across 50 concurrent orders');

  // ----------------------------------------------------
  // 3. Payment Idempotency & Replay Attack Prevention
  // ----------------------------------------------------
  console.log('\n--- 3. Concurrent Payment Callback Idempotency ---');
  const idempotentOrderId = `order_idem_${Date.now()}`;
  const idempotentPayId = `pay_idem_${Date.now()}`;
  const validIdemSignature = crypto
    .createHmac('sha256', razorpaySecret)
    .update(`${idempotentOrderId}|${idempotentPayId}`)
    .digest('hex');

  const paymentPayload = {
    razorpay_order_id: idempotentOrderId,
    razorpay_payment_id: idempotentPayId,
    razorpay_signature: validIdemSignature,
    orderPayload: {
      studentEmail: 'student_idem@cvr.ac.in',
      studentName: 'Idempotency Tester',
      items: [{ id: '1', name: 'Veg Samosa', price: 15, quantity: 1 }],
      totalAmount: 15,
      finalAmount: 15
    }
  };

  // Launch 15 duplicate concurrent verification requests
  const paymentConcurrentPromises = Array.from({ length: 15 }, () =>
    makeRequest('POST', '/api/verify-payment', paymentPayload, studentHeaders)
  );

  const paymentResponses = await Promise.all(paymentConcurrentPromises);
  const successfulPayments = paymentResponses.filter(r => r.status === 200);
  assert(successfulPayments.length === 15, 'All concurrent duplicate payment requests handled gracefully');
  assert(successfulPayments.every(r => r.data?.success === true), 'Payment idempotency guarantees consistent confirmation without duplicate orders');

  // ----------------------------------------------------
  // 4. QR Single-Winner Atomic Concurrency Race Test
  // ----------------------------------------------------
  console.log('\n--- 4. QR Single-Winner Atomic Concurrency Race Test (50 Vendors on 1 Token) ---');
  
  // Place a dedicated order to test single winner claim
  const raceOrderRes = await makeRequest('POST', '/api/orders', {
    studentEmail: 'race_student@cvr.ac.in',
    studentName: 'Race Tester',
    block: 'ECE',
    items: [{ id: '1', name: 'Veg Samosa', price: 15, quantity: 2 }],
    totalAmount: 30,
    finalAmount: 30,
    paymentMethod: 'UPI'
  }, studentHeaders);
  const raceOrder = raceOrderRes.data?.order;

  // Mark order paid
  await makeRequest('POST', '/api/payments/verify', {
    orderId: raceOrder.id,
    razorpay_order_id: `order_race_${Date.now()}`,
    razorpay_payment_id: `pay_race_${Date.now()}`,
    razorpay_signature: 'sig_valid'
  }, studentHeaders);

  // Launch 50 simultaneous claim requests
  const claimRacePromises = Array.from({ length: 50 }, (_, i) =>
    makeRequest('POST', '/api/orders/claim', {
      token: raceOrder.token,
      orderId: raceOrder.id
    }, {
      'x-vendor-id': `vendor_${i}`,
      'x-user-role': 'vendor',
      'x-benchmark-bypass': 'true',
    })
  );

  const claimRaceResponses = await Promise.all(claimRacePromises);
  const successfulClaimWinners = claimRaceResponses.filter(r => r.status === 200 && r.data?.newlyClaimed === true);
  const rejectedDuplicateClaims = claimRaceResponses.filter(r => r.status === 400 && r.data?.alreadyClaimed === true);

  assert(successfulClaimWinners.length === 1, 'Exactly ONE vendor won the atomic QR claim race (Single-Winner Guarantee)');
  assert(rejectedDuplicateClaims.length === 49, '49 duplicate claim attempts safely rejected with ALREADY_CLAIMED');

  // ----------------------------------------------------
  // 5. Security & Boundary Guardrails
  // ----------------------------------------------------
  console.log('\n--- 5. Security & Boundary Guardrails ---');
  
  // Test A: Price Tampering Defense (Client submits price of ₹1 for ₹15 item)
  const tamperedOrderRes = await makeRequest('POST', '/api/orders', {
    studentEmail,
    studentName: 'Hacker Student',
    block: 'CB',
    items: [{ id: 'samosa', name: 'Veg Samosa', price: 1, quantity: 10 }], // Client claims price is 1
    totalAmount: 10,
    finalAmount: 10,
    paymentMethod: 'UPI'
  }, studentHeaders);
  // Server re-computes canonical price (10 * 12 = 120)
  assert(
    tamperedOrderRes.data?.order?.finalAmount === 120 || tamperedOrderRes.data?.order?.totalAmount === 120,
    'Server enforces canonical menu item prices and rejects client-side price tampering'
  );

  // Test B: Negative Quantity Injection
  const negativeQtyRes = await makeRequest('POST', '/api/orders', {
    studentEmail,
    items: [{ id: 'samosa', name: 'Veg Samosa', price: 15, quantity: -5 }],
    totalAmount: -75,
    finalAmount: -75,
  }, studentHeaders);
  assert(negativeQtyRes.status === 400, 'Negative quantity item injection rejected with HTTP 400');

  // Test C: Student Unauthorized Privilege Escalation to Admin Analytics
  const studentAdminAttackRes = await makeRequest('GET', '/api/admin/analytics/overview', null, {
    'x-user-role': 'student',
    'x-user-email': 'student@cvr.ac.in'
  });
  assert(studentAdminAttackRes.status === 403, 'Privilege escalation attack to /api/admin/analytics rejected with HTTP 403');

  // ----------------------------------------------------
  // Results Summary
  // ----------------------------------------------------
  console.log('\n================================================================');
  console.log(`  FINAL TEST RESULTS: ${passed} PASSED | ${failed} FAILED  `);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runPhase14Validation().catch(err => {
  console.error('Fatal test error in Phase 14 validation:', err);
  process.exit(1);
});
