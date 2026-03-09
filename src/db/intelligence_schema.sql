-- Intelligence Analyst: expand intelligence_log with additional fields
-- for influencer, newsletter, launch_platform, book_agent, competitor categories

-- Add columns that don't exist yet (safe IF NOT EXISTS style via DO blocks)

DO $$ BEGIN
  ALTER TABLE intelligence_log ADD COLUMN category TEXT NOT NULL DEFAULT 'general';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE intelligence_log ADD COLUMN platform TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE intelligence_log ADD COLUMN product TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE intelligence_log ADD COLUMN relevance_score INTEGER CHECK (relevance_score >= 1 AND relevance_score <= 10);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE intelligence_log ADD COLUMN cost_estimate TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE intelligence_log ADD COLUMN contact_info TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE intelligence_log ADD COLUMN url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE intelligence_log ADD COLUMN potential_reach BIGINT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE intelligence_log ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Update status check constraint to include all valid statuses
-- (safe: new constraint replaces old if exists)
DO $$ BEGIN
  ALTER TABLE intelligence_log DROP CONSTRAINT IF EXISTS intelligence_log_status_check;
  ALTER TABLE intelligence_log ADD CONSTRAINT intelligence_log_status_check
    CHECK (status IN ('discovered', 'contacted', 'in_progress', 'completed', 'passed', 'new'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_intelligence_log_account ON intelligence_log(account_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_log_category ON intelligence_log(account_id, category);
CREATE INDEX IF NOT EXISTS idx_intelligence_log_product ON intelligence_log(account_id, product);
CREATE INDEX IF NOT EXISTS idx_intelligence_log_status ON intelligence_log(account_id, status);
CREATE INDEX IF NOT EXISTS idx_intelligence_log_name ON intelligence_log(account_id, name, category);
CREATE INDEX IF NOT EXISTS idx_intelligence_log_date ON intelligence_log(account_id, date_found);
