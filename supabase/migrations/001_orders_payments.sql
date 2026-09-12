-- ==============================================================================
-- Migration: 001_orders_payments.sql
-- Description: Creates orders and payments tables with optimized indexes,
--              Row Level Security (RLS), and atomic order claim procedure.
-- ==============================================================================

-- 1. Helper function to maintain updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  token text NOT NULL UNIQUE,
  student_email text NOT NULL,
  student_name text NOT NULL,
  student_phone text DEFAULT '',
  block text NOT NULL,
  floor text DEFAULT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric(10, 2) NOT NULL DEFAULT 0.00,
  discount numeric(10, 2) NOT NULL DEFAULT 0.00,
  final_amount numeric(10, 2) NOT NULL DEFAULT 0.00,
  coins_earned integer NOT NULL DEFAULT 0,
  coins_redeemed integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'UPI',
  transaction_id text,
  razorpay_order_id text,
  payment_status text NOT NULL DEFAULT 'PAID',
  order_status text NOT NULL DEFAULT 'PENDING_PICKUP',
  claimed_by text DEFAULT NULL,
  claimed_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  student_email text NOT NULL,
  amount numeric(10, 2) NOT NULL DEFAULT 0.00,
  payment_method text NOT NULL DEFAULT 'UPI',
  transaction_id text,
  razorpay_order_id text,
  payment_status text NOT NULL DEFAULT 'SUCCESS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create Targeted Performance Indexes
CREATE INDEX IF NOT EXISTS idx_orders_student_email ON orders (lower(student_email));
CREATE INDEX IF NOT EXISTS idx_orders_token ON orders (token);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_block ON orders (block);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders (transaction_id) WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_email ON payments (lower(student_email));
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments (transaction_id) WHERE transaction_id IS NOT NULL;

-- 5. Attach Trigger for Updated_At Auto-Management
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Atomic Order Claim Stored Procedure
CREATE OR REPLACE FUNCTION claim_order_atomic(
  p_identifier text,
  p_vendor_id text DEFAULT 'Vendor'
)
RETURNS TABLE (
  success boolean,
  already_claimed boolean,
  not_found boolean,
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
BEGIN
  -- 1. Attempt atomic conditional update on pending order
  UPDATE orders
  SET order_status = 'CLAIMED',
      claimed_by = COALESCE(p_vendor_id, 'Vendor'),
      claimed_at = now(),
      updated_at = now()
  WHERE (id = p_identifier OR token = p_identifier OR UPPER(id) = UPPER(p_identifier) OR UPPER(token) = UPPER(p_identifier))
    AND order_status = 'PENDING_PICKUP'
  RETURNING * INTO v_order;

  IF FOUND THEN
    RETURN QUERY SELECT
      true AS success,
      false AS already_claimed,
      false AS not_found,
      to_jsonb(v_order) AS order_data,
      v_order.claimed_by,
      v_order.claimed_at,
      'QR scanned successfully! Order Verified.'::text AS message;
    RETURN;
  END IF;

  -- 2. Check if order exists to distinguish already claimed vs not found
  SELECT * INTO v_order FROM orders
  WHERE (id = p_identifier OR token = p_identifier OR UPPER(id) = UPPER(p_identifier) OR UPPER(token) = UPPER(p_identifier))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false AS success,
      false AS already_claimed,
      true AS not_found,
      NULL::jsonb AS order_data,
      NULL::text AS claimed_by,
      NULL::timestamptz AS claimed_at,
      'Order QR not found or invalid token.'::text AS message;
    RETURN;
  END IF;

  -- 3. Order was found but already claimed
  RETURN QUERY SELECT
    false AS success,
    true AS already_claimed,
    false AS not_found,
    to_jsonb(v_order) AS order_data,
    v_order.claimed_by,
    v_order.claimed_at,
    ('This QR code has ALREADY EXPIRED! It was claimed at ' || to_char(v_order.claimed_at, 'HH12:MI:SS AM') || ' by ' || COALESCE(v_order.claimed_by, 'a vendor') || '.')::text AS message;
END;
$$;

-- 7. Configure Row Level Security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow backend service role complete access
DROP POLICY IF EXISTS "Service role full access on orders" ON orders;
CREATE POLICY "Service role full access on orders" ON orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on payments" ON payments;
CREATE POLICY "Service role full access on payments" ON payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
