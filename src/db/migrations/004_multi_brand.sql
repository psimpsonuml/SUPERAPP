-- ══════════════════════════════════════════════════════════════════
-- Migration 004 — Multi-brand dimension
--
-- Growth OS was built for one brand (Payroll Beacon). The engine moves
-- to PL Maren and must run two brands side by side: the payroll
-- compliance business and the author business. They share the engine,
-- the approval queue and the safety limits' *shape*, but almost nothing
-- of their content: different ICP, different scoring weights, different
-- cadence, different voice, different prospects.
--
-- The model here is a brand dimension, not a second deployment:
--
--   growth_brands          one row per brand, per account
--   <table>.brand_id       which brand a row belongs to
--   growth_settings        two-level: brand row overrides account row
--
-- What deliberately stays account-wide:
--
--   growth_suppressions    An unsubscribe is a person saying "stop
--                          emailing me", not "stop emailing me about
--                          payroll". Scoping suppressions per brand
--                          would let brand B mail someone brand A was
--                          told to leave alone. Fail closed: global.
--   approval_queue         One queue, one place to review. Brand is
--                          carried on the item, not the queue.
--   dispatch_log           Idempotency is per approval item, which is
--                          already brand-specific through its content.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ── Brands ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Maps onto the legacy `product` string used by content_memory,
  -- sending_mailboxes and prospect_pipeline so the two vocabularies
  -- stay reconcilable instead of drifting apart.
  product TEXT,

  -- What the generator, outreach writer and researcher need to know
  -- to write as this brand rather than the other one. Empty means
  -- "fall back to the module default" — never means "make it up".
  positioning JSONB NOT NULL DEFAULT '{}',
  voice JSONB NOT NULL DEFAULT '{}',

  -- Where this brand is allowed to publish. A brand with no channels
  -- configured produces drafts and nothing auto-publishes.
  channels JSONB NOT NULL DEFAULT '[]',

  website_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_growth_brands_account ON growth_brands(account_id, status);

-- Same account isolation the other growth tables get in 003. Without
-- it growth_brands would be the one table in the set readable across
-- accounts, and it is the table that decides which list a message is
-- written for.
ALTER TABLE growth_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS growth_brands_isolation ON growth_brands;
CREATE POLICY growth_brands_isolation ON growth_brands
  USING (account_id::text = current_setting('app.account_id', TRUE));

-- Exactly one default brand per account. A partial unique index is the
-- only way to say that without a trigger.
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_brands_one_default
  ON growth_brands(account_id) WHERE is_default;

-- ── Seed the two brands ───────────────────────────────────────────
-- Payroll Beacon is the default because every existing row belongs to
-- it; the backfill below depends on that.
INSERT INTO growth_brands (account_id, slug, name, description, product, is_default, website_url)
SELECT a.id, 'payroll_beacon', 'Payroll Beacon',
       'B2B payroll compliance. Multi-state payroll leaders at 200-5000 employee companies.',
       'payroll_beacon', TRUE, 'https://payrollbeacon.com'
FROM accounts a
ON CONFLICT (account_id, slug) DO NOTHING;

INSERT INTO growth_brands (account_id, slug, name, description, product, is_default)
SELECT a.id, 'pl_maren', 'P.L. Maren',
       'Author business. Readers, reviewers, podcasts, bookstores and rights contacts.',
       'pl_maren', FALSE
FROM accounts a
ON CONFLICT (account_id, slug) DO NOTHING;

-- ── brand_id on the tables that carry brand-specific rows ─────────
ALTER TABLE growth_campaigns          ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE CASCADE;
ALTER TABLE growth_content            ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE CASCADE;
ALTER TABLE growth_prospects          ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE CASCADE;
ALTER TABLE growth_outreach           ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE CASCADE;
ALTER TABLE content_sources           ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE CASCADE;
ALTER TABLE growth_assets             ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE CASCADE;
ALTER TABLE growth_cost_events        ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE SET NULL;
ALTER TABLE growth_attribution_events ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE SET NULL;

-- Event tables inherit their brand from the parent row, so they get a
-- column for query convenience but no constraint of their own.
ALTER TABLE growth_content_events     ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE SET NULL;
ALTER TABLE growth_prospect_events    ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE SET NULL;

-- ── Backfill ──────────────────────────────────────────────────────
-- Everything that exists today is Payroll Beacon. Campaigns carry a
-- `product` string already, so honour it where it disagrees.
UPDATE growth_campaigns c
SET brand_id = COALESCE(
  (SELECT b.id FROM growth_brands b WHERE b.account_id = c.account_id AND b.product = c.product),
  (SELECT b.id FROM growth_brands b WHERE b.account_id = c.account_id AND b.is_default)
)
WHERE c.brand_id IS NULL;

UPDATE growth_content x
SET brand_id = (SELECT b.id FROM growth_brands b WHERE b.account_id = x.account_id AND b.is_default)
WHERE x.brand_id IS NULL;

UPDATE growth_prospects x
SET brand_id = (SELECT b.id FROM growth_brands b WHERE b.account_id = x.account_id AND b.is_default)
WHERE x.brand_id IS NULL;

UPDATE growth_outreach x
SET brand_id = (SELECT b.id FROM growth_brands b WHERE b.account_id = x.account_id AND b.is_default)
WHERE x.brand_id IS NULL;

UPDATE content_sources x
SET brand_id = (SELECT b.id FROM growth_brands b WHERE b.account_id = x.account_id AND b.is_default)
WHERE x.brand_id IS NULL;

UPDATE growth_assets x
SET brand_id = (SELECT b.id FROM growth_brands b WHERE b.account_id = x.account_id AND b.is_default)
WHERE x.brand_id IS NULL;

-- ── Indexes on the hot paths ──────────────────────────────────────
-- Every list view in the dashboard filters by (account, brand).
CREATE INDEX IF NOT EXISTS idx_growth_campaigns_brand  ON growth_campaigns(account_id, brand_id);
CREATE INDEX IF NOT EXISTS idx_growth_content_brand    ON growth_content(account_id, brand_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_brand  ON growth_prospects(account_id, brand_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_outreach_brand   ON growth_outreach(account_id, brand_id, status);
CREATE INDEX IF NOT EXISTS idx_content_sources_brand   ON content_sources(account_id, brand_id);
CREATE INDEX IF NOT EXISTS idx_growth_assets_brand     ON growth_assets(account_id, brand_id);
CREATE INDEX IF NOT EXISTS idx_growth_cost_brand       ON growth_cost_events(account_id, brand_id, created_at);

-- ── Per-brand duplicate prevention ────────────────────────────────
-- growth_prospects was unique on (account_id, email). Two brands may
-- legitimately both hold the same person — a payroll director who also
-- reads fiction — with different scores and different sequences.
-- Uniqueness becomes per-brand. Cross-brand contact frequency is a
-- suppression/cooldown question, not a uniqueness one, and stays
-- global by design (see the header).
DROP INDEX IF EXISTS idx_growth_prospects_email;
DROP INDEX IF EXISTS idx_growth_prospects_linkedin;
DROP INDEX IF EXISTS idx_growth_prospects_source;

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_prospects_email_brand
  ON growth_prospects(account_id, brand_id, LOWER(email))
  WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_prospects_linkedin_brand
  ON growth_prospects(account_id, brand_id, linkedin_url)
  WHERE linkedin_url IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_prospects_source_brand
  ON growth_prospects(account_id, brand_id, source, source_id)
  WHERE source_id IS NOT NULL;

-- ── Settings become two-level ─────────────────────────────────────
-- A row with brand_id IS NULL is the account-wide value; a row with a
-- brand_id overrides it for that brand. GrowthSettingsService merges
-- module defaults -> account row -> brand row, so a brand only has to
-- state what differs. That matters here: the author brand shares the
-- safety limits but shares none of the ICP.
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES growth_brands(id) ON DELETE CASCADE;

-- The old constraint assumed one row per key. Replace it with two
-- partial indexes — a plain UNIQUE over a nullable brand_id would let
-- duplicate account-wide rows through, because NULL != NULL.
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_account_id_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_settings_account_key
  ON growth_settings(account_id, key) WHERE brand_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_settings_brand_key
  ON growth_settings(account_id, brand_id, key) WHERE brand_id IS NOT NULL;

-- ── Author-brand settings ─────────────────────────────────────────
-- Seeded empty on purpose. The scoring weights and ICP for the author
-- business are a judgement call the owner has to make; a guessed ICP
-- would silently score the wrong people as priority prospects. Until
-- these are filled in, the author brand inherits the account defaults
-- and its prospect scores should be read as provisional.
INSERT INTO growth_settings (account_id, brand_id, key, value, description, updated_by)
SELECT b.account_id, b.id, 'icp', '{}'::jsonb,
       'UNSET — author-brand ICP. Inherits the Payroll Beacon default until configured.',
       'system'
FROM growth_brands b WHERE b.slug = 'pl_maren'
ON CONFLICT DO NOTHING;

INSERT INTO growth_settings (account_id, brand_id, key, value, description, updated_by)
SELECT b.account_id, b.id, 'cadence', '{}'::jsonb,
       'UNSET — author-brand publishing cadence. Inherits the account default until configured.',
       'system'
FROM growth_brands b WHERE b.slug = 'pl_maren'
ON CONFLICT DO NOTHING;

COMMIT;
