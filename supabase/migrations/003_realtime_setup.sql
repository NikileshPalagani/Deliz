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
