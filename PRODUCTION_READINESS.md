# Campus-Bite — Production Readiness & Architecture Blueprint

## 1. Current Architecture
- **Frontend**: Single Page Application built with React 18, Vite 6, and Tailwind CSS.
- **Backend API**: Stateless Node.js / Express server exposing RESTful endpoints and serving static production assets.
- **Database & Identity**: Supabase PostgreSQL with Row-Level Security (RLS) and Supabase Auth JWT identity.
- **Realtime Updates**: Supabase Realtime WebSocket channels for live order status synchronization.
- **Payments**: Razorpay payment gateway integration with server-side signature verification and idempotency keys.
- **Transactional Notifications**: Brevo HTTPS REST API (with SMTP/Mock fallback) for OTP delivery and password resets.

---

## 2. Production Target Architecture
```
                         [ 8,000+ Students / 10,000 Peak Users ]
                                            │
                                            ▼
                           [ CDN & Edge Caching (Cloudflare / Render CDN) ]
                                            │
                                            ▼
                           [ Application Load Balancer / Reverse Proxy ]
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
      [ Node Instance #1 ]         [ Node Instance #2 ]         [ Node Instance #3 ]
      (Express API / Assets)       (Express API / Assets)       (Express API / Assets)
               │                            │                            │
               └────────────────────────────┼────────────────────────────┘
                                            │ (PgBouncer / Supavisor Connection Pool)
                                            ▼
                             [ Supabase PostgreSQL 15+ ]
                             ├── Orders, Payments, Profiles
                             ├── Row Level Security (RLS)
                             └── Composite Query Indexes
                                            ▲
                                            │
                              [ Supabase Realtime Engine ]
                              (Scoped Postgres Change Broadcasts)
```

---

## 3. Current Hosting Configuration
- **Platform**: Render Web Service (`render.yaml`).
- **Runtime**: Node.js 20+ LTS.
- **Region**: Singapore (`singapore` - optimized for sub-60ms latency to Indian campus networks).
- **Current Plan**: Free Tier (for prototyping and functional validation).
- **Health Check Path**: `/api/health`.

---

## 4. Recommended Production Hosting Configuration
- **Compute (Web Service)**: Render **Starter Plan** (0.5 CPU, 512MB RAM) or **Standard Plan** (1 CPU, 2GB RAM) with **Auto-scaling** enabled (min: 2 instances, max: 6 instances based on CPU > 70% threshold).
- **Database**: Supabase **Pro Tier** with dedicated compute and Supavisor connection pooling (supports 200+ concurrent pooled database connections).
- **Network**: Cloudflare CDN Edge layer in front of Render for DDoS mitigation, TLS termination, and static asset caching.

---

## 5. Node.js Horizontal Scaling Strategy
- **Stateless Application Servers**: No persistent session state or order data stored in Node memory. Any Node instance can handle any incoming request.
- **Token Authentication**: Client sends signed Supabase Auth JWT in `Authorization: Bearer <token>` header; validated authoritatively against Supabase Auth.
- **In-Memory Fallback Stores**: Used strictly during local testing/development; in production, all state resides in PostgreSQL.

---

## 6. Database Requirements & Connection Pooling
- **Connection Management**: Multi-instance Node backends must connect via **Supavisor Transaction Mode** (port `6543`) to prevent exhausting PostgreSQL `max_connections`.
- **Prepared Statements**: Optimized for pooled connections without prepared statement conflicts.
- **Composite Indexes**:
  - `idx_orders_student_created`: `(student_email, created_at DESC)`
  - `idx_orders_block_status_created`: `(block, order_status, created_at DESC)`
  - `idx_orders_pickup_token`: `(pickup_token)`
  - `idx_payments_razorpay_order`: `(razorpay_order_id)`

---

## 7. Realtime Scalability & Subscription Guardrails
- **Filtered Subscriptions**:
  - Students subscribe strictly to `filter: "student_email=eq.${userEmail}"`.
  - Vendors subscribe strictly to `filter: "block=eq.${vendorBlock}"`.
- **Lifecycle Cleanup**: All components (`OrderTrackerModal`, `VendorDashboard`, `AdminDashboard`) explicitly call `channel.unsubscribe()` and `removeChannel()` on unmount.
- **No Global Broadcasts**: Prevents broadcasting all campus orders to every student mobile device.

---

## 8. Realistic Campus Traffic Model
| Parameter | Baseline (Normal Class Hours) | Peak Rush (Lunch & Break Hours) | Stress Peak Target |
| :--- | :--- | :--- | :--- |
| **Active Users** | 500 – 1,000 students | 4,000 – 6,000 students | **10,000 concurrent users** |
| **Orders / Minute** | 5 – 15 orders/min | 100 – 250 orders/min | **400 orders/min** |
| **API Requests / Sec (RPS)** | 10 – 25 req/sec | 150 – 350 req/sec | **600 – 1,000 req/sec** |
| **Realtime Connections** | 100 – 300 active WebSockets | 1,500 – 3,500 WebSockets | **5,000 – 8,000 WebSockets** |
| **Payment Invocations** | 1 – 3 / min | 30 – 80 / min | **150 / min** |

---

## 9. Peak Traffic Assumptions & User Behavior
1. **Browsing vs Ordering**: 80% of active users browse menus and view active orders; 20% execute cart checkouts and payments simultaneously.
2. **Menu Caching**: The menu API (`/api/menu`) returns `Cache-Control: public, max-age=300, stale-while-revalidate=600`, reducing database queries by ~90% during rush periods.
3. **Pickup Token Scans**: Vendors scan 1 QR token every 3–5 seconds per counter. With 4 campus blocks, peak QR claim throughput is ~1–2 claims/sec.

---

## 10. Health & Readiness Check Strategy
- **Liveness (`GET /api/health`)**:
  - Returns `200 OK` with server metadata, uptime, and configured service flags.
  - Zero database queries — instantaneous response for load balancers.
- **Readiness Probe (`GET /api/ready`)**:
  - Checks if server is shutting down.
  - Executes a fast (2.5s timeout) probe against database connection.
  - Returns `503 Service Unavailable` if database is unresponsive or server is draining connections.

---

## 11. Zero-Downtime Deployment Strategy
- **Rolling Restarts**: Render spins up new instance container, polls `/api/health` until healthy, then shifts traffic before terminating old container.
- **Graceful Shutdown**: On `SIGTERM` / `SIGINT`, server stops accepting new connections and gives in-flight orders/payments 10 seconds to complete cleanly.
- **Hashed Assets**: Vite emits content-hashed asset files (`assets/index-BgVvZ24F.js`) cached immutably for 1 year, ensuring existing sessions never load mismatched chunks.

---

## 12. Backup & Disaster Recovery Plan
- **Supabase Point-in-Time Recovery (PITR)**: Continuous WAL archiving enabling recovery to any second within 7–30 days.
- **Daily Logical Backups**: Automated `pg_dump` snapshots stored in secure S3/GCS cold storage.
- **RTO (Recovery Time Objective)**: < 15 minutes.
- **RPO (Recovery Point Objective)**: < 1 minute.

---

## 13. Observability & Production Monitoring Metrics
- **HTTP Metrics**: Requests per second (RPS), p50/p95/p99 latency, HTTP status codes (2xx, 4xx, 5xx rate).
- **Resource Utilization**: Node.js CPU usage, heap memory allocations, event loop lag.
- **Database Telemetry**: Active pool connections, query latency, slow queries (>100ms), lock wait times.
- **Business Alerts**: Payment signature verification failures, Brevo email delivery errors, QR claim collision rate.

---

## 14. Load Testing Strategy Summary
- See [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md) for full tiered load testing architecture spanning 100 to 10,000 concurrent user simulations.

---

## 15. Known Bottlenecks & Scaling Mitigations
| Potential Bottleneck | Impact | Phase 9 Mitigation |
| :--- | :--- | :--- |
| **In-Memory Rate Limiting** | Limits tracked per instance in multi-node setup | MemoryRateLimiter auto-evicts clean timestamps; Redis recommended for cluster-wide rate limiting in Phase 10 |
| **Database Connection Exhaustion** | 10,000 users overwhelming PostgreSQL connections | Supavisor connection pooling + composite indexes + HTTP Cache-Control on read endpoints |
| **Third-Party Email Rate Limits** | SMTP port 587 throttling on free hosting | Switched to Brevo HTTPS REST API over port 443 with timeout guards |

---

## 16. Estimated Production Infrastructure Sizing
- **Compute**: 2–4 Node.js instances (Render Starter/Standard, 1 vCPU, 1–2GB RAM each).
- **Database**: Supabase Pro Compute (2 Core vCPU, 4GB RAM, 200+ PgBouncer connections).
- **Egress Bandwidth**: ~25–50 GB / month (optimized via Gzip compression and CDN caching).

---

## 17. Operational Risks & Failover Contingencies
- **Payment Gateway Downtime**: Razorpay offline simulation and webhook retry mechanisms prevent order loss.
- **Database Degradation**: Client-side backoff and retry guards prevent retry storms.
- **Network Glitches**: Realtime channel auto-reconnects with exponential backoff and jitter.

---

## 18. Manual Configuration Checklist for Production
1. Provision Supabase Pro instance and execute SQL migrations `001` through `008`.
2. Configure environment variables in Render Dashboard (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `BREVO_API_KEY`).
3. Set Custom Domain & configure Cloudflare DNS proxy (CNAME).
4. Register Razorpay Webhook URL pointing to `https://<domain>/api/payments/webhook`.

---

## 19. Important Scale & Concurrency Disclaimer
> [!IMPORTANT]
> **10,000 concurrent-user support is NOT yet guaranteed. It requires successful load testing.**
> While the codebase and database architecture are designed and prepared for horizontal scalability, true multi-thousand concurrent capacity depends on provisioned infrastructure, network bandwidth, database tier, and validation via controlled load testing.

