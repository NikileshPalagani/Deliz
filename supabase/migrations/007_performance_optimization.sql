-- ==============================================================================
-- CAMPUS-BITE — PHASE 7 PERFORMANCE OPTIMIZATION MIGRATION
-- Adds high-traffic composite indexes and database-side aggregation RPC
-- ==============================================================================

-- 1. High-Traffic Composite Indexes for Filtered Queries & Pagination
CREATE INDEX IF NOT EXISTS idx_orders_student_created
  ON public.orders(student_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_block_status_created
  ON public.orders(block, order_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders(order_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_student_created
  ON public.payments(student_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON public.orders(created_at DESC);

-- 2. Database-Side Stored Procedure for Admin Dashboard Aggregation
-- Eliminates fetching hundreds/thousands of order rows into Node.js memory.
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
  total_orders BIGINT,
  total_revenue NUMERIC,
  claimed_orders BIGINT,
  pending_orders BIGINT,
  today_orders BIGINT,
  today_revenue NUMERIC,
  block_distribution JSONB,
  item_popularity JSONB,
  vendor_scans JSONB,
  recent_orders JSONB,
  recent_payments JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_orders BIGINT;
  v_total_revenue NUMERIC;
  v_claimed_orders BIGINT;
  v_pending_orders BIGINT;
  v_today_orders BIGINT;
  v_today_revenue NUMERIC;
  v_block_dist JSONB;
  v_item_pop JSONB;
  v_vendor_scans JSONB;
  v_recent_orders JSONB;
  v_recent_payments JSONB;
BEGIN
  -- Aggregate overall order counts and revenue
  SELECT
    COUNT(*),
    COALESCE(SUM(final_amount), 0),
    COUNT(*) FILTER (WHERE order_status = 'CLAIMED'),
    COUNT(*) FILTER (WHERE order_status = 'PENDING_PICKUP'),
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
    COALESCE(SUM(final_amount) FILTER (WHERE created_at >= CURRENT_DATE), 0)
  INTO
    v_total_orders,
    v_total_revenue,
    v_claimed_orders,
    v_pending_orders,
    v_today_orders,
    v_today_revenue
  FROM public.orders;

  -- Block distribution count aggregation
  SELECT COALESCE(
    jsonb_object_agg(COALESCE(block, 'UNKNOWN'), cnt),
    '{"CB": 0, "CM": 0, "FB": 0, "PG": 0}'::jsonb
  )
  INTO v_block_dist
  FROM (
    SELECT block, COUNT(*) AS cnt
    FROM public.orders
    GROUP BY block
  ) b;

  -- Vendor scan count aggregation
  SELECT COALESCE(
    jsonb_object_agg(claimed_by, cnt),
    '{}'::jsonb
  )
  INTO v_vendor_scans
  FROM (
    SELECT claimed_by, COUNT(*) AS cnt
    FROM public.orders
    WHERE claimed_by IS NOT NULL
    GROUP BY claimed_by
  ) v;

  -- Item popularity aggregation from JSONB items arrays
  SELECT COALESCE(
    jsonb_object_agg(item_id, total_qty),
    '{"samosa": 0, "veg_puff": 0, "egg_puff": 0, "chicken_puff": 0}'::jsonb
  )
  INTO v_item_pop
  FROM (
    SELECT
      item->>'id' AS item_id,
      SUM((item->>'quantity')::INT) AS total_qty
    FROM public.orders,
    LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(items::jsonb) = 'array' THEN items::jsonb ELSE '[]'::jsonb END) AS item
    WHERE item->>'id' IS NOT NULL
    GROUP BY item->>'id'
  ) p;

  -- Top 20 Recent Orders (projected columns only)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'token', o.token,
        'studentEmail', o.student_email,
        'studentName', o.student_name,
        'block', o.block,
        'items', o.items,
        'totalAmount', o.total_amount,
        'discount', o.discount,
        'finalAmount', o.final_amount,
        'coinsEarned', o.coins_earned,
        'coinsRedeemed', o.coins_redeemed,
        'paymentMethod', o.payment_method,
        'paymentStatus', o.payment_status,
        'orderStatus', o.order_status,
        'claimedBy', o.claimed_by,
        'claimedAt', o.claimed_at,
        'createdAt', o.created_at
      )
    ),
    '[]'::jsonb
  )
  INTO v_recent_orders
  FROM (
    SELECT *
    FROM public.orders
    ORDER BY created_at DESC
    LIMIT 20
  ) o;

  -- Top 20 Recent Payments (projected columns only)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'orderId', p.order_id,
        'studentEmail', p.student_email,
        'amount', p.amount,
        'paymentMethod', p.payment_method,
        'transactionId', p.transaction_id,
        'razorpayOrderId', p.razorpay_order_id,
        'status', p.payment_status,
        'createdAt', p.created_at
      )
    ),
    '[]'::jsonb
  )
  INTO v_recent_payments
  FROM (
    SELECT *
    FROM public.payments
    ORDER BY created_at DESC
    LIMIT 20
  ) p;

  RETURN QUERY SELECT
    v_total_orders,
    v_total_revenue,
    v_claimed_orders,
    v_pending_orders,
    v_today_orders,
    v_today_revenue,
    v_block_dist,
    v_item_pop,
    v_vendor_scans,
    v_recent_orders,
    v_recent_payments;
END;
$$;
