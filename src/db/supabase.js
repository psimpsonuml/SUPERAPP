const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('Supabase URL and service key must be configured');
    }
    supabaseClient = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
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
