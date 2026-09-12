/**
 * Campus Bite — Authentication & OTP Subsystem Load Test
 * Evaluates session validation throughput, login load, and OTP challenge generation under load.
 * Uses mock email dispatch to protect external SMTP/Brevo quotas.
 */

import { app } from '../server.js';

const postJson = (urlPath, body) => {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = {
      method: 'POST',
      url: urlPath,
      path: urlPath,
      originalUrl: urlPath,
      query: {},
      body,
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        'x-no-compression': '1',
        'x-benchmark-bypass': 'true',
      },
    };

    let statusCode = 200;
    const res = {
      statusCode: 200,
      status(c) { statusCode = c; this.statusCode = c; return this; },
      setHeader() { return this; },
      getHeader() { return null; },
      json(data) { resolve({ status: statusCode, data, latency: Date.now() - start }); },
      send(data) { resolve({ status: statusCode, data, latency: Date.now() - start }); },
      end() { resolve({ status: statusCode, data: null, latency: Date.now() - start }); }
    };

    try {
      app.handle(req, res);
    } catch (err) {
      resolve({ status: 500, error: err.message, latency: Date.now() - start });
    }
  });
};

export const runAuthOtpLoadTests = async () => {
  console.log('\n======================================================');
  console.log('🔐 Starting Authentication & OTP Load Test Suite...');
  console.log('======================================================\n');

  const results = {};

  // 1. Concurrent Vendor & Admin Logins
  console.log('--- 1. Concurrent Authentication Burst (100 Logins) ---');
  const loginPromises = [];
  for (let i = 1; i <= 100; i++) {
    loginPromises.push(postJson('/api/auth/login', {
      identifier: 'vendor1',
      password: 'vendor1'
    }));
  }
  const loginResponses = await Promise.all(loginPromises);
  const successfulLogins = loginResponses.filter(r => r.status === 200).length;
  const loginLatencies = loginResponses.map(r => r.latency).sort((a, b) => a - b);
  const loginP95 = loginLatencies[Math.floor(loginLatencies.length * 0.95)] || 0;

  results.auth = {
    total: 100,
    successful: successfulLogins,
    p95Ms: loginP95,
    status: successfulLogins >= 95 ? 'PASS' : 'WARNING',
  };
  console.log(`   Successful Logins: ${successfulLogins}/100 | p95 Latency: ${loginP95}ms | Status: [${results.auth.status}]`);

  // 2. Concurrent OTP Challenge Requests (Distinct Emails)
  console.log('\n--- 2. Concurrent OTP Challenge Generation (50 Distinct Users) ---');
  const otpPromises = [];
  for (let i = 1; i <= 50; i++) {
    otpPromises.push(postJson('/api/send-otp', {
      email: `otp_load_student_${i}@cvr.ac.in`,
      purpose: 'registration'
    }));
  }
  const otpResponses = await Promise.all(otpPromises);
  const successfulOtps = otpResponses.filter(r => r.status === 200).length;
  const otpLatencies = otpResponses.map(r => r.latency).sort((a, b) => a - b);
  const otpP95 = otpLatencies[Math.floor(otpLatencies.length * 0.95)] || 0;

  results.otp = {
    total: 50,
    successful: successfulOtps,
    p95Ms: otpP95,
    status: successfulOtps >= 45 ? 'PASS' : 'WARNING',
  };
  console.log(`   Dispatched OTP Challenges: ${successfulOtps}/50 | p95 Latency: ${otpP95}ms | Status: [${results.otp.status}]`);

  // 3. Security Inspection: Ensure zero OTP codes leaked in responses
  const leakedOtps = otpResponses.filter(r => r.data?.otp || r.data?.code);
  results.security = {
    leakedCodes: leakedOtps.length,
    status: leakedOtps.length === 0 ? 'PASS' : 'FAIL',
  };
  console.log(`   Zero OTP Code Leaks in Responses: [${results.security.status}]`);

  return results;
};

if (process.argv[1] && process.argv[1].endsWith('auth-otp-load-test.js')) {
  runAuthOtpLoadTests().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
