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
