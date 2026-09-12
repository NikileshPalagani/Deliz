/**
 * Campus Bite — Phase 9 Automated Test Suite
 * Production Infrastructure, Scaling, Health/Readiness Probes, Graceful Shutdown,
 * Response Compression, Environment Validation, and Non-Regression.
 */

import { app, startServer, gracefulShutdown, validateProductionEnv } from '../server.js';
import fs from 'fs';
import path from 'path';
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
        'x-no-compression': '1',
        ...headers,
      },
      setTimeout: () => {},
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
      setHeader(k, v) {
        responseHeaders[k.toLowerCase()] = v;
        return this;
      },
      getHeader(k) {
        return responseHeaders[k.toLowerCase()] || null;
      },
      json(data) {
        resolve({ status: statusCode, data, headers: responseHeaders });
      },
      send(data) {
        resolve({ status: statusCode, data, headers: responseHeaders });
      },
      sendFile(filePath) {
        resolve({ status: statusCode, data: { file: filePath }, headers: responseHeaders });
      },
      end() {
        resolve({ status: statusCode, data: null, headers: responseHeaders });
      }
    };

    try {
      app.handle(req, res);
    } catch (e) {
      reject(e);
    }
  });
};

const runPhase9Tests = async () => {
  console.log('\n======================================================');
  console.log('🧪 Starting Campus Bite Phase 9 Test Suite...');
  console.log('======================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 1. Health (Liveness) & Readiness Probes
    // -------------------------------------------------------------------------
    console.log('--- 1. Health (Liveness) & Readiness Probes ---');
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200, 'Health endpoint returns HTTP 200');
    assert(health.data?.status === 'ok', 'Health response status is "ok"');
    assert(typeof health.data?.uptime === 'number', 'Health includes server uptime');
    assert(Boolean(health.data?.timestamp), 'Health includes ISO timestamp');
    assert(health.headers['cache-control']?.includes('no-cache'), 'Health endpoint sets Cache-Control: no-cache');
    assert(!JSON.stringify(health.data).includes('service_role'), 'Health exposes zero secret service role keys');
    assert(!JSON.stringify(health.data).includes('key_secret'), 'Health exposes zero Razorpay secrets');

    const ready = await makeRequest('GET', '/api/ready');
    assert(ready.status === 200, 'Readiness probe returns HTTP 200 in healthy state');
    assert(ready.data?.ready === true, 'Readiness probe reports ready: true');
    assert(Boolean(ready.data?.database), `Readiness confirms database status (${ready.data?.database})`);
    assert(ready.headers['cache-control']?.includes('no-cache'), 'Readiness sets Cache-Control: no-cache');

    // -------------------------------------------------------------------------
    // 2. Response Compression & Caching Configurations
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Compression, Caching & Timeouts ---');
    const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    assert(serverCode.includes("import compression from 'compression'"), 'server.js imports compression middleware');
    assert(serverCode.includes('app.use(compression('), 'server.js registers compression middleware');
    assert(serverCode.includes('threshold: 1024'), 'Compression threshold set to 1KB');
    assert(serverCode.includes('text/event-stream'), 'Compression exempts streaming/SSE responses');
    assert(serverCode.includes("app.use('/assets'"), 'Hashed static assets route configured');
    assert(serverCode.includes('maxAge: 31536000') || serverCode.includes("maxAge: '1y'"), 'Static assets configured for long-term immutable caching');
    assert(serverCode.includes('req.setTimeout(30000'), 'API request timeout guard configured (30s)');

    // -------------------------------------------------------------------------
    // 3. Graceful Shutdown & Lifecycle Management
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Server Lifecycle & Graceful Shutdown ---');
    assert(typeof startServer === 'function', 'server.js exports startServer function');
    assert(typeof gracefulShutdown === 'function', 'server.js exports gracefulShutdown function');
    assert(serverCode.includes("process.on('SIGTERM'"), 'Process registers SIGTERM handler');
    assert(serverCode.includes("process.on('SIGINT'"), 'Process registers SIGINT handler');
    assert(serverCode.includes('server.close('), 'Graceful shutdown stops accepting new connections');
    assert(serverCode.includes('isShuttingDown = true'), 'Graceful shutdown sets isShuttingDown flag');

    // -------------------------------------------------------------------------
    // 4. Startup Environment Validation
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Startup Environment Validation ---');
    assert(typeof validateProductionEnv === 'function', 'server.js exports validateProductionEnv function');
    const envValidation = validateProductionEnv();
    assert(typeof envValidation.isValid === 'boolean', 'validateProductionEnv returns validation status');
    assert(Array.isArray(envValidation.missing), 'validateProductionEnv returns missing variables array');
    assert(Array.isArray(envValidation.warnings), 'validateProductionEnv returns warnings array');

    // -------------------------------------------------------------------------
    // 5. Stateless Architecture & Persistence Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Stateless Architecture & Persistence Audit ---');
    assert(!serverCode.includes('fs.writeFileSync('), 'Production server does not write state to local disk');
    assert(!serverCode.includes('fs.writeFile('), 'Production server does not use asynchronous local file writes');
    const dataOrdersPath = path.join(__dirname, '../data/orders.json');
    if (fs.existsSync(dataOrdersPath)) {
      const legacyData = fs.readFileSync(dataOrdersPath, 'utf8').trim();
      assert(legacyData === '[]' || legacyData === '', 'data/orders.json is confirmed empty/legacy');
    }

    // -------------------------------------------------------------------------
    // 6. Render Configuration Audit (render.yaml)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Render Production Configuration (render.yaml) ---');
    const renderYamlPath = path.join(__dirname, '../render.yaml');
    assert(fs.existsSync(renderYamlPath), 'render.yaml exists in repository root');
    const renderYaml = fs.readFileSync(renderYamlPath, 'utf8');
    assert(renderYaml.includes('healthCheckPath: /api/health'), 'render.yaml specifies healthCheckPath: /api/health');
    assert(renderYaml.includes('region: singapore'), 'render.yaml specifies optimal singapore region');
    assert(renderYaml.includes('buildCommand: npm install && npm run build'), 'render.yaml configures build command');
    assert(renderYaml.includes('startCommand: node server.js'), 'render.yaml configures start command');
    assert(renderYaml.includes('autoDeploy: true'), 'render.yaml configures autoDeploy');

    // -------------------------------------------------------------------------
    // 7. Production Documentation Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Production Documentation Audit ---');
    const prodReadinessPath = path.join(__dirname, '../PRODUCTION_READINESS.md');
    assert(fs.existsSync(prodReadinessPath), 'PRODUCTION_READINESS.md exists');
    const prodReadinessContent = fs.readFileSync(prodReadinessPath, 'utf8');
    assert(prodReadinessContent.includes('10,000 concurrent-user support is NOT yet guaranteed'), 'PRODUCTION_READINESS.md contains mandatory 10k validation disclaimer');
    assert(prodReadinessContent.includes('Traffic Model'), 'PRODUCTION_READINESS.md documents college traffic model');
    assert(prodReadinessContent.includes('Graceful Shutdown'), 'PRODUCTION_READINESS.md documents shutdown strategy');
    assert(prodReadinessContent.includes('Supavisor'), 'PRODUCTION_READINESS.md documents Supavisor connection pooling');

    const loadTestPlanPath = path.join(__dirname, '../LOAD_TEST_PLAN.md');
    assert(fs.existsSync(loadTestPlanPath), 'LOAD_TEST_PLAN.md exists');
    const loadTestPlanContent = fs.readFileSync(loadTestPlanPath, 'utf8');
    assert(loadTestPlanContent.includes('Tier 1') && loadTestPlanContent.includes('100 users'), 'LOAD_TEST_PLAN.md contains 100 users scenario');
    assert(loadTestPlanContent.includes('Tier 8') && loadTestPlanContent.includes('10,000 users'), 'LOAD_TEST_PLAN.md contains 10,000 users scenario');
    assert(loadTestPlanContent.includes('p95 Latency'), 'LOAD_TEST_PLAN.md defines p95 latency thresholds');

    // -------------------------------------------------------------------------
    // 8. Non-Regression: Phases 1–8 Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Non-Regression: Phases 1–8 Verification ---');
    // Phase 1: Order creation
    const orderPayload = {
      studentEmail: 'phase9_reg_student@cvr.ac.in',
      studentName: 'Phase 9 Student',
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
    assert(orderRes.status === 201, 'Phase 1: Order creation returns HTTP 201');
    const orderId = orderRes.data?.order?.id;
    const orderToken = orderRes.data?.order?.token;
    assert(Boolean(orderId), `Phase 1: Order ID #${orderId} generated`);
    assert(orderToken?.startsWith('CB-TOKEN-'), 'Phase 6: Cryptographic token generated');

    // Phase 2: Vendor auth
    const vendorLogin = await makeRequest('POST', '/api/auth/login', {
      identifier: 'vendor1',
      password: 'vendor1'
    });
    assert(vendorLogin.status === 200, 'Phase 2: Vendor login succeeded');

    // Phase 4: OTP generation
    const otpRes = await makeRequest('POST', '/api/send-otp', {
      email: 'phase9_otp_user@cvr.ac.in',
      purpose: 'registration'
    });
    assert(otpRes.status === 200, 'Phase 4: OTP generation returns HTTP 200');

    // Phase 5: Razorpay Create-Order
    const rzpRes = await makeRequest('POST', '/api/create-order', {
      items: [{ id: 'samosa', name: 'Hot Samosa', price: 15, quantity: 2 }],
      studentEmail: 'phase9_reg_student@cvr.ac.in',
      block: 'CB'
    });
    assert(rzpRes.status === 200, 'Phase 5: Razorpay create-order returns HTTP 200');
    assert(rzpRes.data?.amount === 2400, 'Phase 5: Canonical server price verified (2400 paise)');

    // Phase 6: Read-only QR validation and claim
    const qrVal = await makeRequest('POST', '/api/orders/validate-qr', { token: orderToken });
    assert(qrVal.status === 200, 'Phase 6: QR validation returns HTTP 200');
    assert(qrVal.data?.status === 'READY_FOR_PICKUP', 'Phase 6: QR status is READY_FOR_PICKUP');

    const qrClaim = await makeRequest('POST', '/api/orders/claim', {
      token: orderToken,
      vendorId: 'vendor1'
    });
    assert(qrClaim.status === 200, 'Phase 6: Vendor claim succeeds with HTTP 200');
    assert(qrClaim.data?.newlyClaimed === true, 'Phase 6: Order marked newlyClaimed');

    // Phase 7: Menu API & Pagination
    const menuRes = await makeRequest('GET', '/api/menu');
    assert(menuRes.status === 200, 'Phase 7: Menu API returns HTTP 200');
    assert(menuRes.headers['cache-control']?.includes('max-age=300'), 'Phase 7: Menu API includes Cache-Control header');

    const paginatedOrders = await makeRequest('GET', '/api/orders?page=1&limit=5', null, {
      'x-admin-role': 'admin',
      'x-admin-email': 'admin@cvr.ac.in'
    });
    assert(paginatedOrders.status === 200, 'Phase 7: Paginated orders returns HTTP 200');
    assert(typeof paginatedOrders.data?.totalPages === 'number', 'Phase 7: Pagination totalPages confirmed');

    // Phase 8: Role-based access control
    const forbiddenAdmin = await makeRequest('GET', '/api/admin/stats', null, {
      'x-user-role': 'student',
      'x-user-email': 'student@cvr.ac.in'
    });
    assert(forbiddenAdmin.status === 403, 'Phase 8: Student blocked from /api/admin/stats with HTTP 403');

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`📊 Phase 9 Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log('======================================================\n');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled error in Phase 9 tests:', err);
    process.exit(1);
  }
};

runPhase9Tests();
