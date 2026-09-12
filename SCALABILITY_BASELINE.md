# DELIZ — Production Scalability Baseline & Architecture Audit

## 1. System Target
- **Target Registered Users**: Up to 10,000 students
- **Peak Concurrent Active Users**: 1,000 – 1,500 simultaneous users (college lunch & break surges)
- **High Concurrency Stability**: Zero duplicate orders, zero duplicate payments, single-winner QR claims, sub-100ms average response times.

## 2. Current Architecture Overview
- **Frontend**: React 18 SPA bundled via Vite with Tailwind CSS, Lucide icons, Canvas Confetti.
- **Backend**: Node.js (v18+) with Express 4, Gzip compression (`compression`), custom sliding-window RateLimiting, Brevo HTTPS/SMTP transactional emailer, Razorpay payment gateway integration.
- **Database**: Supabase PostgreSQL with connection pooling (Supavisor / port 6543 / 5432), Row Level Security (RLS), and Realtime WebSocket engine.
- **State & Storage**: Authoritative PostgreSQL database with client-side zero-flicker local caching (`src/utils/storage.js`), direct Supabase SDK fallbacks, and JWT-authenticated API requests (`src/utils/api.js`).

## 3. Existing Modules & Key Assets
| Module | File Location | Key Mechanisms |
|---|---|---|
| Server Core | `server.js` | Express API, rate limiters, auth identity extractor (`getCallerIdentity`), payment verification, metrics, health checks |
| Supabase Admin | `server/supabaseAdmin.js` | Service-role PostgreSQL operations, atomic RPC calls (`claim_order_atomic`, `validate_order_qr`, etc.) |
| Client SDK | `src/utils/supabaseClient.js` | Supabase auth listeners, direct order/payment fetching, realtime channel subscriptions |
| Application Context | `src/context/AppContext.jsx` | React context, order state management, cart calculation, coin redemption |
| Security & DB | `supabase/migrations/` | 12 migration files covering auth, orders, payments, RLS, idempotency, QR concurrency, analytics |

## 4. Initial Audit Baseline Metrics
- **Build Status**: Passing (`npm run build` ~1.9s)
- **Phase Test Suites**: Passing (Phases 1-14 verified)
- **Load Test Infrastructure**: Available in `load-tests/` (`http-load-engine.js`, `order-creation-stress-test.js`, `qr-concurrency-race-test.js`, `production-10k.js`)
