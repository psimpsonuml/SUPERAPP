-- News & Social Feed: multi-viewpoint news aggregation and social media
CREATE TABLE IF NOT EXISTS news_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  topic TEXT NOT NULL DEFAULT 'general',
  source_lean TEXT CHECK (source_lean IN ('left', 'center', 'right', NULL)),
  source_type TEXT NOT NULL DEFAULT 'news',
  cluster_id UUID,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed', NULL)),
  saved BOOLEAN DEFAULT FALSE,
  social_platform TEXT,
  social_author TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_news_feed_account_date ON news_feed_items(account_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_feed_topic ON news_feed_items(account_id, topic);
CREATE INDEX IF NOT EXISTS idx_news_feed_cluster ON news_feed_items(account_id, cluster_id);
CREATE INDEX IF NOT EXISTS idx_news_feed_saved ON news_feed_items(account_id, saved) WHERE saved = TRUE;

-- News clusters: groups related stories from multiple sources
CREATE TABLE IF NOT EXISTS news_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  cluster_title TEXT NOT NULL,
  synthesis TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed', NULL)),
  source_count INTEGER DEFAULT 0,
  topic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_clusters_account ON news_clusters(account_id, created_at DESC);

-- Morning briefings: cached daily summaries
CREATE TABLE IF NOT EXISTS news_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  briefing_text TEXT NOT NULL,
  story_count INTEGER DEFAULT 0,
  topics_covered JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_briefings_unique_daily ON news_briefings(account_id, CAST(generated_at AS DATE));
CREATE INDEX IF NOT EXISTS idx_news_briefings_account ON news_briefings(account_id, generated_at DESC);

-- Feed preferences: saved filter/source settings
CREATE TABLE IF NOT EXISTS news_feed_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE,
  active_topics JSONB DEFAULT '["all"]',
  disabled_sources JSONB DEFAULT '[]',
  sort_mode TEXT DEFAULT 'chronological' CHECK (sort_mode IN ('chronological', 'relevance')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
