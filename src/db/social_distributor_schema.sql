-- Social Distributor schema: platform connections, post logs, engagement tracking

-- Connected social accounts per platform
CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  platform TEXT NOT NULL, -- reddit, facebook, instagram, linkedin, discord
  product TEXT, -- NULL means shared across products (e.g. linkedin, discord)
  status TEXT NOT NULL DEFAULT 'disconnected', -- connected, disconnected, error, expired
  credentials_json JSONB NOT NULL DEFAULT '{}', -- encrypted tokens, never exposed to frontend
  platform_user_id TEXT, -- platform-specific user/page ID
  platform_user_name TEXT, -- display name on platform
  metadata JSONB DEFAULT '{}', -- extra config (subreddit list, page ID, server ID, etc.)
  connected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- token expiry
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, platform, product)
);

-- Log of every post published or attempted
CREATE TABLE IF NOT EXISTS social_post_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  product TEXT NOT NULL,
  platform TEXT NOT NULL,
  post_type TEXT, -- text, image_caption, carousel, professional_insight, conversational
  content_preview TEXT, -- first 280 chars
  full_content JSONB DEFAULT '{}',
  platform_post_id TEXT, -- ID returned by platform API after posting
  platform_post_url TEXT, -- direct link to the post
  calendar_entry_id UUID, -- links to content_calendar
  approval_item_id UUID, -- links to approval_queue
  content_memory_id UUID, -- links to content_memory
  status TEXT NOT NULL DEFAULT 'queued', -- queued, scheduled, posting, published, failed, rejected
  scheduled_for TIMESTAMPTZ, -- when to publish
  published_at TIMESTAMPTZ,
  error_message TEXT,
  -- Engagement metrics (pulled 24h after posting)
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  impressions INT DEFAULT 0,
  engagement_score FLOAT DEFAULT 0,
  engagement_pulled_at TIMESTAMPTZ,
  -- Shadowban detection
  flagged_shadowban BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for daily queries
CREATE INDEX IF NOT EXISTS idx_social_post_log_daily
  ON social_post_log (account_id, scheduled_for, status);

CREATE INDEX IF NOT EXISTS idx_social_post_log_platform
  ON social_post_log (account_id, platform, published_at);

CREATE INDEX IF NOT EXISTS idx_social_connections_account
  ON social_connections (account_id, platform);
