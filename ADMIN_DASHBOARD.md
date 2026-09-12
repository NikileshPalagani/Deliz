# Campus-Bite Admin Dashboard Documentation (Phase 11)

## 1. Executive Summary & Overview
The **Campus-Bite Admin Dashboard** is a centralized, production-grade management portal built for college canteen administrators at CVR College of Engineering. It provides end-to-end operational visibility, real-time order telemetry, student and vendor management, dynamic menu catalog administration, payment reconciliation, coupon campaigns, broadcast announcements, and analytical business reports.

---

## 2. Architecture & Tech Stack

- **Frontend**: React 18 + Vite, Tailwind CSS, Lucide React icons, Canvas Confetti.
- **Backend**: Node.js + Express, sliding-window rate limiters, compression, graceful shutdown.
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS), Supabase Auth (JWT/Bearer), Supabase Realtime (WebSocket channels).
- **Security & RBAC**: Strict server-side `requireAdmin` and `adminLimiter` middleware. Zero client-side trust. No service-role keys exposed to the client.

---

## 3. Database Schema & Migrations (`009_admin_dashboard.sql`)

### 3.1 Tables Added / Enhanced
1. `menu_items`:
   - `id VARCHAR(64) PRIMARY KEY`
   - `name VARCHAR(120) NOT NULL`
   - `price NUMERIC(10,2) NOT NULL CHECK (price >= 0)`
   - `unit VARCHAR(20) DEFAULT 'pcs'`
   - `category VARCHAR(50) DEFAULT 'Snacks'`
   - `is_veg BOOLEAN DEFAULT true`
   - `image_url TEXT`
   - `description TEXT`
   - `is_available BOOLEAN DEFAULT true`
   - `stock_count INTEGER DEFAULT 100`
   - `created_at TIMESTAMPTZ DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ DEFAULT NOW()`

2. `announcements`:
   - `id VARCHAR(64) PRIMARY KEY`
   - `title VARCHAR(200) NOT NULL`
   - `message TEXT NOT NULL`
   - `priority VARCHAR(20) DEFAULT 'normal'` ('low', 'normal', 'high', 'urgent')
   - `target_role VARCHAR(20) DEFAULT 'all'` ('all', 'student', 'vendor')
   - `is_active BOOLEAN DEFAULT true`
   - `expires_at TIMESTAMPTZ`
   - `created_at TIMESTAMPTZ DEFAULT NOW()`

3. `coupons`:
   - `id VARCHAR(64) PRIMARY KEY`
   - `code VARCHAR(32) UNIQUE NOT NULL`
   - `discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100)`
   - `max_discount_amount NUMERIC(10,2) DEFAULT 50.00`
   - `min_order_amount NUMERIC(10,2) DEFAULT 30.00`
   - `usage_limit INTEGER DEFAULT 1000`
   - `usage_count INTEGER DEFAULT 0`
   - `is_active BOOLEAN DEFAULT true`
   - `expires_at TIMESTAMPTZ`
   - `created_at TIMESTAMPTZ DEFAULT NOW()`

### 3.2 High-Performance Stored Procedures
- `get_admin_dashboard_stats()`: Computes total orders, total revenue, today's velocity, block distributions, active counts, and vendor claim audits in a single round-trip without client-side aggregation.

---

## 4. API Endpoints Reference

All administrative endpoints are protected by `adminLimiter` (sliding-window rate limiter) and `requireAdmin` role verification.

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/admin/stats` | Real-time high-level KPIs, block distributions, live metrics | Admin |
| `GET` | `/api/admin/orders` | Paginated orders stream with filters (status, block, search, dates) | Admin |
| `GET` | `/api/admin/students` | Paginated student registry with balances and block filters | Admin |
| `GET` | `/api/admin/vendors` | List of canteen vendors with station names and active states | Admin |
| `POST` | `/api/admin/vendors/toggle-status` | Enable/disable vendor station operations | Admin |
| `GET` | `/api/admin/menu` | Complete menu catalog with stock & availability | Admin |
| `POST` | `/api/admin/menu` | Create a new food item | Admin |
| `PUT` | `/api/admin/menu/:id` | Update food item price, name, image, or category | Admin |
| `PATCH` | `/api/admin/menu/:id/toggle` | Instant 1-click toggle for item availability (Out of Stock) | Admin |
| `DELETE` | `/api/admin/menu/:id` | Delete item from menu catalog | Admin |
| `GET` | `/api/admin/payments` | Paginated payment ledger with search and transaction IDs | Admin |
| `GET` | `/api/admin/coupons` | List all promotional coupon codes | Admin |
| `POST` | `/api/admin/coupons` | Create a new promotional discount coupon | Admin |
| `PATCH` | `/api/admin/coupons/:id` | Activate/deactivate discount coupon | Admin |
| `DELETE` | `/api/admin/coupons/:id` | Delete coupon code | Admin |
| `GET` | `/api/admin/announcements` | Full list of announcements | Admin |
| `POST` | `/api/admin/announcements` | Broadcast a new notice/announcement | Admin |
| `PATCH` | `/api/admin/announcements/:id` | Update announcement status/message | Admin |
| `DELETE` | `/api/admin/announcements/:id` | Delete announcement | Admin |
| `GET` | `/api/admin/reports` | Daily sales trends, hourly velocity, AOV (1d/7d/30d) | Admin |
| `GET` | `/api/announcements/active` | Public active notices for student menu banner | Public |

---

## 5. Admin Dashboard Frontend Features (`AdminDashboard.jsx`)

1. **Live KPI Telemetry Tab**:
   - Total Orders & Revenue with today's delta.
   - Total Students & Active Vendors.
   - Pickup Block Distribution bar charts (CB, CM, FB, PG).
   - Realtime order feed indicator and connection status.
2. **Orders Feed Tab**:
   - Realtime updates as students place orders and vendors scan QR tokens.
   - Multi-criteria filtering by order status (`CLAIMED`, `PENDING_PICKUP`, `CANCELLED`) and block.
   - Search by Order ID, Token, or Student Email.
   - Detailed Order Receipt Modal.
3. **Student Directory Tab**:
   - Student roll numbers, emails, phone numbers, and delivery blocks.
   - Realtime Campus Bite Coin balances.
4. **Menu Catalog Management Tab**:
   - Visual cards showing vegetarian indicators, prices, stock counts, and images.
   - Modal for adding new items and editing existing prices/details.
   - Fast 1-click toggle to mark items Out of Stock during peak rush.
5. **Vendor Management Tab**:
   - Station cards for all 12 food counters.
   - Create Vendor modal with username, password, station name, and phone.
   - Toggle station active status.
   - Real-time QR claim audit counts per vendor.
6. **Payment Ledger Tab**:
   - Razorpay transaction IDs, payment methods, timestamps, and amounts.
   - Filter by status (`SUCCESS`, `PENDING`, `FAILED`).
7. **Coupons & Promotions Tab**:
   - Create percentage discount codes with max caps and min order requirements.
   - Enable/disable campaigns in real time.
8. **Notice Board / Announcements Tab**:
   - Post canteen notices that instantly appear on the student mobile menu banner.
   - Filter by target roles and expiration dates.
9. **Sales Reports & Trends Tab**:
   - Dynamic time ranges (Today / 7 Days / 30 Days).
   - Daily sales revenue and order volume velocity charts.
   - Average Order Value (AOV) and peak ordering hour breakdowns.

---

## 6. Verification & Automated Testing
- Automated test suite in `scripts/test-phase11.js`.
- All 30 unit, RBAC, CRUD, and pagination test assertions passed (0 failures).
- Complete non-regression verified across Phases 1 through 10.
