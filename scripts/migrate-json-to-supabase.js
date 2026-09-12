/**
 * ==============================================================================
 * Migration Script: migrate-json-to-supabase.js
 * Description: Reads existing orders.json and payments.json files, validates
 *              their structure, and migrates existing data to Supabase PostgreSQL.
 *              DOES NOT delete original JSON files.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  supabaseAdmin,
  isSupabaseAdminConfigured,
  mapOrderToDb,
  mapPaymentToDb,
} from '../server/supabaseAdmin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

async function runMigration() {
  console.log('\n======================================================');
  console.log('🚀 Campus Bite: JSON to Supabase PostgreSQL Migration');
  console.log('======================================================\n');

  if (!isSupabaseAdminConfigured()) {
    console.error('❌ Supabase Admin credentials not configured.');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.\n');
    process.exit(1);
  }

  let totalOrdersMigrated = 0;
  let totalOrdersSkipped = 0;
  let totalPaymentsMigrated = 0;
  let totalPaymentsSkipped = 0;

  // 1. Migrate Orders
  if (fs.existsSync(ORDERS_FILE)) {
    try {
      const rawData = fs.readFileSync(ORDERS_FILE, 'utf-8');
      const orders = JSON.parse(rawData);

      if (Array.isArray(orders) && orders.length > 0) {
        console.log(`📦 Found ${orders.length} order(s) in ${ORDERS_FILE}. Starting migration...`);

        for (const order of orders) {
          if (!order.id || !order.token) {
            console.warn(`⚠️ Skipping invalid order record:`, order);
            totalOrdersSkipped++;
            continue;
          }

          const dbRow = mapOrderToDb(order);

          // Upsert to prevent duplicate primary key violation
          const { error } = await supabaseAdmin
            .from('orders')
            .upsert(dbRow, { onConflict: 'id' });

          if (error) {
            console.error(`❌ Failed to migrate order #${order.id}:`, error.message);
            totalOrdersSkipped++;
          } else {
            console.log(`✅ Order #${order.id} (${order.studentEmail || 'N/A'}) migrated successfully.`);
            totalOrdersMigrated++;
          }
        }
      } else {
        console.log(`ℹ️ ${ORDERS_FILE} is empty or contains no records. No orders to migrate.`);
      }
    } catch (err) {
      console.error(`❌ Error reading ${ORDERS_FILE}:`, err.message);
    }
  } else {
    console.log(`ℹ️ ${ORDERS_FILE} does not exist. No order data found to migrate.`);
  }

  // 2. Migrate Payments
  if (fs.existsSync(PAYMENTS_FILE)) {
    try {
      const rawData = fs.readFileSync(PAYMENTS_FILE, 'utf-8');
      const payments = JSON.parse(rawData);

      if (Array.isArray(payments) && payments.length > 0) {
        console.log(`\n💳 Found ${payments.length} payment record(s) in ${PAYMENTS_FILE}. Starting migration...`);

        for (const payment of payments) {
          if (!payment.id) {
            totalPaymentsSkipped++;
            continue;
          }

          const dbRow = mapPaymentToDb(payment);

          const { error } = await supabaseAdmin
            .from('payments')
            .upsert(dbRow, { onConflict: 'id' });

          if (error) {
            console.error(`❌ Failed to migrate payment #${payment.id}:`, error.message);
            totalPaymentsSkipped++;
          } else {
            console.log(`✅ Payment #${payment.id} migrated successfully.`);
            totalPaymentsMigrated++;
          }
        }
      } else {
        console.log(`ℹ️ ${PAYMENTS_FILE} is empty or contains no records. No payments to migrate.`);
      }
    } catch (err) {
      console.error(`❌ Error reading ${PAYMENTS_FILE}:`, err.message);
    }
  } else {
    console.log(`ℹ️ ${PAYMENTS_FILE} does not exist. No payment data found to migrate.`);
  }

  console.log('\n======================================================');
  console.log('📊 Migration Summary:');
  console.log(`   - Orders Migrated: ${totalOrdersMigrated}`);
  console.log(`   - Orders Skipped / Errors: ${totalOrdersSkipped}`);
  console.log(`   - Payments Migrated: ${totalPaymentsMigrated}`);
  console.log(`   - Payments Skipped / Errors: ${totalPaymentsSkipped}`);
  console.log('   - Original JSON files preserved: YES');
  console.log('======================================================\n');
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
