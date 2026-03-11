CREATE TABLE IF NOT EXISTS recommendation_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  title TEXT NOT NULL,
  list_type TEXT DEFAULT 'custom' CHECK (list_type IN ('top_movies','top_directors','hidden_gems','best_books','top_artists','custom')),
  items_json JSONB DEFAULT '[]',
  description TEXT DEFAULT '',
  public_slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watch_parties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  title TEXT NOT NULL,
  item_id TEXT DEFAULT '',
  item_type TEXT DEFAULT 'movie',
  proposed_date TIMESTAMPTZ,
  invite_slug TEXT UNIQUE,
  attendees_json JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_lists_account ON recommendation_lists(account_id);
CREATE INDEX IF NOT EXISTS idx_rec_lists_slug ON recommendation_lists(public_slug);
CREATE INDEX IF NOT EXISTS idx_watch_parties_account ON watch_parties(account_id);
