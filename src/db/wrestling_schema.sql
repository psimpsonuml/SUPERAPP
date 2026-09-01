-- ══════════════════════════════════════════════════════════════════
-- Wrestling Tracker — replaces the former Sports Tracker module
--
-- Covers WWE, AEW, NJPW, TNA, ROH, and GCW. Events and matches are
-- populated weekly by the wrestling-scraper agent; ratings and cascade
-- scores are user-generated.
-- ══════════════════════════════════════════════════════════════════

-- ── Favorites: wrestlers and promotions the user follows ──────────
CREATE TABLE IF NOT EXISTS wrestling_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  favorite_type TEXT NOT NULL CHECK (favorite_type IN ('wrestler', 'promotion', 'tag_team', 'stable')),
  name TEXT NOT NULL,
  promotion TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, favorite_type, name)
);

-- ── Scraped events (shows / PPVs / PLEs) ──────────────────────────
CREATE TABLE IF NOT EXISTS wrestling_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  promotion TEXT NOT NULL CHECK (promotion IN ('WWE', 'AEW', 'NJPW', 'TNA', 'ROH', 'GCW')),
  event_name TEXT NOT NULL,
  event_type TEXT DEFAULT 'weekly' CHECK (event_type IN ('weekly', 'ppv', 'special', 'tournament')),
  event_date DATE NOT NULL,
  venue TEXT DEFAULT '',
  city TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  source TEXT DEFAULT 'wikipedia',
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, promotion, event_name, event_date)
);

-- ── Scraped match results ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wrestling_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_id UUID REFERENCES wrestling_events(id) ON DELETE CASCADE,
  promotion TEXT NOT NULL,
  event_name TEXT DEFAULT '',
  event_date DATE NOT NULL,
  match_order INTEGER DEFAULT 0,
  match_type TEXT DEFAULT 'singles',
  stipulation TEXT DEFAULT '',
  title_match BOOLEAN DEFAULT FALSE,
  title_name TEXT DEFAULT '',
  -- participants_json: [{ name, role: 'winner'|'loser'|'participant', team }]
  participants_json JSONB DEFAULT '[]',
  winner TEXT DEFAULT '',
  duration_seconds INTEGER,
  finish TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── User match ratings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wrestling_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  match_id UUID REFERENCES wrestling_matches(id) ON DELETE CASCADE,
  promotion TEXT NOT NULL,
  event_name TEXT DEFAULT '',
  event_date DATE NOT NULL,
  match_description TEXT DEFAULT '',
  score INTEGER CHECK (score >= 1 AND score <= 10),
  -- participants_json mirrors the match shape so manual entries work too
  participants_json JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  rated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, match_id)
);

-- ── Wrestler cascade scores (weighted by CASCADE_WEIGHTS.wrestling) ─
CREATE TABLE IF NOT EXISTS wrestling_cascade_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  wrestler_name TEXT NOT NULL,
  promotion TEXT DEFAULT '',
  weighted_sum NUMERIC(10,2) DEFAULT 0,
  weight_total NUMERIC(10,2) DEFAULT 0,
  composite_score NUMERIC(5,2) DEFAULT 0,
  matches_rated INTEGER DEFAULT 0,
  avg_score NUMERIC(3,1) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, wrestler_name)
);

-- ── Derived weekly statistics (built by the scraper) ──────────────
CREATE TABLE IF NOT EXISTS wrestling_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  stat_type TEXT NOT NULL,
  promotion TEXT DEFAULT '',
  period_start DATE,
  period_end DATE,
  -- payload_json holds the computed leaderboard / streak / tally
  payload_json JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, stat_type, promotion, period_start)
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wrestling_favorites_account ON wrestling_favorites(account_id);
CREATE INDEX IF NOT EXISTS idx_wrestling_events_account ON wrestling_events(account_id);
CREATE INDEX IF NOT EXISTS idx_wrestling_events_date ON wrestling_events(account_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_wrestling_matches_account ON wrestling_matches(account_id);
CREATE INDEX IF NOT EXISTS idx_wrestling_matches_event ON wrestling_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_wrestling_matches_date ON wrestling_matches(account_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_wrestling_ratings_account ON wrestling_ratings(account_id);
CREATE INDEX IF NOT EXISTS idx_wrestling_cascade_account ON wrestling_cascade_scores(account_id);
CREATE INDEX IF NOT EXISTS idx_wrestling_cascade_score ON wrestling_cascade_scores(account_id, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_wrestling_stats_account ON wrestling_stats(account_id, stat_type);

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE wrestling_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrestling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrestling_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrestling_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrestling_cascade_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrestling_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY wrestling_favorites_isolation ON wrestling_favorites
  USING (account_id::text = current_setting('app.account_id', TRUE));
CREATE POLICY wrestling_events_isolation ON wrestling_events
  USING (account_id::text = current_setting('app.account_id', TRUE));
CREATE POLICY wrestling_matches_isolation ON wrestling_matches
  USING (account_id::text = current_setting('app.account_id', TRUE));
CREATE POLICY wrestling_ratings_isolation ON wrestling_ratings
  USING (account_id::text = current_setting('app.account_id', TRUE));
CREATE POLICY wrestling_cascade_isolation ON wrestling_cascade_scores
  USING (account_id::text = current_setting('app.account_id', TRUE));
CREATE POLICY wrestling_stats_isolation ON wrestling_stats
  USING (account_id::text = current_setting('app.account_id', TRUE));
