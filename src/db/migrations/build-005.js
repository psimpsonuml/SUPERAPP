#!/usr/bin/env node
// Regenerates 005_operations.sql from the eight standalone operations
// schema files. Run this if one of them changes:
//
//   node src/db/migrations/build-005.js
//
// If 005 has already been applied to a database, regenerating it will
// trip the runner's checksum guard — which is the correct outcome.
// Write a 006 for the change instead of editing an applied migration.

const fs = require('fs');
const path = require('path');

const SOURCES = [
  ['book_publishing', 'Book Publishing'],
  ['pr', 'PR & Media'],
  ['design', 'Design Studio'],
  ['kb', 'Knowledge Base'],
  ['testimonials', 'Testimonials'],
  ['partners', 'Partners'],
  ['revenue', 'Revenue'],
  ['podcast_producer', 'Podcast Producer'],
];

const DB_DIR = path.join(__dirname, '..');
const OUT = path.join(__dirname, '005_operations.sql');

// Statements Postgres refuses inside a transaction block. The runner
// wraps each migration in BEGIN/COMMIT, so one of these appearing in a
// source file would fail at apply time rather than here — check now.
const NON_TRANSACTIONAL = /CREATE\s+INDEX\s+CONCURRENTLY|VACUUM|CREATE\s+DATABASE|ALTER\s+SYSTEM/i;

function build() {
  let out = `-- ══════════════════════════════════════════════════════════════════
-- Migration 005 — Operations schema
--
-- GENERATED. Do not hand-edit; regenerate with:
--   node src/db/migrations/build-005.js
--
-- The eight operations pages each shipped with a standalone schema
-- file under src/db/*_schema.sql, applied by hand. On the retiring
-- SUPERAPP that was survivable; for the port it is not — nothing
-- recorded which of them had run. This migration folds them into the
-- ordered set so \`npm run migrate:growth\` builds the whole thing.
--
-- Sources, in application order:
`;

  for (const [file, label] of SOURCES) {
    out += `--   src/db/${file}_schema.sql  (${label})\n`;
  }

  out += `--
-- None of these reference the Growth OS tables, and none reference
-- each other across files, so the order is only for readability.
-- Every statement is IF NOT EXISTS: safe to run more than once, and a
-- no-op on a database where the schemas were already applied by hand.
-- ══════════════════════════════════════════════════════════════════
`;

  for (const [file, label] of SOURCES) {
    const src = path.join(DB_DIR, `${file}_schema.sql`);
    if (!fs.existsSync(src)) throw new Error(`Missing source schema: ${src}`);

    const sql = fs.readFileSync(src, 'utf8');
    const offending = sql.match(NON_TRANSACTIONAL);
    if (offending) {
      throw new Error(
        `${file}_schema.sql contains "${offending[0]}", which cannot run inside `
        + 'a transaction. Move it into its own migration.'
      );
    }

    out += `\n\n-- ══════════════ ${label} (${file}_schema.sql) ══════════════\n`;
    out += sql.trimEnd() + '\n';
  }

  fs.writeFileSync(OUT, out);
  return out;
}

if (require.main === module) {
  const out = build();
  console.log(`Wrote ${path.relative(process.cwd(), OUT)} — ${out.split('\n').length} lines `
    + `from ${SOURCES.length} schema files.`);
}

module.exports = { build, SOURCES };
