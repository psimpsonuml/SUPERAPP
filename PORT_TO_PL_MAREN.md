# Handoff: porting BeaconOps Growth OS + Operations into PL Maren

**Audience:** the Claude Code session working on the PL Maren author website.
**Written by:** the session working on the SUPERAPP repo, which is being retired.

You have no access to the SUPERAPP repo's history, so this document is
self-contained. Everything below is either a fact verified in that session or a
decision that is still open and marked as such.

**Source:** `https://github.com/psimpsonuml/SUPERAPP`
**Branch:** `claude/beaconops-system-architecture-eR1Qa`
**Commit at handoff:** `13563f9`

---

## 1. What is being moved, and what is not

SUPERAPP is a personal operations monorepo (Express API + Next.js dashboard +
23 scheduled agents). The owner is retiring it and wants two parts of it living
in the PL Maren author site instead, as **private admin tooling for himself** —
not reader-facing pages, not a public product.

### In scope

**Growth OS** — a marketing/outreach engine: content pipeline, prospect
research and scoring, cold-outreach drafting, publishing to social, funnel
analytics. 15 tables, 7 scheduled workers, 68 API endpoints, 4 dashboard pages.

**Eight operations modules** — Book Publishing, PR & Media, Design Studio,
Knowledge Base, Testimonials, Partners, Revenue, Podcast Producer. 22 tables,
115 API endpoints, 8 dashboard pages.

### Explicitly out of scope

The personal modules stay in the retiring repo and do **not** come across:
wrestling, pets, journal, goals, nostalgia, recommendations, stores, live
events, podcasts (the subscription tracker, distinct from Podcast Producer),
quiz, life manager, TMDB.

### The multi-brand requirement

One engine, two configured brands:

- **`payroll_beacon`** — B2B payroll compliance. The ICP the whole engine was
  originally written for.
- **`pl_maren`** — the author business. Readers, reviewers, podcast bookers,
  bookstores, rights contacts.

They share the engine, the approval queue and the safety limits. They share
nothing of the ICP, scoring weights, cadence or voice. The database work for
this is done; threading it through the workers is not (§7).

---

## 2. The single most important constraint: this must be additive

The PL Maren database already belongs to the author site. This schema wants
table names the site plausibly already uses — on a test database seeded to look
like an author site, **four names collided**: `accounts`, `testimonials`,
`books_authored`, `partners`.

Installing into `public` would fail silently and destructively in both
directions:

- `CREATE TABLE IF NOT EXISTS testimonials` does nothing when one already
  exists. It does not warn. The migration reports success, and from then on the
  operations module reads and writes the *site's* table with the wrong shape.
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` would silently add this system's
  columns to the site's live table.

**So it installs into its own Postgres schema — `beacon` — and never into
`public`.** The two sets of tables are separate objects. Neither can read or
alter the other. `public.testimonials` and `beacon.testimonials` coexist without
knowing about each other, and the whole install is reversible with
`DROP SCHEMA beacon CASCADE`.

Do not "simplify" this back to `public`. The runner refuses `--schema public`
when it would collide, and that refusal is deliberate.

### Verified on a database seeded to look like the author site

Five public tables with real rows, four colliding by name. After applying the
full set:

- All 43 tables landed in `beacon`; the runner verifies this and exits non-zero
  if any bound to a `public` table instead.
- `public`'s columns and row counts were byte-identical before and after.
- `DROP SCHEMA beacon CASCADE` left the site exactly as it started.
- `--schema public` refused with a non-zero exit.

---

## 3. Step one: the schema

Copy `src/db/migrations/` (8 files, ~1,875 lines) into the PL Maren repo. It
contains the SQL, the runner, and the generator for migration 005.

```bash
# .env
DATABASE_URL=postgresql://...      # Supabase → Settings → Database → URI
SUPABASE_SCHEMA=beacon

npm install pg                      # the runner's only new dependency

node src/db/migrations/run.js --preflight   # writes nothing; shows collisions
node src/db/migrations/run.js               # applies
```

Use the **session pooler or direct connection**. The transaction pooler on port
6543 does not support this DDL.

Then, in **Supabase → Project Settings → API → Exposed schemas**, add `beacon`.
Without it PostgREST cannot see the tables and every query returns "relation not
found". This is the most likely day-one failure.

### What each migration does

| File | Purpose | Tables |
|---|---|---|
| `000_prerequisites.sql` | `accounts`, `approval_queue`, `content_memory`, `sending_domains`, plus two legacy tables 002 alters. Seeds the default account. | 6 |
| `001_remove_deprecated_modules.sql` | Drops retired personal modules. **Never run this on PL Maren.** Skipped by default. | — |
| `002_dispatcher_and_suppression.sql` | Suppression list, dispatch log, sending mailboxes. | 3 |
| `003_growth_os_core.sql` | Campaigns, content sources, content, assets, prospects, outreach, cost/attribution events, settings. Enables RLS on 11 of them. | 11 |
| `004_multi_brand.sql` | `growth_brands`, `brand_id` on nine tables, per-brand uniqueness, three-layer settings. | 1 |
| `005_operations.sql` | The eight operations modules. **Generated** — regenerate with `build-005.js`, never hand-edit. | 22 |

### Runner behaviour worth knowing

- Ledger in `beacon.schema_migrations` with checksums. Re-running is a no-op.
- A migration edited after being applied is a **hard failure**, not a silent
  skip. Write a new migration instead.
- The runner owns the transaction and strips each file's own `BEGIN`/`COMMIT`.
  This matters: a file's `COMMIT` would end the runner's transaction early and
  take the `search_path` with it, and every statement after that point would
  create tables in the wrong schema. The stripping is dollar-quote aware so the
  PL/pgSQL `BEGIN` inside 003's `DO $$` block survives.
- After applying, it verifies all 43 expected tables are in `beacon`.

### Row-level security: partial

Migration 003 enables RLS with an account-isolation policy on the 11 growth
tables; 002 covers 3 more; 004 covers `growth_brands`. **15 tables have RLS.**
The 22 operations tables and the 6 prerequisites have none. Behind a service key
on a single account that is survivable, but it is a real gap — not an absence of
need. Worth closing before any second user exists.

---

## 4. The layers, and how much work each is

SUPERAPP is Express + Next.js. PL Maren is Next.js. That seam is the only real
architectural work, and it lands on the thinnest layer.

| Layer | What it is | Lines | Effort |
|---|---|---|---|
| **Domain** | `src/shared/**` (33 files) and `src/agents/**` (27 files). Plain Node against the Supabase JS client. No Express anywhere in it. | ~6,500 (growth subset) | Copy as-is |
| **UI** | `app/growth/**` (4 pages) and `app/operations/**` (8 pages). Already written for the Next App Router. | 9,343 | Copy as-is |
| **HTTP** | `src/dashboard/routes/*.js` — 183 Express handlers that validate input and call the domain layer. | 5,001 | Rewrite as Route Handlers |
| **Scheduling** | BullMQ worker + an existing Vercel Cron fallback. | — | Decision (§9) |

### Recommendation

Drop Express and BullMQ. Convert the handlers to Next Route Handlers under
`app/api/` and schedule the workers with Vercel Cron. One deployment, one set of
env vars, and server components in the author site can read Growth OS data
directly instead of over HTTP.

The rewrite is mechanical — these handlers are thin — but 183 of them is real
work. **Do Growth OS first (68 endpoints); that gets the engine running.** The
115 operations endpoints can follow module by module, because nothing in
operations depends on Growth OS.

### Copy manifest

```
src/shared/**            → lib/beacon/shared/**      (33 files)
src/agents/**            → lib/beacon/agents/**      (27 files)
src/db/migrations/**     → db/migrations/**          (8 files)
src/db/supabase.js       → lib/beacon/db/supabase.js
src/config/index.js      → merge into your config    (needs supabase.schema)
src/config/schedule.js   → lib/beacon/config/schedule.js
app/growth/**            → app/admin/growth/**       (4 pages)
app/operations/**        → app/admin/operations/**   (8 pages)
lib/api.js               → the seam; rewrite paths to match your routes
```

`src/agents/` contains all 23 agents including the out-of-scope personal ones.
Take the 7 growth agents plus whatever else the operations pages need; the rest
can be left behind. `src/agents/registry.js` will need pruning to match.

---

## 5. The Supabase client must be told the schema

```js
createClient(url, serviceKey, {
  auth: { persistSession: false },
  db: { schema: config.supabase.schema },   // 'beacon'
});
```

`config.supabase.schema` defaults to `process.env.SUPABASE_SCHEMA || 'beacon'`.
Every query goes through this one client, so this is a single change — but
missing it means every query silently hits `public` and fails.

---

## 6. The brand model

### `growth_brands`

One row per brand per account. Seeded by migration 004 with `payroll_beacon`
(default) and `pl_maren`. A partial unique index enforces exactly one default
per account.

Nine tables carry `brand_id`: `growth_prospects`, `growth_content`,
`growth_campaigns`, `growth_outreach`, `content_sources`, `growth_assets`,
`growth_cost_events`, `growth_attribution_events`, plus the two event logs.

Prospect uniqueness moved from per-account to **per-brand** — a payroll director
who also reads fiction can legitimately sit in both lists with different scores
and different sequences.

### `BrandService` — `lib/beacon/shared/growth/brands.js`

```js
const brands = new BrandService(accountId);

await brands.resolve('pl_maren')   // by slug
await brands.resolve(uuid)         // by id
await brands.resolve(null)         // → the default brand
await brands.resolve('typo')       // throws UnknownBrandError (status 404)
await brands.list()
await brands.create({ slug, name, positioning, voice, channels })
await brands.setDefault(idOrSlug)
```

Two rules it enforces, both deliberate:

1. **Resolution never guesses.** An unknown slug throws rather than falling
   through to the default. Writing payroll outreach to a reader list because a
   slug was mistyped is exactly the failure worth being loud about.
2. **Voice and positioning are never invented.** Resolved brands carry
   `configured: false` and a `missing_config` array when nothing has been said
   about who the brand is. Generators should refuse rather than improvise claims
   about a real business.

### Three-layer settings

`GrowthSettingsService` resolves in order: **module defaults → account row →
brand row.** A brand states only what differs and inherits the rest.

```js
new GrowthSettingsService(accountId)            // account-wide only (old behaviour)
new GrowthSettingsService(accountId, brandId)   // brand-aware

await settings.get('limits')          // merged effective value
await settings.provenance('limits')   // { key: 'brand' | 'account' | 'default' }
await settings.set('limits', { max_daily_cold_emails: 3 }, { scope: 'brand' })
```

Keys: `limits`, `scoring_weights`, `fit_bands`, `icp`, `cadence`, `savings`.

Notes for whoever builds the settings UI:

- A brand write stores **only the keys given**, so the rest keeps inheriting.
  Storing the merged effective value would freeze a copy of the account config
  into the brand and the two would drift.
- `provenance()` exists so the UI can show which layer supplied each value.
  Without it an inherited setting is indistinguishable from a deliberate one —
  which is how a brand ends up running on another brand's ICP unnoticed.
- Uniqueness is two **partial** indexes (`WHERE brand_id IS NULL` /
  `IS NOT NULL`). PostgREST's `onConflict` cannot name a partial index's
  predicate, so `set()` does an explicit read-then-insert-or-update rather than
  an upsert. Don't "simplify" it back to `.upsert()`.

### What deliberately does not carry a brand

- **`growth_suppressions` is account-wide.** An unsubscribe is a person saying
  *stop emailing me*, not *stop emailing me about payroll*. Scoping suppressions
  per brand would let one brand mail someone the other was told to leave alone.
  Global, fail-closed. Do not add `brand_id` to it.
- **`approval_queue` is single.** One place to review; the brand is carried on
  the item.
- **The operations tables** are author-business data already, so they got no
  brand column. Revenue and partners are the two that arguably span both — see
  §9.

---

## 7. Not done: threading the brand through the workers

**This is the biggest remaining piece of Growth OS work.** The brand dimension
exists in the database and in `BrandService`/`GrowthSettingsService`, but the
callers have not been updated.

Eleven call sites construct `GrowthSettingsService` with only an account id. The
constructor's second argument is optional, so they all keep working and silently
operate account-wide — which is the failure mode to close deliberately rather
than leave to be discovered.

```
src/shared/growth/import.js:30
src/shared/growth/prospects.js:40
src/shared/growth/calendar.js:41
src/shared/growth/outreach.js:73
src/agents/growth-content-repurposer.js:39
src/agents/growth-scheduler.js:43
src/dashboard/routes/growth.js:223, 233, 637, 808, 1151
```

(`src/shared/growth/settings.js:112` also constructs one, but that is
`forBrand()` passing a brand through deliberately — leave it alone.)

Each worker needs a brand to run as. Suggested approach: resolve it from a
`brandId` job argument, falling back to `process.env.DEFAULT_BRAND` (documented
in `.env.example` as `payroll_beacon`), and pass it to every service the worker
constructs. The generator, outreach writer and researcher additionally need the
brand's `positioning`/`voice` in their prompts — right now those prompts have
"Payroll Beacon is a B2B payroll compliance product" hardcoded in
`src/shared/growth/generator.js`, `outreach.js` and `research.js`.

---

## 8. Route-layer gotchas

These cost real debugging time in the original build. Carry them across.

- **Route ordering.** `POST /dispatch/:approvalItemId` registered before
  `POST /dispatch/retry-failed` swallows it. Same class of bug with
  `/api/cron/batch/run` vs `/api/cron/:agentId`. In Next.js App Router, static
  segments win over dynamic ones automatically — so this mostly *goes away* —
  but verify rather than assume.
- **The unsubscribe endpoint is public.** `growth.js` exports a separate
  `publicRouter` mounted *before* the account guard, serving
  `GET /api/growth/unsubscribe`. It must stay reachable without auth — it is the
  link in every outbound email. Everything else must sit behind auth.
- **Suppression checks must never build a PostgREST `.or()` filter from user
  input.** Interpolating an address into a filter string means a comma can alter
  the predicate. `src/shared/suppression.js` uses two exact-match queries
  instead. Keep it that way.
- **Cron schedules are extracted from `src/config/schedule.js`.** The
  `inbox-monitor` entry's cron is a *computed expression*, not a string literal
  (it depends on `INBOX_MONITOR_FREQUENCY`). A regex-based extraction silently
  dropped it once, and email classification would have stopped running. Resolve
  the module with `node -e` rather than parsing the source.

---

## 9. Open decisions — need the owner

1. **The author brand's ICP and scoring weights.** Migration 004 seeds
   `pl_maren` with an **empty** `icp` and `cadence`, marked `UNSET` in the
   description column. Guessing them would be worse than leaving them blank — a
   made-up profile scores the wrong people as priority prospects and nothing in
   the output says so. **Until they are filled in, the author brand inherits
   Payroll Beacon's ICP** (multi-state payroll leaders at 200–5,000 employee
   companies) and any score it produces is provisional. What's needed: who the
   author business actually contacts, and what makes one worth reaching.

2. **Admin authentication.** Currently the account id comes from an
   `x-account-id` header or an env default — anyone who can reach the API is the
   account. This is the owner's private tooling, so the whole surface needs to
   sit behind the author site's existing auth plus an admin check. Not merely
   unlinked from the nav. **Blocking before anything is internet-reachable.**

3. **Revenue and partners: shared or per-brand?** They got no `brand_id`. If
   per-brand reporting is wanted, that's a small migration 006 — but decide
   before data accumulates.

4. **Vercel Cron vs. a Railway worker.** Serverless functions cap at 60s on
   Hobby, 300s on Pro. `growth-prospect-engine` (Apollo import) and
   `growth-content-research` both fan out across an external API and could
   exceed that on a large batch. Either chunk them behind a cursor or keep one
   long-running worker for those two. Decide before the first live import, not
   after it times out halfway through a paid Apollo pull.

---

## 10. The scheduled workers

Seven Growth OS workers. Cron expressions from `src/config/schedule.js` (ET).

| Agent | Cron | What it does |
|---|---|---|
| `publish-dispatcher` | `*/10 * * * *` | Turns approvals into actions. **Essential and critical-on-failure** — silent failure looks exactly like "nobody approved anything today". |
| `growth-content-research` | `0 5 * * 1` | Weekly topic sweep |
| `growth-content-repurposer` | `0 6 * * 1` | Weekly content package generation |
| `growth-scheduler` | `0 7 * * 1` | Weekly calendar slot assignment |
| `growth-prospect-engine` | `0 6 * * 2` | Weekly Apollo import + scoring |
| `growth-outreach-assistant` | `30 7 * * 1-5` | Weekday outreach drafting |
| `growth-analyst` | `0 9 * * 5` | Weekly funnel review |

All extend `BaseAgent` (`accountId, options`), implement `async run()`, and
submit work through `submitForApproval()`. The existing cron route
(`src/dashboard/routes/cron.js`) is already secured by a `CRON_SECRET` bearer
token and dispatches by agent id — port that pattern rather than reinventing it.

---

## 11. Safety rules — carry these across verbatim

These are the owner's stated constraints, not suggestions. They are enforced in
the current code and must stay enforced.

**AI must never automatically:**
- send LinkedIn connection requests
- send LinkedIn DMs
- post to the owner's personal LinkedIn profile
- aggressively email unreviewed prospect lists
- publish low-confidence or generated content without approval

**Never implement browser automation that:** mass-sends connection requests,
mass-DMs, auto-comments, auto-likes, imitates human browsing, or attempts to
evade platform limits.

**Other standing rules:**
- Every outbound workflow checks suppressions before queuing or sending. No
  exceptions.
- No placeholder image URLs, ever. Instagram has no text-only post, so content
  without a real hosted image is **refused** (`no_image_available`) rather than
  published with a placeholder. A previous version shipped
  `https://placeholder.com/img.jpg` as a fallback, which guaranteed failure.
- The content generator never invents compliance facts.
- No hardcoded fake credentials.
- Automations may not silently raise safety limits. `GrowthSettingsService.set()`
  rejects `source: 'automation'` writes that would increase a guarded limit.
- Automations do not change campaigns on their own.
- **LinkedIn publishing is company-page only.** There is no publisher class for
  personal LinkedIn at all — not a disabled one, none. `manualReason()` cites the
  spec.

### The design principle behind all of it

**Fail visibly; never report a clean zero.** Unconfigured integrations return
named refusal reasons — `not_configured`, `no_image_available`,
`prospect_has_no_email`, `no_mailbox_available`, `manual_posting_required` —
rather than succeeding with nothing. Ratios return null rather than 0 when the
denominator is absent. Verdicts are gated on sample size. Preserve this; a lot
of the code's shape exists to maintain it.

---

## 12. Verification status — be precise about this

**Verified against a real Postgres 16 in the source session:**
- The full migration set applies to an empty database and produces 44 tables
  (43 + the ledger).
- It applies to a database seeded to look like the author site without touching
  a single existing column or row.
- Re-running is a no-op; replaying 004 by hand changes nothing.
- The one-default-brand index rejects a second default.
- The checksum guard fires on drift.
- `DROP SCHEMA beacon CASCADE` cleanly uninstalls.
- 408 automated checks pass across twelve suites.

**Not verified — do not describe as working:**
- Nothing has touched a real Supabase project.
- The workers have never run on a schedule anywhere.
- No outbound integration has a live credential: Apollo, Resend, Anthropic,
  Brave, Meta, LinkedIn are all unconfigured.
- The Route Handler rewrite does not exist yet.
- The brand dimension is not threaded through any worker (§7).

---

## 13. Suggested order

1. Copy `db/migrations/`, run `--preflight`, then apply. Expose `beacon` in
   Supabase. *(ready now)*
2. Copy the domain layer (`src/shared/**`, the growth agents, `supabase.js`),
   point env at the new project. No code changes needed.
3. Thread the brand through the eleven call sites in §7 and the three hardcoded
   prompts.
4. Convert the 68 Growth endpoints to Route Handlers. Mind §8.
5. Bring over the 4 Growth pages; add a brand switcher in the shell and a brand
   badge wherever a page shows brand-scoped data.
6. Add cron entries. Watch the `inbox-monitor` computed-cron trap (§8).
7. Add credentials one at a time, set the automation slider low so everything
   lands in the approval queue, and watch one full cycle before letting anything
   auto-approve.
8. Then the 115 operations endpoints and 8 pages, module by module.

Steps 1–3 are what make the system real. Everything after is surface area.
