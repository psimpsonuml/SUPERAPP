-- Community Profiles table for Community Scout agent (#7)
-- Stores discovered online communities across Reddit, Facebook, Discord, LinkedIn, Slack

CREATE TABLE IF NOT EXISTS community_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id),
  platform TEXT NOT NULL CHECK (platform IN ('reddit', 'facebook', 'discord', 'linkedin', 'slack')),
  name TEXT NOT NULL,
  url TEXT,
  description TEXT,
  subscriber_count INTEGER,
  activity_score NUMERIC(3,1) DEFAULT 0 CHECK (activity_score BETWEEN 0 AND 10),
  relevance_score NUMERIC(3,1) DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 10),
  overall_score NUMERIC(3,1) DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 10),
  product TEXT NOT NULL,
  rules_json JSONB DEFAULT '{}',
  classification TEXT DEFAULT 'unknown',
  posts_per_day NUMERIC(8,2),
  active_users INTEGER,
  rule_friendliness TEXT DEFAULT 'unknown' CHECK (rule_friendliness IN ('promotion_friendly', 'limited_promotion', 'no_marketing', 'unknown')),
  metadata_json JSONB DEFAULT '{}',
  last_scanned TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (account_id, platform, name)
);

ALTER TABLE community_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "community_profiles_account_isolation" ON community_profiles
  USING (account_id = current_setting('app.account_id', true)::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_community_profiles_product ON community_profiles(account_id, product);
CREATE INDEX IF NOT EXISTS idx_community_profiles_platform ON community_profiles(account_id, platform);
CREATE INDEX IF NOT EXISTS idx_community_profiles_score ON community_profiles(account_id, overall_score DESC);
