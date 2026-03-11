CREATE TABLE IF NOT EXISTS dating_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  platform TEXT NOT NULL,
  bio_text TEXT DEFAULT '',
  photos_json JSONB DEFAULT '[]',
  prompts_json JSONB DEFAULT '[]',
  preferences_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, platform)
);

CREATE TABLE IF NOT EXISTS dating_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  platform TEXT NOT NULL,
  match_name TEXT DEFAULT '',
  match_date DATE DEFAULT CURRENT_DATE,
  conversation_started BOOLEAN DEFAULT false,
  date_scheduled BOOLEAN DEFAULT false,
  date_happened BOOLEAN DEFAULT false,
  outcome TEXT DEFAULT '' CHECK (outcome IN ('','second_date','not_interested','ghosted','relationship','talking','unmatched')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dating_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  platform TEXT NOT NULL,
  week_start DATE NOT NULL,
  matches INTEGER DEFAULT 0,
  conversations INTEGER DEFAULT 0,
  dates INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, platform, week_start)
);

CREATE INDEX IF NOT EXISTS idx_dating_profiles_account ON dating_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_dating_matches_account ON dating_matches(account_id);
CREATE INDEX IF NOT EXISTS idx_dating_analytics_account ON dating_analytics(account_id);
