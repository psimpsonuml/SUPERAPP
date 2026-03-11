-- Product Intelligence: recommendations table with snooze system
-- Stores feature/pricing/UX recommendations from signal analysis

CREATE TABLE IF NOT EXISTS product_intelligence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  product TEXT NOT NULL,
  rec_type TEXT NOT NULL CHECK (rec_type IN ('add', 'change', 'remove', 'pricing', 'ux')),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  rationale TEXT DEFAULT '',
  effort_estimate TEXT CHECK (effort_estimate IN ('small', 'medium', 'large')),
  impact_estimate TEXT CHECK (impact_estimate IN ('low', 'medium', 'high')),
  source_signals JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'accepted', 'rejected', 'snoozed')),
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policy
ALTER TABLE product_intelligence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY product_intelligence_account_isolation ON product_intelligence
    USING (account_id = current_setting('app.account_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_intelligence_account ON product_intelligence(account_id);
CREATE INDEX IF NOT EXISTS idx_product_intelligence_product ON product_intelligence(account_id, product);
CREATE INDEX IF NOT EXISTS idx_product_intelligence_status ON product_intelligence(account_id, status);
CREATE INDEX IF NOT EXISTS idx_product_intelligence_type ON product_intelligence(account_id, rec_type);
CREATE INDEX IF NOT EXISTS idx_product_intelligence_snoozed ON product_intelligence(account_id, snoozed_until)
  WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_intelligence_created ON product_intelligence(account_id, created_at);
