-- Content Library Manager: tracks generated ChronoStates scenarios
CREATE TABLE IF NOT EXISTS cs_scenario_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  title TEXT NOT NULL,
  era TEXT NOT NULL,
  region TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  description TEXT,
  starting_conditions JSONB DEFAULT '{}',
  decision_point_count INTEGER DEFAULT 0,
  translations JSONB DEFAULT '{}',
  approval_queue_id UUID,
  approval_status TEXT DEFAULT 'pending',
  injected BOOLEAN DEFAULT FALSE,
  cs_scenario_id TEXT,
  injected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, title)
);

CREATE INDEX IF NOT EXISTS idx_cs_scenario_library_account ON cs_scenario_library(account_id);
CREATE INDEX IF NOT EXISTS idx_cs_scenario_library_era ON cs_scenario_library(account_id, era);
CREATE INDEX IF NOT EXISTS idx_cs_scenario_library_status ON cs_scenario_library(account_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_cs_scenario_library_injected ON cs_scenario_library(account_id, injected);
