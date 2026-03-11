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

CREATE INDEX IF NOT EXISTS idx_content_memory_account ON content_memory(account_id);
CREATE INDEX IF NOT EXISTS idx_content_memory_product ON content_memory(account_id, product);
CREATE INDEX IF NOT EXISTS idx_content_memory_hash ON content_memory(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_memory_published ON content_memory(published_at);
CREATE INDEX IF NOT EXISTS idx_content_memory_chain ON content_memory(repurpose_chain_id);

CREATE TABLE IF NOT EXISTS keyword_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  product_assigned TEXT NOT NULL DEFAULT 'unknown',
  last_used TIMESTAMPTZ,
  search_volume_estimate INTEGER DEFAULT 0,
  difficulty_estimate INTEGER DEFAULT 50,
  current_ranking INTEGER,
  next_eligible TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, keyword, product_assigned)
);

CREATE INDEX IF NOT EXISTS idx_keyword_map_account ON keyword_map(account_id, product_assigned);

-- ============================================================
-- COMMUNITY & SOCIAL
-- ============================================================

CREATE TABLE IF NOT EXISTS community_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  description TEXT,
  subscriber_count INTEGER,
  activity_score NUMERIC(3,1) DEFAULT 0,
  overall_score NUMERIC(3,1) DEFAULT 0,
  product TEXT,
  rules_json JSONB NOT NULL DEFAULT '{}',
  rule_friendliness TEXT DEFAULT 'unknown',
  classification TEXT NOT NULL DEFAULT 'unknown',
  relevance_score REAL DEFAULT 0,
  products_relevant JSONB NOT NULL DEFAULT '[]',
  self_promo_policy TEXT,
  frequency_limits JSONB NOT NULL DEFAULT '{}',
  posts_per_day NUMERIC(8,2),
  active_users INTEGER,
  metadata_json JSONB DEFAULT '{}',
  engagement_count INTEGER DEFAULT 0,
  first_engaged_at TIMESTAMPTZ,
  warmup_complete BOOLEAN DEFAULT FALSE,
  last_scanned TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_profiles_account ON community_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_community_profiles_platform ON community_profiles(account_id, platform);

CREATE TABLE IF NOT EXISTS content_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  product TEXT NOT NULL,
  platform TEXT NOT NULL,
  community_id UUID REFERENCES community_profiles(id),
  community_name TEXT,
  post_type TEXT NOT NULL CHECK (post_type IN (
    'value_post', 'value_post_with_mention', 'promo_thread_entry',
    'value_engagement', 'question_answer', 'comment_engagement',
    'warmup_comment', 'warmup_upvote', 'manual_review',
    'builder_promo', 'builder_x_post'
  )),
  content_preview TEXT,
  content_theme TEXT,
  content_draft TEXT,
  rules_summary TEXT,
  content_id UUID REFERENCES content_memory(id),
  status TEXT NOT NULL DEFAULT 'scheduled',
  approval_tier INTEGER NOT NULL DEFAULT 2,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_calendar_date ON content_calendar(account_id, date);

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
  source_url TEXT,
  platform TEXT,
  drafted_email JSONB,
  sent_via TEXT,
  last_contacted TIMESTAMPTZ,
  touch_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_account ON prospect_pipeline(account_id);
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_stage ON prospect_pipeline(account_id, stage);
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_track ON prospect_pipeline(account_id, track);
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_source_url ON prospect_pipeline(account_id, source_url);
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_platform ON prospect_pipeline(account_id, platform);
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_created ON prospect_pipeline(account_id, product, created_at);

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
  subreddit TEXT,
  title TEXT,
  text TEXT NOT NULL,
  product TEXT,
  product_relevance TEXT NOT NULL,
  classification TEXT DEFAULT 'pain_point',
  score INTEGER DEFAULT 0,
  urgency TEXT NOT NULL DEFAULT 'low' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  category TEXT,
  action_taken TEXT,
  drafted_response TEXT,
  response_mentions_product BOOLEAN DEFAULT FALSE,
  reddit_author TEXT,
  reddit_score INTEGER,
  reddit_num_comments INTEGER,
  metadata_json JSONB DEFAULT '{}',
  date_found TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pain_points_account ON pain_points(account_id);
CREATE INDEX IF NOT EXISTS idx_pain_points_product ON pain_points(account_id, product_relevance);

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

CREATE INDEX IF NOT EXISTS idx_product_intelligence_account ON product_intelligence(account_id, product);
CREATE INDEX IF NOT EXISTS idx_product_intelligence_status ON product_intelligence(account_id, status);

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

CREATE INDEX IF NOT EXISTS idx_qa_results_date ON qa_results(account_id, test_date);

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

CREATE INDEX IF NOT EXISTS idx_approval_queue_account ON approval_queue(account_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(account_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_agent ON approval_queue(account_id, agent_id);

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

CREATE INDEX IF NOT EXISTS idx_user_lifecycle_account ON user_lifecycle(account_id, product);
CREATE INDEX IF NOT EXISTS idx_user_lifecycle_stage ON user_lifecycle(account_id, drip_stage);

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

CREATE INDEX IF NOT EXISTS idx_event_calendar_dates ON event_calendar(account_id, start_date, end_date);

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

CREATE INDEX IF NOT EXISTS idx_agent_runs_account ON agent_runs(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(account_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);

CREATE TABLE IF NOT EXISTS infra_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  service TEXT NOT NULL,
  product TEXT,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_infra_alerts_severity ON infra_alerts(account_id, severity);
CREATE INDEX IF NOT EXISTS idx_infra_alerts_resolved ON infra_alerts(account_id, resolved);

CREATE TABLE IF NOT EXISTS infra_check_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'healthy',
  response_time_ms INTEGER,
  message TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- OUTREACH TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospect_pipeline(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT 'user',
  sending_domain TEXT,
  mailbox_email TEXT,
  subject TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_sends_account ON outreach_sends(account_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_prospect ON outreach_sends(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_date ON outreach_sends(account_id, sent_at);

-- ============================================================
-- ENTERTAINMENT MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS entertainment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tmdb_id INTEGER,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'movie',
  year INTEGER,
  poster_path TEXT,
  overview TEXT,
  genres JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, title, item_type),
  UNIQUE(account_id, tmdb_id, item_type)
);

CREATE TABLE IF NOT EXISTS entertainment_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES entertainment_items(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, item_id)
);

CREATE TABLE IF NOT EXISTS entertainment_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES entertainment_items(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  tmdb_person_id INTEGER,
  role TEXT NOT NULL,
  profile_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, item_id, person_name, role)
);

CREATE TABLE IF NOT EXISTS cascade_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  tmdb_person_id INTEGER,
  primary_role TEXT NOT NULL,
  composite_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  weighted_sum NUMERIC(8,2) NOT NULL DEFAULT 0,
  weight_total NUMERIC(8,2) NOT NULL DEFAULT 0,
  ratings_count INTEGER NOT NULL DEFAULT 0,
  item_type TEXT NOT NULL DEFAULT 'movie',
  source_type TEXT NOT NULL DEFAULT 'entertainment',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, person_name, primary_role, item_type)
);

-- ============================================================
-- QUIZ MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  reask_days INTEGER DEFAULT NULL,
  dimension TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_text)
);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_answer TEXT,
  previous_answered_at TIMESTAMPTZ,
  UNIQUE(account_id, question_id)
);

CREATE TABLE IF NOT EXISTS quiz_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  category TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  description TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, dimension)
);

-- ============================================================
-- LIFE MANAGER MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  days_of_week JSONB DEFAULT '[]',
  custom_interval_days INTEGER,
  time_of_day TIME NOT NULL DEFAULT '09:00',
  category TEXT NOT NULL DEFAULT 'personal',
  active BOOLEAN NOT NULL DEFAULT true,
  streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminder_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'completed',
  UNIQUE(reminder_id, completed_date)
);

CREATE TABLE IF NOT EXISTS family_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entry_text TEXT NOT NULL,
  photo_url TEXT,
  child_tag TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BOOKS MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS book_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  open_library_id TEXT,
  title TEXT NOT NULL,
  author TEXT,
  year INTEGER,
  genre TEXT,
  cover_url TEXT,
  page_count INTEGER,
  description TEXT,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, open_library_id),
  UNIQUE(account_id, title, author)
);

CREATE TABLE IF NOT EXISTS book_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES book_items(id) ON DELETE CASCADE,
  score INTEGER CHECK (score >= 1 AND score <= 10),
  status TEXT NOT NULL DEFAULT 'rated',
  notes TEXT,
  rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, book_id)
);

-- ============================================================
-- BUILDER INTEL
-- ============================================================

CREATE TABLE IF NOT EXISTS builder_intel (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  source TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  summary TEXT,
  product_relevance TEXT,
  intel_type TEXT NOT NULL,
  relevance_score INTEGER DEFAULT 0,
  author TEXT,
  metadata_json JSONB DEFAULT '{}',
  date_found TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, source_url)
);

-- ============================================================
-- RELEASE DIGEST
-- ============================================================

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
ALTER TABLE infra_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE entertainment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE entertainment_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE entertainment_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE cascade_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE builder_intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_digest ENABLE ROW LEVEL SECURITY;

-- RLS policies: service role bypasses, authenticated users see only their account
-- Wrapped in DO blocks so they never error on re-run (Postgres has no CREATE POLICY IF NOT EXISTS)
DO $$ BEGIN CREATE POLICY account_isolation ON brand_profiles FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON content_memory FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON keyword_map FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON community_profiles FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON content_calendar FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON prospect_pipeline FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON sending_domains FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON pain_points FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON product_intelligence FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON intelligence_log FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON qa_results FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON approval_queue FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON user_lifecycle FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON event_calendar FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON agent_runs FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON infra_alerts FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON infra_check_results FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON outreach_sends FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON entertainment_items FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON entertainment_ratings FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON entertainment_people FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON cascade_scores FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON quiz_answers FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON quiz_profile FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON reminders FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON reminder_completions FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON family_log FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON book_items FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON book_ratings FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON builder_intel FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON release_digest FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default account
INSERT INTO accounts (id, name, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'BeaconOps Personal', 'personal')
ON CONFLICT (id) DO NOTHING;
