-- ══════════════════════════════════════════════════════════════════
-- Migration 000 — Prerequisites
--
-- Migrations 002 and 003 reference five tables they do not create:
--
--   accounts           every growth table's account_id FK
--   approval_queue     dispatch_log, growth_content, growth_outreach
--   content_memory     growth_content.content_memory_id (dedup reuse)
--   sending_domains    sending_mailboxes.domain_id
--   prospect_pipeline  002 ALTERs it; 003 links legacy_prospect_id
--
-- On the original SUPERAPP database those came from schema.sql, so the
-- gap never showed. On a fresh Supabase project — which is what the
-- PL Maren port is — 002 aborts on its first REFERENCES and nothing
-- after it runs. This file closes that gap so the migration set is
-- self-contained: 000 → 002 → 003 → 004 on an empty database.
--
-- Definitions are copied verbatim from src/db/schema.sql so this is a
-- no-op on the existing database (every statement is IF NOT EXISTS).
-- Run 001_remove_deprecated_modules.sql only against the old database;
-- it drops retired tables and has nothing to do on a fresh project.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid() in 002/003

-- ── accounts ──────────────────────────────────────────────────────
-- slider_position drives the approval tier model: tier 1 auto-approves
-- at >= 26, tier 2 at >= 51, tier 3 at >= 76. Default 60.
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'personal',
  slider_position INTEGER NOT NULL DEFAULT 60 CHECK (slider_position >= 0 AND slider_position <= 100),
  reduced_ops BOOLEAN NOT NULL DEFAULT FALSE,
  notification_email TEXT,
  notification_push_endpoint TEXT,
  escalation_window_minutes INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── content_memory ────────────────────────────────────────────────
-- Reused by growth_content for dedup/similarity rather than
-- reimplementing hashing in the Growth schema (spec §23).
CREATE TABLE IF NOT EXISTS content_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT,
  content_hash TEXT NOT NULL,
  content_text TEXT,
  keywords JSONB NOT NULL DEFAULT '[]',
  published_at TIMESTAMPTZ,
  engagement_score REAL DEFAULT 0,
  repurpose_chain_id UUID,
  source_content_id UUID REFERENCES content_memory(id),
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_memory_account ON content_memory(account_id);
CREATE INDEX IF NOT EXISTS idx_content_memory_product ON content_memory(account_id, product);
CREATE INDEX IF NOT EXISTS idx_content_memory_hash ON content_memory(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_memory_published ON content_memory(published_at);
CREATE INDEX IF NOT EXISTS idx_content_memory_chain ON content_memory(repurpose_chain_id);

-- ── approval_queue ────────────────────────────────────────────────
-- The human gate. Growth items submit here; the dispatcher (002) acts
-- on approval and records to dispatch_log.
CREATE TABLE IF NOT EXISTS approval_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  content_preview TEXT,
  full_content JSONB NOT NULL DEFAULT '{}',
  tier INTEGER NOT NULL DEFAULT 2 CHECK (tier >= 1 AND tier <= 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'auto_approved', 'edited'
  )),
  reviewer_notes TEXT,
  auto_approve_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  escalated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approval_queue_account ON approval_queue(account_id);
CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON approval_queue(account_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_queue_agent ON approval_queue(account_id, agent_id);

-- ── sending_domains ───────────────────────────────────────────────
-- Domain-level warmup and reputation. Individual mailboxes live in
-- sending_mailboxes (002) because this table has no `email` column —
-- that mismatch is the bug 002 exists to fix.
CREATE TABLE IF NOT EXISTS sending_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  warmup_status TEXT NOT NULL DEFAULT 'pending',
  warmup_started_at TIMESTAMPTZ,
  reputation_score REAL DEFAULT 0,
  daily_volume INTEGER NOT NULL DEFAULT 0,
  max_daily_volume INTEGER NOT NULL DEFAULT 10,
  mailbox_count INTEGER NOT NULL DEFAULT 1,
  blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sending_domains_account ON sending_domains(account_id);

-- ── prospect_pipeline ─────────────────────────────────────────────
-- LEGACY. This is the old Reddit/X discovery funnel, not part of
-- Growth OS. It is created here only so migrations 002 and 003 resolve
-- their references: 002 adds suppression columns to it, and
-- growth_prospects.legacy_prospect_id points at it for reconciliation
-- when Growth OS runs alongside the old funnel.
--
-- On a fresh project (PL Maren) it stays empty and no Growth OS code
-- path writes to it. It can be dropped once you have confirmed no
-- legacy rows need reconciling — see 004 for how to detach the FK.
CREATE TABLE IF NOT EXISTS prospect_pipeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  linkedin_url TEXT,
  company TEXT,
  title TEXT,
  product TEXT NOT NULL,
  icp_score REAL DEFAULT 0,
  track TEXT NOT NULL DEFAULT 'user' CHECK (track IN ('user', 'partner')),
  stage TEXT NOT NULL DEFAULT 'discovered' CHECK (stage IN (
    'discovered', 'email_drafted', 'contacted', 'replied', 'engaged', 'converted', 'closed_lost',
    'identified', 'pitch_drafted', 'pitched', 'in_discussion', 'evaluating', 'partnership_active', 'declined'
  )),
  source TEXT,
  source_url TEXT,
  platform TEXT,
  drafted_email JSONB,
  sent_via TEXT,
  last_contacted TIMESTAMPTZ,
  touch_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_stage ON prospect_pipeline(account_id, stage);
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_track ON prospect_pipeline(account_id, track);

-- ── outreach_sends ────────────────────────────────────────────────
-- LEGACY, same reasoning as prospect_pipeline: migration 002 ALTERs it
-- to add message_id, dispatch_id, clicked_at and unsubscribed_at.
-- Growth OS records its own sends in growth_outreach; this table
-- belongs to the old funnel and stays empty on a fresh project.
CREATE TABLE IF NOT EXISTS outreach_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospect_pipeline(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  track TEXT NOT NULL DEFAULT 'user',
  sending_domain TEXT,
  mailbox_email TEXT,
  subject TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_sends_account ON outreach_sends(account_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_prospect ON outreach_sends(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_date ON outreach_sends(account_id, sent_at);

-- ── Seed account ──────────────────────────────────────────────────
-- DEFAULT_ACCOUNT_ID in .env.example is this UUID. Without a row here
-- every insert fails its FK and the failure looks like a permissions
-- problem rather than a missing account.
INSERT INTO accounts (id, name, plan, slider_position)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Account', 'personal', 60)
ON CONFLICT (id) DO NOTHING;

COMMIT;
