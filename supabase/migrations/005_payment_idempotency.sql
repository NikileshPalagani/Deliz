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
