-- Health Dashboard: metrics, targets, imports, correlations, weekly digests
CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  date DATE NOT NULL,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  source TEXT DEFAULT 'manual',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_account_date ON health_metrics(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_type ON health_metrics(account_id, metric_type, date DESC);

CREATE TABLE IF NOT EXISTS health_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  metric_type TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, metric_type)
);

CREATE TABLE IF NOT EXISTS health_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  source TEXT NOT NULL,
  file_name TEXT NOT NULL,
  records_imported INTEGER DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_imports_account ON health_imports(account_id, imported_at DESC);

CREATE TABLE IF NOT EXISTS health_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  correlation_text TEXT NOT NULL,
  metrics_involved JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_correlations_account ON health_correlations(account_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS health_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  digest_text TEXT NOT NULL,
  week_start DATE NOT NULL,
  metrics_summary JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_health_digests_account ON health_digests(account_id, week_start DESC);
