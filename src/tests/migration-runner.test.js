// Migration runner — the parts that decide whether an install into
// someone else's database stays additive.
//
// The behaviour under test is verified end-to-end against a real
// Postgres separately; this suite covers the pure logic, which is
// where a mistake would be silent.
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');

const runner = require(path.join(ROOT, 'src/db/migrations/run.js'));
const { stripTransactionControl, migrationFiles, checksum, EXPECTED_TABLES } = runner;

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

console.log('\n── Transaction control is stripped so search_path survives ──');
// The runner opens the transaction and sets search_path. A file's own
// COMMIT would end that transaction early and take the search_path
// with it — the rest of the file would then create tables in whatever
// schema came next, which on a shared database is the host site's.
check('a leading BEGIN goes',
  !/^BEGIN;/m.test(stripTransactionControl('BEGIN;\nCREATE TABLE a();\nCOMMIT;\n')));
check('a trailing COMMIT goes',
  !/^COMMIT;/m.test(stripTransactionControl('BEGIN;\nCREATE TABLE a();\nCOMMIT;\n')));
check('the statements between survive',
  /CREATE TABLE a\(\)/.test(stripTransactionControl('BEGIN;\nCREATE TABLE a();\nCOMMIT;\n')));
check('indented forms go too',
  !/BEGIN/.test(stripTransactionControl('   BEGIN;  \nSELECT 1;\n')));
check('lowercase goes too',
  !/begin/i.test(stripTransactionControl('begin;\nSELECT 1;\n')));

console.log('\n── PL/pgSQL BEGIN inside DO $$ ... $$ is left alone ──');
// Migration 003 ends with a DO block whose body opens with BEGIN.
// Stripping that would leave an unterminated block and the RLS
// policies would never be created.
const doBlock = `CREATE TABLE x();
DO $$
DECLARE t TEXT;
BEGIN
  EXECUTE 'SELECT 1';
END $$;
COMMIT;
`;
const stripped = stripTransactionControl(doBlock);
check('the block BEGIN survives', /\nBEGIN\n/.test(stripped), JSON.stringify(stripped));
check('the block END survives', /END \$\$;/.test(stripped));
check('the top-level COMMIT still goes', !/^COMMIT;/m.test(stripped));

console.log('\n── Applied to the real migration files ──');
const files = migrationFiles();
check('every migration is discovered', files.length === 6, `found ${files.length}`);
check('they sort into apply order',
  files[0].startsWith('000') && files[files.length - 1].startsWith('005'));

for (const f of files) {
  const raw = fs.readFileSync(path.join(ROOT, 'src/db/migrations', f), 'utf8');
  const out = stripTransactionControl(raw);
  check(`${f}: no top-level BEGIN/COMMIT left`,
    !/^[ \t]*(BEGIN|COMMIT)[ \t]*;[ \t]*$/im.test(out));
  check(`${f}: nothing else was removed`,
    out.replace(/\n/g, '').length
      === raw.replace(/^[ \t]*(BEGIN|COMMIT)[ \t]*;[ \t]*$/gim, '').replace(/\n/g, '').length);
}

console.log('\n── The DO block in 003 is intact after stripping ──');
const m003 = stripTransactionControl(
  fs.readFileSync(path.join(ROOT, 'src/db/migrations/003_growth_os_core.sql'), 'utf8'));
check('DO $$ still opens', /DO \$\$/.test(m003));
check('its BEGIN survives', /DECLARE t TEXT;\nBEGIN/.test(m003));
check('its END survives', /END \$\$;/.test(m003));
check('ROW LEVEL SECURITY still enabled there', /ENABLE ROW LEVEL SECURITY/.test(m003));

console.log('\n── Expected-table list matches what the migrations create ──');
// verifyTables() compares against this list after applying. If a
// migration gains a table and the list does not, the check silently
// stops covering it.
const allSql = migrationFiles()
  .filter(f => !f.startsWith('001'))          // 001 only drops
  .map(f => fs.readFileSync(path.join(ROOT, 'src/db/migrations', f), 'utf8'))
  .join('\n');

const created = [...allSql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g)]
  .map(m => m[1]);
const uniqueCreated = [...new Set(created)].sort();

check('every created table is on the expected list',
  uniqueCreated.every(t => EXPECTED_TABLES.includes(t)),
  uniqueCreated.filter(t => !EXPECTED_TABLES.includes(t)).join(', '));
check('every expected table is actually created',
  EXPECTED_TABLES.every(t => uniqueCreated.includes(t)),
  EXPECTED_TABLES.filter(t => !uniqueCreated.includes(t)).join(', '));
check('the list has no duplicates',
  new Set(EXPECTED_TABLES).size === EXPECTED_TABLES.length);

console.log('\n── The set never hardcodes a schema ──');
// Unqualified names are what let search_path place everything in the
// target schema. A stray `public.` would escape it.
check('no migration writes public.', !/\bpublic\./.test(allSql));

console.log('\n── Checksums are stable and content-sensitive ──');
check('same input, same sum', checksum('SELECT 1;') === checksum('SELECT 1;'));
check('one character changes it', checksum('SELECT 1;') !== checksum('SELECT 2;'));
check('sum is short enough to read', checksum('x').length === 16);

console.log('\n── The app reads from the same schema ──');
const clientSrc = fs.readFileSync(path.join(ROOT, 'src/db/supabase.js'), 'utf8');
check('supabase client is told the schema', /db: \{ schema: config\.supabase\.schema \}/.test(clientSrc));
const configSrc = fs.readFileSync(path.join(ROOT, 'src/config/index.js'), 'utf8');
check('schema defaults to beacon, not public',
  /schema: process\.env\.SUPABASE_SCHEMA \|\| 'beacon'/.test(configSrc));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
