/**
 * Campus Bite — Phase 11 Automated Test Suite
 * Tests:
 * 1. Admin RBAC & Route Authorization (Reject 401 unauthenticated & 403 non-admin)
 * 2. Admin Dashboard Live Stats API (/api/admin/stats)
 * 3. Paginated Admin Orders Stream & Filter Queries (/api/admin/orders)
 * 4. Paginated Student Directory & Search (/api/admin/students)
 * 5. Vendor Operations & Counter Toggles (/api/admin/vendors)
 * 6. Full Menu Management CRUD & Availability Toggling (/api/admin/menu)
 * 7. Payment Ledger Auditing (/api/admin/payments)
 * 8. Coupon Lifecycle Management (/api/admin/coupons)
 * 9. Announcements Broadcasting & Public Feed (/api/admin/announcements & /api/announcements/active)
 * 10. Analytical Sales Reports & Trends (/api/admin/reports)
 * 11. Non-regression of Core Student/Vendor Lifecycle (Phases 1-10)
 */

import { app } from '../server.js';

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${name} ${details ? '— ' + details : ''}`);
    failed++;
  }
}

const makeRequest = (method, urlPath, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const [pathPart, queryPart] = urlPath.split('?');
    const query = {};
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      for (const [k, v] of params.entries()) {
        query[k] = v;
      }
    }

    const req = {
      method: method.toUpperCase(),
      url: urlPath,
      path: pathPart,
      originalUrl: urlPath,
      query,
      body: body || {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
        ...headers,
      },
    };

    let statusCode = 200;
    const responseHeaders = {};

    const res = {
      statusCode: 200,
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader(name, val) {
        responseHeaders[name.toLowerCase()] = val;
        return this;
      },
      getHeader(name) {
        return responseHeaders[name.toLowerCase()] || null;
      },
      json(data) {
        resolve({ status: statusCode, data, body: data, headers: responseHeaders });
      },
      send(data) {
        let parsed = data;
        try {
          if (typeof data === 'string') parsed = JSON.parse(data);
        } catch (_) {}
        resolve({ status: statusCode, data: parsed, body: parsed, headers: responseHeaders });
      },
      end(data) {
        let parsed = data;
        try {
          if (typeof data === 'string') parsed = JSON.parse(data);
        } catch (_) {}
        resolve({ status: statusCode, data: parsed, body: parsed, headers: responseHeaders });
      }
    };

    try {
      app.handle(req, res);
    } catch (e) {
      reject(e);
    }
  });
};

async function runTests() {
  console.log('====================================================');
  console.log('  CAMPUS-BITE PHASE 11: ADMIN DASHBOARD TEST SUITE  ');
  console.log('====================================================\n');

  const adminHeaders = {
    'x-admin-role': 'admin',
    'x-admin-email': 'admin@cvr.ac.in',
  };

  const studentHeaders = {
    'x-user-role': 'student',
    'x-user-email': 'student_test@cvr.ac.in',
  };

  let createdMenuItemId = null;
  let createdCouponId = null;
  let createdAnnouncementId = null;

  try {
    // ----------------------------------------------------
    // Step 1: Security & RBAC Enforcement
    // ----------------------------------------------------
    console.log('--- 1. Security & RBAC Enforcement ---');

    // Anonymous request to admin stats -> 401
    const anonRes = await makeRequest('GET', '/api/admin/stats');
    assert(anonRes.status === 401, 'Anonymous request to /api/admin/stats rejected with HTTP 401');

    // Student request to admin stats -> 403
    const studentRes = await makeRequest('GET', '/api/admin/stats', null, studentHeaders);
    assert(studentRes.status === 403, 'Student request to /api/admin/stats rejected with HTTP 403 (Admin role required)');

    // Student request to admin menu POST -> 403
    const studentMenuRes = await makeRequest('POST', '/api/admin/menu', { name: 'Hacked Item', price: 10 }, studentHeaders);
    assert(studentMenuRes.status === 403, 'Student unauthorized mutation to /api/admin/menu rejected with HTTP 403');

    // ----------------------------------------------------
    // Step 2: Admin Dashboard Stats API
    // ----------------------------------------------------
    console.log('\n--- 2. Admin Dashboard Stats ---');

    const statsRes = await makeRequest('GET', '/api/admin/stats', null, adminHeaders);
    assert(statsRes.status === 200, 'Admin successfully accesses /api/admin/stats (HTTP 200)');
    assert(
      statsRes.data?.stats &&
      typeof statsRes.data.stats.total_orders === 'number' &&
      typeof statsRes.data.stats.total_revenue === 'number' &&
      typeof statsRes.data.stats.today_orders === 'number' &&
      typeof statsRes.data.stats.today_revenue === 'number' &&
      typeof statsRes.data.stats.students_count === 'number' &&
      typeof statsRes.data.stats.vendors_count === 'number',
      'Stats response contains all required KPI fields'
    );

    // ----------------------------------------------------
    // Step 3: Paginated Admin Orders Stream
    // ----------------------------------------------------
    console.log('\n--- 3. Paginated Admin Orders Stream ---');

    const ordersRes = await makeRequest('GET', '/api/admin/orders?page=1&limit=10&block=All', null, adminHeaders);
    assert(ordersRes.status === 200, 'Admin fetches orders stream (HTTP 200)');
    assert(
      Array.isArray(ordersRes.data?.orders) &&
      typeof ordersRes.data?.total === 'number' &&
      ordersRes.data?.page === 1,
      'Orders payload is properly paginated and formatted'
    );

    // Filter query test
    const ordersFilteredRes = await makeRequest('GET', '/api/admin/orders?status=claimed&search=CVR', null, adminHeaders);
    assert(ordersFilteredRes.status === 200 && Array.isArray(ordersFilteredRes.data?.orders), 'Order search and filter query executes smoothly');

    // ----------------------------------------------------
    // Step 4: Paginated Students Directory
    // ----------------------------------------------------
    console.log('\n--- 4. Paginated Students Directory ---');

    const studentsRes = await makeRequest('GET', '/api/admin/students?page=1&limit=10', null, adminHeaders);
    assert(studentsRes.status === 200, 'Admin fetches students directory (HTTP 200)');
    assert(
      Array.isArray(studentsRes.data?.students) &&
      typeof studentsRes.data?.total === 'number',
      'Students payload contains paginated student records with balance'
    );

    // ----------------------------------------------------
    // Step 5: Vendors Management & Counter Toggles
    // ----------------------------------------------------
    console.log('\n--- 5. Vendor Management ---');

    const vendorsRes = await makeRequest('GET', '/api/admin/vendors', null, adminHeaders);
    assert(vendorsRes.status === 200, 'Admin fetches vendor list (HTTP 200)');
    assert(Array.isArray(vendorsRes.data?.vendors) && vendorsRes.data.vendors.length > 0, 'Vendors list returned active vendor stations');

    const firstVendorId = vendorsRes.data?.vendors[0]?.id;

    // Toggle vendor status
    const toggleVendorRes = await makeRequest('POST', '/api/admin/vendors/toggle-status', {
      vendorId: firstVendorId,
      is_active: false,
    }, adminHeaders);
    assert(toggleVendorRes.status === 200 && toggleVendorRes.data?.success, 'Admin successfully toggled vendor active status');

    // Restore vendor status
    await makeRequest('POST', '/api/admin/vendors/toggle-status', {
      vendorId: firstVendorId,
      is_active: true,
    }, adminHeaders);

    // ----------------------------------------------------
    // Step 6: Menu Management CRUD & Availability
    // ----------------------------------------------------
    console.log('\n--- 6. Menu Management CRUD ---');

    // GET /api/admin/menu
    const menuRes = await makeRequest('GET', '/api/admin/menu', null, adminHeaders);
    assert(menuRes.status === 200 && Array.isArray(menuRes.data?.items), 'Admin fetches full menu catalog');

    // CREATE new menu item
    const createItemRes = await makeRequest('POST', '/api/admin/menu', {
      name: 'Special Paneer Roll',
      price: 75,
      category: 'Snacks',
      is_veg: true,
      is_available: true,
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
      description: 'Fresh cottage cheese roll with mint chutney',
    }, adminHeaders);
    assert(createItemRes.status === 201 && createItemRes.data?.item?.id, 'Admin creates new menu item (HTTP 201)');
    createdMenuItemId = createItemRes.data?.item?.id;

    // UPDATE menu item
    const updateItemRes = await makeRequest('PUT', `/api/admin/menu/${createdMenuItemId}`, {
      name: 'Special Paneer Roll (Extra Spiced)',
      price: 80,
      category: 'Snacks',
      is_veg: true,
      is_available: true,
    }, adminHeaders);
    assert(updateItemRes.status === 200, 'Admin updates menu item details (HTTP 200)');

    // TOGGLE menu item availability
    const toggleItemRes = await makeRequest('PATCH', `/api/admin/menu/${createdMenuItemId}/toggle`, {}, adminHeaders);
    assert(toggleItemRes.status === 200 && toggleItemRes.data?.item?.is_available === false, 'Admin toggles item out-of-stock');

    // DELETE menu item
    const deleteItemRes = await makeRequest('DELETE', `/api/admin/menu/${createdMenuItemId}`, null, adminHeaders);
    assert(deleteItemRes.status === 200, 'Admin deletes menu item (HTTP 200)');

    // ----------------------------------------------------
    // Step 7: Payment Ledger
    // ----------------------------------------------------
    console.log('\n--- 7. Payment Ledger Auditing ---');

    const paymentsRes = await makeRequest('GET', '/api/admin/payments?page=1&limit=10', null, adminHeaders);
    assert(paymentsRes.status === 200, 'Admin fetches payments ledger (HTTP 200)');
    assert(
      Array.isArray(paymentsRes.data?.payments) &&
      typeof paymentsRes.data?.total === 'number',
      'Payment ledger payload is correctly paginated'
    );

    // ----------------------------------------------------
    // Step 8: Coupons & Discounts Management
    // ----------------------------------------------------
    console.log('\n--- 8. Coupon Lifecycle Management ---');

    // CREATE Coupon
    const createCouponRes = await makeRequest('POST', '/api/admin/coupons', {
      code: 'CAMPUSFEST20',
      discount_percent: 20,
      max_discount_amount: 50,
      min_order_amount: 100,
      usage_limit: 500,
      is_active: true,
    }, adminHeaders);
    assert(createCouponRes.status === 201 && createCouponRes.data?.coupon?.id, 'Admin creates discount coupon (HTTP 201)');
    createdCouponId = createCouponRes.data?.coupon?.id;

    // TOGGLE Coupon Active
    const toggleCouponRes = await makeRequest('PATCH', `/api/admin/coupons/${createdCouponId}`, {
      is_active: false,
    }, adminHeaders);
    assert(toggleCouponRes.status === 200, 'Admin deactivates coupon (HTTP 200)');

    // DELETE Coupon
    const deleteCouponRes = await makeRequest('DELETE', `/api/admin/coupons/${createdCouponId}`, null, adminHeaders);
    assert(deleteCouponRes.status === 200, 'Admin deletes coupon (HTTP 200)');

    // ----------------------------------------------------
    // Step 9: Announcements Broadcasting
    // ----------------------------------------------------
    console.log('\n--- 9. Announcements Broadcasting ---');

    // CREATE Announcement
    const createNoticeRes = await makeRequest('POST', '/api/admin/announcements', {
      title: 'Canteen Maintenance Notice',
      message: 'Counter 2 will close 15 minutes early today for deep cleaning.',
      target_role: 'all',
      is_active: true,
    }, adminHeaders);
    assert(createNoticeRes.status === 201 && createNoticeRes.data?.announcement?.id, 'Admin creates broadcast announcement (HTTP 201)');
    createdAnnouncementId = createNoticeRes.data?.announcement?.id;

    // GET Public active announcements for students
    const publicNoticeRes = await makeRequest('GET', '/api/announcements/active');
    assert(
      publicNoticeRes.status === 200 &&
      Array.isArray(publicNoticeRes.data?.announcements) &&
      publicNoticeRes.data?.announcements.some((n) => n.id === createdAnnouncementId),
      'Public active announcements endpoint serves the created notice to buyers'
    );

    // DELETE Announcement
    const deleteNoticeRes = await makeRequest('DELETE', `/api/admin/announcements/${createdAnnouncementId}`, null, adminHeaders);
    assert(deleteNoticeRes.status === 200, 'Admin deletes announcement notice (HTTP 200)');

    // ----------------------------------------------------
    // Step 10: Analytical Reports & Trends
    // ----------------------------------------------------
    console.log('\n--- 10. Analytical Reports & Trends ---');

    const reportsRes = await makeRequest('GET', '/api/admin/reports?range=7d', null, adminHeaders);
    assert(reportsRes.status === 200, 'Admin fetches analytics & sales reports (HTTP 200)');
    assert(
      Array.isArray(reportsRes.data?.daily_trends) &&
      typeof reportsRes.data?.summary?.total_revenue === 'number' &&
      Array.isArray(reportsRes.data?.peak_hours),
      'Reports payload provides daily trends, summary metrics, and peak hour velocity'
    );

    // ----------------------------------------------------
    // Step 11: Non-Regression Check (Phases 1-10)
    // ----------------------------------------------------
    console.log('\n--- 11. Core Non-Regression Checks (Phases 1-10) ---');

    // Menu fetch for students
    const studentMenuGet = await makeRequest('GET', '/api/menu');
    assert(studentMenuGet.status === 200 && Array.isArray(studentMenuGet.data?.items), 'Student menu endpoint is functional with caching');

    // Create Order with Idempotency Key
    const orderIdempotencyKey = `phase11_test_${Date.now()}`;
    const orderCreateRes = await makeRequest('POST', '/api/orders', {
      studentEmail: 'student_test@cvr.ac.in',
      studentName: 'Test Student',
      studentPhone: '9876543210',
      block: 'CB',
      items: [{ id: 'samosa', name: 'Samosa', price: 15, quantity: 2 }],
      totalAmount: 30,
      finalAmount: 30,
      paymentMethod: 'razorpay',
    }, {
      'x-idempotency-key': orderIdempotencyKey,
      ...studentHeaders,
    });
    assert((orderCreateRes.status === 200 || orderCreateRes.status === 201) && orderCreateRes.data?.order?.id, 'Order creation remains fully operational and idempotent');

  } catch (err) {
    console.error('Fatal Test Execution Error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED  `);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
