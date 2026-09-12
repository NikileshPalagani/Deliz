/**
 * Campus Bite — Master Load Testing Orchestrator
 * Executes all Phase 10 performance and scalability test suites:
 * 1. Baseline Tests (10 - 100 Users)
 * 2. Progressive Load Tests (100 - 10,000 Users)
 * 3. Realistic End-to-End User Journeys
 * 4. Concurrent Order Creation Stress Test
 * 5. QR Concurrency Race Test
 * 6. Authentication & OTP Subsystem Load Test
 * 7. Endurance & Breaking Point Test
 */

import { runBaselineTests } from './baseline-test.js';
import { runProgressiveTests } from './progressive-load-test.js';
import { runRealisticJourneyTests } from './realistic-journey-test.js';
import { runOrderCreationStressTests } from './order-creation-stress-test.js';
import { runQrConcurrencyRaceTests } from './qr-concurrency-race-test.js';
import { runAuthOtpLoadTests } from './auth-otp-load-test.js';
import { runEnduranceAndBreakingPointTests } from './endurance-breaking-point-test.js';

const executeMasterSuite = async () => {
  console.log('================================================================');
  console.log('🚀 CAMPUS-BITE PHASE 10 LOAD, STRESS & SCALABILITY TEST SUITE');
  console.log('================================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Platform: ${process.platform} (${process.arch})\n`);

  const summaryReport = {};

  try {
    // 1. Baseline
    console.log('>>> [1/7] Executing Baseline Tests...');
    summaryReport.baseline = await runBaselineTests();

    // 2. Progressive Load
    console.log('\n>>> [2/7] Executing Progressive Concurrency Tests...');
    summaryReport.progressive = await runProgressiveTests();

    // 3. Realistic User Journeys
    console.log('\n>>> [3/7] Executing Realistic User Journey Tests...');
    summaryReport.journeys = await runRealisticJourneyTests([25, 50, 100, 250]);

    // 4. Order Creation Stress
    console.log('\n>>> [4/7] Executing Concurrent Order Creation Stress Tests...');
    summaryReport.orders = await runOrderCreationStressTests();

    // 5. QR Concurrency Race
    console.log('\n>>> [5/7] Executing QR Concurrency Race Tests...');
    summaryReport.qrRace = await runQrConcurrencyRaceTests();

    // 6. Auth & OTP Load
    console.log('\n>>> [6/7] Executing Authentication & OTP Load Tests...');
    summaryReport.authOtp = await runAuthOtpLoadTests();

    // 7. Endurance & Breaking Point
    console.log('\n>>> [7/7] Executing Endurance & Breaking Point Tests...');
    summaryReport.endurance = await runEnduranceAndBreakingPointTests();

    console.log('\n================================================================');
    console.log('✅ ALL PHASE 10 LOAD TESTING SUITES COMPLETED SUCCESSFULLY');
    console.log('================================================================\n');

    return summaryReport;
  } catch (err) {
    console.error('\n❌ Unhandled error during load test orchestration:', err);
    process.exit(1);
  }
};

executeMasterSuite();
