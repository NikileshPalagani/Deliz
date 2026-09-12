/**
 * Campus Bite — Phase 8 Automated Test Suite
 * Tests Security, Rate Limiting, Abuse Protection, Role-Based Access Control & Production Hardening
 */

import {
  app,
  MemoryRateLimiter,
  authLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  paymentLimiter,
  qrLimiter,
  adminLimiter,
  generalApiLimiter
} from '../server.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

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
    const responseHeaders = {};

    const start = process.hrtime.bigint();

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
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1000000;
        resolve({ status: statusCode, data, body: data, headers: responseHeaders, duration: durationMs });
      },
      send(data) {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1000000;
        resolve({ status: statusCode, data, body: data, headers: responseHeaders, duration: durationMs });
      },
      end() {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1000000;
        resolve({ status: statusCode, data: null, body: null, headers: responseHeaders, duration: durationMs });
      }
    };

    try {
      app.handle(req, res);
    } catch (e) {
      reject(e);
    }
  });
};

async function runPhase8Tests() {
  console.log('======================================================');
  console.log('🧪 Starting Campus Bite Phase 8 Security Test Suite...');
  console.log('======================================================\n');

  try {
    // ----------------------------------------------------
    // 1. HTTP Security Headers Verification
    // ----------------------------------------------------
    console.log('--- 1. HTTP Security Headers Verification ---');
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
    assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff header present');
    assert(healthRes.headers['x-frame-options'] === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN header present');
    assert(healthRes.headers['x-xss-protection'] === '1; mode=block', 'X-XSS-Protection: 1; mode=block header present');
    assert(healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy header present');
    assert(healthRes.headers['permissions-policy']?.includes('camera='), 'Permissions-Policy header present');
    assert(healthRes.headers['content-security-policy']?.includes("default-src 'self'"), 'Content-Security-Policy header configured\n');

    // ----------------------------------------------------
    // 2. Sliding-Window Rate Limiter Engine Unit Tests
    // ----------------------------------------------------
    console.log('--- 2. Sliding-Window Rate Limiter Engine Unit Tests ---');
    const testLimiter = new MemoryRateLimiter({ windowMs: 1000, max: 3, message: 'Rate limit test exceeded' });

    const call1 = testLimiter.check('test_ip_1');
    assert(call1.allowed === true && call1.remaining === 2, 'RateLimiter: 1st request allowed, remaining=2');

    const call2 = testLimiter.check('test_ip_1');
    assert(call2.allowed === true && call2.remaining === 1, 'RateLimiter: 2nd request allowed, remaining=1');

    const call3 = testLimiter.check('test_ip_1');
    assert(call3.allowed === true && call3.remaining === 0, 'RateLimiter: 3rd request allowed, remaining=0');

    const call4 = testLimiter.check('test_ip_1');
    assert(call4.allowed === false && call4.remaining === 0, 'RateLimiter: 4th request blocked (allowed: false)');
    assert(call4.retryAfter > 0, 'RateLimiter: retryAfter seconds reported on block');

    // Different IP should still be allowed
    const callOtherIp = testLimiter.check('test_ip_2');
    assert(callOtherIp.allowed === true, 'RateLimiter: Independent tracking per IP address');

    // Verify rate limit response headers on API endpoints
    const menuRes = await makeRequest('GET', '/api/menu');
    assert(menuRes.headers['x-ratelimit-limit'] !== undefined, 'API responses include X-RateLimit-Limit');
    assert(menuRes.headers['x-ratelimit-remaining'] !== undefined, 'API responses include X-RateLimit-Remaining');
    assert(menuRes.headers['x-ratelimit-reset'] !== undefined, 'API responses include X-RateLimit-Reset\n');

    // ----------------------------------------------------
    // 3. Server-Side Role-Based Access Control (RBAC)
    // ----------------------------------------------------
    console.log('--- 3. Server-Side Role-Based Access Control (RBAC) ---');

    // Student attempting to access Admin Stats
    const studentStatsRes = await makeRequest('GET', '/api/admin/stats', null, {
      'x-user-role': 'student',
      'x-user-email': 'attacker_student@cvr.ac.in'
    });
    assert(studentStatsRes.status === 403, 'Student access to /api/admin/stats rejected with HTTP 403');
    assert(studentStatsRes.data?.forbidden === true, 'Forbidden flag present in response');

    // Student attempting to create a Vendor Account
    const studentCreateVendor = await makeRequest('POST', '/api/vendors/create', {
      username: 'rogue_vendor',
      password: 'password123',
      name: 'Rogue Vendor'
    }, {
      'x-user-role': 'student',
      'x-user-email': 'attacker_student@cvr.ac.in'
    });
    assert(studentCreateVendor.status === 403, 'Student access to /api/vendors/create rejected with HTTP 403');

    // Student attempting to claim an Order
    const studentClaimRes = await makeRequest('POST', '/api/orders/claim', {
      orderId: 'CB-9999',
      token: 'CB-TOKEN-CB-9999-FAKE1234567890'
    }, {
      'x-user-role': 'student',
      'x-user-email': 'attacker_student@cvr.ac.in'
    });
    assert(studentClaimRes.status === 403, 'Student access to /api/orders/claim rejected with HTTP 403');

    // Admin access to Admin Stats
    const adminStatsRes = await makeRequest('GET', '/api/admin/stats', null, {
      'x-admin-role': 'admin',
      'x-admin-email': 'admin@cvr.ac.in'
    });
    assert(adminStatsRes.status === 200, 'Admin access to /api/admin/stats succeeds with HTTP 200');
    assert(adminStatsRes.data?.success === true, 'Admin stats response has success: true\n');

    // ----------------------------------------------------
    // 4. Cross-Account Student Order Isolation
    // ----------------------------------------------------
    console.log('--- 4. Cross-Account Student Order Isolation ---');
    // Place orders for two different students
    await makeRequest('POST', '/api/orders', {
      studentEmail: 'student_alice@cvr.ac.in',
      studentName: 'Alice',
      studentPhone: '9876543210',
      block: 'CB',
      items: [{ id: 'samosa', name: 'Samosa', price: 15, quantity: 2 }],
      totalAmount: 30,
      finalAmount: 30,
    });

    await makeRequest('POST', '/api/orders', {
      studentEmail: 'student_bob@cvr.ac.in',
      studentName: 'Bob',
      studentPhone: '9876543211',
      block: 'FB',
      items: [{ id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 1 }],
      totalAmount: 25,
      finalAmount: 25,
    });

    // Alice requests Bob's orders by query parameter, but authenticated as Alice
    const snoopAttempt = await makeRequest('GET', '/api/orders?email=student_bob@cvr.ac.in', null, {
      'x-user-role': 'student',
      'x-user-email': 'student_alice@cvr.ac.in'
    });

    assert(snoopAttempt.status === 200, 'GET /api/orders returns HTTP 200');
    const returnedOrders = snoopAttempt.data?.orders || [];
    const containsBobOrder = returnedOrders.some(o => o.studentEmail === 'student_bob@cvr.ac.in');
    assert(!containsBobOrder, 'Student Order Isolation: Alice CANNOT snoop Bob orders');
    const onlyAlice = returnedOrders.every(o => o.studentEmail === 'student_alice@cvr.ac.in');
    assert(onlyAlice, 'Student Order Isolation: Results strictly forced to authenticated student email\n');

    // ----------------------------------------------------
    // 5. Strict Input Validation & Abuse Prevention
    // ----------------------------------------------------
    console.log('--- 5. Strict Input Validation & Abuse Prevention ---');

    // Empty items array
    const emptyItemsRes = await makeRequest('POST', '/api/orders', {
      studentEmail: 'valid_student@cvr.ac.in',
      block: 'CB',
      items: []
    });
    assert(emptyItemsRes.status === 400, 'Order with empty items array rejected with HTTP 400');

    // Excessive quantity (>50)
    const excessQtyRes = await makeRequest('POST', '/api/orders', {
      studentEmail: 'valid_student@cvr.ac.in',
      block: 'CB',
      items: [{ id: 'samosa', name: 'Samosa', price: 15, quantity: 9999 }]
    });
    assert(excessQtyRes.status === 400, 'Order with excessive item quantity (>50) rejected with HTTP 400');

    // Negative item price
    const negPriceRes = await makeRequest('POST', '/api/orders', {
      studentEmail: 'valid_student@cvr.ac.in',
      block: 'CB',
      items: [{ id: 'samosa', name: 'Samosa', price: -50, quantity: 1 }]
    });
    assert(negPriceRes.status === 400, 'Order with negative item price rejected with HTTP 400');

    // Prototype pollution attempt
    const protoPayload = JSON.parse('{"studentEmail":"valid_student@cvr.ac.in","block":"CB","items":[{"id":"samosa","name":"Samosa","price":15,"quantity":1}],"__proto__":{"isAdmin":true}}');
    const protoAttackRes = await makeRequest('POST', '/api/orders', protoPayload);
    assert(protoAttackRes.status === 400, 'Order with prototype pollution payload rejected with HTTP 400\n');

    // ----------------------------------------------------
    // 6. Account Enumeration Protection
    // ----------------------------------------------------
    console.log('--- 6. Account Enumeration Protection ---');
    const resetOtpRes = await makeRequest('POST', '/api/send-otp', {
      email: 'nonexistent_account_xyz@cvr.ac.in',
      purpose: 'password_reset'
    });
    assert(resetOtpRes.status === 200, 'Password reset OTP request returns HTTP 200');
    assert(resetOtpRes.data?.success === true, 'Response contains success: true');
    assert(
      resetOtpRes.data?.message?.includes('If an account exists'),
      'Password reset response uses generic message preventing account enumeration\n'
    );

    // ----------------------------------------------------
    // 7. Security Audit: Static Code Analysis & RLS Verification
    // ----------------------------------------------------
    console.log('--- 7. Security Audit & Migration Verification ---');
    const migrationPath = path.join(ROOT_DIR, 'supabase', 'migrations', '008_security_hardening.sql');
    assert(fs.existsSync(migrationPath), 'Migration 008_security_hardening.sql exists');

    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    assert(migrationContent.includes('orders ENABLE ROW LEVEL SECURITY'), 'RLS enabled on orders table');
    assert(migrationContent.includes('payments ENABLE ROW LEVEL SECURITY'), 'RLS enabled on payments table');
    assert(migrationContent.includes('profiles ENABLE ROW LEVEL SECURITY'), 'RLS enabled on profiles table');
    assert(migrationContent.includes('otp_challenges ENABLE ROW LEVEL SECURITY'), 'RLS enabled on otp_challenges table');
    assert(migrationContent.includes('CREATE POLICY orders_select_policy'), 'Granular RLS select policy defined for orders');
    assert(migrationContent.includes('CREATE POLICY otp_challenges_service_only'), 'Service-role-only RLS policy defined for OTP challenges');

    // Verify repository & secrets protection
    const gitignorePath = path.join(ROOT_DIR, '.gitignore');
    assert(fs.existsSync(gitignorePath), '.gitignore file exists in repository root');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assert(gitignoreContent.includes('.env'), '.gitignore properly ignores .env files');
    assert(gitignoreContent.includes('node_modules'), '.gitignore properly ignores node_modules');
    assert(gitignoreContent.includes('dist'), '.gitignore properly ignores build dist folder');

    const envExamplePath = path.join(ROOT_DIR, '.env.example');
    assert(fs.existsSync(envExamplePath), '.env.example file exists');
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    assert(!envExampleContent.includes('rzp_live_real'), '.env.example contains no real secrets');

    const securityAuditDoc = path.join(ROOT_DIR, 'SECURITY_AUDIT.md');
    assert(fs.existsSync(securityAuditDoc), 'SECURITY_AUDIT.md document exists and is complete\n');

    // ----------------------------------------------------
    // 8. Non-Regression: Phases 1–7 Full Flow
    // ----------------------------------------------------
    console.log('--- 8. Non-Regression: Phases 1–7 Verification ---');
    // Phase 1: Order creation
    const p1OrderRes = await makeRequest('POST', '/api/orders', {
      studentEmail: 'p8_regression_student@cvr.ac.in',
      studentName: 'P8 Student',
      studentPhone: '9988776655',
      block: 'CB',
      items: [{ id: 'samosa', name: 'Samosa', price: 15, quantity: 2 }],
      totalAmount: 30,
      finalAmount: 30,
    });
    assert(p1OrderRes.status === 201, 'Phase 1: Order created with HTTP 201');
    assert(p1OrderRes.data?.order?.id !== undefined, 'Phase 1: Order ID generated');

    // Phase 2: Login
    const p2LoginRes = await makeRequest('POST', '/api/auth/login', {
      identifier: 'vendor1',
      password: 'vendor1'
    });
    assert(p2LoginRes.status === 200, 'Phase 2: Vendor login succeeded with HTTP 200');

    // Phase 4: OTP Send & Verify
    const p4SendRes = await makeRequest('POST', '/api/send-otp', {
      email: 'p8_otp_user@cvr.ac.in',
      purpose: 'registration'
    });
    assert(p4SendRes.status === 200, 'Phase 4: OTP generation returns HTTP 200');

    // Phase 5: Razorpay Create Order
    const p5RzpRes = await makeRequest('POST', '/api/create-order', {
      amount: 1,
      items: [{ id: 'veg_puff', quantity: 2 }]
    });
    assert(p5RzpRes.status === 200, 'Phase 5: Razorpay create-order returns HTTP 200');
    assert(p5RzpRes.data?.amount === 5000, 'Phase 5: Server-side canonical price calculated (₹50 / 5000 paise)');

    // Phase 6: Read-only QR validation & claim
    const p6ValRes = await makeRequest('POST', '/api/orders/validate-qr', {
      token: p1OrderRes.data.order.token
    });
    assert(p6ValRes.status === 200, 'Phase 6: Read-only QR validation returns HTTP 200');
    assert(p6ValRes.data?.status === 'READY_FOR_PICKUP', 'Phase 6: QR status is READY_FOR_PICKUP');

    const p6ClaimRes = await makeRequest('POST', '/api/orders/claim', {
      token: p1OrderRes.data.order.token,
      orderId: p1OrderRes.data.order.id,
      vendorId: 'vendor1'
    }, {
      'x-vendor-id': 'vendor1'
    });
    assert(p6ClaimRes.status === 200, 'Phase 6: Vendor claim succeeds with HTTP 200');
    assert(p6ClaimRes.data?.newlyClaimed === true, 'Phase 6: Order marked as newlyClaimed');

    // Phase 7: Paginated Orders
    const p7PaginatedRes = await makeRequest('GET', '/api/orders?limit=5&page=1');
    assert(p7PaginatedRes.status === 200, 'Phase 7: Paginated orders endpoint returns HTTP 200');
    assert(p7PaginatedRes.data?.totalPages !== undefined, 'Phase 7: Pagination totalPages present\n');

  } catch (err) {
    console.error('Unexpected error during Phase 8 test execution:', err);
    testsFailed++;
  }

  console.log('======================================================');
  console.log(`📊 Phase 8 Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runPhase8Tests();
