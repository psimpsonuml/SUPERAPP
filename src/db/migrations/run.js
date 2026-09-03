#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// Migration runner
//
//   node src/db/migrations/run.js --preflight  # what's already there
//   node src/db/migrations/run.js --status     # what would run
//   node src/db/migrations/run.js              # apply pending
//   node src/db/migrations/run.js --only 004   # one, by filename prefix
//
// ── It installs into its own schema ───────────────────────────────
//
// Everything lands in a dedicated Postgres schema (default `beacon`),
// never in `public`. This matters when the target database already
// belongs to something else — PL Maren's site owns tables called
// `testimonials`, `partners`, `books_authored`, `accounts`, and this
// schema wants all four names.
//
// In `public` that collision would be silent and destructive in both
// directions: CREATE TABLE IF NOT EXISTS skips a name that already
// exists, so the app would then read and write the site's table with
// the wrong shape; ALTER TABLE ADD COLUMN IF NOT EXISTS would quietly
// add columns to it. A separate schema removes the question — the two
// sets of tables cannot see each other, and the whole install is
// reversible with one DROP SCHEMA.
//
// Override with --schema <name> or BEACON_SCHEMA. Passing
// --schema public is allowed but warns, because that is the one
// configuration where a name collision can damage existing data.
//
// ── Everything else ───────────────────────────────────────────────
//
// Connects with DATABASE_URL — Supabase gives you one under
// Project Settings → Database → Connection string → URI. The Supabase
// JS client cannot execute DDL, which is why this uses `pg` directly.
//
// Applied migrations are recorded in <schema>.schema_migrations with a
// checksum, so re-running is a no-op and an edited-after-apply file is
// reported rather than quietly skipped.
//
// The runner owns the transaction: each file's own BEGIN/COMMIT is
// stripped before it runs, so the search_path set for the file holds
// for every statement in it. A file's COMMIT would otherwise end the
// transaction early and drop the search_path along with it.
//
// 001_remove_deprecated_modules.sql is destructive (it drops the
// retired personal-module tables). It is skipped unless you pass
// --include-destructive, because on a fresh database it has nothing to
// do and on a populated one it should be a deliberate act.
// ══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const DIR = __dirname;
const DESTRUCTIVE = new Set(['001_remove_deprecated_modules.sql']);
const DEFAULT_SCHEMA = process.env.BEACON_SCHEMA || 'beacon';

// Every table the set is expected to create. Checked after applying so
// that a table which bound to an existing `public` name instead of
// being created in our schema is reported rather than discovered later
// by a worker writing to the wrong place.
const EXPECTED_TABLES = [
  // 000 — prerequisites and legacy
  'accounts', 'approval_queue', 'content_memory', 'sending_domains',
  'prospect_pipeline', 'outreach_sends',
  // 002 — dispatcher
  'growth_suppressions', 'dispatch_log', 'sending_mailboxes',
  // 003 — growth core
  'growth_settings', 'growth_campaigns', 'content_sources', 'growth_content',
  'growth_content_events', 'growth_assets', 'growth_prospects',
  'growth_prospect_events', 'growth_outreach', 'growth_cost_events',
  'growth_attribution_events',
  // 004 — brands
  'growth_brands',
  // 005 — operations
  'books_authored', 'book_publishing', 'book_chapters', 'book_arcs',
  'book_queries', 'book_reviews', 'book_sales', 'book_marketing_calendar',
  'press_releases', 'media_contacts', 'media_mentions', 'media_opportunities',
  'design_assets', 'design_templates', 'kb_articles', 'kb_question_log',
  'testimonials', 'partners', 'partner_referrals', 'partner_payments',
  'revenue_snapshots', 'podcast_episodes_produced',
];

// ── SQL helpers ───────────────────────────────────────────────────

function migrationFiles() {
  return fs.readdirSync(DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();  // 000, 001, 002, ... — zero-padded, so lexical == order
}

function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(
      `Invalid schema name "${name}". Use lowercase letters, digits and underscores.`
    );
  }
  return `"${name}"`;
}

/**
 * Remove the file's own transaction control.
 *
 * Only top-level statements are touched. `BEGIN` also opens a PL/pgSQL
 * block inside a DO $$ ... $$ body — migration 003 has one — so the
 * text is split on dollar-quote delimiters and only the segments
 * outside them are rewritten.
 */
function stripTransactionControl(sql) {
  const parts = sql.split('$$');
  return parts
    .map((part, i) => (
      i % 2 === 0                              // even segments are outside $$ ... $$
        ? part.replace(/^[ \t]*(BEGIN|COMMIT)[ \t]*;[ \t]*$/gim, '')
        : part
    ))
    .join('$$');
}

// ── Ledger ────────────────────────────────────────────────────────

async function ensureSchema(client, schema) {
  const q = quoteIdent(schema);
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${q}`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${q}.schema_migrations (
      filename    TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER
    )
  `);
}

async function appliedMap(client, schema) {
  const { rows } = await client.query(
    `SELECT filename, checksum, applied_at FROM ${quoteIdent(schema)}.schema_migrations`
  );
  return new Map(rows.map(r => [r.filename, r]));
}

// ── Preflight ─────────────────────────────────────────────────────

/**
 * Report what the target database already contains, before anything
 * is written. The collision list is the point: it names every table
 * this set would have fought over had it installed into `public`.
 */
async function preflight(client, schema) {
  const { rows: schemas } = await client.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`, [schema]
  );
  const schemaExists = schemas.length > 0;

  const { rows: publicTables } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  const publicNames = publicTables.map(r => r.table_name);

  let ourTables = [];
  if (schemaExists) {
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`, [schema]
    );
    ourTables = rows.map(r => r.table_name);
  }

  const collisions = EXPECTED_TABLES.filter(t => publicNames.includes(t)).sort();

  console.log('\nPreflight\n─────────');
  console.log(`  target schema        ${schema}${schemaExists ? '' : '  (will be created)'}`);
  console.log(`  tables already in it ${ourTables.length}`);
  console.log(`  tables in public     ${publicNames.length}`);

  if (publicNames.length > 0) {
    console.log('\n  public already contains:');
    console.log('    ' + publicNames.join(', ').replace(/(.{72}) /g, '$1\n    '));
  }

  if (collisions.length > 0) {
    console.log(
      `\n  ${collisions.length} name(s) this set also wants:\n`
      + collisions.map(c => `    ${c}`).join('\n')
      + `\n\n  These stay untouched. Installing into "${schema}" instead of public\n`
      + '  is what keeps them that way — the two sets of tables are separate\n'
      + '  objects and neither can read or alter the other.'
    );
  } else if (publicNames.length > 0) {
    console.log('\n  No name collisions with public.');
  }

  console.log(
    `\n  To remove this install later, in full:\n`
    + `    DROP SCHEMA ${quoteIdent(schema)} CASCADE;\n`
  );

  return { schemaExists, publicNames, collisions, ourTables };
}

/** Confirm every expected table actually landed in our schema. */
async function verifyTables(client, schema) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'`, [schema]
  );
  const present = new Set(rows.map(r => r.table_name));
  return EXPECTED_TABLES.filter(t => !present.has(t));
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const has = flag => args.includes(flag);
  const value = flag => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };

  const preflightOnly = has('--preflight');
  const statusOnly = has('--status');
  const dryRun = has('--dry-run');
  const includeDestructive = has('--include-destructive');
  const only = value('--only');
  const schema = value('--schema') || DEFAULT_SCHEMA;

  quoteIdent(schema);  // validate early, before connecting

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      '\nDATABASE_URL is not set.\n\n'
      + 'Supabase → Project Settings → Database → Connection string → URI.\n'
      + 'Use the session pooler or direct connection; the transaction\n'
      + 'pooler (port 6543) does not support the DDL these migrations run.\n'
    );
    process.exit(1);
  }

  const { Client } = require('pg');
  const client = new Client({
    connectionString: url,
    // Supabase presents a certificate chain Node does not carry a root
    // for on every platform. The connection is still TLS-encrypted.
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const report = await preflight(client, schema);

    if (schema === 'public') {
      console.error(
        '  WARNING: installing into public.\n'
        + (report.collisions.length > 0
          ? `  ${report.collisions.length} existing table(s) share a name with this set.\n`
            + '  CREATE TABLE IF NOT EXISTS will skip them, and the app will then\n'
            + '  read and write YOUR tables with the wrong shape. Do not do this.\n'
          : '  No collisions today, but a future table on either side can create\n'
            + '  one silently. A dedicated schema has no such failure mode.\n')
      );
      if (!has('--i-mean-it')) {
        console.error('  Refusing. Re-run with --i-mean-it if this is deliberate.\n');
        process.exit(1);
      }
    }

    if (preflightOnly) return;

    await ensureSchema(client, schema);
    const applied = await appliedMap(client, schema);

    let files = migrationFiles();
    if (only) files = files.filter(f => f.startsWith(only));
    if (files.length === 0) {
      console.error(only ? `\nNo migration matches "${only}"\n` : '\nNo migrations found\n');
      process.exit(1);
    }

    const plan = [];
    for (const file of files) {
      const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
      const sum = checksum(raw);
      const prev = applied.get(file);

      let state;
      if (prev && prev.checksum === sum) state = 'applied';
      else if (prev) state = 'CHANGED-SINCE-APPLIED';
      else if (DESTRUCTIVE.has(file) && !includeDestructive && !only) state = 'skipped-destructive';
      else state = 'pending';

      plan.push({ file, sql: stripTransactionControl(raw), sum, state, appliedAt: prev?.applied_at });
    }

    console.log('Migration plan\n──────────────');
    for (const p of plan) {
      const when = p.appliedAt ? `  (${new Date(p.appliedAt).toISOString().slice(0, 19)}Z)` : '';
      console.log(`  ${p.state.padEnd(22)} ${p.file}${when}`);
    }

    const changed = plan.filter(p => p.state === 'CHANGED-SINCE-APPLIED');
    if (changed.length > 0) {
      console.error(
        `\n${changed.length} migration(s) were edited after being applied:\n`
        + changed.map(c => `  ${c.file}`).join('\n')
        + '\n\nThe database does not match the files. Write a new migration for\n'
        + 'the change rather than editing an applied one — re-running an\n'
        + 'edited file would silently apply only the parts that are still\n'
        + 'idempotent.\n'
      );
      process.exit(1);
    }

    const pending = plan.filter(p => p.state === 'pending');
    const skipped = plan.filter(p => p.state === 'skipped-destructive');

    if (skipped.length > 0) {
      console.log(
        `\nSkipping ${skipped.length} destructive migration(s). `
        + 'Pass --include-destructive to run them.'
      );
    }

    if (statusOnly || dryRun) {
      console.log(`\n${pending.length} pending. Nothing was applied.\n`);
      return;
    }

    if (pending.length === 0) {
      console.log('\nUp to date.\n');
      return;
    }

    const q = quoteIdent(schema);

    for (const p of pending) {
      process.stdout.write(`\nApplying ${p.file} ... `);
      const started = Date.now();
      try {
        await client.query('BEGIN');
        // Our schema first, so every unqualified CREATE lands in it.
        // public and extensions follow only so that functions supplied
        // by extensions resolve; verifyTables() below catches anything
        // that bound to a public table instead of being created here.
        await client.query(`SET LOCAL search_path = ${q}, public, extensions`);
        await client.query(p.sql);
        const ms = Date.now() - started;
        await client.query(
          `INSERT INTO ${q}.schema_migrations (filename, checksum, duration_ms) `
          + 'VALUES ($1, $2, $3) ON CONFLICT (filename) DO UPDATE SET '
          + 'checksum = EXCLUDED.checksum, applied_at = NOW(), duration_ms = EXCLUDED.duration_ms',
          [p.file, p.sum, ms]
        );
        await client.query('COMMIT');
        console.log(`ok (${ms}ms)`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.log('FAILED');
        console.error(`\n${p.file} failed and was rolled back:\n  ${err.message}\n`);
        if (err.position) {
          const line = p.sql.slice(0, Number(err.position)).split('\n').length;
          console.error(`  near line ${line} of ${p.file} (after stripping BEGIN/COMMIT)\n`);
        }
        // Stop here. Later migrations assume this one's tables exist,
        // and running them would produce a half-built schema that is
        // harder to diagnose than a clean stop.
        process.exit(1);
      }
    }

    console.log(`\n${pending.length} migration(s) applied.`);

    const missing = await verifyTables(client, schema);
    if (missing.length > 0 && !only) {
      console.error(
        `\nWARNING: ${missing.length} expected table(s) are not in "${schema}":\n`
        + missing.map(m => `  ${m}`).join('\n')
        + '\n\nMost likely a statement resolved to a same-named table in public\n'
        + 'instead of creating one here. Do not run the app against this\n'
        + 'database until it is understood.\n'
      );
      process.exit(1);
    }

    console.log(
      `All ${EXPECTED_TABLES.length} tables verified in "${schema}".\n\n`
      + `Point the app at it with SUPABASE_SCHEMA=${schema}, and add "${schema}" to\n`
      + 'Supabase → Project Settings → API → Exposed schemas so PostgREST\n'
      + 'can see it.\n'
    );
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`\nMigration runner failed: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  migrationFiles, checksum, stripTransactionControl, EXPECTED_TABLES,
};
