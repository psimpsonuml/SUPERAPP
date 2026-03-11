-- Revenue Dashboard tables
CREATE TABLE IF NOT EXISTS revenue_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  date DATE NOT NULL,
  product TEXT NOT NULL,
  mrr NUMERIC(12,2) DEFAULT 0,
  active_subs INTEGER DEFAULT 0,
  new_subs INTEGER DEFAULT 0,
  churns INTEGER DEFAULT 0,
  failed_payments INTEGER DEFAULT 0,
  avg_ltv NUMERIC(12,2) DEFAULT 0,
  data_json JSONB DEFAULT '{}',
  refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, date, product)
);

CREATE INDEX IF NOT EXISTS idx_rev_snap_account ON revenue_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_rev_snap_date ON revenue_snapshots(account_id, date);
