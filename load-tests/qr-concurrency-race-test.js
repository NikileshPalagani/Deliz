/**
 * Campus Bite — QR Concurrency Race Test
 * Simulates multiple vendors simultaneously scanning and attempting to claim the EXACT same order token.
 * Validates atomic isolation: exactly 1 claim succeeds, all others receive ALREADY_CLAIMED.
 */

import { app } from '../server.js';

const createTestOrder = () => {
  return new Promise((resolve, reject) => {
    const payload = {
      studentEmail: 'qr_race_student@cvr.ac.in',
      studentName: 'QR Race Student',
      block: 'CB',
      items: [{ id: 'samosa', name: 'Hot Samosa', price: 15, quantity: 1 }],
      totalAmount: 15,
      discount: 0,
      finalAmount: 15,
      coinsEarned: 1,
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
    const res = {
      statusCode: 200,
      status(c) { statusCode = c; this.statusCode = c; return this; },
      setHeader() { return this; },
      getHeader() { return null; },
      json(data) { resolve(data.order); },
      send(data) { resolve(data.order); },
      end() { resolve(null); }
    };

    app.handle(req, res);
  });
};

const attemptClaim = (token, vendorId) => {
  return new Promise((resolve) => {
    const payload = {
      token,
      vendorId: `vendor${vendorId}`,
    };

    const start = Date.now();
    const req = {
      method: 'POST',
      url: '/api/orders/claim',
      path: '/api/orders/claim',
      originalUrl: '/api/orders/claim',
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

export const runQrConcurrencyRaceTests = async () => {
  console.log('\n======================================================');
  console.log('⚡ Starting QR Concurrency Race Test Suite...');
  console.log('======================================================\n');

  const raceTiers = [2, 5, 10, 50];
  const results = [];

  for (const vendorCount of raceTiers) {
    console.log(`\n--- Race Condition Test: ${vendorCount} Simultaneous Claims on ONE Order ---`);
    const order = await createTestOrder();
    const token = order.token;

    // Fire claims concurrently at the exact same instant
    const promises = [];
    for (let v = 1; v <= vendorCount; v++) {
      promises.push(attemptClaim(token, v));
    }

    const responses = await Promise.all(promises);

    const successClaims = responses.filter(r => r.status === 200 && r.data?.newlyClaimed === true);
    const alreadyClaimedResponses = responses.filter(r => r.status === 400 && r.data?.alreadyClaimed === true);

    const exactOneWinner = successClaims.length === 1;
    const allOthersRejected = alreadyClaimedResponses.length === (vendorCount - 1);

    const isPass = exactOneWinner && allOthersRejected;

    const summary = {
      vendorCount,
      orderId: order.id,
      successCount: successClaims.length,
      rejectedCount: alreadyClaimedResponses.length,
      winnerVendor: successClaims[0]?.data?.order?.claimedBy || 'None',
      status: isPass ? 'PASS' : 'FAIL',
    };

    results.push(summary);
    console.log(`   Order #${order.id} | Token: ${token.substring(0, 22)}...`);
    console.log(`   Success (Winner): ${summary.successCount} (Claimed by ${summary.winnerVendor})`);
    console.log(`   Rejected (Already Claimed): ${summary.rejectedCount}/${vendorCount - 1}`);
    console.log(`   Atomic Integrity Assessment: [${summary.status}]`);
  }

  return results;
};

if (process.argv[1] && process.argv[1].endsWith('qr-concurrency-race-test.js')) {
  runQrConcurrencyRaceTests().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
