CREATE TABLE IF NOT EXISTS books_authored (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  title TEXT NOT NULL,
  series_name TEXT DEFAULT '',
  series_order INTEGER,
  genre TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  draft_status TEXT DEFAULT 'drafting' CHECK (draft_status IN ('drafting','first_draft','editing','final_draft','ready_to_publish','published')),
  synopsis TEXT DEFAULT '',
  target_date DATE,
  cover_url TEXT DEFAULT '',
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_chapters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES books_authored(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'drafting' CHECK (status IN ('drafting','written','edited','final')),
  edit_score_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_publishing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES books_authored(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  format TEXT DEFAULT 'ebook' CHECK (format IN ('ebook','paperback','hardcover','audiobook')),
  isbn TEXT DEFAULT '',
  listing_url TEXT DEFAULT '',
  price NUMERIC(8,2),
  publish_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','submitted','live','paused','removed')),
  enrollment_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES books_authored(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  agency TEXT DEFAULT '',
  email TEXT DEFAULT '',
  materials_sent TEXT DEFAULT '',
  date_sent DATE DEFAULT CURRENT_DATE,
  response_deadline DATE,
  status TEXT DEFAULT 'sent' CHECK (status IN ('queued','sent','requested_materials','rejected','offer','withdrawn')),
  response_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_arcs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES books_authored(id) ON DELETE CASCADE,
  reader_name TEXT NOT NULL,
  reader_email TEXT DEFAULT '',
  date_sent DATE DEFAULT CURRENT_DATE,
  review_received BOOLEAN DEFAULT false,
  review_score INTEGER,
  review_url TEXT DEFAULT '',
  platform TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_marketing_calendar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES books_authored(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT DEFAULT '',
  content_draft TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES books_authored(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  format TEXT DEFAULT 'ebook',
  date DATE NOT NULL,
  units_sold INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  royalty NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES books_authored(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  reviewer TEXT DEFAULT '',
  rating NUMERIC(3,1),
  review_text TEXT DEFAULT '',
  review_url TEXT DEFAULT '',
  sentiment TEXT DEFAULT 'neutral',
  date_found DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_authored_account ON books_authored(account_id);
CREATE INDEX IF NOT EXISTS idx_book_chapters_book ON book_chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_book_publishing_book ON book_publishing(book_id);
CREATE INDEX IF NOT EXISTS idx_book_queries_book ON book_queries(book_id);
CREATE INDEX IF NOT EXISTS idx_book_arcs_book ON book_arcs(book_id);
CREATE INDEX IF NOT EXISTS idx_book_marketing_book ON book_marketing_calendar(book_id);
CREATE INDEX IF NOT EXISTS idx_book_sales_book ON book_sales(book_id);
CREATE INDEX IF NOT EXISTS idx_book_reviews_book ON book_reviews(book_id);
