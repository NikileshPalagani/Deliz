/**
 * Campus-Bite Phase 15 / Final Production 10,000 Concurrent User Load Validation Suite
 * 
 * Performs real network-level HTTP/HTTPS progressive load, realistic student user journeys,
 * controlled order creation, QR concurrency races, and infrastructure limits testing against:
 * https://campus-bite-66jt.onrender.com/
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

const PROD_BASE_URL = process.env.PROD_URL || 'https://campus-bite-66jt.onrender.com';
const TIMEOUT_MS = 10000;

// High-capacity Keep-Alive agent for network-level load testing
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 2000,
  maxFreeSockets: 500,
  timeout: TIMEOUT_MS,
});

/**
 * Dispatch an actual network HTTP/HTTPS request to the deployed production server
 */
export const dispatchProdRequest = (method, path, body = null, headers = {}) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const targetUrl = new URL(path.startsWith('http') ? path : `${PROD_BASE_URL}${path}`);

    const options = {
      method: method.toUpperCase(),
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: `${targetUrl.pathname}${targetUrl.search}`,
      agent: targetUrl.protocol === 'https:' ? httpsAgent : undefined,
      headers: {
        'Accept': 'application/json, text/html, */*',
        'User-Agent': 'CampusBite-ProdLoadTester/1.0',
        ...headers,
      },
      timeout: TIMEOUT_MS,
    };

    let payload = null;
    if (body) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const client = targetUrl.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        const latency = Date.now() - startTime;
        let parsed = null;
        try {
          parsed = JSON.parse(rawData);
        } catch (_) {
          parsed = rawData;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
          latency,
          error: null,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 408,
        headers: {},
        data: null,
        latency: Date.now() - startTime,
        error: 'REQUEST_TIMEOUT',
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 0,
        headers: {},
        data: null,
        latency: Date.now() - startTime,
        error: err.code || err.message,
      });
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

/**
 * Computes percentile metrics (p50, p90, p95, p99, avg) from latency array
 */
function computePercentiles(latencies) {
  if (!latencies.length) return { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    p50: getP(50),
    p90: getP(90),
    p95: getP(95),
    p99: getP(99),
    avg: Number((sum / sorted.length).toFixed(2)),
  };
}

/**
 * Execute a timed load tier with N concurrent virtual users
 */
async function runNetworkLoadTier(tierName, concurrentUsers, durationSeconds, requestGenerator) {
  console.log(`\n======================================================`);
  console.log(`  [TEST TIER] ${tierName} (${concurrentUsers} Concurrent VUs, ${durationSeconds}s)`);
  console.log(`======================================================`);

  const startTime = Date.now();
  const endTime = startTime + (durationSeconds * 1000);
  const latencies = [];
  const statusCounts = {};
  let totalRequests = 0;
  let successCount = 0;
  let errorCount = 0;
  let rateLimitCount = 0;
  let timeoutCount = 0;

  let activeWorkers = 0;
  let shouldStop = false;

  const runWorker = async (workerId) => {
    while (Date.now() < endTime && !shouldStop) {
      const reqConfig = requestGenerator(workerId, totalRequests);
      const res = await dispatchProdRequest(reqConfig.method, reqConfig.path, reqConfig.body, reqConfig.headers);
      
      totalRequests++;
      latencies.push(res.latency);
      statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;

      if (res.status >= 200 && res.status < 400) {
        successCount++;
      } else {
        errorCount++;
        if (res.status === 429) rateLimitCount++;
        if (res.status === 408 || res.error === 'REQUEST_TIMEOUT') timeoutCount++;
      }

      // If server is heavily failing (>50% errors after 100 requests), trigger safety stop to protect live server
      if (totalRequests > 100 && (errorCount / totalRequests) > 0.6) {
        console.warn(`⚠️ [SAFETY TRIGGER] Error rate exceeded 60% at ${concurrentUsers} VUs. Throttling tier.`);
        shouldStop = true;
        break;
      }
    }
  };

  const workerPromises = [];
  for (let i = 0; i < concurrentUsers; i++) {
    workerPromises.push(runWorker(i));
  }

  await Promise.all(workerPromises);

  const durationSec = (Date.now() - startTime) / 1000;
  const rps = Number((totalRequests / durationSec).toFixed(1));
  const metrics = computePercentiles(latencies);
  const errorRate = Number(((errorCount / (totalRequests || 1)) * 100).toFixed(2));

  let assessment = 'PASS';
  if (errorRate > 15 || metrics.p95 > 2500) assessment = 'FAIL';
  else if (errorRate > 3 || metrics.p95 > 1000) assessment = 'WARNING';

  console.log(`📊 Tier Summary:`);
  console.log(`   Requests: ${totalRequests} total | ${successCount} ok | ${errorCount} err (${errorRate}%)`);
  console.log(`   Throughput: ${rps} req/sec | Duration: ${durationSec.toFixed(2)}s`);
  console.log(`   Latency: p50=${metrics.p50}ms | p90=${metrics.p90}ms | p95=${metrics.p95}ms | p99=${metrics.p99}ms | avg=${metrics.avg}ms`);
  console.log(`   Statuses:`, JSON.stringify(statusCounts));
  console.log(`   Assessment: [${assessment}]`);

  return {
    tierName,
    concurrentUsers,
    totalRequests,
    successCount,
    errorCount,
    rateLimitCount,
    timeoutCount,
    errorRate,
    rps,
    metrics,
    statusCounts,
    assessment,
  };
}

/**
 * Main Production 10K Load Validation Runner
 */
export async function runProductionValidation() {
  console.log(`\n================================================================`);
  console.log(`  CAMPUS-BITE: REAL PRODUCTION NETWORK LOAD VALIDATION`);
  console.log(`  Target URL: ${PROD_BASE_URL}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`================================================================\n`);

  // Verify Initial Connectivity
  const initialHealth = await dispatchProdRequest('GET', '/api/health');
  console.log(`📡 Initial Health Check: HTTP ${initialHealth.status} (${initialHealth.latency}ms)`);
  console.log(`   Payload:`, JSON.stringify(initialHealth.data));

  if (initialHealth.status !== 200) {
    console.error(`❌ Production server is not reachable at ${PROD_BASE_URL}. Aborting.`);
    process.exit(1);
  }

  const allTierResults = [];

  // ----------------------------------------------------
  // Part 1: Progressive Load Tiers (Real Network HTTP Traffic)
  // ----------------------------------------------------
  const progressiveTiers = [
    { users: 10, duration: 3, label: '10 Users' },
    { users: 25, duration: 3, label: '25 Users' },
    { users: 50, duration: 4, label: '50 Users' },
    { users: 100, duration: 4, label: '100 Users' },
    { users: 250, duration: 5, label: '250 Users' },
    { users: 500, duration: 5, label: '500 Users' },
    { users: 1000, duration: 5, label: '1,000 Users' },
    { users: 2000, duration: 5, label: '2,000 Users' },
    { users: 5000, duration: 5, label: '5,000 Users' },
    { users: 8000, duration: 5, label: '8,000 Users' },
    { users: 10000, duration: 5, label: '10,000 Users' },
  ];

  // Request generator for realistic student browsing: mixes app root, health, orders query
  const studentBrowsingMix = (workerId, reqIdx) => {
    const r = reqIdx % 3;
    if (r === 0) return { method: 'GET', path: '/api/health' };
    if (r === 1) return { method: 'GET', path: '/' };
    return { method: 'GET', path: '/api/orders' };
  };

  for (const tier of progressiveTiers) {
    const res = await runNetworkLoadTier(tier.label, tier.users, tier.duration, studentBrowsingMix);
    allTierResults.push(res);

    // If server failed completely on a tier, don't overwhelm production
    if (res.assessment === 'FAIL' && res.errorRate > 80) {
      console.warn(`\n🛑 Halting higher tiers as infrastructure limit reached at ${tier.label}.`);
      break;
    }
  }

  // ----------------------------------------------------
  // Part 2: Controlled Concurrent Order Creation (Safe Test Data)
  // ----------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`  [CONCURRENCY TEST] Controlled Order Creation (25 Simultaneous)`);
  console.log(`======================================================`);
  
  const orderCreationPromises = [];
  for (let i = 0; i < 25; i++) {
    orderCreationPromises.push(
      dispatchProdRequest('POST', '/api/orders', {
        studentEmail: `prod_load_tester_${i}@cvr.ac.in`,
        studentName: `Prod Tester ${i}`,
        studentPhone: '9876543210',
        block: 'CB',
        items: [{ id: 'samosa', name: 'Samosa', price: 15, quantity: 1 }],
        totalAmount: 15,
        finalAmount: 15,
        paymentMethod: 'UPI',
      })
    );
  }

  const orderResponses = await Promise.all(orderCreationPromises);
  const createdOrderIds = new Set();
  let validOrderCount = 0;
  orderResponses.forEach(r => {
    if (r.status === 201 && r.data?.order?.id) {
      createdOrderIds.add(r.data.order.id);
      validOrderCount++;
    }
  });

  console.log(`   Created Orders: ${validOrderCount}/25 | Unique IDs: ${createdOrderIds.size}/25`);
  console.log(`   Order Concurrency Assessment: [${createdOrderIds.size === 25 ? 'PASS' : 'WARNING'}]`);

  // ----------------------------------------------------
  // Part 3: QR Atomic Single-Winner Claim Concurrency Race
  // ----------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`  [CONCURRENCY TEST] QR Single-Winner Claim Race (20 Vendors on 1 Token)`);
  console.log(`======================================================`);

  // Create 1 dedicated test order to race on
  const raceSeedRes = await dispatchProdRequest('POST', '/api/orders', {
    studentEmail: 'qr_race_prod@cvr.ac.in',
    studentName: 'QR Race Student',
    studentPhone: '9876543210',
    block: 'CB',
    items: [{ id: 'samosa', name: 'Samosa', price: 15, quantity: 1 }],
    totalAmount: 15,
    finalAmount: 15,
    paymentMethod: 'UPI',
  });

  if (raceSeedRes.status === 201 && raceSeedRes.data?.order) {
    const testOrder = raceSeedRes.data.order;
    const claimPromises = Array.from({ length: 20 }, (_, i) =>
      dispatchProdRequest('POST', '/api/orders/claim', {
        token: testOrder.token,
        orderId: testOrder.id,
      }, {
        'x-vendor-id': `vendor_prod_${i}`,
        'x-user-role': 'vendor',
      })
    );

    const claimResults = await Promise.all(claimPromises);
    const winners = claimResults.filter(r => r.status === 200 && r.data?.alreadyClaimed === false);
    const rejected = claimResults.filter(r => r.status === 200 && r.data?.alreadyClaimed === true);

    console.log(`   Winners (First claim): ${winners.length} | Rejected (Already claimed): ${rejected.length}`);
    console.log(`   QR Single-Winner Guarantee: [${winners.length === 1 && rejected.length === 19 ? 'PASS' : 'FAIL'}]`);
  } else {
    console.warn(`   Could not seed race order: HTTP ${raceSeedRes.status}`);
  }

  // ----------------------------------------------------
  // Part 4: Final Summary & Capacity Verdict
  // ----------------------------------------------------
  console.log(`\n================================================================`);
  console.log(`  PRODUCTION 10K LOAD VALIDATION SUMMARY TABLE`);
  console.log(`================================================================`);
  console.log(`| Tier | Users | Total Req | RPS | p50 | p95 | p99 | Error % | Status |`);
  console.log(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);
  allTierResults.forEach(r => {
    console.log(`| ${r.tierName} | ${r.concurrentUsers} | ${r.totalRequests} | ${r.rps} | ${r.metrics.p50}ms | ${r.metrics.p95}ms | ${r.metrics.p99}ms | ${r.errorRate}% | ${r.assessment} |`);
  });
  console.log(`================================================================\n`);

  return allTierResults;
}

if (process.argv[1]?.endsWith('production-10k.js')) {
  runProductionValidation().catch(err => {
    console.error('Fatal error in production load validation:', err);
    process.exit(1);
  });
}
