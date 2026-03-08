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
  return !!(config.supabase.url && config.supabase.serviceKey);
}

module.exports = { getSupabase, isSupabaseConfigured };
