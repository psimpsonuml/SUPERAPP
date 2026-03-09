-- ============================================================
-- SCHEMA RECONCILIATION MIGRATION
-- ============================================================
-- Fixes column mismatches between schema.sql and individual
-- *_schema.sql files. Safe to run multiple times (idempotent).
-- Run this if routes are returning 500 errors due to missing columns.
-- ============================================================

-- ── keyword_map: add missing columns from keyword_map_schema.sql ──
ALTER TABLE keyword_map ADD COLUMN IF NOT EXISTS search_volume_estimate INTEGER DEFAULT 0;
ALTER TABLE keyword_map ADD COLUMN IF NOT EXISTS difficulty_estimate INTEGER DEFAULT 50;
ALTER TABLE keyword_map ADD COLUMN IF NOT EXISTS next_eligible TIMESTAMPTZ;
-- Ensure product_assigned exists (individual schema uses it, main schema may not)
ALTER TABLE keyword_map ADD COLUMN IF NOT EXISTS product_assigned TEXT;
-- Backfill product_assigned from product if it was missing
UPDATE keyword_map SET product_assigned = 'unknown' WHERE product_assigned IS NULL;

-- Drop the old narrow unique constraint and add the wider one
-- (The code uses ON CONFLICT (account_id, keyword, product_assigned))
DO $$
BEGIN
  -- Check if the narrow constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'keyword_map_account_id_keyword_key'
    AND conrelid = 'keyword_map'::regclass
  ) THEN
    ALTER TABLE keyword_map DROP CONSTRAINT keyword_map_account_id_keyword_key;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create the wider unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'keyword_map'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 3
  ) THEN
    ALTER TABLE keyword_map ADD CONSTRAINT keyword_map_account_keyword_product_unique
      UNIQUE (account_id, keyword, product_assigned);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── community_profiles: add missing columns ──────────────────
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS subscriber_count INTEGER;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS activity_score NUMERIC(3,1) DEFAULT 0;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS overall_score NUMERIC(3,1) DEFAULT 0;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS product TEXT;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS rule_friendliness TEXT DEFAULT 'unknown';
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS posts_per_day NUMERIC(8,2);
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS active_users INTEGER;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}';
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS engagement_count INTEGER DEFAULT 0;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS first_engaged_at TIMESTAMPTZ;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS warmup_complete BOOLEAN DEFAULT FALSE;

-- ── content_calendar: add missing columns ────────────────────
-- The individual schema uses 'date', main schema uses 'scheduled_date'
-- Add 'date' if only 'scheduled_date' exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_calendar' AND column_name = 'scheduled_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_calendar' AND column_name = 'date'
  ) THEN
    ALTER TABLE content_calendar RENAME COLUMN scheduled_date TO date;
  END IF;
END $$;

ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS community_name TEXT;
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS content_theme TEXT;
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS content_draft TEXT;
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS rules_summary TEXT;
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}';
ALTER TABLE content_calendar ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Expand post_type check constraint to include all types
ALTER TABLE content_calendar DROP CONSTRAINT IF EXISTS content_calendar_post_type_check;
ALTER TABLE content_calendar ADD CONSTRAINT content_calendar_post_type_check
  CHECK (post_type IN (
    'value_post', 'value_post_with_mention', 'promo_thread_entry',
    'value_engagement', 'question_answer', 'comment_engagement',
    'warmup_comment', 'warmup_upvote', 'manual_review',
    'builder_promo', 'builder_x_post'
  ));

-- ── pain_points: add missing columns from pain_points_schema.sql ──
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS subreddit TEXT;
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS product TEXT;
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'pain_point';
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS drafted_response TEXT;
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS response_mentions_product BOOLEAN DEFAULT FALSE;
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS reddit_author TEXT;
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS reddit_score INTEGER;
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS reddit_num_comments INTEGER;
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}';
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── prospect_pipeline: add outreach columns ──────────────────
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS drafted_email JSONB;
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS sent_via TEXT;

-- ── infra_alerts: add product column ─────────────────────────
ALTER TABLE infra_alerts ADD COLUMN IF NOT EXISTS product TEXT;

-- ── Create tables that only exist in individual schema files ──

-- Entertainment module
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

-- Quiz module
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

-- Life Manager module
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

-- Books module
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

-- Builder Intel
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

-- Infra Check Results (uptime history)
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

-- Outreach Sends
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

-- Release Digest (weekly cached release data)
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

-- ── Seed default account if not exists ───────────────────────
INSERT INTO accounts (id, name, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Personal', 'personal')
ON CONFLICT (id) DO NOTHING;

SELECT 'Schema reconciliation complete' AS status;
