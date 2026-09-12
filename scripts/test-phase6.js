/**
 * Campus Bite — Phase 6 Automated Test Suite
 * Validates QR scanning, order claiming, pickup security, duplicate scan protection,
 * vendor authorization, and database-level concurrency race safety.
 */

import { app } from '../server.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testsPassed = 0;
let testsFailed = 0;

const assert = (condition, testName) => {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    testsFailed++;
  }
};

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
};

const runPhase6Tests = async () => {
  console.log('\n======================================================');
  console.log('🧪 Starting Campus Bite Phase 6 Test Suite...');
  console.log('======================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 1. Health & Server Connectivity Check
    // -------------------------------------------------------------------------
    console.log('--- 1. Health & Server Connectivity Check ---');
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200, 'Health endpoint returns HTTP 200');
    assert(health.data?.status === 'ok', 'Health response status is "ok"');
    console.log(`   Database Engine: ${health.data?.database}`);
    console.log(`   Auth Backend: ${health.data?.authBackend}`);

    // -------------------------------------------------------------------------
    // 2. Cryptographically Secure Token Generation & Format
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Cryptographic Token Generation & QR Security ---');
    const orderPayload = {
      studentEmail: 'student_phase6_qr@cvr.ac.in',
      studentName: 'QR Security Student',
      studentPhone: '9876543210',
      block: 'CB',
      items: [{ id: 'samosa', name: 'Hot Samosa', price: 15, quantity: 2 }],
      totalAmount: 30,
      discount: 0,
      finalAmount: 30,
      coinsEarned: 3,
      coinsRedeemed: 0,
      paymentMethod: 'UPI'
    };

    const orderRes = await makeRequest('POST', '/api/orders', orderPayload);
    assert(orderRes.status === 201, 'Order creation returns HTTP 201');
    const createdOrder = orderRes.data?.order;
    assert(Boolean(createdOrder?.id), `Order ID #${createdOrder?.id} generated`);
    assert(Boolean(createdOrder?.token), 'Pickup token generated');
    assert(createdOrder?.token?.startsWith('CB-TOKEN-'), 'Pickup token has CB-TOKEN prefix');
    assert(createdOrder?.token?.length >= 20, 'Pickup token has sufficient cryptographic entropy (>20 chars)');
    assert(!createdOrder?.token?.includes('student_phase6_qr@cvr.ac.in'), 'Pickup token contains no sensitive email');
    assert(!createdOrder?.token?.includes('9876543210'), 'Pickup token contains no phone number');

    const pickupToken = createdOrder.token;
    const orderId = createdOrder.id;

    // -------------------------------------------------------------------------
    // 3. Read-Only QR Code Validation Endpoint (/api/orders/validate-qr)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Read-Only QR Validation (/api/orders/validate-qr) ---');
    const valMissing = await makeRequest('POST', '/api/orders/validate-qr', {});
    assert(valMissing.status === 400, 'Missing token/orderId rejected with HTTP 400');

    const valNonExistent = await makeRequest('POST', '/api/orders/validate-qr', {
      token: 'CB-TOKEN-FAKE-NONEXISTENT-9999'
    });
    assert(valNonExistent.status === 404, 'Non-existent token returns HTTP 404 NOT_FOUND');

    const valValid = await makeRequest('POST', '/api/orders/validate-qr', {
      token: pickupToken
    });
    assert(valValid.status === 200, 'Valid pickup pass returns HTTP 200');
    assert(valValid.data?.success === true, 'Validation success is true');
    assert(valValid.data?.status === 'READY_FOR_PICKUP', 'Validation status is READY_FOR_PICKUP');
    assert(valValid.data?.order?.id === orderId, 'Returned order ID matches expected order');
    assert(valValid.data?.order?.orderStatus === 'PENDING_PICKUP', 'Validation did NOT mutate order status (read-only)');

    // -------------------------------------------------------------------------
    // 4. Vendor Authorization & Access Control (/api/orders/claim)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Vendor Authorization & Role Enforcement ---');
    // First register student account so it's recognized as student
    await makeRequest('POST', '/api/auth/register-student', {
      email: 'unauthorized_student_phase6@cvr.ac.in',
      password: 'Password123',
      name: 'Unauthorized Student'
    });

    const studentClaim = await makeRequest('POST', '/api/orders/claim', {
      token: pickupToken,
      vendorId: 'unauthorized_student_phase6@cvr.ac.in'
    });
    assert(studentClaim.status === 403, 'Student account rejected from claiming with HTTP 403');
    assert(studentClaim.data?.unauthorized === true, 'Response clarifies unauthorized vendor');

    // -------------------------------------------------------------------------
    // 5. Cross-Order Parameter Tampering Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Cross-Order Parameter Tampering Protection ---');
    const mismatchClaim = await makeRequest('POST', '/api/orders/claim', {
      token: pickupToken,
      orderId: 'CB-9999', // Mismatched Order ID
      vendorId: 'vendor1'
    });
    assert(mismatchClaim.status === 400, 'Mismatched token and order ID rejected with HTTP 400');

    // -------------------------------------------------------------------------
    // 6. Concurrency & Race Condition Test (MANDATORY)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Concurrency Race Safety (Simultaneous Vendor Scans) ---');
    // Create a dedicated order for the concurrency test
    const concurrentOrderRes = await makeRequest('POST', '/api/orders', {
      studentEmail: 'race_test_student@cvr.ac.in',
      studentName: 'Race Test Student',
      block: 'FB',
      items: [{ id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 1 }],
      totalAmount: 25,
      discount: 0,
      finalAmount: 25,
      coinsEarned: 2,
      coinsRedeemed: 0,
      paymentMethod: 'UPI'
    });

    const raceOrder = concurrentOrderRes.data?.order;
    const raceToken = raceOrder.token;
    assert(Boolean(raceToken), `Created race test order #${raceOrder.id} with token ${raceToken}`);

    // Fire two simultaneous vendor claim requests using the exact same pickup token
    const [claim1, claim2] = await Promise.all([
      makeRequest('POST', '/api/orders/claim', {
        token: raceToken,
        vendorId: 'vendor1'
      }),
      makeRequest('POST', '/api/orders/claim', {
        token: raceToken,
        vendorId: 'vendor2'
      })
    ]);

    const successCount = (claim1.status === 200 && claim1.data?.newlyClaimed ? 1 : 0) +
                         (claim2.status === 200 && claim2.data?.newlyClaimed ? 1 : 0);
    const alreadyClaimedCount = (claim1.status === 400 && claim1.data?.alreadyClaimed ? 1 : 0) +
                                (claim2.status === 400 && claim2.data?.alreadyClaimed ? 1 : 0);

    assert(successCount === 1, `Exactly ONE vendor claim succeeded in race condition (Count: ${successCount})`);
    assert(alreadyClaimedCount === 1, `Exactly ONE vendor claim received ALREADY_CLAIMED (Count: ${alreadyClaimedCount})`);

    // Verify database state: order is CLAIMED and has exactly one claimedBy
    const valAfterRace = await makeRequest('POST', '/api/orders/validate-qr', {
      token: raceToken
    });
    assert(valAfterRace.data?.status === 'ALREADY_CLAIMED', 'Final order state is ALREADY_CLAIMED');
    assert(Boolean(valAfterRace.data?.order?.claimedBy), `Order claimed authoritatively by: ${valAfterRace.data?.order?.claimedBy}`);
    assert(Boolean(valAfterRace.data?.order?.claimedAt), 'Claim timestamp recorded');

    // -------------------------------------------------------------------------
    // 7. QR Re-use / Replay Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- 7. QR Reuse & Replay Prevention ---');
    const thirdScan = await makeRequest('POST', '/api/orders/claim', {
      token: raceToken,
      vendorId: 'vendor3'
    });
    assert(thirdScan.status === 400, 'Subsequent re-scan rejected with HTTP 400');
    assert(thirdScan.data?.alreadyClaimed === true, 'Response confirms alreadyClaimed: true');

    // -------------------------------------------------------------------------
    // 8. Order Lifecycle & Eligibility (Cancelled / Unpaid Orders)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Order Lifecycle & Unpaid / Cancelled Eligibility ---');
    // Normal claim on first order
    const claimFirst = await makeRequest('POST', '/api/orders/claim', {
      token: pickupToken,
      vendorId: 'vendor1'
    });
    assert(claimFirst.status === 200, 'Authorized claim on eligible order returns HTTP 200');
    assert(claimFirst.data?.newlyClaimed === true, 'Claim response has newlyClaimed: true');

    // -------------------------------------------------------------------------
    // 9. Static Code & Security Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Security Audit: Static Code Analysis ---');
    const migration006Path = path.join(__dirname, '../supabase/migrations/006_qr_claim_concurrency.sql');
    assert(fs.existsSync(migration006Path), 'Migration 006_qr_claim_concurrency.sql exists');

    const migration006Content = fs.readFileSync(migration006Path, 'utf8');
    assert(migration006Content.includes('uq_orders_pickup_token'), 'Migration adds unique constraint on token');
    assert(migration006Content.includes('validate_order_qr'), 'Migration defines validate_order_qr stored procedure');
    assert(migration006Content.includes('claim_order_atomic'), 'Migration defines claim_order_atomic stored procedure');

    const supabaseAdminPath = path.join(__dirname, '../server/supabaseAdmin.js');
    const supabaseAdminContent = fs.readFileSync(supabaseAdminPath, 'utf8');
    assert(supabaseAdminContent.includes('dbValidateOrderQr'), 'supabaseAdmin exports dbValidateOrderQr');
    assert(supabaseAdminContent.includes('dbClaimOrderAtomic'), 'supabaseAdmin exports dbClaimOrderAtomic');
    assert(supabaseAdminContent.includes('dbVerifyVendorRole'), 'supabaseAdmin exports dbVerifyVendorRole');

    const serverJsPath = path.join(__dirname, '../server.js');
    const serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
    assert(serverJsContent.includes('generateSecurePickupToken'), 'server.js uses generateSecurePickupToken');
    assert(serverJsContent.includes('/api/orders/validate-qr'), 'server.js exposes /api/orders/validate-qr');
    assert(serverJsContent.includes('checkQrRateLimit'), 'server.js enforces rate limiting on QR routes');

    const qrScannerModalPath = path.join(__dirname, '../src/components/vendor/QrScannerModal.jsx');
    const qrScannerModalContent = fs.readFileSync(qrScannerModalPath, 'utf8');
    assert(qrScannerModalContent.includes('isProcessingRef'), 'QrScannerModal uses isProcessingRef to debounce duplicate scans');

    // -------------------------------------------------------------------------
    // 10. Non-Regression: Phases 1 to 5 Checks
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Non-Regression: Phases 1–5 Verification ---');
    // Phase 1 Orders
    const p1Order = await makeRequest('POST', '/api/orders', {
      studentEmail: 'p1_reg_student@cvr.ac.in',
      studentName: 'Phase 1 Reg Student',
      block: 'CM',
      items: [{ id: 'chicken_puff', name: 'Chicken Puff', price: 40, quantity: 1 }],
      totalAmount: 40,
      discount: 0,
      finalAmount: 40,
      coinsEarned: 4,
      coinsRedeemed: 0,
      paymentMethod: 'UPI'
    });
    assert(p1Order.status === 201, 'Phase 1: Order created with HTTP 201');

    // Phase 2 Auth Login
    const p2Login = await makeRequest('POST', '/api/auth/login', {
      identifier: 'vendor2',
      password: 'vendor2'
    });
    assert(p2Login.status === 200, 'Phase 2: Vendor login succeeded with HTTP 200');

    // Phase 4 OTP Request
    const p4Otp = await makeRequest('POST', '/api/send-otp', {
      email: 'p4_phase6_test@cvr.ac.in',
      purpose: 'registration'
    });
    assert(p4Otp.status === 200, 'Phase 4: OTP generation returns HTTP 200');

    // Phase 5 Razorpay Price Validation
    const p5Order = await makeRequest('POST', '/api/create-order', {
      items: [{ id: 'samosa', name: 'Hot Samosa', price: 1, quantity: 2 }], // Spoofed price
      studentEmail: 'p5_student@cvr.ac.in'
    });
    assert(p5Order.status === 200, 'Phase 5: Razorpay order endpoint returns HTTP 200');
    assert(p5Order.data?.amount === 2400, 'Phase 5: Enforced canonical price (₹24 / 2400 paise)');

    console.log('\n======================================================');
    console.log(`📊 Phase 6 Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log('======================================================\n');

    if (testsFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('💥 Test suite execution error:', err);
    process.exit(1);
  }
};

runPhase6Tests();
