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

