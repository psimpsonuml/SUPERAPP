-- BeaconOps Infrastructure Alerts Schema Update
-- Adds product column and check_results table for uptime history

-- Add product column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'infra_alerts' AND column_name = 'product'
  ) THEN
    ALTER TABLE infra_alerts ADD COLUMN product TEXT;
  END IF;
END $$;

-- ── Health Check Results (uptime history) ───────────────────
CREATE TABLE IF NOT EXISTS infra_check_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  service TEXT NOT NULL,          -- 'stripe_cs', 'stripe_pb', 'supabase', 'tmdb', etc.
  check_type TEXT NOT NULL,       -- 'stripe_webhooks', 'api_ping', 'supabase_health', etc.
  status TEXT NOT NULL DEFAULT 'healthy'
    CHECK (status IN ('healthy', 'warning', 'critical', 'error')),
  response_time_ms INTEGER,
  message TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infra_check_results_account ON infra_check_results(account_id);
CREATE INDEX IF NOT EXISTS idx_infra_check_results_service ON infra_check_results(account_id, service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_infra_check_results_created ON infra_check_results(account_id, created_at DESC);

ALTER TABLE infra_check_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "infra_check_results_account" ON infra_check_results FOR ALL
  USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
