-- BeaconOps Entertainment Module Schema
-- Tables: entertainment_items, entertainment_ratings, entertainment_people, cascade_scores

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Entertainment Items ─────────────────────────────────────
-- Stores movies, TV shows, wrestling matches
CREATE TABLE IF NOT EXISTS entertainment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tmdb_id INTEGER,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'movie' CHECK (item_type IN ('movie', 'tv', 'wrestling_match')),
  year INTEGER,
  poster_path TEXT,
  overview TEXT,
  genres JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, title, item_type),
  UNIQUE(account_id, tmdb_id, item_type)
);

CREATE INDEX IF NOT EXISTS idx_entertainment_items_account ON entertainment_items(account_id);
CREATE INDEX IF NOT EXISTS idx_entertainment_items_tmdb ON entertainment_items(account_id, tmdb_id);

-- ── Entertainment Ratings ───────────────────────────────────
CREATE TABLE IF NOT EXISTS entertainment_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES entertainment_items(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_entertainment_ratings_account ON entertainment_ratings(account_id);

-- ── Entertainment People ────────────────────────────────────
-- Links people (directors, actors, etc.) to items with their role
CREATE TABLE IF NOT EXISTS entertainment_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES entertainment_items(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  tmdb_person_id INTEGER,
  role TEXT NOT NULL CHECK (role IN ('director', 'lead_actor', 'writer', 'supporting_actor', 'cinematographer', 'composer')),
  profile_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, item_id, person_name, role)
);

CREATE INDEX IF NOT EXISTS idx_entertainment_people_account ON entertainment_people(account_id);
CREATE INDEX IF NOT EXISTS idx_entertainment_people_item ON entertainment_people(item_id);

-- ── Cascade Scores ──────────────────────────────────────────
-- Aggregated weighted scores per person across all rated items
CREATE TABLE IF NOT EXISTS cascade_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  tmdb_person_id INTEGER,
  primary_role TEXT NOT NULL,
  composite_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  weighted_sum NUMERIC(8,2) NOT NULL DEFAULT 0,
  weight_total NUMERIC(8,2) NOT NULL DEFAULT 0,
  ratings_count INTEGER NOT NULL DEFAULT 0,
  item_type TEXT NOT NULL DEFAULT 'movie',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, person_name, primary_role, item_type)
);

CREATE INDEX IF NOT EXISTS idx_cascade_scores_account ON cascade_scores(account_id);
CREATE INDEX IF NOT EXISTS idx_cascade_scores_composite ON cascade_scores(account_id, composite_score DESC);

-- ── RLS Policies ────────────────────────────────────────────
ALTER TABLE entertainment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE entertainment_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE entertainment_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE cascade_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "entertainment_items_account" ON entertainment_items FOR ALL USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "entertainment_ratings_account" ON entertainment_ratings FOR ALL USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "entertainment_people_account" ON entertainment_people FOR ALL USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "cascade_scores_account" ON cascade_scores FOR ALL USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
