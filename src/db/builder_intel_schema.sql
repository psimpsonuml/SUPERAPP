-- Builder Intel table for Builder Community agent
-- Stores intelligence gathered from builder/indie communities

CREATE TABLE IF NOT EXISTS builder_intel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id),
  source TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  summary TEXT,
  product_relevance TEXT,
  intel_type TEXT NOT NULL CHECK (intel_type IN (
    'feature_idea', 'competitive_signal', 'partnership_opportunity',
    'marketing_tactic', 'tech_approach'
  )),
  relevance_score INTEGER DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 10),
  author TEXT,
  metadata_json JSONB DEFAULT '{}',
  date_found TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (account_id, source_url)
);

ALTER TABLE builder_intel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "builder_intel_account_isolation" ON builder_intel
  USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE INDEX idx_builder_intel_date ON builder_intel(account_id, date_found DESC);
CREATE INDEX idx_builder_intel_type ON builder_intel(account_id, intel_type);
CREATE INDEX idx_builder_intel_product ON builder_intel(account_id, product_relevance);

-- Add builder_promo to content_calendar post_type check
-- (Postgres doesn't support ALTER CHECK directly, so we drop and recreate)
ALTER TABLE content_calendar DROP CONSTRAINT IF EXISTS content_calendar_post_type_check;
ALTER TABLE content_calendar ADD CONSTRAINT content_calendar_post_type_check
  CHECK (post_type IN (
    'value_post', 'value_post_with_mention', 'promo_thread_entry',
    'value_engagement', 'question_answer', 'comment_engagement',
    'warmup_comment', 'warmup_upvote', 'manual_review',
    'builder_promo', 'builder_x_post'
  ));
