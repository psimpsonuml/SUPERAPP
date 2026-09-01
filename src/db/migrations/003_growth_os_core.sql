-- ══════════════════════════════════════════════════════════════════
-- Migration 003 — Payroll Beacon Growth OS core schema
--
-- Reuse decisions (spec §23: "Do not create duplicate tables if
-- equivalent models already exist"):
--
--   content_memory      REUSED for dedup/hashing. growth_content links
--                       to it rather than reimplementing similarity.
--   approval_queue      REUSED as-is. Growth items submit here.
--   dispatch_log        REUSED (migration 002).
--   growth_suppressions ALREADY CREATED in migration 002.
--   content_calendar    NOT reused — its post_type CHECK is Reddit
--                       community-specific ('warmup_comment' etc.) and
--                       its rows are owned by community-scout.
--                       growth_content carries its own scheduled_for.
--
--   prospect_pipeline   NOT extended. It serves three products via
--                       Reddit/X discovery, its `stage` CHECK has a
--                       different vocabulary from the Growth outreach
--                       status model, and it lacks ~20 of the fields
--                       spec §6 requires. Extending it would mean
--                       rewriting the constraint and mixing two funnels
--                       in one table. growth_prospects carries a
--                       nullable legacy_prospect_id for reconciliation.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Settings (safety limits, scoring weights, cadence) ────────────
-- Spec §29: automations may not silently raise these.
CREATE TABLE IF NOT EXISTS growth_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, key)
);

-- ── Campaigns ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'cold' CHECK (campaign_type IN (
    'cold', 'engaged', 'partnership', 'content', 'paid'
  )),
  product TEXT NOT NULL DEFAULT 'payroll_beacon',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft', 'active', 'paused', 'completed', 'archived'
  )),
  goal TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, slug)
);

-- ── Content sources ───────────────────────────────────────────────
-- Everything starts here. Spec §2: no disconnected daily posts.
CREATE TABLE IF NOT EXISTS content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual_topic' CHECK (source_type IN (
    'blog_article', 'compliance_update', 'state_wage_update',
    'local_wage_update', 'local_tax_update', 'payroll_deadline',
    'regulatory_change', 'original_analysis', 'uploaded_notes', 'url',
    'manual_topic', 'database_discovery', 'product_feature', 'faq',
    'user_question', 'pain_point', 'data_study'
  )),
  source_url TEXT,
  raw_text TEXT,
  summary TEXT,
  topic TEXT,
  category TEXT,
  target_audience TEXT,
  states JSONB NOT NULL DEFAULT '[]',
  jurisdictions JSONB NOT NULL DEFAULT '[]',
  -- Spec §32: compliance claims must retain provenance.
  effective_date DATE,
  last_verified_at TIMESTAMPTZ,
  source_confidence TEXT NOT NULL DEFAULT 'unverified' CHECK (source_confidence IN (
    'verified', 'likely', 'unverified', 'needs_research'
  )),
  origin_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'needs_research', 'ready', 'in_use', 'used', 'archived', 'rejected'
  )),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Generated content ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_id UUID REFERENCES content_sources(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN (
    'blog', 'facebook', 'instagram', 'linkedin_company', 'linkedin_personal',
    'x', 'reddit', 'tumblr', 'substack', 'youtube', 'tiktok', 'shorts', 'video'
  )),
  content_type TEXT NOT NULL DEFAULT 'post',
  title TEXT,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  asset_ids JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'generated', 'needs_review', 'approved', 'scheduled',
    'published', 'rejected', 'failed', 'archived'
  )),
  -- Spec §12: personal LinkedIn never auto-publishes.
  requires_manual_posting BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  published_url TEXT,
  approval_item_id UUID REFERENCES approval_queue(id) ON DELETE SET NULL,
  content_memory_id UUID REFERENCES content_memory(id) ON DELETE SET NULL,
  model TEXT,
  prompt_version TEXT,
  edited_by_human BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Content event log (spec §25) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_content_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES growth_content(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'generated', 'edited', 'approved', 'rejected', 'scheduled',
    'published', 'failed', 'clicked', 'converted'
  )),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Assets ────────────────────────────────────────────────────────
-- Spec §4: never substitute placeholder images. A failed generation
-- stays status='failed' with a null file_url.
CREATE TABLE IF NOT EXISTS growth_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_id UUID REFERENCES content_sources(id) ON DELETE SET NULL,
  content_id UUID REFERENCES growth_content(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'infographic', 'quote_card', 'compliance_alert', 'state_comparison',
    'chart', 'carousel', 'thumbnail', 'video_script', 'video_scene_plan', 'image'
  )),
  file_url TEXT,
  prompt TEXT,
  alt_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'generating', 'ready', 'failed'
  )),
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Prospects (Apollo-sourced, payroll fit scored) ────────────────
CREATE TABLE IF NOT EXISTS growth_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,

  title TEXT,
  seniority TEXT,

  email TEXT,
  email_status TEXT NOT NULL DEFAULT 'unknown' CHECK (email_status IN (
    'verified', 'guessed', 'unavailable', 'invalid', 'unknown'
  )),

  linkedin_url TEXT,
  sales_nav_url TEXT,
  linkedin_last_checked_at TIMESTAMPTZ,

  company_name TEXT,
  company_domain TEXT,
  company_size INTEGER,
  industry TEXT,

  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'United States',

  -- Component scores feeding payroll_fit_score (spec §7)
  multi_state_score INTEGER NOT NULL DEFAULT 0,
  remote_score INTEGER NOT NULL DEFAULT 0,
  growth_score INTEGER NOT NULL DEFAULT 0,
  complexity_score INTEGER NOT NULL DEFAULT 0,
  payroll_fit_score INTEGER NOT NULL DEFAULT 0
    CHECK (payroll_fit_score >= 0 AND payroll_fit_score <= 100),
  fit_band TEXT NOT NULL DEFAULT 'ignore' CHECK (fit_band IN (
    'priority', 'good', 'maybe', 'ignore'
  )),
  fit_reason TEXT,
  score_breakdown JSONB NOT NULL DEFAULT '{}',

  research_card JSONB,
  researched_at TIMESTAMPTZ,

  source TEXT NOT NULL DEFAULT 'apollo',
  source_id TEXT,
  campaign_id UUID REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  legacy_prospect_id UUID REFERENCES prospect_pipeline(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'researching', 'ready', 'contacted', 'followup_due', 'replied',
    'positive', 'negative', 'meeting', 'registered', 'converted',
    'disqualified', 'do_not_contact'
  )),

  owner TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  touch_count INTEGER NOT NULL DEFAULT 0,

  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deduplication (spec §30). Partial unique indexes so NULLs don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_prospects_email
  ON growth_prospects (account_id, LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_prospects_linkedin
  ON growth_prospects (account_id, linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_prospects_source
  ON growth_prospects (account_id, source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_prospects_name_company
  ON growth_prospects (account_id, LOWER(full_name), LOWER(company_name));

-- ── Prospect event log (spec §24) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_prospect_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES growth_prospects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'imported', 'enriched', 'scored', 'researched', 'email_queued',
    'email_sent', 'email_opened', 'link_clicked', 'reply_positive',
    'reply_negative', 'linkedin_contacted', 'meeting_booked', 'registered',
    'converted', 'unsubscribed', 'disqualified', 'snoozed'
  )),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Outreach queue ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES growth_prospects(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'linkedin')),
  sequence TEXT NOT NULL DEFAULT 'cold' CHECK (sequence IN ('cold', 'engaged', 'partnership')),
  step_number INTEGER NOT NULL DEFAULT 1,
  subject TEXT,
  body TEXT,
  recommended_asset TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'ready', 'queued', 'sent', 'skipped', 'failed', 'replied'
  )),
  -- LinkedIn is prepare-only; the human performs the action (spec §11).
  requires_manual_send BOOLEAN NOT NULL DEFAULT FALSE,
  approval_item_id UUID REFERENCES approval_queue(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  message_id TEXT,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Cost tracking (spec §17) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  model TEXT,
  operation TEXT,
  content_id UUID REFERENCES growth_content(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES growth_prospects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  units NUMERIC(12,4),
  estimated_cost NUMERIC(12,6) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Attribution (spec §14) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'click' CHECK (event_type IN (
    'click', 'visit', 'signup', 'registration', 'conversion'
  )),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  landing_url TEXT,
  referrer TEXT,
  content_id UUID REFERENCES growth_content(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES growth_prospects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES growth_campaigns(id) ON DELETE SET NULL,
  external_id TEXT,
  value_usd NUMERIC(12,2),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_growth_settings_account ON growth_settings (account_id);
CREATE INDEX IF NOT EXISTS idx_growth_campaigns_account ON growth_campaigns (account_id, status);
CREATE INDEX IF NOT EXISTS idx_content_sources_account ON content_sources (account_id, status);
CREATE INDEX IF NOT EXISTS idx_content_sources_created ON content_sources (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_content_account ON growth_content (account_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_content_source ON growth_content (source_id);
CREATE INDEX IF NOT EXISTS idx_growth_content_scheduled ON growth_content (account_id, scheduled_for)
  WHERE status IN ('approved', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_growth_content_events ON growth_content_events (content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_assets_content ON growth_assets (content_id);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_account ON growth_prospects (account_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_band ON growth_prospects (account_id, fit_band, payroll_fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_followup ON growth_prospects (account_id, next_followup_at)
  WHERE next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_prospects_company ON growth_prospects (account_id, LOWER(company_domain));
CREATE INDEX IF NOT EXISTS idx_growth_prospect_events ON growth_prospect_events (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_outreach_account ON growth_outreach (account_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_outreach_prospect ON growth_outreach (prospect_id);
CREATE INDEX IF NOT EXISTS idx_growth_cost_account ON growth_cost_events (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_cost_service ON growth_cost_events (account_id, service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_attr_account ON growth_attribution_events (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_attr_campaign ON growth_attribution_events (account_id, utm_campaign);

-- ── Row Level Security ────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'growth_settings', 'growth_campaigns', 'content_sources', 'growth_content',
    'growth_content_events', 'growth_assets', 'growth_prospects',
    'growth_prospect_events', 'growth_outreach', 'growth_cost_events',
    'growth_attribution_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (account_id::text = current_setting(''app.account_id'', TRUE))',
      t || '_isolation', t
    );
  END LOOP;
END $$;

COMMIT;
