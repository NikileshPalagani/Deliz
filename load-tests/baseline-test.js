/**
 * Campus Bite — Baseline Load Test (10, 25, 50, 100 Users)
 * Evaluates baseline latency, throughput, and percentiles under gentle-to-moderate load.
 */

import { app } from '../server.js';
import { runBenchmark } from './http-load-engine.js';

export const runBaselineTests = async () => {
  console.log('\n======================================================');
  console.log('📊 Starting Baseline Load Test Suite (10 – 100 Users)...');
  console.log('======================================================\n');

  const tiers = [10, 25, 50, 100];
  const results = [];

  for (const concurrency of tiers) {
    console.log(`\n--- Running Baseline Test: ${concurrency} Concurrent Users (3s) ---`);
    const result = await runBenchmark({
      app,
      urlPath: '/api/menu',
      concurrency,
      durationSec: 3,
    });

    const isPass = result.failedRequests === 0 && result.p95Ms < 50;
    const summary = {
      concurrency,
      rps: result.rps,
      totalRequests: result.totalRequests,
      p50: result.p50Ms,
      p90: result.p90Ms,
      p95: result.p95Ms,
      p99: result.p99Ms,
      errors: result.failedRequests,
      timeouts: result.timeouts,
      status: isPass ? 'PASS' : 'WARNING',
    };

    results.push(summary);
    console.log(`   RPS: ${summary.rps} req/sec | Total Requests: ${summary.totalRequests}`);
    console.log(`   Latency: p50=${summary.p50}ms | p90=${summary.p90}ms | p95=${summary.p95}ms | p99=${summary.p99}ms`);
    console.log(`   Errors: ${summary.errors} | Timeouts: ${summary.timeouts} | Status: [${summary.status}]`);
  }

  return results;
};

if (process.argv[1] && process.argv[1].endsWith('baseline-test.js')) {
  runBaselineTests().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
