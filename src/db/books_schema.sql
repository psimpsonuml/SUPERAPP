-- BeaconOps Books Module Schema
-- Tables: book_items, book_ratings
-- Reuses cascade_scores table with source_type = 'book'

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Book Items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  open_library_id TEXT,             -- e.g. "/works/OL45883W"
  title TEXT NOT NULL,
  author TEXT,
  year INTEGER,
  genre TEXT,
  cover_url TEXT,
  page_count INTEGER,
  description TEXT,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, open_library_id),
  UNIQUE(account_id, title, author)
);

CREATE INDEX IF NOT EXISTS idx_book_items_account ON book_items(account_id);
CREATE INDEX IF NOT EXISTS idx_book_items_ol ON book_items(account_id, open_library_id);

-- ── Book Ratings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES book_items(id) ON DELETE CASCADE,
  score INTEGER CHECK (score >= 1 AND score <= 10),
  status TEXT NOT NULL DEFAULT 'rated'
    CHECK (status IN ('rated', 'want_to_read', 'reading', 'abandoned')),
  notes TEXT,
  rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_book_ratings_account ON book_ratings(account_id);
CREATE INDEX IF NOT EXISTS idx_book_ratings_status ON book_ratings(account_id, status);
CREATE INDEX IF NOT EXISTS idx_book_ratings_score ON book_ratings(account_id, score DESC);

-- ── Add source_type to cascade_scores if not exists ─────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cascade_scores' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE cascade_scores ADD COLUMN source_type TEXT NOT NULL DEFAULT 'entertainment';
  END IF;
END $$;

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE book_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_ratings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "book_items_account" ON book_items FOR ALL USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "book_ratings_account" ON book_ratings FOR ALL USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
