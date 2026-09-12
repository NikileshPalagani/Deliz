# Campus-Bite — Phase 10: Load & Scalability Testing Plan

This document outlines the reproduction steps and methodology for executing baseline, progressive, and stress load tests against the Campus-Bite backend.

---

## 1. Prerequisites
- **Node.js**: v18+ (tested on v20.x)
- **Dependencies**: Installed via `npm install`
- **Environment**: `.env` configured with Supabase and backend port settings.

---

## 2. Progressive Load Test Tiers & Acceptance Criteria

| Tier | Concurrency Level | Target Scenarios | Target p95 Latency | Target Error Rate |
|---|---|---|---|---|
| **Tier 1** | **100 users** | Read bursts (/health, /api/menu) | < 25ms | < 0.1% |
| **Tier 2** | **250 users** | Session checks & menu catalog | < 30ms | < 0.1% |
| **Tier 3** | **500 users** | User browse & item selection | < 35ms | < 0.1% |
| **Tier 4** | **1,000 users** | Cart checks & order tracking | < 40ms | < 0.1% |
| **Tier 5** | **2,000 users** | Concurrent status queries | < 50ms | < 0.1% |
| **Tier 6** | **5,000 users** | High-traffic lunch simulation | < 60ms | < 0.5% |
| **Tier 7** | **8,000 users** | Campus-wide active sessions | < 75ms | < 0.5% |
| **Tier 8** | **10,000 users** | Peak stretch capacity test | < 100ms | < 1.0% |

---

## 3. Test Execution Commands

### Execute Full Suite
Runs all 7 load testing suites sequentially:
```bash
npm run test:load
```

### Execute Individual Test Modules
```bash
# 1. Baseline Test (10, 25, 50, 100 users)
node load-tests/baseline-test.js

# 2. Progressive Scalability Ramp (Tier 1: 100 users to Tier 8: 10,000 users)
node load-tests/progressive-load-test.js

# 3. Realistic User Journey Simulation (Health -> Menu -> Order -> Claim)
node load-tests/realistic-journey-test.js

# 4. Order Creation Stress & Token Integrity Test
node load-tests/order-creation-stress-test.js

# 5. Concurrent QR Claiming Race Condition Test
node load-tests/qr-concurrency-race-test.js

# 6. Auth & OTP Challenge Flood Test
node load-tests/auth-otp-load-test.js

# 7. Sustained Endurance & Breaking Point Ramp
node load-tests/endurance-breaking-point-test.js
```

---

## 4. Test Methodology & Safety
1. **In-Memory Express Simulation**: Tests utilize in-process virtual request dispatch (`app.handle`) with synthetic student IPs (`10.0.x.x`), avoiding OS socket exhaustion and sandbox permission errors while accurately benchmarking middleware, routing, and JSON processing.
2. **Payment Safety**: Tests mock payment signatures or use test order structures—**zero real money or live Razorpay transactions** are generated.
3. **Database Integrity**: Test orders are tagged with unique test IDs and cleaned up or isolated to prevent pollution of production analytics.
4. **Secret Protection**: All sensitive tokens and keys are loaded via environment variables and never logged in test outputs.
