-- Substack Publisher: newsletter_editions table for tracking daily newsletters
-- Linked to content_memory via content_id

CREATE TABLE IF NOT EXISTS newsletter_editions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  content_id UUID REFERENCES content_memory(id),
  product TEXT NOT NULL DEFAULT 'chronostates',
  subject_line TEXT NOT NULL,
  free_teaser TEXT,
  paywall_content TEXT,
  closing_section TEXT,
  word_count INTEGER DEFAULT 0,
  header_image_url TEXT,
  header_image_prompt TEXT,
  theme_type TEXT CHECK (theme_type IN ('blog_adaptation', 'scenario_spotlight', 'community_driven', 'original')),
  sources TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'published', 'rejected', 'draft')),
  publish_method TEXT DEFAULT 'manual_draft'
    CHECK (publish_method IN ('email', 'manual_draft')),
  formatted_html TEXT,
  email_id TEXT,
  published_at TIMESTAMPTZ,
  open_rate NUMERIC(5,2),
  subscriber_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policy
ALTER TABLE newsletter_editions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY newsletter_editions_account_isolation ON newsletter_editions
    USING (account_id = current_setting('app.account_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_newsletter_editions_account ON newsletter_editions(account_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_editions_status ON newsletter_editions(account_id, status);
CREATE INDEX IF NOT EXISTS idx_newsletter_editions_created ON newsletter_editions(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_newsletter_editions_content ON newsletter_editions(content_id);
