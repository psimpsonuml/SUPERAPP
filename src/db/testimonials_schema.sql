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
