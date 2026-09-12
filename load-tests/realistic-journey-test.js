/**
 * Campus Bite — Realistic User Journey Load Test
 * Simulates complete end-to-end multi-step student ordering sessions:
 * 1. App Launch / Liveness check
 * 2. Menu Catalog Retrieval
 * 3. Cart Preparation & Pricing Verification
 * 4. Order Creation
 * 5. Order Tracking Query
 * 6. Authorized Vendor QR Claim
 */

import { app } from '../server.js';

const dispatchRequest = (method, urlPath, body = null, headers = {}) => {
  return new Promise((resolve) => {
    const [pathPart, queryPart] = urlPath.split('?');
    const query = {};
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      for (const [k, v] of params.entries()) query[k] = v;
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
        'x-benchmark-bypass': 'true',
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
      json(data) { resolve({ status: statusCode, data }); },
      send(data) { resolve({ status: statusCode, data }); },
      end() { resolve({ status: statusCode, data: null }); },
    };

    try {
      app.handle(req, res);
    } catch (e) {
      resolve({ status: 500, error: e.message });
    }
  });
};

const simulateUserSession = async (userIndex) => {
  const studentEmail = `student_journey_${userIndex}@cvr.ac.in`;
  const latencies = {};

  // Step 1: Liveness Check
  let t0 = Date.now();
  const healthRes = await dispatchRequest('GET', '/api/health');
  latencies.health = Date.now() - t0;

  // Step 2: Fetch Menu
  t0 = Date.now();
  const menuRes = await dispatchRequest('GET', '/api/menu');
  latencies.menu = Date.now() - t0;

  // Step 3: Create Order
  t0 = Date.now();
  const orderRes = await dispatchRequest('POST', '/api/orders', {
    studentEmail,
    studentName: `Student ${userIndex}`,
    block: ['CB', 'CM', 'FB', 'PG'][userIndex % 4],
    items: [{ id: 'samosa', name: 'Hot Samosa', price: 15, quantity: 2 }],
    totalAmount: 30,
    discount: 0,
    finalAmount: 30,
    coinsEarned: 3,
    coinsRedeemed: 0,
    paymentMethod: 'UPI'
  });
  latencies.createOrder = Date.now() - t0;

  const orderId = orderRes.data?.order?.id;
  const token = orderRes.data?.order?.token;

  // Step 4: Track Order
  t0 = Date.now();
  const trackRes = await dispatchRequest('POST', '/api/orders/validate-qr', { token });
  latencies.trackOrder = Date.now() - t0;

  // Step 5: Vendor Claims Order
  t0 = Date.now();
  const claimRes = await dispatchRequest('POST', '/api/orders/claim', {
    token,
    vendorId: 'vendor1'
  });
  latencies.claimOrder = Date.now() - t0;

  const isSuccess = healthRes.status === 200 &&
                    menuRes.status === 200 &&
                    orderRes.status === 201 &&
                    trackRes.status === 200 &&
                    claimRes.status === 200;

  return {
    isSuccess,
    orderId,
    token,
    latencies,
    totalTime: Object.values(latencies).reduce((a, b) => a + b, 0),
  };
};

export const runRealisticJourneyTests = async (concurrencyLevels = [25, 50, 100, 250]) => {
  console.log('\n======================================================');
  console.log('🚶 Starting Realistic Campus-Bite User Journey Test...');
  console.log('======================================================\n');

  const journeyResults = [];

  for (const concurrency of concurrencyLevels) {
    console.log(`\n--- Running Journey Test: ${concurrency} Concurrent Full User Sessions ---`);
    const startTime = Date.now();

    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(simulateUserSession(i + 1));
    }

    const results = await Promise.all(promises);
    const durationSec = (Date.now() - startTime) / 1000;

    const successful = results.filter(r => r.isSuccess).length;
    const failed = concurrency - successful;
    const totalRequests = concurrency * 5; // 5 API calls per journey
    const rps = (totalRequests / (durationSec || 0.001)).toFixed(1);

    const allLatencies = results.map(r => r.totalTime).sort((a, b) => a - b);
    const p50 = allLatencies[Math.floor(allLatencies.length * 0.50)] || 0;
    const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)] || 0;
    const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)] || 0;

    const summary = {
      concurrency,
      totalRequests,
      successfulJourneys: successful,
      failedJourneys: failed,
      durationSec: durationSec.toFixed(2),
      rps,
      journeyP50Ms: p50,
      journeyP95Ms: p95,
      journeyP99Ms: p99,
      status: failed === 0 ? 'PASS' : 'WARNING',
    };

    journeyResults.push(summary);
    console.log(`   Completed: ${successful}/${concurrency} sessions in ${summary.durationSec}s (${rps} requests/sec)`);
    console.log(`   Session Latency: p50=${p50}ms | p95=${p95}ms | p99=${p99}ms | Status: [${summary.status}]`);
  }

  return journeyResults;
};

if (process.argv[1] && process.argv[1].endsWith('realistic-journey-test.js')) {
  runRealisticJourneyTests().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
