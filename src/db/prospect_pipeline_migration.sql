-- Migration: Add outreach-specific columns to prospect_pipeline
-- These columns support the Outreach Prospector agent's full workflow

-- Source URL where the prospect was discovered
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Platform where prospect was found (reddit, linkedin, x, forum, google, etc.)
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS platform TEXT;

-- Drafted outreach email (subject + body stored as JSONB)
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS drafted_email JSONB;

-- Which sending domain/mailbox was used
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS sent_via TEXT;

-- Index for deduplication by source_url
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_source_url ON prospect_pipeline(account_id, source_url);

-- Index for platform filtering
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_platform ON prospect_pipeline(account_id, platform);

-- Index for daily counting (emails drafted per product per day)
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_created ON prospect_pipeline(account_id, product, created_at);

-- ============================================================
-- OUTREACH TRACKING (sent email log for response rate calc)
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
