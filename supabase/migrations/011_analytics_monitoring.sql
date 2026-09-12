-- ==============================================================================
-- Migration 011: Campus-Bite Production Analytics & System Monitoring RPCs
-- ==============================================================================

-- 1. Optimized Composite Indexes for Reporting & Analytics
CREATE INDEX IF NOT EXISTS idx_orders_created_at_payment_status 
ON orders (created_at DESC, payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status 
ON orders (payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_claimed_at 
ON orders (claimed_at DESC) 
WHERE claimed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_ready_at 
ON orders (ready_at DESC) 
WHERE ready_at IS NOT NULL;

-- 2. Stored Procedure: Single-Roundtrip Admin Analytics Overview
CREATE OR REPLACE FUNCTION get_admin_analytics_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_students INT := 0;
    v_total_vendors INT := 0;
    v_total_orders INT := 0;
    v_orders_today INT := 0;
    v_orders_this_week INT := 0;
    v_orders_this_month INT := 0;
    v_revenue_today NUMERIC := 0;
    v_revenue_this_week NUMERIC := 0;
    v_revenue_this_month NUMERIC := 0;
    v_total_revenue NUMERIC := 0;
    v_successful_payments INT := 0;
    v_failed_payments INT := 0;
    v_pending_payments INT := 0;
    v_cancelled_orders INT := 0;
    v_completed_orders INT := 0;
    v_avg_order_value NUMERIC := 0;
BEGIN
    -- Students count
    SELECT COUNT(*) INTO v_total_students 
    FROM profiles 
    WHERE role = 'student';

    -- Vendors count
    SELECT COUNT(*) INTO v_total_vendors 
    FROM profiles 
    WHERE role = 'vendor';

    -- Aggregated order metrics
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)),
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)),
        COALESCE(SUM(final_amount) FILTER (WHERE payment_status IN ('PAID', 'SUCCESS') AND created_at >= CURRENT_DATE), 0),
        COALESCE(SUM(final_amount) FILTER (WHERE payment_status IN ('PAID', 'SUCCESS') AND created_at >= DATE_TRUNC('week', CURRENT_DATE)), 0),
        COALESCE(SUM(final_amount) FILTER (WHERE payment_status IN ('PAID', 'SUCCESS') AND created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0),
        COALESCE(SUM(final_amount) FILTER (WHERE payment_status IN ('PAID', 'SUCCESS')), 0),
        COUNT(*) FILTER (WHERE payment_status IN ('PAID', 'SUCCESS')),
        COUNT(*) FILTER (WHERE payment_status IN ('FAILED', 'PAYMENT_FAILED')),
        COUNT(*) FILTER (WHERE payment_status = 'PENDING'),
        COUNT(*) FILTER (WHERE order_status = 'CANCELLED'),
        COUNT(*) FILTER (WHERE order_status = 'CLAIMED'),
        COALESCE(AVG(final_amount) FILTER (WHERE payment_status IN ('PAID', 'SUCCESS')), 0)
    INTO 
        v_total_orders,
        v_orders_today,
        v_orders_this_week,
        v_orders_this_month,
        v_revenue_today,
        v_revenue_this_week,
        v_revenue_this_month,
        v_total_revenue,
        v_successful_payments,
        v_failed_payments,
        v_pending_payments,
        v_cancelled_orders,
        v_completed_orders,
        v_avg_order_value
    FROM orders;

    RETURN jsonb_build_object(
        'total_students', v_total_students,
        'total_vendors', v_total_vendors,
        'total_orders', v_total_orders,
        'orders_today', v_orders_today,
        'orders_this_week', v_orders_this_week,
        'orders_this_month', v_orders_this_month,
        'revenue_today', ROUND(v_revenue_today, 2),
        'revenue_this_week', ROUND(v_revenue_this_week, 2),
        'revenue_this_month', ROUND(v_revenue_this_month, 2),
        'total_revenue', ROUND(v_total_revenue, 2),
        'successful_payments', v_successful_payments,
        'failed_payments', v_failed_payments,
        'pending_payments', v_pending_payments,
        'cancelled_orders', v_cancelled_orders,
        'completed_orders', v_completed_orders,
        'average_order_value', ROUND(v_avg_order_value, 2)
    );
END;
$$;

-- 3. Stored Procedure: Food & Menu Item Sales Velocity
CREATE OR REPLACE FUNCTION get_admin_analytics_food(p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'), p_limit INT DEFAULT 10)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_top_items JSONB;
    v_least_items JSONB;
BEGIN
    -- Top Ordered Items
    WITH item_data AS (
        SELECT 
            COALESCE(item->>'name', item->>'item_name', 'Item') AS item_name,
            COALESCE((item->>'quantity')::INT, 1) AS quantity,
            COALESCE((item->>'price')::NUMERIC, 0) AS price,
            o.id AS order_id
        FROM orders o,
        jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) AS item
        WHERE o.created_at >= p_start_date
          AND o.payment_status IN ('PAID', 'SUCCESS')
    ),
    aggregated AS (
        SELECT 
            item_name,
            SUM(quantity) AS total_quantity,
            SUM(quantity * price) AS total_revenue,
            COUNT(DISTINCT order_id) AS orders_count
        FROM item_data
        GROUP BY item_name
    )
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_top_items
    FROM (
        SELECT * FROM aggregated ORDER BY total_quantity DESC LIMIT p_limit
    ) sub;

    -- Least Ordered Items
    WITH item_data AS (
        SELECT 
            COALESCE(item->>'name', item->>'item_name', 'Item') AS item_name,
            COALESCE((item->>'quantity')::INT, 1) AS quantity,
            COALESCE((item->>'price')::NUMERIC, 0) AS price,
            o.id AS order_id
        FROM orders o,
        jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) AS item
        WHERE o.created_at >= p_start_date
          AND o.payment_status IN ('PAID', 'SUCCESS')
    ),
    aggregated AS (
        SELECT 
            item_name,
            SUM(quantity) AS total_quantity,
            SUM(quantity * price) AS total_revenue,
            COUNT(DISTINCT order_id) AS orders_count
        FROM item_data
        GROUP BY item_name
    )
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_least_items
    FROM (
        SELECT * FROM aggregated ORDER BY total_quantity ASC LIMIT p_limit
    ) sub;

    RETURN jsonb_build_object(
        'top_items', v_top_items,
        'least_items', v_least_items
    );
END;
$$;

-- 4. Stored Procedure: Peak Ordering Times (Hourly & Day of Week)
CREATE OR REPLACE FUNCTION get_admin_analytics_peak_times(p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hourly JSONB;
    v_daily JSONB;
    v_busiest_hour INT;
    v_busiest_day TEXT;
    v_avg_orders_per_hour NUMERIC;
BEGIN
    -- Hourly aggregation
    SELECT COALESCE(jsonb_agg(h ORDER BY h.hour), '[]'::jsonb) INTO v_hourly
    FROM (
        SELECT 
            EXTRACT(HOUR FROM created_at)::INT AS hour,
            COUNT(*)::INT AS orders,
            COALESCE(SUM(final_amount) FILTER (WHERE payment_status IN ('PAID', 'SUCCESS')), 0) AS revenue
        FROM orders
        WHERE created_at >= p_start_date
        GROUP BY EXTRACT(HOUR FROM created_at)
    ) h;

    -- Day of week aggregation
    SELECT COALESCE(jsonb_agg(d ORDER BY d.dow), '[]'::jsonb) INTO v_daily
    FROM (
        SELECT 
            EXTRACT(DOW FROM created_at)::INT AS dow,
            TO_CHAR(created_at, 'FMDay') AS day_name,
            COUNT(*)::INT AS orders,
            COALESCE(SUM(final_amount) FILTER (WHERE payment_status IN ('PAID', 'SUCCESS')), 0) AS revenue
        FROM orders
        WHERE created_at >= p_start_date
        GROUP BY EXTRACT(DOW FROM created_at), TO_CHAR(created_at, 'FMDay')
    ) d;

    -- Busiest hour
    SELECT EXTRACT(HOUR FROM created_at)::INT INTO v_busiest_hour
    FROM orders
    WHERE created_at >= p_start_date
    GROUP BY EXTRACT(HOUR FROM created_at)
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- Busiest day
    SELECT TO_CHAR(created_at, 'FMDay') INTO v_busiest_day
    FROM orders
    WHERE created_at >= p_start_date
    GROUP BY TO_CHAR(created_at, 'FMDay')
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- Average orders per active hour
    SELECT ROUND(AVG(cnt), 1) INTO v_avg_orders_per_hour
    FROM (
        SELECT COUNT(*) as cnt
        FROM orders
        WHERE created_at >= p_start_date
        GROUP BY DATE_TRUNC('day', created_at), EXTRACT(HOUR FROM created_at)
    ) per_hour;

    RETURN jsonb_build_object(
        'hourly_trends', v_hourly,
        'daily_trends', v_daily,
        'busiest_hour', COALESCE(v_busiest_hour, 13),
        'busiest_day', COALESCE(v_busiest_day, 'Wednesday'),
        'avg_orders_per_hour', COALESCE(v_avg_orders_per_hour, 0)
    );
END;
$$;

-- 5. Stored Procedure: Order Lifecycle & Processing Times
CREATE OR REPLACE FUNCTION get_admin_analytics_order_processing()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_avg_prep_minutes NUMERIC := 0;
    v_fastest_prep_minutes NUMERIC := 0;
    v_slowest_prep_minutes NUMERIC := 0;
    v_avg_pickup_minutes NUMERIC := 0;
    v_avg_total_fulfillment_minutes NUMERIC := 0;
BEGIN
    SELECT 
        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (ready_at - preparation_started_at)) / 60)::NUMERIC, 1), 0),
        COALESCE(ROUND(MIN(EXTRACT(EPOCH FROM (ready_at - preparation_started_at)) / 60)::NUMERIC, 1), 0),
        COALESCE(ROUND(MAX(EXTRACT(EPOCH FROM (ready_at - preparation_started_at)) / 60)::NUMERIC, 1), 0),
        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (claimed_at - ready_at)) / 60)::NUMERIC, 1), 0),
        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (claimed_at - created_at)) / 60)::NUMERIC, 1), 0)
    INTO 
        v_avg_prep_minutes,
        v_fastest_prep_minutes,
        v_slowest_prep_minutes,
        v_avg_pickup_minutes,
        v_avg_total_fulfillment_minutes
    FROM orders
    WHERE ready_at IS NOT NULL 
      AND preparation_started_at IS NOT NULL
      AND ready_at >= preparation_started_at;

    RETURN jsonb_build_object(
        'avg_prep_time_minutes', v_avg_prep_minutes,
        'fastest_prep_time_minutes', v_fastest_prep_minutes,
        'slowest_prep_time_minutes', v_slowest_prep_minutes,
        'avg_pickup_time_minutes', v_avg_pickup_minutes,
        'avg_total_fulfillment_minutes', v_avg_total_fulfillment_minutes
    );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION get_admin_analytics_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_admin_analytics_food(TIMESTAMPTZ, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_admin_analytics_peak_times(TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_admin_analytics_order_processing() TO authenticated, service_role;
