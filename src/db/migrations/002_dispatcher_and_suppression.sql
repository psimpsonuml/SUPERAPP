-- ══════════════════════════════════════════════════════════════════
-- Migration 002 — Approval dispatcher, suppression, and mailboxes
--
-- Closes the open approval loop. Before this, approving an item only
-- flipped approval_queue.status: executePost() and sendApprovedEmail()
-- had zero callers, so nothing was ever published or sent.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Suppression list ──────────────────────────────────────────────
-- Spec §13: every outbound workflow checks this before queuing or
-- sending. No exceptions.
CREATE TABLE IF NOT EXISTS growth_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Either a specific address or a whole domain. At least one required.
  email TEXT,
  domain TEXT,
  prospect_id UUID REFERENCES prospect_pipeline(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT 'other' CHECK (reason IN (
    'unsubscribed', 'requested_no_contact', 'bounced', 'spam_complaint',
    'manually_blocked', 'competitor', 'invalid', 'other'
  )),
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT suppression_target_required CHECK (email IS NOT NULL OR domain IS NOT NULL)
);

-- Case-insensitive uniqueness so 'A@B.com' and 'a@b.com' collapse
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppressions_email
  ON growth_suppressions (account_id, LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppressions_domain
  ON growth_suppressions (account_id, LOWER(domain)) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppressions_account ON growth_suppressions (account_id);

-- ── Dispatch log ──────────────────────────────────────────────────
-- Every approval -> action attempt, successful or not. Spec §34 item 17:
-- failed jobs must visibly fail rather than silently do nothing.
CREATE TABLE IF NOT EXISTS dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  approval_item_id UUID REFERENCES approval_queue(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  agent_id TEXT,
  handler TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'dispatched', 'skipped', 'failed', 'no_handler', 'suppressed'
  )),
  attempt INTEGER NOT NULL DEFAULT 1,
  result JSONB DEFAULT '{}',
  error_message TEXT,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One successful dispatch per approval item — the idempotency guard
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispatch_once
  ON dispatch_log (approval_item_id) WHERE status = 'dispatched';
CREATE INDEX IF NOT EXISTS idx_dispatch_account ON dispatch_log (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_status ON dispatch_log (account_id, status);

-- ── Sending mailboxes ─────────────────────────────────────────────
-- sending_domains has no `email` column, so getNextMailbox() returned
-- rows whose .email was undefined and every send had an undefined
-- From address. One domain has many mailboxes.
CREATE TABLE IF NOT EXISTS sending_mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES sending_domains(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  product TEXT,
  warmup_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (warmup_status IN ('pending', 'warming', 'ready', 'paused')),
  -- Volume is tracked per-day so it resets without a cron job:
  -- when volume_date <> today, the count is treated as 0.
  daily_volume INTEGER NOT NULL DEFAULT 0,
  volume_date DATE NOT NULL DEFAULT CURRENT_DATE,
  max_daily_volume INTEGER NOT NULL DEFAULT 20,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, email)
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_account ON sending_mailboxes (account_id);
CREATE INDEX IF NOT EXISTS idx_mailboxes_rotation
  ON sending_mailboxes (account_id, active, warmup_status, daily_volume);

-- ── outreach_sends: link to the dispatch + provider message id ─────
ALTER TABLE outreach_sends ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE outreach_sends ADD COLUMN IF NOT EXISTS dispatch_id UUID REFERENCES dispatch_log(id) ON DELETE SET NULL;
ALTER TABLE outreach_sends ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE outreach_sends ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- ── prospect_pipeline: suppression + contact hygiene ──────────────
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS email_status TEXT;
ALTER TABLE prospect_pipeline ADD COLUMN IF NOT EXISTS company_domain TEXT;

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE growth_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sending_mailboxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS growth_suppressions_isolation ON growth_suppressions;
CREATE POLICY growth_suppressions_isolation ON growth_suppressions
  USING (account_id::text = current_setting('app.account_id', TRUE));

DROP POLICY IF EXISTS dispatch_log_isolation ON dispatch_log;
CREATE POLICY dispatch_log_isolation ON dispatch_log
  USING (account_id::text = current_setting('app.account_id', TRUE));

DROP POLICY IF EXISTS sending_mailboxes_isolation ON sending_mailboxes;
CREATE POLICY sending_mailboxes_isolation ON sending_mailboxes
  USING (account_id::text = current_setting('app.account_id', TRUE));

COMMIT;
