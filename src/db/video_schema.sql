-- Video Producer: video_assets table for tracking produced videos
-- Linked to content_memory via content_id

CREATE TABLE IF NOT EXISTS video_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  content_id UUID REFERENCES content_memory(id),
  product TEXT NOT NULL,
  title TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('short', 'long')),
  duration_sec INTEGER,
  video_url TEXT,
  thumbnail_url TEXT,
  captions_srt_url TEXT,
  captions_vtt_url TEXT,
  storage_path TEXT,
  scene_count INTEGER DEFAULT 0,
  file_size_bytes BIGINT DEFAULT 0,
  hashtags TEXT[] DEFAULT '{}',
  platforms TEXT[] DEFAULT '{}',
  quality_gate JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'published', 'rejected', 'failed')),
  source_content_id UUID,
  repurpose_chain_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policy
ALTER TABLE video_assets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY video_assets_account_isolation ON video_assets
    USING (account_id = current_setting('app.account_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_assets_account ON video_assets(account_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_product ON video_assets(account_id, product);
CREATE INDEX IF NOT EXISTS idx_video_assets_status ON video_assets(account_id, status);
CREATE INDEX IF NOT EXISTS idx_video_assets_format ON video_assets(account_id, format);
CREATE INDEX IF NOT EXISTS idx_video_assets_created ON video_assets(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_video_assets_content ON video_assets(content_id);
