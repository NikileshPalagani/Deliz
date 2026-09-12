-- ==============================================================================
-- CAMPUS-BITE — PHASE 12 VENDOR DASHBOARD MIGRATION
-- Adds order preparation timestamps, high-traffic vendor indexes,
-- database-side vendor stats aggregation RPC, and status transition procedures.
-- ==============================================================================

-- 1. Add Preparation & Readiness Timestamps to Orders Table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'preparation_started_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN preparation_started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'ready_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN ready_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'station_name'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN station_name VARCHAR(100);
  END IF;
END $$;

-- 2. Performance Composite Indexes for Vendor Queries & Queue Filtering
CREATE INDEX IF NOT EXISTS idx_orders_vendor_status_created
  ON public.orders (claimed_by, order_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_block_created
  ON public.orders (order_status, block, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at_status
  ON public.orders (created_at DESC, order_status);

-- 3. Stored Procedure: Get Real-Time Vendor Dashboard Stats in 1 Round-Trip
CREATE OR REPLACE FUNCTION public.get_vendor_dashboard_stats(
  p_vendor_id text DEFAULT NULL
)
RETURNS TABLE (
  new_orders_count BIGINT,
  preparing_orders_count BIGINT,
  ready_orders_count BIGINT,
  completed_today_count BIGINT,
  cancelled_today_count BIGINT,
  today_orders_count BIGINT,
  today_sales_amount NUMERIC,
  average_prep_time_minutes NUMERIC,
  popular_items JSONB,
  recent_orders JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_orders BIGINT;
  v_preparing_orders BIGINT;
  v_ready_orders BIGINT;
  v_completed_today BIGINT;
  v_cancelled_today BIGINT;
  v_today_orders BIGINT;
  v_today_sales NUMERIC;
  v_avg_prep NUMERIC;
  v_popular_items JSONB;
  v_recent_orders JSONB;
BEGIN
  -- 1. Active Workload Metrics
  SELECT
    COUNT(*) FILTER (WHERE order_status IN ('PLACED', 'NEW', 'PENDING_PICKUP')),
    COUNT(*) FILTER (WHERE order_status = 'PREPARING'),
    COUNT(*) FILTER (WHERE order_status = 'READY'),
    COUNT(*) FILTER (WHERE order_status = 'CLAIMED' AND (claimed_at >= CURRENT_DATE OR created_at >= CURRENT_DATE)),
    COUNT(*) FILTER (WHERE order_status = 'CANCELLED' AND created_at >= CURRENT_DATE),
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
    COALESCE(SUM(final_amount) FILTER (WHERE created_at >= CURRENT_DATE AND payment_status IN ('PAID', 'SUCCESS')), 0)
  INTO
    v_new_orders,
    v_preparing_orders,
    v_ready_orders,
    v_completed_today,
    v_cancelled_today,
    v_today_orders,
    v_today_sales
  FROM public.orders
  WHERE (p_vendor_id IS NULL OR claimed_by = p_vendor_id OR claimed_by IS NULL OR order_status IN ('PLACED', 'NEW', 'PENDING_PICKUP', 'PREPARING', 'READY'));

  -- 2. Average Preparation Duration (in Minutes) for fulfilled orders
  SELECT
    COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(ready_at, claimed_at) - COALESCE(preparation_started_at, created_at))) / 60.0)::numeric, 1), 6.5)
  INTO v_avg_prep
  FROM public.orders
  WHERE (ready_at IS NOT NULL OR claimed_at IS NOT NULL)
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND (p_vendor_id IS NULL OR claimed_by = p_vendor_id);

  -- 3. Top-Selling Snack Items
  SELECT COALESCE(jsonb_agg(row_to_json(item_stat)), '[]'::jsonb)
  INTO v_popular_items
  FROM (
    SELECT
      elem->>'id' AS item_id,
      elem->>'name' AS item_name,
      SUM((elem->>'quantity')::int) AS total_quantity,
      SUM((elem->>'price')::numeric * (elem->>'quantity')::int) AS total_revenue
    FROM public.orders,
    LATERAL jsonb_array_elements(items) AS elem
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      AND payment_status IN ('PAID', 'SUCCESS')
    GROUP BY elem->>'id', elem->>'name'
    ORDER BY total_quantity DESC
    LIMIT 6
  ) item_stat;

  -- 4. Recent Incoming Workload
  SELECT COALESCE(jsonb_agg(row_to_json(recent)), '[]'::jsonb)
  INTO v_recent_orders
  FROM (
    SELECT id, token, student_name, block, items, final_amount, order_status, payment_status, created_at, claimed_at
    FROM public.orders
    ORDER BY created_at DESC
    LIMIT 15
  ) recent;

  RETURN QUERY SELECT
    v_new_orders,
    v_preparing_orders,
    v_ready_orders,
    v_completed_today,
    v_cancelled_today,
    v_today_orders,
    v_today_sales,
    COALESCE(v_avg_prep, 5.0),
    v_popular_items,
    v_recent_orders;
END;
$$;

-- 4. Stored Procedure: Atomic Server-Side Order Status Transition for Vendors
CREATE OR REPLACE FUNCTION public.update_order_status_vendor(
  p_order_id text,
  p_new_status text,
  p_vendor_id text DEFAULT 'Vendor'
)
RETURNS TABLE (
  success boolean,
  current_status text,
  updated_order jsonb,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_clean_id text;
  v_target_status text;
  v_now timestamptz;
BEGIN
  v_clean_id := trim(p_order_id);
  v_target_status := upper(trim(p_new_status));
  v_now := clock_timestamp();

  -- Find the order with row-level lock
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_clean_id OR UPPER(id) = UPPER(v_clean_id) OR token = v_clean_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false AS success,
      NULL::text AS current_status,
      NULL::jsonb AS updated_order,
      'Order not found.'::text AS message;
    RETURN;
  END IF;

  -- Prevent transitions from terminal states
  IF v_order.order_status = 'CLAIMED' THEN
    RETURN QUERY SELECT
      false AS success,
      v_order.order_status::text AS current_status,
      to_jsonb(v_order) AS updated_order,
      'Order is already fulfilled/claimed and cannot be changed.'::text AS message;
    RETURN;
  END IF;

  IF v_order.order_status = 'CANCELLED' THEN
    RETURN QUERY SELECT
      false AS success,
      v_order.order_status::text AS current_status,
      to_jsonb(v_order) AS updated_order,
      'Order is cancelled and cannot be modified.'::text AS message;
    RETURN;
  END IF;

  -- Validate Allowed Forward Transitions
  IF v_target_status = 'PREPARING' THEN
    UPDATE public.orders
    SET order_status = 'PREPARING',
        preparation_started_at = COALESCE(preparation_started_at, v_now),
        updated_at = v_now
    WHERE id = v_order.id
    RETURNING * INTO v_order;

  ELSIF v_target_status = 'READY' THEN
    UPDATE public.orders
    SET order_status = 'READY',
        ready_at = COALESCE(ready_at, v_now),
        updated_at = v_now
    WHERE id = v_order.id
    RETURNING * INTO v_order;

  ELSIF v_target_status = 'CLAIMED' THEN
    UPDATE public.orders
    SET order_status = 'CLAIMED',
        claimed_by = COALESCE(NULLIF(trim(p_vendor_id), ''), 'Vendor'),
        claimed_at = v_now,
        ready_at = COALESCE(ready_at, v_now),
        updated_at = v_now
    WHERE id = v_order.id
    RETURNING * INTO v_order;

  ELSIF v_target_status = 'CANCELLED' THEN
    UPDATE public.orders
    SET order_status = 'CANCELLED',
        updated_at = v_now
    WHERE id = v_order.id
    RETURNING * INTO v_order;

  ELSE
    RETURN QUERY SELECT
      false AS success,
      v_order.order_status::text AS current_status,
      to_jsonb(v_order) AS updated_order,
      format('Invalid target status "%s". Allowed: PREPARING, READY, CLAIMED, CANCELLED.', v_target_status)::text AS message;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true AS success,
    v_order.order_status::text AS current_status,
    to_jsonb(v_order) AS updated_order,
    format('Order status successfully updated to %s.', v_target_status)::text AS message;
END;
$$;
