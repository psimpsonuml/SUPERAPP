-- BeaconOps Database Schema v2.0
-- Multi-tenant ready with account_id on all tables
-- Designed for Supabase (Postgres + RLS)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ACCOUNTS & CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'personal',
  slider_position INTEGER NOT NULL DEFAULT 60 CHECK (slider_position >= 0 AND slider_position <= 100),
  reduced_ops BOOLEAN NOT NULL DEFAULT FALSE,
  notification_email TEXT,
  notification_push_endpoint TEXT,
  escalation_window_minutes INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  voice_config JSONB NOT NULL DEFAULT '{}',
  language_settings JSONB NOT NULL DEFAULT '["en"]',
  hashtag_sets JSONB NOT NULL DEFAULT '[]',
  prohibited_phrases JSONB NOT NULL DEFAULT '[]',
  emoji_policy TEXT NOT NULL DEFAULT 'minimal',
  platform_adaptations JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, product)
);

-- ============================================================
-- CONTENT ENGINE
-- ============================================================

CREATE TABLE IF NOT EXISTS content_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT,
  content_hash TEXT NOT NULL,
  content_text TEXT,
  keywords JSONB NOT NULL DEFAULT '[]',
  published_at TIMESTAMPTZ,
  engagement_score REAL DEFAULT 0,
  repurpose_chain_id UUID,
  source_content_id UUID REFERENCES content_memory(id),
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_memory_account ON content_memory(account_id);
CREATE INDEX idx_content_memory_product ON content_memory(account_id, product);
CREATE INDEX idx_content_memory_hash ON content_memory(content_hash);
CREATE INDEX idx_content_memory_published ON content_memory(published_at);
CREATE INDEX idx_content_memory_chain ON content_memory(repurpose_chain_id);

CREATE TABLE IF NOT EXISTS keyword_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  product_assigned TEXT NOT NULL,
  last_used TIMESTAMPTZ,
  search_volume INTEGER DEFAULT 0,
  difficulty REAL DEFAULT 0,
  current_ranking INTEGER,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, keyword)
);

CREATE INDEX idx_keyword_map_account ON keyword_map(account_id, product_assigned);

-- ============================================================
-- COMMUNITY & SOCIAL
-- ============================================================

CREATE TABLE IF NOT EXISTS community_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  rules_json JSONB NOT NULL DEFAULT '{}',
  classification TEXT NOT NULL DEFAULT 'unknown',
  relevance_score REAL DEFAULT 0,
  products_relevant JSONB NOT NULL DEFAULT '[]',
  self_promo_policy TEXT,
  frequency_limits JSONB NOT NULL DEFAULT '{}',
  last_scanned TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_profiles_account ON community_profiles(account_id);
CREATE INDEX idx_community_profiles_platform ON community_profiles(account_id, platform);

CREATE TABLE IF NOT EXISTS content_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  product TEXT NOT NULL,
  platform TEXT NOT NULL,
  community_id UUID REFERENCES community_profiles(id),
  post_type TEXT NOT NULL,
  content_preview TEXT,
  content_id UUID REFERENCES content_memory(id),
  status TEXT NOT NULL DEFAULT 'scheduled',
  approval_tier INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_calendar_date ON content_calendar(account_id, scheduled_date);

-- ============================================================
-- OUTREACH & CRM
-- ============================================================

CREATE TABLE IF NOT EXISTS prospect_pipeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  linkedin_url TEXT,
  company TEXT,
  title TEXT,
  product TEXT NOT NULL,
  icp_score REAL DEFAULT 0,
  track TEXT NOT NULL DEFAULT 'user' CHECK (track IN ('user', 'partner')),
  stage TEXT NOT NULL DEFAULT 'discovered' CHECK (stage IN (
    -- End-user pipeline stages (track = 'user')
    'discovered', 'email_drafted', 'contacted', 'replied', 'engaged', 'converted', 'closed_lost',
    -- Partnership pipeline stages (track = 'partner')
    'identified', 'pitch_drafted', 'pitched', 'in_discussion', 'evaluating', 'partnership_active', 'declined'
  )),
  source TEXT,
  last_contacted TIMESTAMPTZ,
  touch_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospect_pipeline_account ON prospect_pipeline(account_id);
CREATE INDEX idx_prospect_pipeline_stage ON prospect_pipeline(account_id, stage);
CREATE INDEX idx_prospect_pipeline_track ON prospect_pipeline(account_id, track);

CREATE TABLE IF NOT EXISTS sending_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  warmup_status TEXT NOT NULL DEFAULT 'pending',
  warmup_started_at TIMESTAMPTZ,
  reputation_score REAL DEFAULT 0,
  daily_volume INTEGER NOT NULL DEFAULT 0,
  max_daily_volume INTEGER NOT NULL DEFAULT 10,
  mailbox_count INTEGER NOT NULL DEFAULT 1,
  blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAIN POINTS & INTELLIGENCE
-- ============================================================

CREATE TABLE IF NOT EXISTS pain_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_url TEXT,
  text TEXT NOT NULL,
  product_relevance TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'low' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  category TEXT,
  action_taken TEXT,
  date_found TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pain_points_account ON pain_points(account_id);
CREATE INDEX idx_pain_points_product ON pain_points(account_id, product_relevance);

CREATE TABLE IF NOT EXISTS product_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  rec_type TEXT NOT NULL CHECK (rec_type IN ('new_feature', 'feature_change', 'feature_removal', 'pricing_adjustment')),
  title TEXT NOT NULL,
  rationale TEXT,
  estimated_effort TEXT,
  expected_impact TEXT,
  source_signals JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'accepted', 'rejected', 'stays')),
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_intelligence_account ON product_intelligence(account_id, product);
CREATE INDEX idx_product_intelligence_status ON product_intelligence(account_id, status);

CREATE TABLE IF NOT EXISTS intelligence_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  intel_type TEXT NOT NULL,
  name TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  estimated_cost REAL,
  roi_estimate TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  date_found TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- QA & TESTING
-- ============================================================

CREATE TABLE IF NOT EXISTS qa_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scenario_id TEXT,
  checks JSONB NOT NULL DEFAULT '{}',
  pass_fail TEXT NOT NULL CHECK (pass_fail IN ('pass', 'fail')),
  bugs JSONB NOT NULL DEFAULT '[]',
  latency_stats JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qa_results_date ON qa_results(account_id, test_date);

-- ============================================================
-- APPROVAL QUEUE
-- ============================================================

CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  content_preview TEXT,
  full_content JSONB NOT NULL DEFAULT '{}',
  tier INTEGER NOT NULL DEFAULT 2 CHECK (tier >= 1 AND tier <= 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved', 'edited')),
  reviewer_notes TEXT,
  auto_approve_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  escalated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_approval_queue_account ON approval_queue(account_id);
CREATE INDEX idx_approval_queue_status ON approval_queue(account_id, status);
CREATE INDEX idx_approval_queue_agent ON approval_queue(account_id, agent_id);

-- ============================================================
-- USER LIFECYCLE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_lifecycle (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  product TEXT NOT NULL,
  email TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ,
  drip_stage TEXT NOT NULL DEFAULT 'registered',
  drip_last_sent TIMESTAMPTZ,
  churned BOOLEAN NOT NULL DEFAULT FALSE,
  churn_detected_at TIMESTAMPTZ,
  winback_touches INTEGER NOT NULL DEFAULT 0,
  review_requested BOOLEAN NOT NULL DEFAULT FALSE,
  referral_invited BOOLEAN NOT NULL DEFAULT FALSE,
  referral_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_lifecycle_account ON user_lifecycle(account_id, product);
CREATE INDEX idx_user_lifecycle_stage ON user_lifecycle(account_id, drip_stage);

-- ============================================================
-- SEASONAL & EVENT CALENDAR
-- ============================================================

CREATE TABLE IF NOT EXISTS event_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  products JSONB NOT NULL DEFAULT '[]',
  content_themes JSONB NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_calendar_dates ON event_calendar(account_id, start_date, end_date);

-- ============================================================
-- AGENT RUNS & INFRASTRUCTURE
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  run_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  inputs_summary TEXT,
  outputs_summary TEXT,
  items_produced INTEGER DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_account ON agent_runs(account_id);
CREATE INDEX idx_agent_runs_agent ON agent_runs(account_id, agent_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);

CREATE TABLE IF NOT EXISTS infra_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_infra_alerts_severity ON infra_alerts(account_id, severity);
CREATE INDEX idx_infra_alerts_resolved ON infra_alerts(account_id, resolved);

-- ============================================================
-- ROW LEVEL SECURITY (Multi-Tenant Isolation)
-- ============================================================

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE sending_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE pain_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE infra_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role bypasses, authenticated users see only their account
CREATE POLICY account_isolation ON brand_profiles FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON content_memory FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON keyword_map FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON community_profiles FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON content_calendar FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON prospect_pipeline FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON sending_domains FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON pain_points FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON product_intelligence FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON intelligence_log FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON qa_results FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON approval_queue FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON user_lifecycle FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON event_calendar FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON agent_runs FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
CREATE POLICY account_isolation ON infra_alerts FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID);
