/**
 * Campus Bite — Phase 7 Automated Test Suite
 * Tests Database, API, and Frontend Performance Optimizations for High Traffic
 */

import { app } from '../server.js';
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

async function runPhase7Tests() {
  console.log('======================================================');
  console.log('🧪 Starting Campus Bite Phase 7 Performance Test Suite...');
  console.log('======================================================\n');

  // 1. Health & Server Connectivity Check
  console.log('--- 1. Health & Server Connectivity Check ---');
  try {
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200, 'Health endpoint returns HTTP 200');
    assert(health.data?.status === 'ok', 'Health response status is "ok"');
    console.log(`   Database Engine: ${health.data?.database || 'In-Memory Fallback'}`);
  } catch (err) {
    assert(false, `Health check failed: ${err.message}`);
  }

  // 2. HTTP Caching & Menu API Performance
  console.log('\n--- 2. Menu API & HTTP Caching ---');
  try {
    const menuRes = await makeRequest('GET', '/api/menu');
    assert(menuRes.status === 200, 'Menu endpoint returns HTTP 200');
    assert(menuRes.data?.success === true, 'Menu response success is true');
    assert(Array.isArray(menuRes.data?.menu), 'Menu response contains menu array');
    assert(menuRes.data.menu.length >= 4, 'Menu contains all canonical items');

    const cacheHeader = menuRes.headers['cache-control'] || '';
    assert(cacheHeader.includes('public') && cacheHeader.includes('max-age'), 'Menu endpoint includes HTTP Cache-Control header');
    console.log(`   Cache-Control: ${cacheHeader}`);
  } catch (e) {
    assert(false, `Menu caching test failed: ${e.message}`);
  }

  // 3. Orders Pagination & Keyset/Offset Metadata
  console.log('\n--- 3. Orders Pagination & Metadata ---');
  try {
    // Create a sample order first to ensure data exists
    await makeRequest('POST', '/api/orders', {
      studentEmail: 'perf_student@cvr.ac.in',
      studentName: 'Performance Tester',
      studentPhone: '9876543210',
      block: 'CB',
      items: [{ id: 'samosa', name: 'Samosa', price: 15, quantity: 2, isVeg: true }],
      totalAmount: 30,
      discount: 0,
      finalAmount: 30,
      paymentMethod: 'UPI'
    });

    const paginatedRes = await makeRequest('GET', '/api/orders?limit=10&page=1');
    assert(paginatedRes.status === 200, 'Paginated orders endpoint returns HTTP 200');
    assert(paginatedRes.data?.success === true, 'Orders response success is true');
    assert(typeof paginatedRes.data?.count === 'number', 'Response contains total count number');
    assert(typeof paginatedRes.data?.totalPages === 'number', 'Response contains totalPages metadata');
    assert(paginatedRes.data?.page === 1, 'Response confirms page number');
    assert(paginatedRes.data?.limit === 10, 'Response confirms page limit');
    assert(Array.isArray(paginatedRes.data?.orders), 'Response contains orders array');
    assert(paginatedRes.data.orders.length <= 10, 'Returned orders count respects limit');
  } catch (e) {
    assert(false, `Orders pagination test failed: ${e.message}`);
  }

  // 4. Database-Side Admin Aggregation & Statistics
  console.log('\n--- 4. Database-Side Admin Aggregation & Statistics ---');
  try {
    const statsRes = await makeRequest('GET', '/api/admin/stats');
    assert(statsRes.status === 200, 'Admin stats endpoint returns HTTP 200');
    assert(statsRes.data?.success === true, 'Admin stats response success is true');

    const stats = statsRes.data?.stats;
    assert(typeof stats?.totalOrders === 'number', 'Stats contains totalOrders count');
    assert(typeof stats?.totalRevenue === 'number', 'Stats contains totalRevenue aggregation');
    assert(typeof stats?.claimedOrders === 'number', 'Stats contains claimedOrders count');
    assert(typeof stats?.pendingOrders === 'number', 'Stats contains pendingOrders count');
    assert(typeof stats?.blockDistribution === 'object', 'Stats contains blockDistribution object');
    assert(typeof stats?.itemPopularity === 'object', 'Stats contains itemPopularity object');
    assert(Array.isArray(stats?.recentOrders), 'Stats contains recentOrders array (projected columns)');
    assert(Array.isArray(stats?.payments), 'Stats contains recent payments array');
  } catch (e) {
    assert(false, `Admin stats test failed: ${e.message}`);
  }

  // 5. Role-Scoped Query Filtering
  console.log('\n--- 5. Role-Scoped Order Filtering ---');
  try {
    const studentOrdersRes = await makeRequest('GET', '/api/orders?email=perf_student@cvr.ac.in&limit=20');
    assert(studentOrdersRes.status === 200, 'Student filtered orders returns HTTP 200');
    assert(studentOrdersRes.data.orders.every(o => o.studentEmail.toLowerCase() === 'perf_student@cvr.ac.in'), 'Student order query strictly filters by student email');

    const blockOrdersRes = await makeRequest('GET', '/api/orders?block=CB&status=PENDING_PICKUP&limit=50');
    assert(blockOrdersRes.status === 200, 'Vendor block filtered orders returns HTTP 200');
    assert(blockOrdersRes.data.orders.every(o => o.block === 'CB'), 'Vendor query strictly filters by block');
  } catch (e) {
    assert(false, `Role-scoped filtering test failed: ${e.message}`);
  }

  // 6. Security Audit & Static Code Analysis
  console.log('\n--- 6. Security & Optimization Static Code Analysis ---');
  try {
    const migration007 = path.join(ROOT_DIR, 'supabase', 'migrations', '007_performance_optimization.sql');
    assert(fs.existsSync(migration007), 'Migration 007_performance_optimization.sql exists');

    const migrationContent = fs.readFileSync(migration007, 'utf8');
    assert(migrationContent.includes('idx_orders_student_created'), 'Migration defines student orders composite index');
    assert(migrationContent.includes('idx_orders_block_status_created'), 'Migration defines vendor block/status composite index');
    assert(migrationContent.includes('get_admin_dashboard_stats'), 'Migration defines get_admin_dashboard_stats database procedure');

    const supabaseAdminContent = fs.readFileSync(path.join(ROOT_DIR, 'server', 'supabaseAdmin.js'), 'utf8');
    assert(supabaseAdminContent.includes('get_admin_dashboard_stats'), 'supabaseAdmin calls get_admin_dashboard_stats database RPC');
    assert(supabaseAdminContent.includes('totalPages'), 'supabaseAdmin dbGetOrders returns pagination metadata');

    const serverContent = fs.readFileSync(path.join(ROOT_DIR, 'server.js'), 'utf8');
    assert(serverContent.includes('/api/menu'), 'server.js provides /api/menu route with Cache-Control');
    assert(serverContent.includes("limit: '1mb'"), 'server.js enforces strict JSON body limits');

    const viteConfigContent = fs.readFileSync(path.join(ROOT_DIR, 'vite.config.js'), 'utf8');
    assert(viteConfigContent.includes('manualChunks'), 'vite.config.js configures vendor chunk splitting');

    const menuCatalogContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'buyer', 'MenuCatalog.jsx'), 'utf8');
    assert(menuCatalogContent.includes('loading="lazy"'), 'MenuCatalog.jsx uses lazy loading for menu images');

    const appContextContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'context', 'AppContext.jsx'), 'utf8');
    assert(appContextContent.includes('useMemo'), 'AppContext.jsx uses useMemo for cart & coin derivations');
  } catch (e) {
    assert(false, `Static code audit failed: ${e.message}`);
  }

  // 7. Latency Benchmarks
  console.log('\n--- 7. Latency & Response Time Benchmarks ---');
  try {
    const menuBenchmark = await makeRequest('GET', '/api/menu');
    assert(menuBenchmark.duration < 50, `Menu API response time is fast (${menuBenchmark.duration.toFixed(2)}ms < 50ms)`);

    const ordersBenchmark = await makeRequest('GET', '/api/orders?limit=20');
    assert(ordersBenchmark.duration < 100, `Orders API response time is fast (${ordersBenchmark.duration.toFixed(2)}ms < 100ms)`);

    const statsBenchmark = await makeRequest('GET', '/api/admin/stats');
    assert(statsBenchmark.duration < 150, `Admin Stats response time is fast (${statsBenchmark.duration.toFixed(2)}ms < 150ms)`);
  } catch (e) {
    assert(false, `Latency benchmark test failed: ${e.message}`);
  }

  // 8. Non-Regression: Phases 1–6 Verification
  console.log('\n--- 8. Non-Regression: Phases 1–6 Verification ---');
  try {
    // Phase 1 & 6: Order creation & Pickup Token
    const orderRes = await makeRequest('POST', '/api/orders', {
      studentEmail: 'p7_reg_student@cvr.ac.in',
      studentName: 'Phase 7 Student',
      studentPhone: '9876543210',
      block: 'CM',
      items: [{ id: 'egg_puff', name: 'Egg Puff', price: 30, quantity: 1, isVeg: false }],
      totalAmount: 30,
      discount: 0,
      finalAmount: 30,
      paymentMethod: 'UPI'
    });
    assert(orderRes.status === 201, 'Phase 1: Order created with HTTP 201');
    assert(orderRes.data?.order?.token?.startsWith('CB-TOKEN-'), 'Phase 6: Order token has cryptographic CB-TOKEN prefix');

    // Phase 2: Centralized vendor login
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      identifier: 'vendor2',
      password: 'vendor2'
    });
    assert(loginRes.status === 200, 'Phase 2: Vendor login succeeded with HTTP 200');

    // Phase 4: OTP generation
    const otpRes = await makeRequest('POST', '/api/send-otp', {
      email: 'p7_phase7_test@cvr.ac.in',
      purpose: 'registration'
    });
    assert(otpRes.status === 200, 'Phase 4: OTP generation returns HTTP 200');

    // Phase 5: Razorpay price calculation
    const rzpRes = await makeRequest('POST', '/api/create-order', {
      amount: 1, // client attempt to tamper
      items: [{ id: 'samosa', quantity: 2 }]
    });
    assert(rzpRes.status === 200, 'Phase 5: Razorpay order endpoint returns HTTP 200');
    assert(rzpRes.data?.amount === 2400 || rzpRes.data?.order?.amount === 2400, 'Phase 5: Enforced canonical price (₹24 / 2400 paise)');

    // Phase 6: Read-only QR validation
    const qrValRes = await makeRequest('POST', '/api/orders/validate-qr', {
      token: orderRes.data.order.token
    });
    assert(qrValRes.status === 200, 'Phase 6: Read-only QR validation returns HTTP 200');
    assert(qrValRes.data.status === 'READY_FOR_PICKUP', 'Phase 6: Validation status is READY_FOR_PICKUP');

    // Phase 6: Atomic Claim
    const claimRes = await makeRequest('POST', '/api/orders/claim', {
      token: orderRes.data.order.token,
      vendorId: 'vendor1'
    }, {
      'x-vendor-id': 'vendor1'
    });
    assert(claimRes.status === 200, 'Phase 6: Authorized vendor claim returns HTTP 200');
    assert(claimRes.data.newlyClaimed === true, 'Phase 6: Order confirmed as newlyClaimed: true');
  } catch (e) {
    assert(false, `Non-regression test failed: ${e.message}`);
  }

  console.log('\n======================================================');
  console.log(`📊 Phase 7 Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runPhase7Tests();
