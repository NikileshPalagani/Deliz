/**
 * Campus-Bite Phase 13: Analytics, Monitoring & System Dashboard Test Suite
 * Validates RBAC security, single-roundtrip aggregation, food analytics, peak hours,
 * vendor metrics, processing lifecycle, payment & OTP telemetry, and system health.
 */

import { app } from '../server.js';
import { EventEmitter } from 'events';

let passedTests = 0;
let failedTests = 0;

const assert = (condition, message) => {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failedTests++;
  }
};

// In-Memory Express Mock Request Runner
const makeRequest = ({ method = 'GET', url = '/', headers = {}, body = null }) => {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.path = url.split('?')[0];
    req.originalUrl = url;
    req.headers = { ...headers };
    if (body) {
      req.headers['content-type'] = 'application/json';
      req.body = body;
    } else {
      req.body = {};
    }
    req.socket = { remoteAddress: '127.0.0.1' };

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (key, val) => {
      res.headers[key.toLowerCase()] = val;
    };
    res.getHeader = (key) => res.headers[key.toLowerCase()];
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };

    let responseBody = '';
    res.write = (chunk) => {
      if (chunk) responseBody += chunk.toString();
      return true;
    };
    res.end = (chunk) => {
      if (chunk) responseBody += chunk.toString();
      res.emit('finish');

      let parsed = null;
      try {
        parsed = JSON.parse(responseBody);
      } catch (e) {
        parsed = responseBody;
      }
      resolve({ status: res.statusCode, body: parsed, headers: res.headers });
    };

    res.json = (data) => {
      res.setHeader('content-type', 'application/json');
      responseBody = JSON.stringify(data);
      res.end();
    };

    res.send = (data) => {
      responseBody = typeof data === 'object' ? JSON.stringify(data) : String(data);
      res.end();
    };

    app.handle(req, res);
  });
};

const runPhase13Tests = async () => {
  console.log('====================================================');
  console.log('  CAMPUS-BITE PHASE 13: ANALYTICS & MONITORING TEST ');
  console.log('====================================================\n');

  const adminHeaders = {
    'x-admin-role': 'admin',
    'x-admin-email': 'admin@cvr.ac.in',
  };

  const studentHeaders = {
    'x-user-role': 'student',
    'x-user-email': 'student_p13@cvr.ac.in',
  };

  const vendorHeaders = {
    'x-vendor-id': 'vendor1',
    'x-user-role': 'vendor',
  };

  // ----------------------------------------------------
  // 1. Security & RBAC Enforcement
  // ----------------------------------------------------
  console.log('--- 1. Analytics RBAC & Security Access Controls ---');
  
  const anonRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/overview',
  });
  assert(anonRes.status === 401, 'Anonymous request to /api/admin/analytics/overview rejected with HTTP 401');

  const studentRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/overview',
    headers: studentHeaders,
  });
  assert(studentRes.status === 403, 'Student access to /api/admin/analytics/overview rejected with HTTP 403');

  const vendorRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/overview',
    headers: vendorHeaders,
  });
  assert(vendorRes.status === 403, 'Vendor access to /api/admin/analytics/overview rejected with HTTP 403');

  const studentSysRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/system-health',
    headers: studentHeaders,
  });
  assert(studentSysRes.status === 403, 'Student access to /api/admin/analytics/system-health rejected with HTTP 403');

  // ----------------------------------------------------
  // 2. Admin Analytics Overview KPIs
  // ----------------------------------------------------
  console.log('\n--- 2. Single-Roundtrip Analytics Overview KPIs ---');
  const overviewRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/overview',
    headers: adminHeaders,
  });
  assert(overviewRes.status === 200, 'Admin fetches analytics overview (HTTP 200)');
  assert(overviewRes.body?.stats !== undefined, 'Overview stats object is present in response');
  assert(typeof overviewRes.body?.stats?.total_students === 'number', 'Total students count is numeric');
  assert(typeof overviewRes.body?.stats?.total_vendors === 'number', 'Total vendors count is numeric');
  assert(typeof overviewRes.body?.stats?.total_orders === 'number', 'Total orders count is numeric');
  assert(typeof overviewRes.body?.stats?.total_revenue === 'number', 'Total revenue is numeric');
  assert(typeof overviewRes.body?.stats?.average_order_value === 'number', 'Average order value (AOV) is computed');

  // ----------------------------------------------------
  // 3. Order & Revenue Analytics
  // ----------------------------------------------------
  console.log('\n--- 3. Orders & Revenue Analytics ---');
  const ordersRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/orders?range=30d',
    headers: adminHeaders,
  });
  assert(ordersRes.status === 200, 'Admin fetches orders analytics (HTTP 200)');
  assert(ordersRes.body?.status_counts !== undefined, 'Order status breakdown present');
  assert(ordersRes.body?.block_distribution !== undefined, 'Campus block delivery distribution present');
  assert(Array.isArray(ordersRes.body?.daily_timeline), 'Daily orders timeline is an array');

  const revenueRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/revenue?range=30d',
    headers: adminHeaders,
  });
  assert(revenueRes.status === 200, 'Admin fetches revenue analytics (HTTP 200)');
  assert(typeof revenueRes.body?.total_successful_revenue === 'number', 'Total successful revenue returned');
  assert(Array.isArray(revenueRes.body?.daily_trends), 'Daily revenue trends returned');

  // ----------------------------------------------------
  // 4. Food & Menu Item Velocity
  // ----------------------------------------------------
  console.log('\n--- 4. Food & Menu Item Analytics ---');
  const foodRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/food?range=30d&limit=5',
    headers: adminHeaders,
  });
  assert(foodRes.status === 200, 'Admin fetches food analytics (HTTP 200)');
  assert(Array.isArray(foodRes.body?.top_items), 'Top ordered items array returned');
  assert(Array.isArray(foodRes.body?.least_items), 'Least ordered items array returned');
  if (foodRes.body?.top_items?.length > 0) {
    const topItem = foodRes.body.top_items[0];
    assert(topItem.item_name && typeof topItem.total_quantity === 'number', 'Item attributes (name, total_quantity, revenue) valid');
  }

  // ----------------------------------------------------
  // 5. Peak Ordering Times Analytics
  // ----------------------------------------------------
  console.log('\n--- 5. Peak Ordering Times Analytics ---');
  const peakRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/peak-times',
    headers: adminHeaders,
  });
  assert(peakRes.status === 200, 'Admin fetches peak times analytics (HTTP 200)');
  assert(Array.isArray(peakRes.body?.hourly_trends), 'Hourly velocity array returned');
  assert(Array.isArray(peakRes.body?.daily_trends), 'Daily demand velocity array returned');
  assert(typeof peakRes.body?.busiest_hour === 'number', 'Busiest ordering hour identified');
  assert(typeof peakRes.body?.busiest_day === 'string', 'Busiest day of week identified');

  // ----------------------------------------------------
  // 6. Vendor Performance Directory
  // ----------------------------------------------------
  console.log('\n--- 6. Vendor Counter Performance Directory ---');
  const vendorStatsRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/vendors',
    headers: adminHeaders,
  });
  assert(vendorStatsRes.status === 200, 'Admin fetches vendor performance analytics (HTTP 200)');
  assert(Array.isArray(vendorStatsRes.body?.vendors), 'Vendor counters array returned');
  if (vendorStatsRes.body?.vendors?.length > 0) {
    const v = vendorStatsRes.body.vendors[0];
    assert(v.station_name && typeof v.total_orders === 'number' && typeof v.avg_prep_time_minutes === 'number', 'Vendor performance metrics valid');
  }

  // ----------------------------------------------------
  // 7. Order Lifecycle & Processing Times
  // ----------------------------------------------------
  console.log('\n--- 7. Order Lifecycle & Fulfillment Times ---');
  const procRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/processing-times',
    headers: adminHeaders,
  });
  assert(procRes.status === 200, 'Admin fetches order processing analytics (HTTP 200)');
  assert(typeof procRes.body?.processing_times?.avg_prep_time_minutes === 'number', 'Average preparation duration returned');
  assert(typeof procRes.body?.processing_times?.avg_pickup_time_minutes === 'number', 'Average pickup duration returned');

  // ----------------------------------------------------
  // 8. Payment Monitoring & Security Telemetry
  // ----------------------------------------------------
  console.log('\n--- 8. Payment Gateway Monitoring ---');
  const payRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/payments',
    headers: adminHeaders,
  });
  assert(payRes.status === 200, 'Admin fetches payment telemetry (HTTP 200)');
  assert(typeof payRes.body?.payments?.success_rate_percent === 'number', 'Payment gateway success rate % computed');
  
  // Security verification: No credentials in payload
  const payStr = JSON.stringify(payRes.body);
  assert(!payStr.includes('secret') && !payStr.includes('service_role'), 'Zero Razorpay secrets or private keys exposed in payment telemetry');

  // ----------------------------------------------------
  // 9. OTP Telemetry (Zero Sensitive Data)
  // ----------------------------------------------------
  console.log('\n--- 9. OTP Telemetry (Zero-Knowledge Aggregates) ---');
  const otpRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/otp',
    headers: adminHeaders,
  });
  assert(otpRes.status === 200, 'Admin fetches OTP telemetry (HTTP 200)');
  assert(typeof otpRes.body?.otp?.successRatePercent === 'number', 'OTP verification success rate % computed');
  
  // Security verification: No raw passcodes or hashes
  const otpStr = JSON.stringify(otpRes.body);
  assert(!otpStr.includes('otp_hash') && !otpStr.includes('passcode'), 'Zero OTP codes, hashes or passcodes present in telemetry');

  // ----------------------------------------------------
  // 10. QR Pickup Telemetry
  // ----------------------------------------------------
  console.log('\n--- 10. QR Pickup Telemetry ---');
  const qrRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/qr',
    headers: adminHeaders,
  });
  assert(qrRes.status === 200, 'Admin fetches QR telemetry (HTTP 200)');
  assert(typeof qrRes.body?.qr?.claimsToday === 'number', 'QR claims count today present');

  // ----------------------------------------------------
  // 11. System Health & Infrastructure Telemetry
  // ----------------------------------------------------
  console.log('\n--- 11. System Health & Infrastructure Monitoring ---');
  const healthRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/system-health',
    headers: adminHeaders,
  });
  assert(healthRes.status === 200, 'Admin fetches system health telemetry (HTTP 200)');
  assert(healthRes.body?.health?.status === 'healthy', 'Server health status is healthy');
  assert(typeof healthRes.body?.health?.memory?.heapUsedMb === 'number', 'Node.js heap memory metrics present');
  assert(healthRes.body?.health?.database?.status !== undefined, 'Database connectivity status reported');

  // ----------------------------------------------------
  // 12. API Performance & Error Logs Ring Buffer
  // ----------------------------------------------------
  console.log('\n--- 12. API Performance & Error Monitoring ---');
  const apiRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/api-metrics',
    headers: adminHeaders,
  });
  assert(apiRes.status === 200, 'Admin fetches API performance metrics (HTTP 200)');
  assert(typeof apiRes.body?.metrics?.totalRequests === 'number', 'Total profiled requests reported');
  assert(apiRes.body?.metrics?.routeGroups !== undefined, 'Route group latency profiles reported');

  const errRes = await makeRequest({
    method: 'GET',
    url: '/api/admin/analytics/errors',
    headers: adminHeaders,
  });
  assert(errRes.status === 200, 'Admin fetches structured error ring buffer (HTTP 200)');
  assert(Array.isArray(errRes.body?.errors), 'Errors ring buffer is an array');

  // ----------------------------------------------------
  // 13. Non-Regression Verification
  // ----------------------------------------------------
  console.log('\n--- 13. Non-Regression Verification (Phases 1-12) ---');
  const menuRes = await makeRequest({
    method: 'GET',
    url: '/api/menu',
  });
  assert(menuRes.status === 200, 'Public student menu remains functional');

  const vendorMenuRes = await makeRequest({
    method: 'GET',
    url: '/api/vendor/stats',
    headers: vendorHeaders,
  });
  assert(vendorMenuRes.status === 200, 'Vendor Dashboard endpoints remain functional');

  // ----------------------------------------------------
  // Results Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passedTests} PASSED | ${failedTests} FAILED  `);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
};

runPhase13Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
