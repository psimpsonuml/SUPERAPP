CREATE TABLE IF NOT EXISTS podcast_episodes_produced (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  series_name TEXT NOT NULL CHECK (series_name IN ('what_if','compliance_corner','money_clarity')),
  product TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  script TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  duration_seconds INTEGER DEFAULT 0,
  show_notes TEXT DEFAULT '',
  metadata_json JSONB DEFAULT '{}',
  cover_art_prompt TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scripted','recorded','produced','approved','published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_podcast_prod_account ON podcast_episodes_produced(account_id);
CREATE INDEX IF NOT EXISTS idx_podcast_prod_series ON podcast_episodes_produced(series_name);
CREATE INDEX IF NOT EXISTS idx_podcast_prod_status ON podcast_episodes_produced(status);
