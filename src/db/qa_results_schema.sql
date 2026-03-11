-- QA Results: nightly ChronoStates playtest results
-- Extends the existing qa_results table with additional columns for full playtest tracking

-- Add new columns if they don't exist
DO $$ BEGIN
  ALTER TABLE qa_results ADD COLUMN IF NOT EXISTS world_id TEXT;
  ALTER TABLE qa_results ADD COLUMN IF NOT EXISTS scenario_config JSONB DEFAULT '{}';
  ALTER TABLE qa_results ADD COLUMN IF NOT EXISTS narrative_quality_score NUMERIC(3,1) DEFAULT 0;
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist yet, create it fresh
  CREATE TABLE qa_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    test_date DATE NOT NULL DEFAULT CURRENT_DATE,
    world_id TEXT,
    scenario_id TEXT,
    scenario_config JSONB DEFAULT '{}',
    checks JSONB NOT NULL DEFAULT '{}',
    pass_fail TEXT NOT NULL CHECK (pass_fail IN ('pass', 'fail')),
    bugs JSONB NOT NULL DEFAULT '[]',
    latency_stats JSONB NOT NULL DEFAULT '{}',
    narrative_quality_score NUMERIC(3,1) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qa_results_account_date ON qa_results(account_id, test_date);
CREATE INDEX IF NOT EXISTS idx_qa_results_pass_fail ON qa_results(account_id, pass_fail);
CREATE INDEX IF NOT EXISTS idx_qa_results_world ON qa_results(account_id, world_id);
