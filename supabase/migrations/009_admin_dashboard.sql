-- ==============================================================================
-- CAMPUS-BITE — PHASE 11: ADMIN DASHBOARD & MANAGEMENT SCHEMA MIGRATION
-- Database tables, stored procedures, and RLS policies for complete administration
-- ==============================================================================

-- 1. Menu Items Table (Dynamic database-backed menu catalog)
CREATE TABLE IF NOT EXISTS public.menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  unit TEXT NOT NULL DEFAULT 'pcs',
  category TEXT NOT NULL DEFAULT 'Snacks',
  is_veg BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  fallback_image TEXT,
  description TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  stock_count INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default menu catalog if empty
INSERT INTO public.menu_items (id, name, price, unit, category, is_veg, image_url, fallback_image, description, is_available)
VALUES
  ('samosa', 'Samosa', 12.00, 'pcs', 'Snacks', true, '/images/samosa.png', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80', 'Crispy spiced potato and pea samosa', true),
  ('veg_puff', 'Veg Puff', 25.00, 'pcs', 'Snacks', true, '/images/veg-puff.png', 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80', 'Golden flaky pastry with seasoned vegetable filling', true),
  ('egg_puff', 'Egg Puff', 25.00, 'pcs', 'Snacks', false, '/images/egg-puff.png', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80', 'Flaky puff pastry with whole spiced boiled egg', true),
  ('chicken_puff', 'Chicken Puff', 30.00, 'pcs', 'Snacks', false, '/images/chicken-puff.png', 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80', 'Savory puff filled with tender chicken masala', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'important', 'urgent'
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed an initial active announcement
INSERT INTO public.announcements (title, message, priority, is_active)
VALUES
  ('Welcome to Campus-Bite Canteen!', 'Fast pickup available across CB, CM, FB, and PG blocks. Scan your QR pass at the counter.', 'normal', true)
ON CONFLICT DO NOTHING;

-- 3. Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_discount NUMERIC(10, 2) DEFAULT 50.00,
  min_order_amount NUMERIC(10, 2) DEFAULT 30.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a welcome coupon
INSERT INTO public.coupons (code, discount_percent, max_discount, min_order_amount, is_active)
VALUES
  ('CAMPUSBITE10', 10, 20.00, 30.00, true),
  ('SNACKFEST', 15, 30.00, 50.00, true)
ON CONFLICT (code) DO NOTHING;

-- 4. Enable Row-Level Security (RLS) on New Tables
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Menu Items: Public read for everyone; write only for admins/service_role
DROP POLICY IF EXISTS menu_items_public_select ON public.menu_items;
CREATE POLICY menu_items_public_select ON public.menu_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS menu_items_admin_modify ON public.menu_items;
CREATE POLICY menu_items_admin_modify ON public.menu_items
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'service_role')
    OR current_user = 'postgres'
  );

-- Announcements: Public read for active announcements; write only for admins/service_role
DROP POLICY IF EXISTS announcements_public_select ON public.announcements;
CREATE POLICY announcements_public_select ON public.announcements
  FOR SELECT
  USING (is_active = true OR (auth.jwt() ->> 'role') IN ('admin', 'service_role') OR current_user = 'postgres');

DROP POLICY IF EXISTS announcements_admin_modify ON public.announcements;
CREATE POLICY announcements_admin_modify ON public.announcements
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'service_role')
    OR current_user = 'postgres'
  );

-- Coupons: Public read for active valid coupons; write only for admins/service_role
DROP POLICY IF EXISTS coupons_select_policy ON public.coupons;
CREATE POLICY coupons_select_policy ON public.coupons
  FOR SELECT
  USING (is_active = true OR (auth.jwt() ->> 'role') IN ('admin', 'service_role') OR current_user = 'postgres');

DROP POLICY IF EXISTS coupons_admin_modify ON public.coupons;
CREATE POLICY coupons_admin_modify ON public.coupons
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'service_role')
    OR current_user = 'postgres'
  );

-- 6. Enhanced PostgreSQL Stored Procedure for Admin Dashboard Statistics
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_orders BIGINT;
  v_total_revenue NUMERIC;
  v_claimed_orders BIGINT;
  v_pending_orders BIGINT;
  v_cancelled_orders BIGINT;
  v_today_orders BIGINT;
  v_today_revenue NUMERIC;
  v_total_students BIGINT;
  v_total_vendors BIGINT;
  v_successful_payments BIGINT;
  v_failed_payments BIGINT;
  v_block_dist JSONB;
  v_item_popularity JSONB;
  v_recent_orders JSONB;
  v_recent_payments JSONB;
BEGIN
  -- Aggregate overall orders metrics
  SELECT
    COUNT(*),
    COALESCE(SUM(final_amount), 0),
    COUNT(*) FILTER (WHERE order_status = 'CLAIMED'),
    COUNT(*) FILTER (WHERE order_status = 'PENDING_PICKUP'),
    COUNT(*) FILTER (WHERE order_status = 'CANCELLED'),
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
    COALESCE(SUM(final_amount) FILTER (WHERE created_at >= CURRENT_DATE), 0)
  INTO
    v_total_orders,
    v_total_revenue,
    v_claimed_orders,
    v_pending_orders,
    v_cancelled_orders,
    v_today_orders,
    v_today_revenue
  FROM public.orders;

  -- Aggregate student and vendor accounts
  SELECT COUNT(*) INTO v_total_students FROM public.profiles WHERE role = 'student';
  SELECT COUNT(*) INTO v_total_vendors FROM public.profiles WHERE role = 'vendor';

  -- Aggregate payments metrics
  SELECT
    COUNT(*) FILTER (WHERE payment_status = 'SUCCESS' OR payment_status = 'PAID'),
    COUNT(*) FILTER (WHERE payment_status = 'FAILED')
  INTO
    v_successful_payments,
    v_failed_payments
  FROM public.payments;

  -- Block distribution
  SELECT COALESCE(jsonb_object_agg(block, cnt), '{}'::JSONB)
  INTO v_block_dist
  FROM (
    SELECT block, COUNT(*) as cnt
    FROM public.orders
    GROUP BY block
  ) b;

  -- Top snack items aggregation
  SELECT COALESCE(jsonb_object_agg(item_id, total_qty), '{}'::JSONB)
  INTO v_item_popularity
  FROM (
    SELECT
      item->>'id' AS item_id,
      SUM((item->>'quantity')::INT) AS total_qty
    FROM public.orders,
    jsonb_array_elements(items) AS item
    GROUP BY item_id
  ) p;

  -- Recent 20 orders
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::JSONB)
  INTO v_recent_orders
  FROM (
    SELECT
      id,
      token,
      student_email AS "studentEmail",
      student_name AS "studentName",
      block,
      items,
      total_amount AS "totalAmount",
      discount,
      final_amount AS "finalAmount",
      payment_status AS "paymentStatus",
      order_status AS "orderStatus",
      claimed_by AS "claimedBy",
      claimed_at AS "claimedAt",
      created_at AS "createdAt"
    FROM public.orders
    ORDER BY created_at DESC
    LIMIT 20
  ) r;

  -- Recent 20 payments
  SELECT COALESCE(jsonb_agg(row_to_json(pay)), '[]'::JSONB)
  INTO v_recent_payments
  FROM (
    SELECT
      id,
      order_id AS "orderId",
      student_email AS "studentEmail",
      amount,
      payment_method AS "paymentMethod",
      transaction_id AS "transactionId",
      razorpay_order_id AS "razorpayOrderId",
      payment_status AS "paymentStatus",
      created_at AS "createdAt"
    FROM public.payments
    ORDER BY created_at DESC
    LIMIT 20
  ) pay;

  RETURN jsonb_build_object(
    'totalOrders', v_total_orders,
    'totalRevenue', v_total_revenue,
    'claimedOrders', v_claimed_orders,
    'pendingOrders', v_pending_orders,
    'cancelledOrders', v_cancelled_orders,
    'todayOrders', v_today_orders,
    'todayRevenue', v_today_revenue,
    'totalStudents', v_total_students,
    'totalVendors', v_total_vendors,
    'successfulPayments', v_successful_payments,
    'failedPayments', v_failed_payments,
    'blockDistribution', v_block_dist,
    'itemPopularity', v_item_popularity,
    'recentOrders', v_recent_orders,
    'payments', v_recent_payments
  );
END;
$$;
