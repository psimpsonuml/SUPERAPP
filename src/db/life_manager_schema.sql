-- BeaconOps Life Manager Schema
-- Tables: reminders, reminder_completions, family_log

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Reminders (Routines) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily'
    CHECK (frequency IN ('daily', 'specific_days', 'weekly', 'custom')),
  days_of_week JSONB DEFAULT '[]',        -- e.g. ["mon","wed","fri"] for specific_days
  custom_interval_days INTEGER,            -- for custom frequency
  time_of_day TIME NOT NULL DEFAULT '09:00',
  category TEXT NOT NULL DEFAULT 'personal'
    CHECK (category IN ('health', 'household', 'kids', 'personal', 'work')),
  active BOOLEAN NOT NULL DEFAULT true,
  streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_account ON reminders(account_id);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(account_id, active);

-- ── Reminder Completions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminder_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'missed', 'skipped')),
  UNIQUE(reminder_id, completed_date)
);

CREATE INDEX IF NOT EXISTS idx_reminder_completions_account ON reminder_completions(account_id);
CREATE INDEX IF NOT EXISTS idx_reminder_completions_reminder ON reminder_completions(reminder_id);
CREATE INDEX IF NOT EXISTS idx_reminder_completions_date ON reminder_completions(account_id, completed_date);

-- ── Family Log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS family_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entry_text TEXT NOT NULL,
  photo_url TEXT,
  child_tag TEXT,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('funny_quote', 'milestone', 'first_time', 'medical', 'school', 'general')),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_log_account ON family_log(account_id);
CREATE INDEX IF NOT EXISTS idx_family_log_date ON family_log(account_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_family_log_child ON family_log(account_id, child_tag);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_account" ON reminders FOR ALL USING (account_id = current_setting('app.account_id')::uuid);
CREATE POLICY "reminder_completions_account" ON reminder_completions FOR ALL USING (account_id = current_setting('app.account_id')::uuid);
CREATE POLICY "family_log_account" ON family_log FOR ALL USING (account_id = current_setting('app.account_id')::uuid);
