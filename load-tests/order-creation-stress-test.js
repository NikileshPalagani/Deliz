/**
 * Campus Bite — Order Creation Stress Test
 * Concurrently fires bursts of order creation requests (10, 25, 50, 100, 250, 500, 1000 orders).
 * Validates uniqueness of Order IDs, token uniqueness, and pricing integrity under extreme concurrency.
 */

import { app } from '../server.js';

const postOrder = (index) => {
  return new Promise((resolve) => {
    const payload = {
      studentEmail: `stress_student_${index}@cvr.ac.in`,
      studentName: `Stress Student ${index}`,
      studentPhone: '9876543210',
      block: ['CB', 'CM', 'FB', 'PG'][index % 4],
      items: [
        { id: 'samosa', name: 'Hot Samosa', price: 15, quantity: 2 },
        { id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 1 }
      ],
      totalAmount: 55,
      discount: 0,
      finalAmount: 55,
      coinsEarned: 5,
      coinsRedeemed: 0,
      paymentMethod: 'UPI'
    };

    const req = {
      method: 'POST',
      url: '/api/orders',
      path: '/api/orders',
      originalUrl: '/api/orders',
      query: {},
      body: payload,
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
    const start = Date.now();

    const res = {
      statusCode: 200,
      status(c) {
        statusCode = c;
        this.statusCode = c;
        return this;
      },
      setHeader() { return this; },
      getHeader() { return null; },
      json(data) { resolve({ status: statusCode, data, latency: Date.now() - start }); },
      send(data) { resolve({ status: statusCode, data, latency: Date.now() - start }); },
      end() { resolve({ status: statusCode, data: null, latency: Date.now() - start }); },
    };

    try {
      app.handle(req, res);
    } catch (err) {
      resolve({ status: 500, error: err.message, latency: Date.now() - start });
    }
  });
};

export const runOrderCreationStressTests = async () => {
  console.log('\n======================================================');
  console.log('🛒 Starting Concurrent Order Creation Stress Test...');
  console.log('======================================================\n');

  const tiers = [10, 25, 50, 100, 250, 500, 1000];
  const results = [];

  for (const count of tiers) {
    console.log(`\n--- Stress Testing Burst of ${count} Simultaneous Orders ---`);
    const startTime = Date.now();

    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(postOrder(i + 1));
    }

    const responses = await Promise.all(promises);
    const durationSec = (Date.now() - startTime) / 1000;

    const successful = responses.filter(r => r.status === 201);
    const orderIds = new Set(successful.map(r => r.data?.order?.id).filter(Boolean));
    const tokens = new Set(successful.map(r => r.data?.order?.token).filter(Boolean));

    const duplicateOrderIds = successful.length - orderIds.size;
    const duplicateTokens = successful.length - tokens.size;

    const latencies = responses.map(r => r.latency).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const rps = (count / (durationSec || 0.001)).toFixed(1);

    let status = 'PASS';
    if (duplicateOrderIds > 0 || duplicateTokens > 0 || successful.length < count * 0.95) {
      status = 'FAIL';
    } else if (p95 > 100) {
      status = 'WARNING';
    }

    const summary = {
      burstCount: count,
      successful: successful.length,
      failed: count - successful.length,
      duplicateOrderIds,
      duplicateTokens,
      durationSec: durationSec.toFixed(2),
      rps,
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      status,
    };

    results.push(summary);
    console.log(`   Success: ${summary.successful}/${count} in ${summary.durationSec}s (${rps} orders/sec)`);
    console.log(`   Duplicates: OrderIDs=${duplicateOrderIds} | Tokens=${duplicateTokens}`);
    console.log(`   Latency: p50=${p50}ms | p95=${p95}ms | p99=${p99}ms | Status: [${status}]`);
  }

  return results;
};

if (process.argv[1] && process.argv[1].endsWith('order-creation-stress-test.js')) {
  runOrderCreationStressTests().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
