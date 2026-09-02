// Integration test for the approval dispatcher using a fake Supabase.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

// ── Fake Supabase ─────────────────────────────────────────
const db = {
  approval_queue: [],
  dispatch_log: [],
  growth_suppressions: [],
  sending_mailboxes: [],
  prospect_pipeline: [],
  outreach_sends: [],
  accounts: [{ id: 'acct-1', slider_position: 60, reduced_ops: false }],
};

function makeQuery(table) {
  let rows = [...(db[table] || [])];
  let pendingInsert = null;
  const q = {
    _table: table,
    select() { return q; },
    eq(col, val) { rows = rows.filter(r => String(r[col]) === String(val)); return q; },
    in(col, vals) { rows = rows.filter(r => vals.map(String).includes(String(r[col]))); return q; },
    or(expr) {
      // supports "email.eq.X,domain.eq.Y"
      const clauses = expr.split(',').map(c => {
        const parts = c.split('.');
        return { col: parts[0], val: parts.slice(2).join('.') };
      });
      rows = rows.filter(r => clauses.some(c => r[c.col] && String(r[c.col]) === c.val));
      return q;
    },
    lte() { return q; },
    gte() { return q; },
    lt() { return q; },
    is() { return q; },
    order() { return q; },
    limit(n) { rows = rows.slice(0, n); return q; },
    range() { return q; },
    insert(rec) {
      const recs = Array.isArray(rec) ? rec : [rec];
      pendingInsert = recs.map(r => ({ id: `${table}-${db[table].length + 1}`, ...r }));
      db[table].push(...pendingInsert);
      rows = pendingInsert;
      return q;
    },
    upsert(rec) { return q.insert(rec); },
    update(patch) {
      rows.forEach(r => Object.assign(r, patch));
      return q;
    },
    delete() { return q; },
    single() { return Promise.resolve({ data: rows[0] || null, error: rows[0] ? null : { message: 'not found' } }); },
    maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
    then(res) { return Promise.resolve({ data: rows, error: null }).then(res); },
  };
  return q;
}

const fakeSupabase = { from: (t) => makeQuery(t) };

// Patch the db module before anything requires it
const dbPath = path.join(ROOT, 'src/db/supabase.js');
require.cache[require.resolve(dbPath)] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { getSupabase: () => fakeSupabase, isSupabaseConfigured: () => true },
};

const { dispatch, registeredTypes } = require(path.join(ROOT, 'src/shared/dispatcher'));
const SuppressionService = require(path.join(ROOT, 'src/shared/suppression'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

(async () => {
  console.log('\n── Handler registry ──');
  const types = registeredTypes();
  check('social_post handled', types.handled.includes('social_post'));
  check('outreach_email handled', types.handled.includes('outreach_email'));
  check('ad_creative is manual-only', types.manualOnly.includes('ad_creative'));

  console.log('\n── Unknown item type ──');
  const unknown = { id: 'a1', item_type: 'totally_unknown', agent_id: 'x', full_content: {} };
  const r1 = await dispatch(unknown, 'acct-1');
  check('returns no_handler', r1.status === 'no_handler', JSON.stringify(r1));
  check('logged to dispatch_log', db.dispatch_log.some(l => l.status === 'no_handler'));

  console.log('\n── Manual-only item ──');
  const manual = { id: 'a2', item_type: 'ad_creative', agent_id: 'ad-creative', full_content: {} };
  const r2 = await dispatch(manual, 'acct-1');
  check('returns skipped', r2.status === 'skipped', JSON.stringify(r2));
  check('reason is manual_only', r2.reason === 'manual_only');

  console.log('\n── Missing required field ──');
  const noPostId = { id: 'a3', item_type: 'social_post', agent_id: 'social-distributor', full_content: {} };
  const r3 = await dispatch(noPostId, 'acct-1');
  check('returns failed', r3.status === 'failed', JSON.stringify(r3));
  check('reason names the gap', r3.reason === 'missing_post_log_id', r3.reason);
  check('failure is logged', db.dispatch_log.some(l => l.status === 'failed'));

  console.log('\n── Idempotency ──');
  db.dispatch_log.push({ id: 'dl-x', account_id: 'acct-1', approval_item_id: 'a9', status: 'dispatched' });
  const dup = { id: 'a9', item_type: 'social_post', agent_id: 'x', full_content: { postLogId: 'p1' } };
  const r4 = await dispatch(dup, 'acct-1');
  check('second dispatch skipped', r4.status === 'skipped', JSON.stringify(r4));
  check('reason is already_dispatched', r4.reason === 'already_dispatched');

  console.log('\n── Suppression: fails closed ──');
  const sup = new SuppressionService('acct-1');
  check('empty email suppressed', (await sup.check('')).suppressed);
  check('malformed email suppressed', (await sup.check('not-an-email')).suppressed);
  const clean = await sup.check('cfo@example.com');
  check('clean email allowed', clean.suppressed === false, JSON.stringify(clean));

  db.growth_suppressions.push({ id: 's1', account_id: 'acct-1', email: 'blocked@example.com', domain: null, reason: 'unsubscribed' });
  const blocked = await sup.check('blocked@example.com');
  check('listed email suppressed', blocked.suppressed === true, JSON.stringify(blocked));
  check('reason surfaced', blocked.reason === 'unsubscribed');

  db.growth_suppressions.push({ id: 's2', account_id: 'acct-1', email: null, domain: 'competitor.com', reason: 'competitor' });
  const domBlocked = await sup.check('anyone@competitor.com');
  check('domain-level suppression works', domBlocked.suppressed === true, JSON.stringify(domBlocked));

  console.log('\n── filterContactable ──');
  const { allowed, blocked: blockedList } = await sup.filterContactable([
    { id: 'p1', email: 'ok@example.com' },
    { id: 'p2', email: 'blocked@example.com' },
    { id: 'p3', email: 'x@competitor.com' },
    { id: 'p4', email: 'flagged@example.com', do_not_contact: true },
  ]);
  check('1 allowed', allowed.length === 1, `got ${allowed.length}`);
  check('3 blocked', blockedList.length === 3, `got ${blockedList.length}`);
  check('do_not_contact respected', blockedList.some(b => b.prospect.id === 'p4'));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
