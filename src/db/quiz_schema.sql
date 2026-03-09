-- BeaconOps Profile Quiz Schema
-- Tables: quiz_questions, quiz_answers, quiz_profile

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Quiz Questions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'multiple_choice'
    CHECK (answer_type IN ('multiple_choice', 'scale', 'spectrum', 'open_text', 'ranking', 'boolean')),
  options JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  reask_days INTEGER DEFAULT NULL,
  dimension TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_text)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_category ON quiz_questions(category);

-- ── Quiz Answers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_answer TEXT,
  previous_answered_at TIMESTAMPTZ,
  UNIQUE(account_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_account ON quiz_answers(account_id);

-- ── Quiz Profile (computed dimensions) ──────────────────────
CREATE TABLE IF NOT EXISTS quiz_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  category TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  description TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, dimension)
);

CREATE INDEX IF NOT EXISTS idx_quiz_profile_account ON quiz_profile(account_id);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_profile ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "quiz_answers_account" ON quiz_answers FOR ALL USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "quiz_profile_account" ON quiz_profile FOR ALL USING (account_id = current_setting('app.account_id')::uuid); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
