import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n======================================================');
console.log('🔍 SUPABASE EMAIL OTP DIAGNOSTIC & VERIFICATION TEST');
console.log('======================================================');

console.log(`📌 Supabase URL: ${supabaseUrl || '(Not set in .env)'}`);
console.log(`📌 Anon Key:     ${supabaseAnonKey ? `${supabaseAnonKey.substring(0, 15)}...` : '(Not set in .env)'}`);

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-ref')) {
  console.log('\n⚠️  [CONFIGURATION REQUIRED]');
  console.log('Please add your actual Supabase project credentials in .env:');
  console.log('SUPABASE_URL=https://<your-project-ref>.supabase.co');
  console.log('SUPABASE_ANON_KEY=<your-anon-key>');
  console.log('VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co');
  console.log('VITE_SUPABASE_ANON_KEY=<your-anon-key>\n');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const testEmail = process.argv[2] || 'test_student@cvr.ac.in';

console.log(`\n🚀 Testing signInWithOtp for: ${testEmail}...`);

try {
  const startTime = Date.now();
  const { data, error } = await supabase.auth.signInWithOtp({
    email: testEmail,
    options: {
      shouldCreateUser: true,
    },
  });
  const duration = Date.now() - startTime;

  console.log(`⏱️  Request completed in ${duration}ms`);

  if (error) {
    console.log('\n❌ [SUPABASE AUTH ERROR RETURNED]');
    console.log('Status Code:', error.status);
    console.log('Error Name:', error.name);
    console.log('Error Message:', error.message);
    console.log('Raw Error Object:', JSON.stringify(error, null, 2));

    if (error.message?.toLowerCase().includes('rate limit') || error.code === 'over_email_send_rate_limit') {
      console.log('\n💡 [DIAGNOSIS: Supabase Email Rate Limit]');
      console.log('• The default Supabase built-in SMTP allows only 3 emails per hour.');
      console.log('• Solution: In Supabase Dashboard -> Authentication -> Email Settings, configure Custom SMTP (e.g. via Resend, SendGrid, or Brevo).');
    } else if (error.message?.toLowerCase().includes('disabled')) {
      console.log('\n💡 [DIAGNOSIS: Email Provider Disabled]');
      console.log('• In Supabase Dashboard -> Authentication -> Providers -> Email, toggle "Enable Email Provider" to ON.');
    }
  } else {
    console.log('\n✅ [SUCCESS: OTP DISPATCHED VIA SUPABASE]');
    console.log('Raw Response Data:', JSON.stringify(data, null, 2));
    console.log(`✨ Supabase successfully triggered email OTP dispatch to ${testEmail}!`);
  }
} catch (err) {
  console.error('\n💥 Unexpected network/client exception:', err);
}

console.log('======================================================\n');
