CREATE TABLE IF NOT EXISTS podcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  feed_url TEXT DEFAULT '',
  category TEXT DEFAULT '',
  podcast_index_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS podcast_episodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  podcast_id UUID NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration_seconds INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  audio_url TEXT DEFAULT '',
  guests_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS podcast_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  podcast_id UUID NOT NULL REFERENCES podcasts(id),
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, podcast_id)
);

CREATE TABLE IF NOT EXISTS podcast_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  episode_id UUID NOT NULL REFERENCES podcast_episodes(id),
  score INTEGER CHECK (score >= 1 AND score <= 10),
  notes TEXT DEFAULT '',
  listened BOOLEAN DEFAULT true,
  rated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, episode_id)
);

CREATE TABLE IF NOT EXISTS podcast_cascade_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  person_name TEXT NOT NULL,
  role TEXT DEFAULT 'host' CHECK (role IN ('host','guest')),
  composite_score NUMERIC(5,2) DEFAULT 0,
  episodes_rated INTEGER DEFAULT 0,
  avg_score NUMERIC(3,1) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, person_name, role)
);

CREATE INDEX IF NOT EXISTS idx_podcasts_title ON podcasts(title);
CREATE INDEX IF NOT EXISTS idx_podcast_eps_podcast ON podcast_episodes(podcast_id);
CREATE INDEX IF NOT EXISTS idx_podcast_subs_account ON podcast_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_podcast_ratings_account ON podcast_ratings(account_id);
CREATE INDEX IF NOT EXISTS idx_podcast_cascade_account ON podcast_cascade_scores(account_id);
