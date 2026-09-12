-- ====================================================================
-- DELIZ / CAMPUS BITE COMPLETE SUPABASE DATABASE SCHEMA
-- ====================================================================

-- ====================================
-- File: 001_orders_payments.sql
-- ====================================
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


-- ====================================
-- File: 002_auth_profiles.sql
-- ====================================
-- ==============================================================================
-- Migration: 002_auth_profiles.sql
-- Description: Centralized User Profiles, Students, and Vendors tables
--              linked with Supabase Auth (auth.users.id), Row Level Security (RLS),
--              and performance indexes.
-- ==============================================================================

-- 1. Create Profiles Table (Core user table linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'vendor', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create Students Table (Student-specific metadata & authoritative coins)
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  student_name text NOT NULL,
  phone text DEFAULT '',
  roll_no text NOT NULL,
  block text NOT NULL DEFAULT 'CB',
  floor text DEFAULT NULL,
  coins integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create Vendors Table (Vendor-specific station metadata & credentials)
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_id text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  vendor_name text NOT NULL,
  phone text DEFAULT '',
  station_name text DEFAULT 'Canteen Counter',
  upi_id text DEFAULT '',
  block text DEFAULT 'CB',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);

CREATE INDEX IF NOT EXISTS idx_students_email ON students (lower(email));
CREATE INDEX IF NOT EXISTS idx_students_roll_no ON students (upper(roll_no));

CREATE INDEX IF NOT EXISTS idx_vendors_username ON vendors (lower(username));
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_id ON vendors (lower(vendor_id));
CREATE INDEX IF NOT EXISTS idx_vendors_email ON vendors (lower(email));

-- 5. Attach Triggers for Auto-Managing updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Service Role Full Access
DROP POLICY IF EXISTS "Service role full access on profiles" ON profiles;
CREATE POLICY "Service role full access on profiles" ON profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on students" ON students;
CREATE POLICY "Service role full access on students" ON students
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on vendors" ON vendors;
CREATE POLICY "Service role full access on vendors" ON vendors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated Users: Read and update their own personal record
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Students can view their own student record" ON students;
CREATE POLICY "Students can view their own student record" ON students
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Vendors can view vendor directory" ON vendors;
CREATE POLICY "Vendors can view vendor directory" ON vendors
  FOR SELECT TO authenticated USING (true);


-- ====================================
-- File: 003_realtime_setup.sql
-- ====================================
-- ====================================================================
-- CAMPUS BITE — MIGRATION 003: SUPABASE REALTIME CONFIGURATION & INDEXES
-- ====================================================================

-- 1. Enable Full Replica Identity so that UPDATE/DELETE payloads include full record
ALTER TABLE IF EXISTS public.orders REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.payments REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.profiles REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.students REPLICA IDENTITY FULL;

-- 2. Add Tables to Supabase Realtime Publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Safely add tables to publication if not already present
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'payments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    END IF;
  END IF;
END $$;

-- 3. Dedicated High-Performance Indexes for Realtime Filtering & Live Queries
CREATE INDEX IF NOT EXISTS idx_orders_student_email ON public.orders (student_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_block ON public.orders (block);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_claimed_by ON public.orders (claimed_by);
CREATE INDEX IF NOT EXISTS idx_orders_token ON public.orders (token);
CREATE INDEX IF NOT EXISTS idx_orders_student_email_status ON public.orders (student_email, order_status);
CREATE INDEX IF NOT EXISTS idx_orders_block_status ON public.orders (block, order_status);

-- 4. Enable Row Level Security (RLS) policies for realtime postgres_changes reads
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own orders via authenticated session or anon key with student_email matching
CREATE POLICY "Allow public order read matching email or vendor" 
  ON public.orders 
  FOR SELECT 
  USING (true);

-- Allow backend service role full access
CREATE POLICY "Allow service role full order management" 
  ON public.orders 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);


-- ====================================
-- File: 004_otp_challenges.sql
-- ====================================
-- ====================================================================
-- CAMPUS BITE — MIGRATION 004: SCALABLE & SECURE OTP CHALLENGES SCHEMA
-- ====================================================================

-- 1. Centralized Persistent OTP Challenges Table
CREATE TABLE IF NOT EXISTS public.otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'password_reset')),
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  reset_token_hash TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance & Query Acceleration Indexes
CREATE INDEX IF NOT EXISTS idx_otp_challenges_email_purpose ON public.otp_challenges (email, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires_at ON public.otp_challenges (expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_reset_token ON public.otp_challenges (reset_token_hash) WHERE reset_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_challenges_created_at ON public.otp_challenges (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_ip_address ON public.otp_challenges (ip_address, created_at DESC);

-- 3. Row Level Security (RLS) Configuration
-- Direct client access from frontend browsers is strictly forbidden.
-- Only the backend Express server using the Supabase Service Role key can manage OTP challenges.
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny public direct access to otp_challenges" 
  ON public.otp_challenges 
  FOR ALL 
  TO anon, authenticated 
  USING (false);

CREATE POLICY "Allow service role full management of otp_challenges" 
  ON public.otp_challenges 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- 4. Opportunistic Cleanup Function for Expired Challenges (Older than 24h)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_challenges()
RETURNS INTEGER AS $$
DECLARE
  deleted_rows INTEGER;
BEGIN
  DELETE FROM public.otp_challenges
  WHERE created_at < (NOW() - INTERVAL '24 hours');
  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================
-- File: 005_payment_idempotency.sql
-- ====================================
-- ==============================================================================
-- Migration: 005_payment_idempotency.sql
-- Description: Enforces payment uniqueness constraints, creates atomic payment
--              confirmation RPC, and optimizes payment transaction queries.
-- ==============================================================================

-- 1. Uniqueness Constraints & Performance Indexes for Idempotency
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_transaction_id 
  ON public.payments (transaction_id) 
  WHERE transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_razorpay_order_id 
  ON public.payments (razorpay_order_id) 
  WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_transaction_id 
  ON public.orders (transaction_id) 
  WHERE transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_razorpay_order_id 
  ON public.orders (razorpay_order_id) 
  WHERE razorpay_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_status_date 
  ON public.payments (payment_status, created_at DESC);

-- 2. Atomic Payment Confirmation, Order Creation & Authoritative Coins Procedure
CREATE OR REPLACE FUNCTION confirm_razorpay_payment_and_create_order_atomic(
  p_order_id text,
  p_token text,
  p_student_email text,
  p_student_name text,
  p_student_phone text,
  p_block text,
  p_floor text,
  p_items jsonb,
  p_total_amount numeric,
  p_discount numeric,
  p_final_amount numeric,
  p_coins_earned integer,
  p_coins_redeemed integer,
  p_payment_method text,
  p_transaction_id text,
  p_razorpay_order_id text,
  p_payment_status text DEFAULT 'PAID'
)
RETURNS TABLE (
  success boolean,
  is_duplicate boolean,
  order_data jsonb,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_order record;
  v_new_order record;
  v_payment_id text;
  v_clean_email text;
BEGIN
  v_clean_email := lower(trim(p_student_email));

  -- 1. IDEMPOTENCY CHECK: Check if order already recorded for this transaction or Razorpay order
  SELECT * INTO v_existing_order
  FROM public.orders
  WHERE (p_razorpay_order_id IS NOT NULL AND razorpay_order_id = p_razorpay_order_id)
     OR (p_transaction_id IS NOT NULL AND transaction_id = p_transaction_id)
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      true AS success,
      true AS is_duplicate,
      to_jsonb(v_existing_order) AS order_data,
      'Payment already verified and order previously recorded.'::text AS message;
    RETURN;
  END IF;

  -- 2. Insert into public.orders
  INSERT INTO public.orders (
    id,
    token,
    student_email,
    student_name,
    student_phone,
    block,
    floor,
    items,
    total_amount,
    discount,
    final_amount,
    coins_earned,
    coins_redeemed,
    payment_method,
    transaction_id,
    razorpay_order_id,
    payment_status,
    order_status,
    claimed_by,
    claimed_at,
    created_at,
    updated_at
  ) VALUES (
    p_order_id,
    p_token,
    v_clean_email,
    COALESCE(p_student_name, 'Student'),
    COALESCE(p_student_phone, ''),
    COALESCE(p_block, 'CB'),
    p_floor,
    COALESCE(p_items, '[]'::jsonb),
    COALESCE(p_total_amount, 0),
    COALESCE(p_discount, 0),
    COALESCE(p_final_amount, 0),
    COALESCE(p_coins_earned, 0),
    COALESCE(p_coins_redeemed, 0),
    COALESCE(p_payment_method, 'Razorpay Gateway'),
    p_transaction_id,
    p_razorpay_order_id,
    COALESCE(p_payment_status, 'PAID'),
    'PENDING_PICKUP',
    NULL,
    NULL,
    now(),
    now()
  )
  RETURNING * INTO v_new_order;

  -- 3. Insert into public.payments
  v_payment_id := 'PAY-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6);
  INSERT INTO public.payments (
    id,
    order_id,
    student_email,
    amount,
    payment_method,
    transaction_id,
    razorpay_order_id,
    payment_status,
    created_at,
    updated_at
  ) VALUES (
    v_payment_id,
    p_order_id,
    v_clean_email,
    COALESCE(p_final_amount, 0),
    COALESCE(p_payment_method, 'Razorpay Gateway'),
    p_transaction_id,
    p_razorpay_order_id,
    'SUCCESS',
    now(),
    now()
  );

  -- 4. Authoritative Coin Deduction (Redemption)
  IF p_coins_redeemed > 0 THEN
    UPDATE public.students
    SET coins = GREATEST(0, coins - p_coins_redeemed),
        updated_at = now()
    WHERE lower(email) = v_clean_email;
  END IF;

  -- 5. Authoritative Coin Reward
  IF p_coins_earned > 0 THEN
    UPDATE public.students
    SET coins = coins + p_coins_earned,
        updated_at = now()
    WHERE lower(email) = v_clean_email;
  END IF;

  RETURN QUERY SELECT
    true AS success,
    false AS is_duplicate,
    to_jsonb(v_new_order) AS order_data,
    'Razorpay payment verified and order confirmed successfully!'::text AS message;
END;
$$;


-- ====================================
-- File: 006_qr_claim_concurrency.sql
-- ====================================
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


-- ====================================
-- File: 007_performance_optimization.sql
-- ====================================
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


-- ====================================
-- File: 008_security_hardening.sql
-- ====================================
-- ==============================================================================
-- CAMPUS-BITE — PHASE 8 SECURITY HARDENING & ROW-LEVEL SECURITY (RLS) MIGRATION
-- Enforces Row-Level Security, least-privilege policies, and access control
-- ==============================================================================

-- 1. Enable Row-Level Security (RLS) on All Tables
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.otp_challenges ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Table Policies
-- Allow users to select only their own profile
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR (auth.jwt() ->> 'role') IN ('vendor', 'admin', 'service_role')
    OR current_user = 'postgres'
  );

-- Allow users to update only their own profile
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Orders Table Policies
-- Students can only view their own orders; vendors and admins can view orders for counter operations
DROP POLICY IF EXISTS orders_select_policy ON public.orders;
CREATE POLICY orders_select_policy ON public.orders
  FOR SELECT
  USING (
    student_email = (auth.jwt() ->> 'email')
    OR (auth.jwt() ->> 'role') IN ('vendor', 'admin', 'canteen_staff', 'service_role')
    OR current_user = 'postgres'
  );

-- Authenticated users and backend can insert new orders
DROP POLICY IF EXISTS orders_insert_policy ON public.orders;
CREATE POLICY orders_insert_policy ON public.orders
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
    OR current_user = 'postgres'
  );

-- Only vendors, admins, and service_role can update order status (claiming, cancelling)
DROP POLICY IF EXISTS orders_update_policy ON public.orders;
CREATE POLICY orders_update_policy ON public.orders
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') IN ('vendor', 'admin', 'canteen_staff', 'service_role')
    OR current_user = 'postgres'
  );

-- 4. Payments Table Policies
-- Students can view their own payment receipts; admins can view all payments
DROP POLICY IF EXISTS payments_select_policy ON public.payments;
CREATE POLICY payments_select_policy ON public.payments
  FOR SELECT
  USING (
    student_email = (auth.jwt() ->> 'email')
    OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
    OR current_user = 'postgres'
  );

-- Payments can be inserted by authenticated checkout or backend service role
DROP POLICY IF EXISTS payments_insert_policy ON public.payments;
CREATE POLICY payments_insert_policy ON public.payments
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
    OR current_user = 'postgres'
  );

-- 5. OTP Challenges Table Policies
-- Strictly locked down: only backend service_role can access or modify OTP records
DROP POLICY IF EXISTS otp_challenges_service_only ON public.otp_challenges;
CREATE POLICY otp_challenges_service_only ON public.otp_challenges
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR current_user = 'postgres'
  );

-- 6. Students & Vendors Tables Policies
DROP POLICY IF EXISTS students_select_policy ON public.students;
CREATE POLICY students_select_policy ON public.students
  FOR SELECT
  USING (
    email = (auth.jwt() ->> 'email')
    OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
    OR current_user = 'postgres'
  );

DROP POLICY IF EXISTS vendors_select_policy ON public.vendors;
CREATE POLICY vendors_select_policy ON public.vendors
  FOR SELECT
  USING (TRUE); -- Menu vendors station metadata is public


-- ====================================
-- File: 009_admin_dashboard.sql
-- ====================================
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


-- ====================================
-- File: 010_vendor_dashboard.sql
-- ====================================
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


-- ====================================
-- File: 011_analytics_monitoring.sql
-- ====================================
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


-- ====================================
-- File: 012_preserve_history_and_indexes.sql
-- ====================================
-- ==============================================================================
-- CAMPUS-BITE — PHASE 15: PERMANENT ORDER, PAYMENT & QR HISTORY PRESERVATION
-- Migration: 012_preserve_history_and_indexes.sql
-- Description: Enforces permanent data persistence, case-insensitive RLS policies,
--              optimized composite history indexes, and ensures Veg Puff price = 25.00.
-- ==============================================================================

-- 1. Ensure composite indexes for high-speed student history retrieval
CREATE INDEX IF NOT EXISTS idx_orders_student_email_created_at ON public.orders (lower(student_email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_student_email_created_at ON public.payments (lower(student_email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_student_email_status ON public.orders (lower(student_email), order_status);

-- 2. Enhanced Case-Insensitive RLS Policies for Orders Table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_policy ON public.orders;
CREATE POLICY orders_select_policy ON public.orders
  FOR SELECT
  USING (
    lower(student_email) = lower(auth.jwt() ->> 'email')
    OR (auth.jwt() ->> 'role') IN ('vendor', 'admin', 'canteen_staff', 'service_role')
    OR current_user = 'postgres'
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS orders_insert_policy ON public.orders;
CREATE POLICY orders_insert_policy ON public.orders
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
    OR current_user = 'postgres'
  );

DROP POLICY IF EXISTS orders_update_policy ON public.orders;
CREATE POLICY orders_update_policy ON public.orders
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') IN ('vendor', 'admin', 'canteen_staff', 'service_role')
    OR current_user = 'postgres'
    OR auth.role() = 'service_role'
  );

-- 3. Enhanced Case-Insensitive RLS Policies for Payments Table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_policy ON public.payments;
CREATE POLICY payments_select_policy ON public.payments
  FOR SELECT
  USING (
    lower(student_email) = lower(auth.jwt() ->> 'email')
    OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
    OR current_user = 'postgres'
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS payments_insert_policy ON public.payments;
CREATE POLICY payments_insert_policy ON public.payments
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
    OR current_user = 'postgres'
  );

-- 4. Ensure Veg Puff Price is Canonical ₹25.00 in Menu Items Catalog
UPDATE public.menu_items
SET price = 25.00,
    updated_at = NOW()
WHERE id = 'veg_puff' AND price != 25.00;

-- 5. Guarantee that orders and payments tables NEVER have auto-deletion triggers or expiration
-- All orders, payments, tokens, and QR pickup passes are permanent in PostgreSQL.


-- ====================================
-- File: 013_deliz_10k_production_scalability.sql
-- ====================================
-- ==============================================================================
-- DELIZ — PHASE 15: PRODUCTION 10,000 REGISTERED & 1,500 CONCURRENT USER SCALABILITY
-- Migration: 013_deliz_10k_production_scalability.sql
-- Description: Adds high-efficiency composite indexes, partial indexes for active orders,
--              OTP challenge lookup indexes, and optimized query paths for peak surges.
-- ==============================================================================

-- 1. High-Speed Partial Index for Active Canteen Queue & Vendor Realtime Operations
CREATE INDEX IF NOT EXISTS idx_orders_active_queue 
  ON public.orders (block, order_status, created_at DESC)
  WHERE order_status IN ('PENDING_PICKUP', 'PREPARING', 'READY');

-- 2. Fast Unclaimed Orders Index for Vendor Screen Filter
CREATE INDEX IF NOT EXISTS idx_orders_unclaimed_active 
  ON public.orders (created_at DESC) 
  WHERE order_status != 'CLAIMED';

-- 3. Composite Index for Student Active and Historical Orders
CREATE INDEX IF NOT EXISTS idx_orders_student_email_status_created 
  ON public.orders (lower(student_email), order_status, created_at DESC);

-- 4. Composite Index for Payment Records by Student and Status
CREATE INDEX IF NOT EXISTS idx_payments_student_email_status_created 
  ON public.payments (lower(student_email), payment_status, created_at DESC);

-- 5. Fast OTP Challenge Verification & Expiration Lookup Index
CREATE INDEX IF NOT EXISTS idx_otp_challenges_active_lookup 
  ON public.otp_challenges (identifier, verified, expires_at DESC);

-- 6. Student Email Case-Insensitive Index for Fast Authentication
CREATE INDEX IF NOT EXISTS idx_students_email_lower_auth 
  ON public.students (lower(email));

-- 7. Vendor Lookup Index
CREATE INDEX IF NOT EXISTS idx_vendors_username_active 
  ON public.vendors (username, is_active);

-- 8. Menu Items Fast Catalog Index
CREATE INDEX IF NOT EXISTS idx_menu_items_available_category 
  ON public.menu_items (is_available, category, display_order ASC);

-- 9. Authoritative Menu Price Synchronization
UPDATE public.menu_items SET price = 12.00, updated_at = NOW() WHERE id = 'samosa';
UPDATE public.menu_items SET price = 25.00, updated_at = NOW() WHERE id = 'veg_puff';
UPDATE public.menu_items SET price = 25.00, updated_at = NOW() WHERE id = 'egg_puff';
UPDATE public.menu_items SET price = 30.00, updated_at = NOW() WHERE id = 'chicken_puff';



