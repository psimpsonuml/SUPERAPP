-- Onboarding Agent: platform assets and setup checklists per product
CREATE TABLE IF NOT EXISTS onboarding_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  product TEXT NOT NULL,
  platform TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_assets_account ON onboarding_assets(account_id, product, platform);
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_assets_unique ON onboarding_assets(account_id, product, platform, asset_type);

CREATE TABLE IF NOT EXISTS onboarding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  product TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, product, platform)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_status_account ON onboarding_status(account_id, product);
