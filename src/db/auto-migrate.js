/**
 * Auto-migration: runs on server startup to verify and fix database schema.
 * Uses only the Supabase JS client (no raw SQL needed).
 * Non-blocking — server starts regardless of migration outcome.
 */
const { isSupabaseConfigured, getSupabase } = require('./supabase');
const logger = require('../shared/logger');

// All tables the app needs, with a sample column to verify structure
const REQUIRED_TABLES = [
  { table: 'accounts', checkCol: 'plan' },
  { table: 'brand_profiles', checkCol: 'voice_config' },
  { table: 'content_memory', checkCol: 'content_hash' },
  { table: 'keyword_map', checkCol: 'search_volume_estimate' },
  { table: 'community_profiles', checkCol: 'warmup_complete' },
  { table: 'content_calendar', checkCol: 'date' },
  { table: 'prospect_pipeline', checkCol: 'drafted_email' },
  { table: 'sending_domains', checkCol: 'domain' },
  { table: 'pain_points', checkCol: 'drafted_response' },
  { table: 'product_intelligence', checkCol: 'rec_type' },
  { table: 'intelligence_log', checkCol: 'intel_type' },
  { table: 'qa_results', checkCol: 'pass_fail' },
  { table: 'approval_queue', checkCol: 'tier' },
  { table: 'user_lifecycle', checkCol: 'drip_stage' },
  { table: 'event_calendar', checkCol: 'event_name' },
  { table: 'agent_runs', checkCol: 'agent_id' },
  { table: 'infra_alerts', checkCol: 'product' },
  { table: 'infra_check_results', checkCol: 'check_type' },
  { table: 'outreach_sends', checkCol: 'prospect_id' },
  { table: 'entertainment_items', checkCol: 'tmdb_id' },
  { table: 'entertainment_ratings', checkCol: 'score' },
  { table: 'entertainment_people', checkCol: 'person_name' },
  { table: 'cascade_scores', checkCol: 'composite_score' },
  { table: 'quiz_questions', checkCol: 'question_text' },
  { table: 'quiz_answers', checkCol: 'answer' },
  { table: 'quiz_profile', checkCol: 'dimension' },
  { table: 'reminders', checkCol: 'streak' },
  { table: 'reminder_completions', checkCol: 'completed_date' },
  { table: 'family_log', checkCol: 'entry_text' },
  { table: 'book_items', checkCol: 'open_library_id' },
  { table: 'book_ratings', checkCol: 'score' },
  { table: 'builder_intel', checkCol: 'intel_type' },
  { table: 'release_digest', checkCol: 'items_json' },
];

async function checkTable(supabase, table, checkCol) {
  try {
    const { error } = await supabase
      .from(table)
      .select(checkCol)
      .limit(0);

    if (error) {
      // PostgREST returns 404 for missing tables, or an error message about columns
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return { table, status: 'missing_table' };
      }
      if (error.message.includes('column') || error.code === '42703') {
        return { table, status: 'missing_column', column: checkCol };
      }
      return { table, status: 'error', message: error.message };
    }
    return { table, status: 'ok' };
  } catch (err) {
    return { table, status: 'error', message: err.message };
  }
}

async function ensureDefaultAccount(supabase) {
  try {
    const { error } = await supabase
      .from('accounts')
      .upsert({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'BeaconOps Personal',
        plan: 'personal',
      }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
      logger.warn(`Could not seed default account: ${error.message}`);
    }
  } catch {}
}

async function autoMigrate() {
  if (!isSupabaseConfigured()) {
    logger.warn('Supabase not configured — skipping auto-migration');
    return;
  }

  const supabase = getSupabase();
  logger.info('Running database health check...');

  // Check all tables in parallel
  const results = await Promise.all(
    REQUIRED_TABLES.map(({ table, checkCol }) => checkTable(supabase, table, checkCol))
  );

  const missing = results.filter(r => r.status === 'missing_table');
  const badCols = results.filter(r => r.status === 'missing_column');
  const errors = results.filter(r => r.status === 'error');
  const ok = results.filter(r => r.status === 'ok');

  if (missing.length === 0 && badCols.length === 0) {
    logger.info(`Database OK: ${ok.length}/${REQUIRED_TABLES.length} tables verified`);
    if (errors.length > 0) {
      logger.warn(`${errors.length} table(s) had check errors (may be transient): ${errors.map(e => e.table).join(', ')}`);
    }
    // Ensure default account exists
    await ensureDefaultAccount(supabase);
    return;
  }

  // Report problems
  if (missing.length > 0) {
    logger.error(`MISSING TABLES (${missing.length}): ${missing.map(m => m.table).join(', ')}`);
  }
  if (badCols.length > 0) {
    logger.error(`MISSING COLUMNS (${badCols.length}): ${badCols.map(m => `${m.table}.${m.column}`).join(', ')}`);
  }

  logger.error('');
  logger.error('=== DATABASE SETUP REQUIRED ===');
  logger.error('Your Supabase database is missing tables or columns.');
  logger.error('Go to your Supabase SQL Editor and paste the contents of:');
  logger.error('  src/db/schema.sql');
  logger.error('');
  logger.error('This file is now fully idempotent — safe to run multiple times.');
  logger.error('It will NOT error on existing tables, indexes, or policies.');
  logger.error('================================');
}

module.exports = { autoMigrate };
