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
