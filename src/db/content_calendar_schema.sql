-- Content Calendar table for Community Strategist agent (#8)
-- Stores rule-aware posting schedule across all communities

CREATE TABLE IF NOT EXISTS content_calendar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id),
  date DATE NOT NULL,
  product TEXT NOT NULL,
  platform TEXT NOT NULL,
  community_id UUID REFERENCES community_profiles(id),
  community_name TEXT,
  post_type TEXT NOT NULL CHECK (post_type IN (
    'value_post', 'value_post_with_mention', 'promo_thread_entry',
    'value_engagement', 'question_answer', 'comment_engagement',
    'warmup_comment', 'warmup_upvote', 'manual_review'
  )),
  content_theme TEXT,
  content_draft TEXT,
  rules_summary TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'approved', 'posted', 'skipped', 'failed')),
  approval_tier INTEGER DEFAULT 2,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "content_calendar_account_isolation" ON content_calendar
  USING (account_id = current_setting('app.account_id', true)::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_content_calendar_date ON content_calendar(account_id, date);
CREATE INDEX IF NOT EXISTS idx_content_calendar_community ON content_calendar(community_id);
CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON content_calendar(account_id, status);

-- Add engagement tracking to community_profiles
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS engagement_count INTEGER DEFAULT 0;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS first_engaged_at TIMESTAMPTZ;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS warmup_complete BOOLEAN DEFAULT FALSE;
