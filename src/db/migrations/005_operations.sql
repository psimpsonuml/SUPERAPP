-- ══════════════════════════════════════════════════════════════════
-- Migration 005 — Operations schema
--
-- GENERATED. Do not hand-edit; regenerate with:
--   node src/db/migrations/build-005.js
--
-- The eight operations pages each shipped with a standalone schema
-- file under src/db/*_schema.sql, applied by hand. On the retiring
-- SUPERAPP that was survivable; for the port it is not — nothing
-- recorded which of them had run. This migration folds them into the
-- ordered set so `npm run migrate:growth` builds the whole thing.
--
-- Sources, in application order:
--   src/db/book_publishing_schema.sql  (Book Publishing)
--   src/db/pr_schema.sql  (PR & Media)
--   src/db/design_schema.sql  (Design Studio)
--   src/db/kb_schema.sql  (Knowledge Base)
--   src/db/testimonials_schema.sql  (Testimonials)
--   src/db/partners_schema.sql  (Partners)
--   src/db/revenue_schema.sql  (Revenue)
--   src/db/podcast_producer_schema.sql  (Podcast Producer)
--
-- None of these reference the Growth OS tables, and none reference
-- each other across files, so the order is only for readability.
-- Every statement is IF NOT EXISTS: safe to run more than once, and a
-- no-op on a database where the schemas were already applied by hand.
-- ══════════════════════════════════════════════════════════════════


-- ══════════════ Book Publishing (book_publishing_schema.sql) ══════════════
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


-- ══════════════ PR & Media (pr_schema.sql) ══════════════
CREATE TABLE IF NOT EXISTS media_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  outlet TEXT DEFAULT '',
  beat TEXT DEFAULT '',
  email TEXT DEFAULT '',
  social_url TEXT DEFAULT '',
  recent_articles_json JSONB DEFAULT '[]',
  reach_estimate INTEGER DEFAULT 0,
  product_relevance JSONB DEFAULT '[]',
  last_contacted TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS press_releases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  product TEXT NOT NULL,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','approved','published','archived')),
  published_at TIMESTAMPTZ,
  pitches_sent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  product TEXT DEFAULT '',
  source TEXT NOT NULL,
  url TEXT DEFAULT '',
  title TEXT DEFAULT '',
  sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive','neutral','negative')),
  reach_estimate INTEGER DEFAULT 0,
  date_found DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  source TEXT NOT NULL,
  query_text TEXT NOT NULL,
  deadline TIMESTAMPTZ,
  relevance TEXT DEFAULT '',
  response_draft TEXT DEFAULT '',
  status TEXT DEFAULT 'new' CHECK (status IN ('new','responded','expired','won')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_contacts_account ON media_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_press_releases_account ON press_releases(account_id);
CREATE INDEX IF NOT EXISTS idx_media_mentions_account ON media_mentions(account_id);
CREATE INDEX IF NOT EXISTS idx_media_opps_account ON media_opportunities(account_id);


-- ══════════════ Design Studio (design_schema.sql) ══════════════
CREATE TABLE IF NOT EXISTS design_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  product TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('social_graphic','email_template','pitch_slide','one_pager','blog_image','landing_hero','ad_visual','logo','icon','other')),
  title TEXT NOT NULL,
  template_id UUID,
  image_url TEXT DEFAULT '',
  dimensions TEXT DEFAULT '',
  format TEXT DEFAULT 'png',
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  template_config_json JSONB DEFAULT '{}',
  thumbnail_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_assets_account ON design_assets(account_id);
CREATE INDEX IF NOT EXISTS idx_design_assets_type ON design_assets(account_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_design_templates_account ON design_templates(account_id);


-- ══════════════ Knowledge Base (kb_schema.sql) ══════════════
CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  product TEXT NOT NULL,
  question_normalized TEXT NOT NULL,
  title TEXT NOT NULL,
  body_markdown TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  frequency INTEGER DEFAULT 1,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_question_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  product TEXT NOT NULL,
  raw_question TEXT NOT NULL,
  normalized_question TEXT,
  email_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_account ON kb_articles(account_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_product ON kb_articles(account_id, product);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(account_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_questions_account ON kb_question_log(account_id);


-- ══════════════ Testimonials (testimonials_schema.sql) ══════════════
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  product TEXT NOT NULL,
  quote_text TEXT NOT NULL,
  author_name TEXT DEFAULT '',
  author_title TEXT DEFAULT '',
  author_company TEXT DEFAULT '',
  source_platform TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  rating INTEGER,
  photo_url TEXT DEFAULT '',
  tags JSONB DEFAULT '[]',
  category TEXT DEFAULT 'text_review' CHECK (category IN ('text_review','video_testimonial','social_media_post','email_excerpt','case_study')),
  verified BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_account ON testimonials(account_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_product ON testimonials(account_id, product);
CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON testimonials(account_id, approved);


-- ══════════════ Partners (partners_schema.sql) ══════════════
CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  partner_type TEXT DEFAULT 'affiliate' CHECK (partner_type IN ('affiliate','integration_partner','reseller','white_label')),
  products JSONB DEFAULT '[]',
  commission_structure_json JSONB DEFAULT '{}',
  payment_terms TEXT DEFAULT '',
  agreement_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
  tracking_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  partner_id UUID NOT NULL REFERENCES partners(id),
  referred_email TEXT DEFAULT '',
  product TEXT NOT NULL,
  signup_date DATE,
  subscription_value NUMERIC(10,2) DEFAULT 0,
  commission_amount NUMERIC(10,2) DEFAULT 0,
  commission_status TEXT DEFAULT 'owed' CHECK (commission_status IN ('owed','invoiced','paid')),
  stripe_customer_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  partner_id UUID NOT NULL REFERENCES partners(id),
  amount NUMERIC(10,2) NOT NULL,
  period TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_account ON partners(account_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner ON partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_payments_partner ON partner_payments(partner_id);


-- ══════════════ Revenue (revenue_schema.sql) ══════════════
-- Revenue Dashboard tables
CREATE TABLE IF NOT EXISTS revenue_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  date DATE NOT NULL,
  product TEXT NOT NULL,
  mrr NUMERIC(12,2) DEFAULT 0,
  active_subs INTEGER DEFAULT 0,
  new_subs INTEGER DEFAULT 0,
  churns INTEGER DEFAULT 0,
  failed_payments INTEGER DEFAULT 0,
  avg_ltv NUMERIC(12,2) DEFAULT 0,
  data_json JSONB DEFAULT '{}',
  refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, date, product)
);

CREATE INDEX IF NOT EXISTS idx_rev_snap_account ON revenue_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_rev_snap_date ON revenue_snapshots(account_id, date);


-- ══════════════ Podcast Producer (podcast_producer_schema.sql) ══════════════
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
