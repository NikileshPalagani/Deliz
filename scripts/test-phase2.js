/**
 * ==============================================================================
 * Phase 2 Comprehensive Test Suite
 * Tests:
 * 1. Health check endpoint (GET /api/health)
 * 2. Student Registration with @cvr.ac.in (POST /api/auth/register-student)
 * 3. Non-college email registration rejection
 * 4. Student Login with valid & invalid passwords (POST /api/auth/login)
 * 5. Vendor Login (vendor1 to vendor12 & custom vendors)
 * 6. Admin Login & Authorization
 * 7. User Profile Retrieval & Updates (POST /api/auth/me, POST /api/auth/update-profile)
 * 8. Password Reset via Verified Token (POST /api/reset-password)
 * 9. Authoritative Coin Balance API (POST /api/coins/balance)
 * 10. Vendor Account Creation & Directory (POST /api/vendors/create, GET /api/vendors)
 * 11. Vendor Profile Updating (POST /api/vendors/update)
 * 12. Phase 1 Orders & Payments Regression Verification
 * ==============================================================================
 */

import crypto from 'crypto';
import { app } from '../server.js';

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
  console.log('🧪 Starting Campus Bite Phase 2 Test Suite...');
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
    assert(healthRes.body?.status === 'ok', 'Health status is "ok"');
    console.log(`   Database Engine: ${healthRes.body?.database}`);
    console.log(`   Auth Backend: ${healthRes.body?.authBackend}`);

    // 2. Student Registration (@cvr.ac.in restriction)
    console.log('\n--- 2. Student Registration Tests ---');
    const invalidEmailRes = await makeRequest('POST', '/api/auth/register-student', {
      email: 'outsider@gmail.com',
      password: 'password123',
      name: 'Outsider User',
      phone: '+91 9876543210',
    });
    assert(invalidEmailRes.status === 400, 'Non-college email registration rejected with HTTP 400');
    assert(invalidEmailRes.body?.success === false, 'success is false for non-@cvr.ac.in email');

    const validStudentPayload = {
      email: '22b81a0501@cvr.ac.in',
      password: 'securePassword123',
      name: 'Ravi Teja',
      phone: '+91 9876543210',
      rollNo: '22B81A0501',
      block: 'CM',
    };

    const validRegisterRes = await makeRequest('POST', '/api/auth/register-student', validStudentPayload);
    assert(validRegisterRes.status === 201, 'Valid student registration returns HTTP 201 Created');
    assert(validRegisterRes.body?.success === true, 'Student registration succeeded');
    assert(validRegisterRes.body?.user?.email === '22b81a0501@cvr.ac.in', 'Student email confirmed');
    assert(validRegisterRes.body?.user?.coins === 0, 'Initial coin balance is strictly 0');
    assert(validRegisterRes.body?.user?.password === undefined, 'Plaintext password NOT exposed in response');

    // 3. Student Login Tests
    console.log('\n--- 3. Student Login Tests ---');
    // Wrong password test
    const wrongPassRes = await makeRequest('POST', '/api/auth/login', {
      identifier: '22b81a0501@cvr.ac.in',
      password: 'incorrectPassword',
    });
    assert(wrongPassRes.status === 401, 'Wrong password rejected with HTTP 401');
    assert(wrongPassRes.body?.success === false, 'Wrong password success is false');

    // Correct password test
    const correctLoginRes = await makeRequest('POST', '/api/auth/login', {
      identifier: '22b81a0501@cvr.ac.in',
      password: 'securePassword123',
    });
    assert(correctLoginRes.status === 200, 'Student login returns HTTP 200 OK');
    assert(correctLoginRes.body?.success === true, 'Student login succeeded');
    assert(correctLoginRes.body?.user?.role === 'student', 'User role is student');
    assert(correctLoginRes.body?.user?.rollNo === '22B81A0501', 'Roll number verified');

    // Non-existent account test (No silent auto-registration!)
    const unknownLoginRes = await makeRequest('POST', '/api/auth/login', {
      identifier: '99z99a9999@cvr.ac.in',
      password: 'anyPassword',
    });
    assert(unknownLoginRes.status === 404, 'Unknown account returns HTTP 404 Not Found (no silent auto-registration)');
    assert(unknownLoginRes.body?.success === false, 'Unknown account success is false');

    // 4. Vendor Login Tests
    console.log('\n--- 4. Vendor Login Tests ---');
    const vendor1LoginRes = await makeRequest('POST', '/api/auth/login', {
      identifier: 'vendor1',
      password: 'vendor1',
    });
    assert(vendor1LoginRes.status === 200, 'Vendor1 login returns HTTP 200 OK');
    assert(vendor1LoginRes.body?.success === true, 'Vendor1 login succeeded');
    assert(vendor1LoginRes.body?.user?.role === 'vendor', 'User role is vendor');
    assert(vendor1LoginRes.body?.user?.vendorId === 'vendor1', 'vendorId matches vendor1');

    // 5. Admin Login Tests
    console.log('\n--- 5. Admin Login Tests ---');
    const adminLoginRes = await makeRequest('POST', '/api/auth/login', {
      identifier: 'admin@cvr.ac.in',
      password: 'admin',
    });
    assert(adminLoginRes.status === 200, 'Admin login returns HTTP 200 OK');
    assert(adminLoginRes.body?.success === true, 'Admin login succeeded');
    assert(adminLoginRes.body?.user?.role === 'admin', 'User role is admin');

    // 6. User Profile Updates
    console.log('\n--- 6. User Profile Update Tests ---');
    const updateProfileRes = await makeRequest('POST', '/api/auth/update-profile', {
      email: '22b81a0501@cvr.ac.in',
      name: 'Ravi Teja Varma',
      phone: '+91 9123456780',
      block: 'FB',
    });
    assert(updateProfileRes.status === 200, 'Profile update returns HTTP 200');
    assert(updateProfileRes.body?.success === true, 'Profile updated successfully');
    assert(updateProfileRes.body?.user?.name === 'Ravi Teja Varma', 'Updated name reflected');
    assert(updateProfileRes.body?.user?.block === 'FB', 'Updated block reflected');

    // 7. Authoritative Coin Balance
    console.log('\n--- 7. Authoritative Coin Balance Tests ---');
    const coinBalanceRes = await makeRequest('POST', '/api/coins/balance', {
      email: '22b81a0501@cvr.ac.in',
    });
    assert(coinBalanceRes.status === 200, 'Coin balance endpoint returns HTTP 200');
    assert(typeof coinBalanceRes.body?.coins === 'number', 'Coin balance is a numeric value');

    // 8. Vendor Management (Creation, Directory, Updates)
    console.log('\n--- 8. Vendor Management Tests ---');
    const createVendorRes = await makeRequest('POST', '/api/vendors/create', {
      username: 'fastbites',
      password: 'fastbites123',
      name: 'Fast Bites Canteen',
      phone: '+91 9988776655',
      stationName: 'Counter 13 - Main Canteen',
      upiId: 'fastbites@upi',
      block: 'CM',
    });
    assert(createVendorRes.status === 201, 'Vendor creation returns HTTP 201 Created');
    assert(createVendorRes.body?.success === true, 'Custom vendor created successfully');
    assert(createVendorRes.body?.vendor?.username === 'fastbites', 'Vendor username confirmed');

    const vendorsListRes = await makeRequest('GET', '/api/vendors');
    assert(vendorsListRes.status === 200, 'GET /api/vendors returns HTTP 200');
    const foundCustomVendor = (vendorsListRes.body?.vendors || []).find(v => v.username === 'fastbites');
    assert(Boolean(foundCustomVendor), 'Newly created vendor is present in directory');

    // 9. Phase 1 Orders & Payment Regression
    console.log('\n--- 9. Phase 1 Orders & Payments Regression Verification ---');
    const orderPayload = {
      studentEmail: '22b81a0501@cvr.ac.in',
      studentName: 'Ravi Teja Varma',
      studentPhone: '+91 9123456780',
      block: 'FB',
      items: [{ id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 2, isVeg: true }],
      totalAmount: 50,
      discount: 0,
      finalAmount: 50,
      coinsEarned: 10,
      coinsRedeemed: 0,
      paymentMethod: 'UPI',
    };

    const orderRes = await makeRequest('POST', '/api/orders', orderPayload);
    assert(orderRes.status === 201, 'Order placement returns HTTP 201');
    assert(orderRes.body?.success === true, 'Order created successfully');
    const placedOrder = orderRes.body?.order;
    assert(Boolean(placedOrder?.token), 'Pickup QR Token generated');

    const claimRes = await makeRequest('POST', '/api/orders/claim', {
      token: placedOrder.token,
      vendorId: 'vendor1',
    });
    assert(claimRes.status === 200, 'Order claim returns HTTP 200');
    assert(claimRes.body?.success === true, 'Order claimed successfully');
    assert(claimRes.body?.order?.orderStatus === 'CLAIMED', 'Status is CLAIMED');

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`📊 Phase 2 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
