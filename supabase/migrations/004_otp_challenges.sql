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
