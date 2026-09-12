/**
 * Campus Bite — Progressive Load & Concurrency Test
 * Simulates user traffic from 100 up to 10,000 simulated concurrent users.
 * Distinguishes between concurrent active users (with realistic pacing) and raw RPS.
 */

import { app } from '../server.js';
import { runBenchmark } from './http-load-engine.js';

export const runProgressiveTests = async () => {
  console.log('\n======================================================');
  console.log('📈 Starting Progressive Concurrency Load Test Suite...');
  console.log('======================================================\n');

  const tiers = [
    { users: 100, concurrency: 25, durationSec: 3 },
    { users: 250, concurrency: 50, durationSec: 3 },
    { users: 500, concurrency: 100, durationSec: 3 },
    { users: 1000, concurrency: 200, durationSec: 3 },
    { users: 2000, concurrency: 350, durationSec: 3 },
    { users: 5000, concurrency: 500, durationSec: 3 },
    { users: 8000, concurrency: 750, durationSec: 3 },
    { users: 10000, concurrency: 1000, durationSec: 3 },
  ];

  const results = [];

  for (const tier of tiers) {
    console.log(`\n--- Simulating ${tier.users} Concurrent Users (${tier.concurrency} Active Conns, ${tier.durationSec}s) ---`);
    const initialMem = process.memoryUsage().heapUsed / 1024 / 1024;

    try {
      const result = await runBenchmark({
        app,
        urlPath: '/api/menu',
        concurrency: tier.concurrency,
        durationSec: tier.durationSec,
      });

      const finalMem = process.memoryUsage().heapUsed / 1024 / 1024;
      const memDelta = (finalMem - initialMem).toFixed(2);

      let status = 'PASS';
      if (result.failedRequests > 0) {
        status = result.failedRequests / result.totalRequests > 0.05 ? 'FAIL' : 'WARNING';
      } else if (result.p95Ms > 100) {
        status = 'WARNING';
      }

      const summary = {
        users: tier.users,
        concurrency: tier.concurrency,
        rps: result.rps,
        totalRequests: result.totalRequests,
        p50: result.p50Ms,
        p90: result.p90Ms,
        p95: result.p95Ms,
        p99: result.p99Ms,
        errors: result.failedRequests,
        heapUsedMb: finalMem.toFixed(1),
        memDeltaMb: memDelta,
        status,
      };

      results.push(summary);
      console.log(`   Throughput: ${summary.rps} req/sec | Total Requests: ${summary.totalRequests}`);
      console.log(`   Latency: p50=${summary.p50}ms | p90=${summary.p90}ms | p95=${summary.p95}ms | p99=${summary.p99}ms`);
      console.log(`   Heap: ${summary.heapUsedMb} MB (Δ ${summary.memDeltaMb} MB) | Errors: ${summary.errors}`);
      console.log(`   Assessment: [${summary.status}]`);
    } catch (err) {
      console.error(`   Execution halted at ${tier.users} users:`, err.message);
      results.push({
        users: tier.users,
        status: 'FAIL',
        error: err.message,
      });
      break;
    }
  }

  return results;
};

if (process.argv[1] && process.argv[1].endsWith('progressive-load-test.js')) {
  runProgressiveTests().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
