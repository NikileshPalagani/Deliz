# 🍔 Campus Bite — Good Food • Great Mood

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)

> **Campus Bite** is a high-performance, mobile-first Web Application engineered for college campuses (e.g., CVR College of Engineering) to eliminate canteen congestion through pre-ordering, direct 1-tap UPI payments, transaction-based reward coins, and single-use digital QR counter pickups.

---

## 📱 Live Application Links
* **📱 Public Mobile Link**: [https://vbhno-115-243-13-109.run.pinggy-free.link](https://vbhno-115-243-13-109.run.pinggy-free.link)
* **💻 Local Web App**: [http://localhost:5173/](http://localhost:5173/)
* **⚙️ Backend API**: `http://localhost:5001/api`

---

## 🌟 Key Features

### 🍔 1. Student / Buyer Mobile Portal
* **Fresh Snack Catalog**:
  * **Samosa** — ₹12 (Hot savory triangular pastry)
  * **Veg Puff** — ₹25 (Flaky multi-layered baked puff)
  * **Egg Puff** — ₹30 (South-Indian style egg masala puff)
* **Campus Location Hierarchy**:
  * **5 Academic Blocks**: `CB` (Computer Block), `CM` (Civil/Mech), `MB` (Main Block), `FB` (Freshman Block), `PG` (PG & Research Block).
  * **2 Floor Levels**: `2nd Floor` and `4th Floor`.
* **🪙 Reward Coin Economy**:
  * **Initial Balance**: Starts with strictly **0 Coins** on sign-up / first login.
  * **Earning Formula**: **1 Coin for every ₹5 spent** on paid transactions ($\lfloor \text{Amount} / 5 \rfloor$).
  * **Redemption Rate**: **10 Coins = ₹1 Discount** ($\lfloor \text{Coins} / 10 \rfloor$) via interactive slider in Cart.
* **💳 Swiggy/Zomato Style Checkout**:
  * Direct 1-tap mobile app launchers for **PhonePe**, **Google Pay**, **Navi**, and **Paytm / Any UPI App**.
  * Integrated **Razorpay Checkout** for Debit/Credit Cards and Netbanking.
* **🎟️ Single-Use Pickup Token QR**:
  * Digital barcode pass generated automatically upon payment confirmation with celebratory confetti.
  * Labeled **"Open Pickup Model"** for easy student access.

---

### 🔒 2. Smart Unified Authentication & OTP Security
* **Zero-Role Selector UI**: Single, clean login form without distracting role buttons or dropdowns. Automatically routes based on identifier format.
* **Strict College Email Enforcement**: Student sign-ups and logins strictly require authorized emails ending in **`@cvr.ac.in`** (e.g. `22b81a0501@cvr.ac.in`). Non-college emails are rejected.
* **6-Digit Verification OTP**: Server-generated 6-digit numeric OTP with 10-minute expiry, dispatch throttling, and built-in auto-fill assistance.

---

### 📷 3. Vendor Counter Scanner Terminal
* **12 Dedicated Stations**: Independent accounts (`vendor1` to `vendor12`).
* **Multi-Modal QR Scanner**:
  * Real-time camera viewfinder with automatic environment/rear camera selection.
  * Photo / Image upload scanner fallback (works across all smartphones and mobile webviews).
  * Manual Order ID / Token input.
* **Single-Use Pass Invalidation**: Instantly verifies items to dispense and permanently marks the QR code as `CLAIMED` with vendor timestamp to prevent reuse.

---

### 📊 4. Super Admin Operations Console
* **Real-time Telemetry**: Live gross sales revenue, total snack orders, active vs claimed passes.
* **Campus Wing Breakdown**: Orders distribution progress bars across all 5 blocks (`CB`, `CM`, `MB`, `FB`, `PG`).
* **Floor Level Split**: `2nd Floor` vs `4th Floor` pickup analytics.
* **Vendor Station Audit**: Scan and fulfillment leaderboard across all 12 stations (`vendor1` through `vendor12`).
* **Searchable Ledger**: Filter orders and payments by student name, roll number, or transaction ID.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 6, Tailwind CSS 3, Lucide Icons, `qrcode.react`, `html5-qrcode`, `canvas-confetti` |
| **Backend** | Node.js, Express 4, Nodemailer (SMTP), CORS, Dotenv |
| **Styling** | Mobile-First Responsive Design, Warm Orange & Amber Theme (`#f97316`), Slate Dark Surface (`#0B0F19`) |
| **State** | React Context API with persistent LocalStorage synchronizer |

---

## 📁 Project Structure

```
campus-bite/
├── package.json               # Dependencies and execution scripts
├── vite.config.js             # Vite configuration with API proxying
├── tailwind.config.js         # Custom theme colors and shadow utilities
├── postcss.config.js          # Tailwind CSS PostCSS processor
├── index.html                 # Mobile-first viewport and fonts
├── server.js                  # Complete Express Backend REST API
├── CAMPUS_BITE_COMPLETE_PROJECT.md # Standalone single-file codebase bundle
├── public/
│   └── images/                # App logos and optimized food images
└── src/
    ├── main.jsx               # React DOM root entrypoint
    ├── App.jsx                # Layout router and mobile bottom navigation
    ├── types.js               # Menu catalog, campus blocks, floors, UPI config
    ├── index.css              # Base styling and custom dark scrollbars
    ├── context/
    │   └── AppContext.jsx     # Global state (Cart, Coins, Auth, Orders)
    ├── utils/
    │   ├── storage.js         # LocalStorage persistence & 0-coin initial state
    │   ├── otpService.js      # Strict @cvr.ac.in OTP client service
    │   └── upi.js             # NPCI standard UPI URL generator & deep links
    └── components/
        ├── auth/
        │   ├── UnifiedLogin.jsx    # Clean single-box authentication
        │   └── BuyerSignUp.jsx     # CVR student registration with 6-digit OTP
        ├── common/
        │   ├── Navbar.jsx          # Mobile header with cart & coins
        │   ├── MobileBottomNav.jsx # 3-Tab native mobile bottom navigation
        │   ├── SidebarDrawer.jsx   # Slide-out navigation menu
        │   └── OtpModal.jsx        # 6-Digit verification dialog
        ├── buyer/
        │   ├── MenuCatalog.jsx     # Food cards grid with quantity counters
        │   ├── CartModal.jsx       # Slide drawer, location & coin slider
        │   ├── DirectUpiPayment.jsx# Swiggy/Zomato style 1-tap UPI payment
        │   ├── OrderQrModal.jsx    # Single-use pickup pass QR code modal
        │   ├── OrderHistory.jsx    # Orders tracker & filterable history
        │   ├── PaymentHistory.jsx  # Transaction receipts ledger
        │   ├── QrHistory.jsx       # QR history with "Open Pickup Model"
        │   └── UserProfile.jsx     # Account details & OTP-guarded update
        ├── vendor/
        │   ├── VendorDashboard.jsx # Vendor station 1–12 pickup stream
        │   ├── QrScannerModal.jsx  # Camera scanner & photo image upload
        │   └── ScannedOrderResult.jsx # Verification & single-use invalidation
        └── admin/
            └── AdminDashboard.jsx  # Super Admin analytics and reports
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* [Node.js](https://nodejs.org/) ($\ge \text{v18.0.0}$)
* [npm](https://www.npmjs.com/) ($\ge \text{v9.0.0}$)

### 2. Installation
```bash
# 1. Clone or navigate to the project directory
cd campus-bite

# 2. Install all frontend and backend dependencies
npm install
```

### 3. Run Development Servers
```bash
# Run both Frontend (Vite) and Backend (Express) concurrently:
npm run dev
```
* **Frontend**: `http://localhost:5173`
* **Backend API**: `http://localhost:5001`

### 4. Build for Production
```bash
npm run build
```

---

## 🔑 Default Demo Accounts

| Role | Email / Identifier | Password | Destination Screen |
| :--- | :--- | :--- | :--- |
| **Student / Buyer** | `22b81a0501@cvr.ac.in` *(or any @cvr.ac.in)* | Any password | Student Menu, Cart & QR Passes |
| **Vendor Station 1** | `vendor1` | `vendor1` | Counter 1 QR Camera Scanner |
| **Vendor Station 2** | `vendor2` | `vendor2` | Counter 2 QR Camera Scanner |
| **Vendor Station 3–12**| `vendor3` to `vendor12` | Same as username | Counter 3–12 QR Camera Scanner |
| **Campus Admin** | `admin` *(or admin@cvr.ac.in)* | `admin` or `admin123` | Super Admin Operations Console |

---

## 📡 REST API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/send-otp` | Validates `@cvr.ac.in` domain and generates a secure 6-digit OTP |
| `POST` | `/api/verify-otp` | Verifies the 6-digit numeric security code |
| `GET` | `/api/orders` | Retrieves order feed (supports `?email=`, `?status=`, `?block=`) |
| `POST` | `/api/orders` | Creates a paid order and generates single-use pickup token |
| `POST` | `/api/orders/claim` | Verifies and permanently invalidates scanned QR passes |
| `GET` | `/api/admin/stats` | Returns comprehensive sales, block splits, and vendor telemetry |

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
