-- Music Discovery Module Schema
-- Spotify integration + cascade scoring for artists, producers, songwriters

-- ============================================================
-- MUSIC ITEMS (songs & albums from Spotify)
-- ============================================================

CREATE TABLE IF NOT EXISTS music_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  spotify_id TEXT,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'song' CHECK (item_type IN ('song', 'album')),
  artist TEXT,
  year INTEGER,
  genre TEXT,
  album_art_url TEXT,
  preview_url TEXT,
  spotify_uri TEXT,
  album_name TEXT,
  album_spotify_id TEXT,
  duration_ms INTEGER,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, spotify_id),
  UNIQUE(account_id, title, artist, item_type)
);

CREATE INDEX IF NOT EXISTS idx_music_items_account ON music_items(account_id);
CREATE INDEX IF NOT EXISTS idx_music_items_spotify ON music_items(account_id, spotify_id);
CREATE INDEX IF NOT EXISTS idx_music_items_artist ON music_items(account_id, artist);

-- ============================================================
-- MUSIC RATINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS music_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  music_item_id UUID NOT NULL REFERENCES music_items(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, music_item_id)
);

CREATE INDEX IF NOT EXISTS idx_music_ratings_account ON music_ratings(account_id);
CREATE INDEX IF NOT EXISTS idx_music_ratings_item ON music_ratings(music_item_id);

-- ============================================================
-- MUSIC PEOPLE (credits: artists, producers, songwriters, featured)
-- ============================================================

CREATE TABLE IF NOT EXISTS music_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  music_item_id UUID NOT NULL REFERENCES music_items(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  spotify_person_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('artist', 'producer', 'featured', 'songwriter')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, music_item_id, person_name, role)
);

CREATE INDEX IF NOT EXISTS idx_music_people_account ON music_people(account_id);
CREATE INDEX IF NOT EXISTS idx_music_people_item ON music_people(music_item_id);
CREATE INDEX IF NOT EXISTS idx_music_people_name ON music_people(account_id, person_name);

-- ============================================================
-- SPOTIFY CONNECTED ACCOUNT TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS spotify_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  spotify_user_id TEXT,
  spotify_display_name TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE music_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotify_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY account_isolation ON music_items FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON music_ratings FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON music_people FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY account_isolation ON spotify_tokens FOR ALL USING (account_id = current_setting('app.current_account_id')::UUID); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
