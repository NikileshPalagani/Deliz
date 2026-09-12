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
