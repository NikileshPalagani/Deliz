import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Testing Supabase connection to:", supabaseUrl);
  
  // Test otp_challenges table
  const { data: otpData, error: otpError } = await supabase
    .from('otp_challenges')
    .select('*')
    .limit(1);
  console.log("otp_challenges table result:", { otpData, otpError });

  // Test profiles table
  const { data: profData, error: profError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  console.log("profiles table result:", { profData, profError });

  // Test orders table
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .limit(1);
  console.log("orders table result:", { orderData, orderError });
}

check();
