-- BeaconOps Release Digest Schema
-- Caches weekly release digests with personalization data

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS release_digest (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  items_json JSONB NOT NULL DEFAULT '{}',
  personalization_json JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_release_digest_account ON release_digest(account_id);
CREATE INDEX IF NOT EXISTS idx_release_digest_week ON release_digest(account_id, week_start DESC);

ALTER TABLE release_digest ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "release_digest_account" ON release_digest FOR ALL USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
