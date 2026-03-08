-- BeaconOps Pain Points Schema
-- Stores Reddit-sourced pain points classified by the Pain Point Hunter agent

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS pain_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'reddit',          -- 'reddit', 'twitter', 'forum', etc.
  source_url TEXT,                                 -- direct link to the post
  subreddit TEXT,                                  -- e.g. 'r/payroll'
  title TEXT,                                      -- post title
  text TEXT NOT NULL,                              -- post body or comment text
  product TEXT,                                    -- 'chronostates', 'payroll_beacon', 'budgeting_beacon'
  product_relevance TEXT,                          -- alias for backward compat
  classification TEXT DEFAULT 'pain_point'
    CHECK (classification IN ('pain_point', 'feature_request', 'complaint', 'question', 'opportunity')),
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 10),
  urgency TEXT DEFAULT 'medium'
    CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  drafted_response TEXT,                           -- AI-drafted helpful response
  response_mentions_product BOOLEAN DEFAULT FALSE,
  action_taken TEXT DEFAULT 'none'
    CHECK (action_taken IN ('none', 'responded', 'bookmarked', 'dismissed')),
  category TEXT,                                   -- 'feature_gap', 'pricing', 'ux', etc.
  reddit_author TEXT,                              -- post author
  reddit_score INTEGER,                            -- post karma
  reddit_num_comments INTEGER,                     -- engagement signal
  metadata_json JSONB DEFAULT '{}',
  date_found TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pain_points_account ON pain_points(account_id);
CREATE INDEX IF NOT EXISTS idx_pain_points_date ON pain_points(account_id, date_found DESC);
CREATE INDEX IF NOT EXISTS idx_pain_points_product ON pain_points(account_id, product);
CREATE INDEX IF NOT EXISTS idx_pain_points_score ON pain_points(account_id, score DESC);

ALTER TABLE pain_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pain_points_account" ON pain_points FOR ALL USING (account_id = current_setting('app.account_id')::uuid);
