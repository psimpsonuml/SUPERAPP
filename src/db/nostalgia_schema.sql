CREATE TABLE IF NOT EXISTS nostalgia_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  memory_date DATE NOT NULL,
  source_module TEXT NOT NULL,
  source_id TEXT DEFAULT '',
  content_preview TEXT NOT NULL,
  year INTEGER NOT NULL,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, source_module, source_id, year)
);
CREATE INDEX IF NOT EXISTS idx_nostalgia_account ON nostalgia_cache(account_id);
CREATE INDEX IF NOT EXISTS idx_nostalgia_date ON nostalgia_cache(account_id, memory_date);
CREATE INDEX IF NOT EXISTS idx_nostalgia_module ON nostalgia_cache(source_module);
