-- ==============================================================================
-- Migration: 006_qr_claim_concurrency.sql
-- Description: Enforces pickup token uniqueness, performance indexes for counter
--              lookups, atomic order claiming RPC with row-level concurrency protection,
--              and QR validation RPC for Campus-Bite.
-- ==============================================================================

-- 1. Ensure Unique Pickup Token Constraint and Index on Orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_orders_pickup_token'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT uq_orders_pickup_token UNIQUE (token);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_pickup_token_uq ON public.orders (token);

-- 2. Performance Indexes for High-Traffic Counter Lookup & Verification
CREATE INDEX IF NOT EXISTS idx_orders_claim_lookup ON public.orders (token, order_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_claimed_by ON public.orders (claimed_by) WHERE claimed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_claimed_at ON public.orders (claimed_at DESC) WHERE claimed_at IS NOT NULL;

-- 3. Stored Procedure: Read-Only QR Code Validation (Does NOT mutate order)
CREATE OR REPLACE FUNCTION validate_order_qr(
  p_identifier text
)
RETURNS TABLE (
  success boolean,
  status text,
  order_data jsonb,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_clean_id text;
BEGIN
  v_clean_id := trim(p_identifier);

  -- Look up order by exact token, exact id, or case-insensitive match
  SELECT * INTO v_order
  FROM public.orders
  WHERE token = v_clean_id
     OR id = v_clean_id
     OR UPPER(token) = UPPER(v_clean_id)
     OR UPPER(id) = UPPER(v_clean_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false AS success,
      'NOT_FOUND'::text AS status,
      NULL::jsonb AS order_data,
      'Order QR not found or invalid pickup pass.'::text AS message;
    RETURN;
  END IF;

  -- Check if already claimed
  IF v_order.order_status = 'CLAIMED' THEN
    RETURN QUERY SELECT
      false AS success,
      'ALREADY_CLAIMED'::text AS status,
      to_jsonb(v_order) AS order_data,
      format('This pickup pass was ALREADY CLAIMED at %s by %s.', to_char(v_order.claimed_at, 'HH12:MI AM'), COALESCE(v_order.claimed_by, 'canteen counter'))::text AS message;
    RETURN;
  END IF;

  -- Check if cancelled
  IF v_order.order_status = 'CANCELLED' THEN
    RETURN QUERY SELECT
      false AS success,
      'CANCELLED'::text AS status,
      to_jsonb(v_order) AS order_data,
      'This order was CANCELLED and cannot be claimed.'::text AS message;
    RETURN;
  END IF;

  -- Check payment status
  IF v_order.payment_status NOT IN ('PAID', 'SUCCESS') THEN
    RETURN QUERY SELECT
      false AS success,
      'PAYMENT_NOT_CONFIRMED'::text AS status,
      to_jsonb(v_order) AS order_data,
      'Payment is not confirmed for this order. Please complete payment.'::text AS message;
    RETURN;
  END IF;

  -- Valid and ready for pickup
  RETURN QUERY SELECT
    true AS success,
    'READY_FOR_PICKUP'::text AS status,
    to_jsonb(v_order) AS order_data,
    'Valid pickup pass ready for handover.'::text AS message;
END;
$$;

-- 4. Atomic Concurrency-Safe Order Claim Procedure
-- Guarantees that even if multiple vendors scan simultaneously, exactly ONE succeeds.
CREATE OR REPLACE FUNCTION claim_order_atomic(
  p_identifier text,
  p_vendor_id text DEFAULT 'Vendor',
  p_vendor_email text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  already_claimed boolean,
  not_found boolean,
  newly_claimed boolean,
  status text,
  order_data jsonb,
  claimed_by text,
  claimed_at timestamptz,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_clean_id text;
  v_clean_vendor text;
  v_now timestamptz;
BEGIN
  v_clean_id := trim(p_identifier);
  v_clean_vendor := COALESCE(NULLIF(trim(p_vendor_id), ''), 'Vendor');
  v_now := clock_timestamp();

  -- 1. ATOMIC CONDITIONAL UPDATE:
  -- Only updates if the order is currently in eligible status ('READY' or 'PENDING_PICKUP')
  -- and payment is confirmed ('PAID' or 'SUCCESS').
  UPDATE public.orders
  SET order_status = 'CLAIMED',
      claimed_by = v_clean_vendor,
      claimed_at = v_now,
      updated_at = v_now
  WHERE (token = v_clean_id OR id = v_clean_id OR UPPER(token) = UPPER(v_clean_id) OR UPPER(id) = UPPER(v_clean_id))
    AND order_status IN ('READY', 'PENDING_PICKUP')
    AND payment_status IN ('PAID', 'SUCCESS')
  RETURNING * INTO v_order;

  -- If the row was updated, this invocation won the race!
  IF FOUND THEN
    RETURN QUERY SELECT
      true AS success,
      false AS already_claimed,
      false AS not_found,
      true AS newly_claimed,
      'SUCCESS'::text AS status,
      to_jsonb(v_order) AS order_data,
      v_order.claimed_by,
      v_order.claimed_at,
      'QR scanned successfully! Order Verified.'::text AS message;
    RETURN;
  END IF;

  -- 2. If no row was updated, inspect existing order state to return exact reason
  SELECT * INTO v_order
  FROM public.orders
  WHERE token = v_clean_id
     OR id = v_clean_id
     OR UPPER(token) = UPPER(v_clean_id)
     OR UPPER(id) = UPPER(v_clean_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false AS success,
      false AS already_claimed,
      true AS not_found,
      false AS newly_claimed,
      'NOT_FOUND'::text AS status,
      NULL::jsonb AS order_data,
      NULL::text AS claimed_by,
      NULL::timestamptz AS claimed_at,
      'Order QR not found or invalid token.'::text AS message;
    RETURN;
  END IF;

  -- If order was already claimed
  IF v_order.order_status = 'CLAIMED' THEN
    RETURN QUERY SELECT
      false AS success,
      true AS already_claimed,
      false AS not_found,
      false AS newly_claimed,
      'ALREADY_CLAIMED'::text AS status,
      to_jsonb(v_order) AS order_data,
      v_order.claimed_by,
      v_order.claimed_at,
      format('This QR code has ALREADY EXPIRED! It was claimed at %s by %s.', to_char(v_order.claimed_at, 'HH12:MI AM'), COALESCE(v_order.claimed_by, 'a vendor'))::text AS message;
    RETURN;
  END IF;

  -- If order is cancelled
  IF v_order.order_status = 'CANCELLED' THEN
    RETURN QUERY SELECT
      false AS success,
      false AS already_claimed,
      false AS not_found,
      false AS newly_claimed,
      'CANCELLED'::text AS status,
      to_jsonb(v_order) AS order_data,
      v_order.claimed_by,
      v_order.claimed_at,
      'This order was CANCELLED and cannot be claimed.'::text AS message;
    RETURN;
  END IF;

  -- If payment is not confirmed
  IF v_order.payment_status NOT IN ('PAID', 'SUCCESS') THEN
    RETURN QUERY SELECT
      false AS success,
      false AS already_claimed,
      false AS not_found,
      false AS newly_claimed,
      'PAYMENT_NOT_CONFIRMED'::text AS status,
      to_jsonb(v_order) AS order_data,
      v_order.claimed_by,
      v_order.claimed_at,
      'Payment is not confirmed for this order.'::text AS message;
    RETURN;
  END IF;

  -- Fallback for any other unexpected status
  RETURN QUERY SELECT
    false AS success,
    false AS already_claimed,
    false AS not_found,
    false AS newly_claimed,
    'INVALID_STATUS'::text AS status,
    to_jsonb(v_order) AS order_data,
    v_order.claimed_by,
    v_order.claimed_at,
    'Order is not in ready state for pickup.'::text AS message;
END;
$$;
