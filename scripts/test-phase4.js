/**
 * Campus Bite Phase 4 Test Suite
 * Scalable OTP, Email Verification & Password-Reset Security Verification
 */

import { app } from '../server.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

function makeRequest(method, urlPath, body = null, headers = {}) {
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
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Campus Bite Phase 4 Test Suite...');
  console.log('======================================================\n');

  try {
    // ----------------------------------------------------
    // 1. Health Check Test
    // ----------------------------------------------------
    console.log('--- 1. Health Check & Environment Verification ---');
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200, 'Health endpoint returns HTTP 200');
    assert(health.data.status === 'ok', 'Health response status is "ok"');
    console.log(`   Database Engine: ${health.data.database}`);
    console.log(`   Auth Backend: ${health.data.authBackend}`);
    console.log(`   Email Service: ${health.data.emailService}\n`);

    // ----------------------------------------------------
    // 2. Input Validation for /api/send-otp
    // ----------------------------------------------------
    console.log('--- 2. Input Validation for /api/send-otp ---');
    const emptyEmailRes = await makeRequest('POST', '/api/send-otp', {});
    assert(emptyEmailRes.status === 400, 'Empty email rejected with HTTP 400');
    assert(emptyEmailRes.data.success === false, 'success is false for empty email');

    const invalidEmailRes = await makeRequest('POST', '/api/send-otp', { email: 'invalid-email' });
    assert(invalidEmailRes.status === 400, 'Malformed email without @/. rejected with HTTP 400');

    const validSend = await makeRequest('POST', '/api/send-otp', {
      email: 'student_phase4_test1@cvr.ac.in',
      purpose: 'registration'
    });
    assert(validSend.status === 200, 'Valid OTP request returns HTTP 200');
    assert(validSend.data.success === true, 'Valid OTP response has success: true');
    assert(!validSend.data.otp, 'Plaintext OTP is never returned in API response');
    assert(!validSend.data.otpHash, 'OTP hash is never returned in API response\n');

    // ----------------------------------------------------
    // 3. 30-Second Cooldown Enforcement
    // ----------------------------------------------------
    console.log('--- 3. 30-Second Cooldown Enforcement ---');
    const immediateResend = await makeRequest('POST', '/api/send-otp', {
      email: 'student_phase4_test1@cvr.ac.in',
      purpose: 'registration'
    });
    assert(immediateResend.status === 429, 'Immediate OTP re-request rejected with HTTP 429');
    assert(immediateResend.data.message.includes('wait'), '429 message advises user of wait cooldown\n');

    // ----------------------------------------------------
    // 4. Invalid OTP & Max 5 Attempts Rate Limiting
    // ----------------------------------------------------
    console.log('--- 4. Invalid OTP & Max 5 Attempts Rate Limiting ---');
    const testEmail2 = 'student_phase4_attempts@cvr.ac.in';
    await makeRequest('POST', '/api/send-otp', { email: testEmail2, purpose: 'registration' });

    // Send malformed OTP format
    const malformedOtpRes = await makeRequest('POST', '/api/verify-otp', {
      email: testEmail2,
      otp: '12',
      purpose: 'registration'
    });
    assert(malformedOtpRes.status === 400, 'Non-6-digit OTP format rejected with HTTP 400');

    // Send 5 incorrect OTP attempts
    let lastBadRes = null;
    for (let i = 1; i <= 5; i++) {
      lastBadRes = await makeRequest('POST', '/api/verify-otp', {
        email: testEmail2,
        otp: `99999${i % 10}`,
        purpose: 'registration'
      });
      assert(lastBadRes.status === 400, `Incorrect attempt #${i} rejected with HTTP 400`);
    }

    // 6th attempt should trigger HTTP 429 lockout
    const sixthAttempt = await makeRequest('POST', '/api/verify-otp', {
      email: testEmail2,
      otp: '000000',
      purpose: 'registration'
    });
    assert(sixthAttempt.status === 429, '6th incorrect attempt triggers HTTP 429 lockout');
    assert(sixthAttempt.data.message.includes('Too many'), 'Lockout message indicates too many attempts\n');

    // ----------------------------------------------------
    // 5. Password Reset Flow with Single-Use Authorization Token
    // ----------------------------------------------------
    console.log('--- 5. Password Reset Flow with Single-Use Authorization Token ---');
    const resetUserEmail = 'student_reset_phase4@cvr.ac.in';
    
    // Register test student first
    await makeRequest('POST', '/api/auth/register-student', {
      email: resetUserEmail,
      password: 'OldPassword123',
      name: 'Reset Test Student',
      phone: '+91 9988776655',
      rollNo: '22B81A0599',
      block: 'CB'
    });

    // Request OTP for password reset
    const resetOtpReq = await makeRequest('POST', '/api/send-otp', {
      email: resetUserEmail,
      purpose: 'password_reset'
    });
    assert(resetOtpReq.status === 200, 'Password reset OTP request returns HTTP 200');

    // Test rejection of missing fields in /api/reset-password
    const missingParamRes = await makeRequest('POST', '/api/reset-password', {
      email: resetUserEmail,
      resetToken: 'some_token'
      // missing newPassword
    });
    assert(missingParamRes.status === 400, 'Missing newPassword rejected with HTTP 400');

    // Test rejection of short password (< 6 chars)
    const shortPassRes = await makeRequest('POST', '/api/reset-password', {
      email: resetUserEmail,
      resetToken: 'some_token',
      newPassword: '123'
    });
    assert(shortPassRes.status === 400, 'Password < 6 chars rejected with HTTP 400');

    // Test rejection of invalid / spoofed reset token
    const spoofedTokenRes = await makeRequest('POST', '/api/reset-password', {
      email: resetUserEmail,
      resetToken: 'spoofed_invalid_token_1234567890',
      newPassword: 'BrandNewPassword123'
    });
    assert(spoofedTokenRes.status === 403, 'Spoofed reset token rejected with HTTP 403');

    // ----------------------------------------------------
    // 6. Security Audit: Static Code Analysis
    // ----------------------------------------------------
    console.log('--- 6. Security Audit: Static Code Analysis ---');
    const serverSrc = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf-8');
    const migrationSrc = fs.readFileSync(path.join(__dirname, '../supabase/migrations/004_otp_challenges.sql'), 'utf-8');
    const supabaseAdminSrc = fs.readFileSync(path.join(__dirname, '../server/supabaseAdmin.js'), 'utf-8');

    assert(migrationSrc.includes('CREATE TABLE IF NOT EXISTS public.otp_challenges'), 'Migration creates public.otp_challenges table');
    assert(migrationSrc.includes('otp_hash TEXT NOT NULL'), 'Migration specifies otp_hash column');
    assert(!migrationSrc.includes('otp TEXT NOT NULL'), 'Migration does NOT store plaintext otp column');
    assert(migrationSrc.includes('ENABLE ROW LEVEL SECURITY'), 'Migration enables Row Level Security on otp_challenges');
    assert(migrationSrc.includes('cleanup_expired_otp_challenges'), 'Migration defines cleanup_expired_otp_challenges procedure');

    assert(supabaseAdminSrc.includes('dbSaveOtpChallenge'), 'supabaseAdmin exports dbSaveOtpChallenge');
    assert(supabaseAdminSrc.includes('dbGetLatestOtpChallenge'), 'supabaseAdmin exports dbGetLatestOtpChallenge');
    assert(supabaseAdminSrc.includes('dbIncrementOtpAttempts'), 'supabaseAdmin exports dbIncrementOtpAttempts');
    assert(supabaseAdminSrc.includes('dbVerifyAndConsumeResetToken'), 'supabaseAdmin exports dbVerifyAndConsumeResetToken');
    assert(supabaseAdminSrc.includes('dbCheckOtpRateLimits'), 'supabaseAdmin exports dbCheckOtpRateLimits');

    assert(serverSrc.includes('crypto.timingSafeEqual'), 'server.js uses timingSafeEqual for hash comparison');
    assert(serverSrc.includes('hashOtp'), 'server.js uses hashOtp helper');
    assert(serverSrc.includes('hashResetToken'), 'server.js uses hashResetToken helper\n');

    // ----------------------------------------------------
    // 7. Non-Regression: Phase 1 Orders & Payments Flow
    // ----------------------------------------------------
    console.log('--- 7. Non-Regression: Phase 1 Orders & Payments Flow ---');
    const orderPayload = {
      studentEmail: 'student_phase4_reg@cvr.ac.in',
      studentName: 'Phase 4 Student',
      studentPhone: '+91 9988776655',
      block: 'CB',
      items: [
        { id: 'samosa', name: 'Samosa', price: 15, quantity: 2, isVeg: true }
      ],
      totalAmount: 30,
      discount: 0,
      finalAmount: 30,
      coinsEarned: 6,
      coinsRedeemed: 0,
      paymentMethod: 'UPI',
    };

    const createOrderRes = await makeRequest('POST', '/api/orders', orderPayload);
    assert(createOrderRes.status === 201, 'Phase 1: Order creation returns HTTP 201');
    assert(createOrderRes.data.success === true, 'Phase 1: Order creation success');

    const claimRes = await makeRequest('POST', '/api/orders/claim', {
      orderId: createOrderRes.data.order.id,
      token: createOrderRes.data.order.token,
      vendorId: 'vendor1'
    });
    assert(claimRes.status === 200, 'Phase 1: Order claimed successfully');
    assert(claimRes.data.order.orderStatus === 'CLAIMED', 'Phase 1: Order status updated to CLAIMED\n');

    // ----------------------------------------------------
    // 8. Non-Regression: Phase 2 Authentication & Profiles
    // ----------------------------------------------------
    console.log('--- 8. Non-Regression: Phase 2 Centralized Auth & Profiles ---');
    const vendorLogin = await makeRequest('POST', '/api/auth/login', {
      identifier: 'vendor1',
      password: 'vendor1'
    });
    assert(vendorLogin.status === 200, 'Phase 2: Vendor login returns HTTP 200');
    assert(vendorLogin.data.user.role === 'vendor', 'Phase 2: Vendor role resolved\n');

    // ----------------------------------------------------
    // 9. Non-Regression: Phase 3 Realtime Order Mapping
    // ----------------------------------------------------
    console.log('--- 9. Non-Regression: Phase 3 Realtime Order Mapping ---');
    const sampleDbRow = {
      id: 'CB-4001',
      token: 'CB-TOKEN-4001',
      student_email: 'phase4_realtime@cvr.ac.in',
      student_name: 'Realtime Student',
      block: 'FB',
      items: [{ id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 1, isVeg: true }],
      total_amount: 25,
      discount: 0,
      final_amount: 25,
      coins_earned: 5,
      coinsRedeemed: 0,
      payment_method: 'UPI',
      payment_status: 'PAID',
      order_status: 'PENDING_PICKUP',
      created_at: new Date().toISOString(),
    };

    const mapped = mapDbOrderToFrontend(sampleDbRow);
    assert(mapped.id === 'CB-4001', 'Phase 3: Order ID mapped');
    assert(mapped.studentEmail === 'phase4_realtime@cvr.ac.in', 'Phase 3: studentEmail mapped');
    assert(mapped.orderStatus === 'PENDING_PICKUP', 'Phase 3: orderStatus mapped\n');

  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    console.log('======================================================');
    console.log(`📊 Phase 4 Test Results: ${passedCount} Passed, ${failedCount} Failed`);
    console.log('======================================================\n');
    process.exit(failedCount === 0 ? 0 : 1);
  }
}

runTests();
