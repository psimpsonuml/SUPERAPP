-- Facebook Archaeologist: parsed data from Facebook export
CREATE TABLE IF NOT EXISTS fb_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  data_type TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  item_count INTEGER DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, data_type)
);

CREATE INDEX IF NOT EXISTS idx_fb_archive_account ON fb_archive(account_id);

-- Facebook analysis results: computed insights per analysis dimension
CREATE TABLE IF NOT EXISTS fb_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  analysis_type TEXT NOT NULL,
  results JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, analysis_type)
);

CREATE INDEX IF NOT EXISTS idx_fb_analysis_account ON fb_analysis(account_id);

-- Facebook import status: tracks upload and processing state
CREATE TABLE IF NOT EXISTS fb_import_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'processing', 'analyzing', 'complete', 'error')),
  progress INTEGER DEFAULT 0,
  total_files INTEGER DEFAULT 0,
  files_parsed INTEGER DEFAULT 0,
  include_messages BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
