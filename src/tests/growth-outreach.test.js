// Phase 8 — Outreach queue. The rules that matter:
// sequences STOP after their last touch (§10), daily caps are counted
// before drafting (§10), and LinkedIn has no send path (§11).
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const db = {
  growth_settings: [], growth_prospects: [], growth_prospect_events: [],
  growth_outreach: [], growth_suppressions: [],
};

function makeQuery(table) {
  let rows = [...(db[table] || [])];
  const q = {
    select() { return q; },
    eq(col, val) { rows = rows.filter(r => String(r[col]) === String(val)); return q; },
    neq() { return q; }, in(col, vals) { rows = rows.filter(r => vals.map(String).includes(String(r[col]))); return q; },
    is() { return q; }, not() { return q; }, ilike() { return q; },
    gte() { return q; }, lte() { return q; }, lt() { return q; },
    order() { return q; }, limit(n) { rows = rows.slice(0, n); return q; }, range() { return q; },
    insert(rec) {
      const recs = Array.isArray(rec) ? rec : [rec];
      const created = recs.map((r, i) => ({
        id: `${table}-${db[table].length + i + 1}`, created_at: new Date().toISOString(), ...r,
      }));
      db[table].push(...created); rows = created; return q;
    },
    upsert(rec) {
      const found = db[table].find(r => r.key === rec.key && r.account_id === rec.account_id);
      if (found) { Object.assign(found, rec); rows = [found]; return q; }
      return q.insert(rec);
    },
    update(patch) { rows.forEach(r => Object.assign(r, patch)); return q; },
    delete() { return q; },
    single() { return Promise.resolve({ data: rows[0] || null, error: rows[0] ? null : { message: 'not found' } }); },
    maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
    then(res) { return Promise.resolve({ data: rows, error: null }).then(res); },
  };
  return q;
}

const dbPath = path.join(ROOT, 'src/db/supabase.js');
require.cache[require.resolve(dbPath)] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { getSupabase: () => ({ from: makeQuery }), isSupabaseConfigured: () => true },
};

const OutreachService = require(path.join(ROOT, 'src/shared/growth/outreach'));
const { SEQUENCES, SENDER_CONTEXT } = require(path.join(ROOT, 'src/shared/growth/outreach'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

const PROSPECT = {
  id: 'p1', full_name: 'Dana Whitfield', title: 'Director of Payroll',
  company_name: 'Northwind Health', company_size: 2400, industry: 'Healthcare',
  email: 'dana@northwind.example', linkedin_url: 'https://linkedin.com/in/dana',
  payroll_fit_score: 85, fit_band: 'priority', status: 'ready',
  research_card: {
    recommended_asset: 'local_wage_database',
    why_they_fit: ['4 states', 'healthcare complexity'],
    conversation_angle: 'Local ordinances stack on the state rate.',
    risks: ['may use a PEO'],
  },
};

(async () => {
  const svc = new OutreachService('acct-1');

  console.log('\n── Sequences STOP (spec §10) ──');
  check('cold sequence has exactly 3 touches', SEQUENCES.cold.steps.length === 3,
    String(SEQUENCES.cold.steps.length));
  check('touch 2 is around day 5', SEQUENCES.cold.steps[1].dayOffset === 5);
  check('touch 3 is around day 12', SEQUENCES.cold.steps[2].dayOffset === 12);
  check('partnership is a separate sequence', !!SEQUENCES.partnership);
  check('partnership campaign differs from cold',
    SEQUENCES.partnership.campaign !== SEQUENCES.cold.campaign);

  // No history -> first touch
  const first = await svc.nextStepFor(PROSPECT, 'cold');
  check('untouched prospect gets step 1', first?.step === 1, JSON.stringify(first));

  // After all three -> null, sequence over
  db.growth_outreach.push(
    { id: 'o1', account_id: 'acct-1', prospect_id: 'p1', sequence: 'cold', step_number: 1, created_at: '2020-01-01T00:00:00Z' },
    { id: 'o2', account_id: 'acct-1', prospect_id: 'p1', sequence: 'cold', step_number: 2, created_at: '2020-01-06T00:00:00Z' },
    { id: 'o3', account_id: 'acct-1', prospect_id: 'p1', sequence: 'cold', step_number: 3, created_at: '2020-01-13T00:00:00Z' },
  );
  const exhausted = await svc.nextStepFor(PROSPECT, 'cold');
  check('sequence stops after touch 3', exhausted === null, JSON.stringify(exhausted));

  console.log('\n── A reply ends the cold sequence ──');
  for (const status of ['replied', 'positive', 'negative', 'meeting', 'converted']) {
    const stopped = await svc.nextStepFor({ ...PROSPECT, id: 'p2', status }, 'cold');
    check(`status "${status}" stops further touches`, stopped === null);
  }

  console.log('\n── Timing gate between touches ──');
  db.growth_outreach.length = 0;
  db.growth_outreach.push({
    id: 'o10', account_id: 'acct-1', prospect_id: 'p3', sequence: 'cold',
    step_number: 1, created_at: new Date().toISOString(),
  });
  const tooSoon = await svc.nextStepFor({ ...PROSPECT, id: 'p3' }, 'cold');
  check('touch 2 not due immediately', tooSoon === null, JSON.stringify(tooSoon));

  db.growth_outreach[0].created_at = new Date(Date.now() - 6 * 86400000).toISOString();
  const nowDue = await svc.nextStepFor({ ...PROSPECT, id: 'p3' }, 'cold');
  check('touch 2 due after 5 days', nowDue?.step === 2, JSON.stringify(nowDue));

  console.log('\n── Unknown sequence/step refuses ──');
  check('unknown sequence returns null', await svc.nextStepFor(PROSPECT, 'made_up') === null);

  let badStep = false;
  try {
    await svc.draft({ prospect: PROSPECT, sequence: 'cold', step: 4 });
  } catch (e) { badStep = /no step 4|stops after/.test(e.message); }
  check('step beyond the sequence throws', badStep);

  console.log('\n── Daily capacity is counted (spec §10) ──');
  db.growth_outreach.length = 0;
  const empty = await svc.remainingDailyCapacity();
  check('default cap is 20', empty.cap === 20, String(empty.cap));
  check('nothing used yet', empty.used === 0);
  check('full capacity remaining', empty.remaining === 20);

  for (let i = 0; i < 20; i++) {
    db.growth_outreach.push({
      id: `f${i}`, account_id: 'acct-1', channel: 'email',
      created_at: new Date().toISOString(),
    });
  }
  const full = await svc.remainingDailyCapacity();
  check('cap reached reports 0 remaining', full.remaining === 0, String(full.remaining));
  check('used reflects the day', full.used === 20, String(full.used));

  const li = await svc.linkedinCapacity();
  check('LinkedIn cap is separate', li.cap === 10, String(li.cap));
  check('email volume does not consume LinkedIn cap', li.used === 0, String(li.used));

  console.log('\n── Queueing refuses what cannot send ──');
  db.growth_outreach.length = 0;
  const draft = { sequence: 'cold', step: 1, subject: 's', body: 'b', asset: 'local_wage_database', campaign: 'c', link: 'http://x' };

  const noEmail = await svc.queueOutreach({
    prospect: { ...PROSPECT, email: null }, draft, channel: 'email',
  });
  check('no email refuses', noEmail.queued === false && noEmail.reason === 'prospect_has_no_email',
    JSON.stringify(noEmail));

  const noLi = await svc.queueOutreach({
    prospect: { ...PROSPECT, linkedin_url: null }, draft, channel: 'linkedin',
  });
  check('no LinkedIn URL refuses', noLi.queued === false && noLi.reason === 'prospect_has_no_linkedin');

  db.growth_suppressions.push({
    id: 's1', account_id: 'acct-1', email: 'blocked@x.example', domain: null, reason: 'unsubscribed',
  });
  const suppressed = await svc.queueOutreach({
    prospect: { ...PROSPECT, email: 'blocked@x.example' }, draft, channel: 'email',
  });
  check('suppressed address refuses', suppressed.queued === false && suppressed.reason === 'suppressed',
    JSON.stringify(suppressed));

  console.log('\n── LinkedIn is prepare-only (spec §11) ──');
  const liQueued = await svc.queueOutreach({ prospect: PROSPECT, draft, channel: 'linkedin' });
  check('LinkedIn row created', liQueued.queued === true);
  check('flagged requires_manual_send', liQueued.outreach.requires_manual_send === true);

  const emailQueued = await svc.queueOutreach({ prospect: PROSPECT, draft, channel: 'email' });
  check('email is not manual-send', emailQueued.outreach.requires_manual_send === false);

  check('service exposes no LinkedIn send method',
    typeof svc.sendLinkedIn === 'undefined' && typeof svc.sendConnectionRequest === 'undefined');

  console.log('\n── Next action text ──');
  check('manual send prompts copying',
    /Copy and send on LinkedIn/.test(svc.nextAction({ requires_manual_send: true }, PROSPECT)));
  check('missing email is called out',
    /Blocked/.test(svc.nextAction({ status: 'ready' }, { ...PROSPECT, email: null })));
  check('ready email prompts approval',
    /Approve to send/.test(svc.nextAction({ status: 'ready' }, PROSPECT)));

  console.log('\n── Sender voice rules (spec §10) ──');
  check('forbids demo asks', /NEVER open with a demo request/.test(SENDER_CONTEXT));
  check('forbids "I wanted to reach out"', /I wanted to reach out/.test(SENDER_CONTEXT));
  check('resource leads, not the pitch', /The resource IS the pitch/.test(SENDER_CONTEXT));
  check('word budget stated', /90-140 words/.test(SENDER_CONTEXT));

  const prompt = svc.buildPrompt({
    prospect: PROSPECT, seq: SEQUENCES.cold, stepDef: SEQUENCES.cold.steps[2],
    channel: 'email', asset: { label: 'Wage DB', bestFor: 'multi-state' },
    link: 'http://x', card: PROSPECT.research_card, context: null,
  });
  check('final touch says it is the last', /LAST touch/.test(prompt));
  check('research angle carried into the draft',
    prompt.includes('Local ordinances stack on the state rate'));
  check('risks carried', prompt.includes('may use a PEO'));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
