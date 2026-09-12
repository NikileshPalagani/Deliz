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
