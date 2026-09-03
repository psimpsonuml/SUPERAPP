#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// Migration runner
//
//   node src/db/migrations/run.js            # apply pending migrations
//   node src/db/migrations/run.js --status   # show what would run
//   node src/db/migrations/run.js --dry-run  # parse and print, no writes
//   node src/db/migrations/run.js --only 004 # one migration by prefix
//
// Connects with DATABASE_URL — Supabase gives you one under
// Project Settings → Database → Connection string → URI. The Supabase
// JS client cannot execute DDL, which is why this uses `pg` directly.
//
// Applied migrations are recorded in schema_migrations with a checksum,
// so re-running is a no-op and an edited-after-apply file is reported
// rather than quietly skipped. Each file runs inside a transaction;
// the files themselves also carry BEGIN/COMMIT, which Postgres treats
// as a no-op inside an open transaction.
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

function migrationFiles() {
  return fs.readdirSync(DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();  // 000, 001, 002, 003, 004 — zero-padded so lexical == order
}

function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER
    )
  `);
}

async function appliedMap(client) {
  const { rows } = await client.query('SELECT filename, checksum, applied_at FROM schema_migrations');
  return new Map(rows.map(r => [r.filename, r]));
}

async function main() {
  const args = process.argv.slice(2);
  const statusOnly = args.includes('--status');
  const dryRun = args.includes('--dry-run');
  const includeDestructive = args.includes('--include-destructive');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      'DATABASE_URL is not set.\n\n'
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
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await ensureLedger(client);
    const applied = await appliedMap(client);

    let files = migrationFiles();
    if (only) files = files.filter(f => f.startsWith(only));
    if (files.length === 0) {
      console.error(only ? `No migration matches "${only}"` : 'No migrations found');
      process.exit(1);
    }

    const plan = [];
    for (const file of files) {
      const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
      const sum = checksum(sql);
      const prev = applied.get(file);

      let state;
      if (prev && prev.checksum === sum) state = 'applied';
      else if (prev) state = 'CHANGED-SINCE-APPLIED';
      else if (DESTRUCTIVE.has(file) && !includeDestructive && !only) state = 'skipped-destructive';
      else state = 'pending';

      plan.push({ file, sql, sum, state, appliedAt: prev?.applied_at });
    }

    console.log('\nMigration plan\n──────────────');
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
    const destructiveSkipped = plan.filter(p => p.state === 'skipped-destructive');

    if (destructiveSkipped.length > 0) {
      console.log(
        `\nSkipping ${destructiveSkipped.length} destructive migration(s). `
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

    for (const p of pending) {
      process.stdout.write(`\nApplying ${p.file} ... `);
      const started = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(p.sql);
        const ms = Date.now() - started;
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum, duration_ms) VALUES ($1, $2, $3) '
          + 'ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, '
          + 'applied_at = NOW(), duration_ms = EXCLUDED.duration_ms',
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
          console.error(`  near line ${line} of ${p.file}\n`);
        }
        // Stop here. Later migrations assume this one's tables exist,
        // and running them would produce a half-built schema that is
        // harder to diagnose than a clean stop.
        process.exit(1);
      }
    }

    console.log(`\n${pending.length} migration(s) applied.\n`);
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

module.exports = { migrationFiles, checksum };
