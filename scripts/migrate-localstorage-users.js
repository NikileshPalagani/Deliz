/**
 * ==============================================================================
 * Migration Utility: migrate-localstorage-users.js
 * Description: Safely imports student profiles & vendor accounts into
 *              Supabase Auth and PostgreSQL profiles/students/vendors tables.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  supabaseAdmin,
  isSupabaseAdminConfigured,
  dbCreateStudentUser,
  dbCreateVendorAccount,
} from '../server/supabaseAdmin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runUserMigration() {
  console.log('\n======================================================');
  console.log('🚀 Campus Bite: Centralized User Migration Script');
  console.log('======================================================\n');

  if (!isSupabaseAdminConfigured()) {
    console.error('❌ Supabase Admin credentials not configured.');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.\n');
    process.exit(1);
  }

  const exportPath = path.join(__dirname, '..', 'data', 'legacy_users_export.json');
  let studentsData = {};
  let vendorsData = {};

  if (fs.existsSync(exportPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
      studentsData = parsed.students || {};
      vendorsData = parsed.vendors || {};
    } catch (e) {
      console.warn('⚠️ Could not parse legacy_users_export.json:', e.message);
    }
  }

  console.log(`📋 Found ${Object.keys(studentsData).length} student record(s) and ${Object.keys(vendorsData).length} vendor record(s) in export file.`);

  let studentsMigrated = 0;
  let studentsSkipped = 0;
  let vendorsMigrated = 0;
  let vendorsSkipped = 0;

  // 1. Migrate Students
  for (const [email, student] of Object.entries(studentsData)) {
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.endsWith('@cvr.ac.in')) {
        console.warn(`⚠️ Skipping non-college email: ${cleanEmail}`);
        studentsSkipped++;
        continue;
      }

      await dbCreateStudentUser({
        email: cleanEmail,
        password: student.password || 'cvrStudent@123',
        name: student.name || cleanEmail.split('@')[0].toUpperCase(),
        phone: student.phone || '',
        rollNo: student.rollNo || cleanEmail.split('@')[0].toUpperCase(),
        block: student.block || 'CB',
      });

      console.log(`✅ Student account created in Supabase: ${cleanEmail}`);
      studentsMigrated++;
    } catch (err) {
      console.error(`❌ Failed to migrate student ${email}:`, err.message);
      studentsSkipped++;
    }
  }

  // 2. Pre-Seed Default Vendors (vendor1 to vendor12)
  console.log('\n🏪 Ensuring default vendors (vendor1 to vendor12) exist in centralized database...');
  for (let i = 1; i <= 12; i++) {
    const vId = `vendor${i}`;
    const customVendor = vendorsData[vId] || {};
    try {
      await dbCreateVendorAccount({
        username: vId,
        password: customVendor.password || vId,
        name: customVendor.name || `Food Counter Vendor #${i}`,
        phone: customVendor.phone || '+91 9876543210',
        stationName: customVendor.stationName || `Counter ${i} - Canteen Block`,
        upiId: customVendor.upiId || `canteen.vendor${i}@okhdfcbank`,
        block: customVendor.block || 'CB',
      });
      vendorsMigrated++;
      console.log(`✅ Vendor @${vId} verified in Supabase PostgreSQL.`);
    } catch (err) {
      console.warn(`ℹ️ Vendor @${vId} already exists or error:`, err.message);
      vendorsSkipped++;
    }
  }

  console.log('\n======================================================');
  console.log('📊 User Migration Summary:');
  console.log(`   - Students Migrated: ${studentsMigrated}`);
  console.log(`   - Students Skipped: ${studentsSkipped}`);
  console.log(`   - Vendors Migrated: ${vendorsMigrated}`);
  console.log(`   - Vendors Skipped: ${vendorsSkipped}`);
  console.log('======================================================\n');
}

runUserMigration().catch((err) => {
  console.error('Fatal user migration error:', err);
  process.exit(1);
});
