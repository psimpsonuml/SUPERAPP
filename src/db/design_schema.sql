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
