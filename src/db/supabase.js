const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('Supabase URL and service key must be configured');
    }
    // The migration set installs into its own Postgres schema (default
    // `beacon`) so it cannot collide with tables the host site already
    // owns — see src/db/migrations/run.js. Every query has to be told
    // to look there; PostgREST also has to be told, in
    // Supabase → Project Settings → API → Exposed schemas.
    supabaseClient = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
      db: { schema: config.supabase.schema },
    });
  }
  return supabaseClient;
}

function isSupabaseConfigured() {
  const url = config.supabase.url;
  const key = config.supabase.serviceKey;
  if (!url || !key) return false;
  // Reject placeholder values from .env.example
  if (url.includes('your-project') || key.startsWith('your-')) return false;
  return true;
}

module.exports = { getSupabase, isSupabaseConfigured };
