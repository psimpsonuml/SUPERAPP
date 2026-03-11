CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT DEFAULT 'journal' CHECK (entry_type IN ('journal','gratitude','goal_reflection','vent','win')),
  content TEXT NOT NULL,
  prompt_used TEXT DEFAULT '',
  sentiment_score NUMERIC(3,2),
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journal_account ON journal_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(account_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_type ON journal_entries(account_id, entry_type);
