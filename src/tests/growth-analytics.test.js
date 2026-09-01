// Phase 9 — Analytics. Two disciplines under test:
// empty denominators return null (not 0), and verdicts are withheld
// below the sample size (§16).
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const db = {
  growth_content: [], growth_prospects: [], growth_outreach: [],
  growth_attribution_events: [], growth_cost_events: [], growth_settings: [],
};

function makeQuery(table) {
  let rows = [...(db[table] || [])];
  const q = {
    select() { return q; },
    eq(col, val) { rows = rows.filter(r => String(r[col]) === String(val)); return q; },
    neq() { return q; }, in(col, vals) { rows = rows.filter(r => vals.map(String).includes(String(r[col]))); return q; },
    is() { return q; }, not() { return q; }, ilike() { return q; },
    gte(col, val) { rows = rows.filter(r => !r[col] || r[col] >= val); return q; },
    lte() { return q; }, lt() { return q; },
    order() { return q; }, limit(n) { rows = rows.slice(0, n); return q; }, range() { return q; },
    insert(rec) {
      const recs = Array.isArray(rec) ? rec : [rec];
      const created = recs.map((r, i) => ({ id: `${table}-${db[table].length + i + 1}`, ...r }));
      db[table].push(...created); rows = created; return q;
    },
    upsert(rec) { return q.insert(rec); },
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

const GrowthAnalyticsService = require(path.join(ROOT, 'src/shared/growth/analytics'));
const { ratio, REVIEW_COHORT_SIZE, MIN_SAMPLE_FOR_VERDICT, REPLY_RATE_BANDS } =
  require(path.join(ROOT, 'src/shared/growth/analytics'));
const GrowthAnalystAgent = require(path.join(ROOT, 'src/agents/growth-analyst'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

function reset() {
  for (const k of Object.keys(db)) db[k].length = 0;
}

(async () => {
  const svc = new GrowthAnalyticsService('acct-1');

  console.log('\n── Empty denominator is null, never zero ──');
  check('0/0 is null', ratio(0, 0) === null);
  check('5/0 is null', ratio(5, 0) === null);
  check('0/10 is 0, a real fact', ratio(0, 10) === 0);
  check('negative denominator is null', ratio(1, -5) === null);
  check('undefined denominator is null', ratio(1, undefined) === null);
  check('percentage computed correctly', ratio(3, 100) === 3);
  check('rounds to one decimal', ratio(1, 3) === 33.3, String(ratio(1, 3)));

  console.log('\n── Ratios with no activity ──');
  reset();
  const empty = await svc.ratios({ days: 30 });
  check('reply rate null with no sends', empty.reply_rate === null, String(empty.reply_rate));
  check('CAC null with no customers', empty.cac === null);
  check('cost per registration null', empty.cost_per_registration === null);
  check('denominators exposed', empty.denominators.emails_sent === 0);
  check('basis stated honestly', /emails SENT/.test(empty.basis_note));

  console.log('\n── §16 verdict withheld below sample ──');
  reset();
  const noSends = await svc.cohortDiagnostic({ days: 90 });
  check('no verdict with zero sends', noSends.verdict === null);
  check('says so plainly', noSends.verdict_label === 'No emails sent yet');
  check('sample flagged insufficient', noSends.sample_sufficient === false);

  // 10 contacted, 1 reply = 10% — flattering but meaningless
  reset();
  for (let i = 0; i < 10; i++) {
    db.growth_prospects.push({
      id: `p${i}`, account_id: 'acct-1', fit_band: 'good',
      status: i === 0 ? 'replied' : 'contacted',
      last_contacted_at: new Date().toISOString(), created_at: new Date().toISOString(),
    });
    db.growth_outreach.push({
      id: `o${i}`, account_id: 'acct-1', channel: 'email', status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }
  const small = await svc.cohortDiagnostic({ days: 90 });
  check('10% on 10 contacted gives no verdict', small.verdict === null, JSON.stringify(small.verdict));
  check('labelled too small', small.verdict_label === 'Sample too small to judge');
  check('guidance quantifies the noise', /single reply moves the rate/.test(small.guidance), small.guidance);
  check('rate still reported for transparency', small.reply_rate_pct === 10, String(small.reply_rate_pct));

  console.log('\n── §16 verdict given once sample suffices ──');
  reset();
  // 100 contacted, 1 reply = 1% -> targeting problem
  for (let i = 0; i < 100; i++) {
    db.growth_prospects.push({
      id: `p${i}`, account_id: 'acct-1', fit_band: 'good',
      status: i === 0 ? 'replied' : 'contacted',
      last_contacted_at: new Date().toISOString(), created_at: new Date().toISOString(),
    });
    db.growth_outreach.push({
      id: `o${i}`, account_id: 'acct-1', channel: 'email', status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }
  const low = await svc.cohortDiagnostic({ days: 90 });
  check('1% flags a targeting problem',
    low.verdict === 'likely_targeting_or_message_problem', low.verdict);
  check('sample now sufficient', low.sample_sufficient === true);
  check('disclaims benchmark status',
    /not industry benchmarks/.test(low.disclaimer), low.disclaimer);

  // 100 contacted, 8 replies = 8% -> scalable
  for (let i = 1; i <= 7; i++) db.growth_prospects[i].status = 'replied';
  const high = await svc.cohortDiagnostic({ days: 90 });
  check('8% suggests scaling', high.verdict === 'strong_enough_to_scale', high.verdict);

  // 3% -> viable
  reset();
  for (let i = 0; i < 100; i++) {
    db.growth_prospects.push({
      id: `p${i}`, account_id: 'acct-1', fit_band: 'good',
      status: i < 3 ? 'replied' : 'contacted',
      last_contacted_at: new Date().toISOString(), created_at: new Date().toISOString(),
    });
    db.growth_outreach.push({ id: `o${i}`, account_id: 'acct-1', channel: 'email', status: 'sent' });
  }
  const mid = await svc.cohortDiagnostic({ days: 90 });
  check('3% is potentially viable', mid.verdict === 'potentially_viable', mid.verdict);

  console.log('\n── Cohort accounting (spec §16) ──');
  check('cohort size is 200', REVIEW_COHORT_SIZE === 200);
  check('three bands defined', REPLY_RATE_BANDS.length === 3);
  check('minimum sample below cohort size', MIN_SAMPLE_FOR_VERDICT < REVIEW_COHORT_SIZE);
  check('counts down to next review', mid.until_next_review === 100, String(mid.until_next_review));
  check('no full cohort yet', mid.cohorts_complete === 0);

  console.log('\n── Impressions are unavailable, not zero ──');
  reset();
  const content = await svc.contentFunnel({ days: 30 });
  check('impressions null', content.impressions === null);
  check('reason given', /not connected/.test(content.impressions_note));

  console.log('\n── Contactability surfaced ──');
  reset();
  db.growth_prospects.push(
    { id: 'a', account_id: 'acct-1', fit_band: 'priority', email: null, status: 'ready', created_at: new Date().toISOString() },
    { id: 'b', account_id: 'acct-1', fit_band: 'priority', email: 'x@y.example', status: 'ready', created_at: new Date().toISOString() },
  );
  const outbound = await svc.outboundFunnel({ days: 30 });
  check('priority without email counted', outbound.priority_without_email === 1,
    String(outbound.priority_without_email));

  console.log('\n── Segment findings are sample-gated ──');
  reset();
  db.growth_prospects.push(
    { id: 's1', account_id: 'acct-1', industry: 'Healthcare', status: 'positive', last_contacted_at: 'x', fit_band: 'priority' },
    { id: 's2', account_id: 'acct-1', industry: 'Healthcare', status: 'contacted', last_contacted_at: 'x', fit_band: 'priority' },
    { id: 's3', account_id: 'acct-1', industry: 'Retail', status: 'positive', last_contacted_at: 'x', fit_band: 'good' },
  );
  const segments = await svc.segmentPerformance({ minSample: 5 });
  const healthcare = segments.find(s => s.segment === 'Healthcare');
  check('segment computed', !!healthcare);
  check('rate calculated', healthcare.positive_rate === 50, String(healthcare?.positive_rate));
  check('small sample flagged insufficient', healthcare.sufficient_sample === false);
  check('a 100% rate on 1 contact is still flagged',
    segments.find(s => s.segment === 'Retail')?.sufficient_sample === false);

  console.log('\n── Analyst recommends, never changes ──');
  const agent = Object.create(GrowthAnalystAgent.prototype);
  const recs = agent.buildRecommendations({
    outbound: { priority: 12, priority_without_email: 12, emails_sent: 0, customers: 0, contacted: 0 },
    content: { approved: 5, published: 0, failed: 2, generated: 8 },
    ratios: { cac: null, denominators: { growth_cost: 0 } },
    diagnostic: { sample_sufficient: false, contacted: 0, guidance: 'g' },
    segments: [], assets: [],
  });

  check('blocker raised for uncontactable priority',
    recs.some(r => r.type === 'blocker' && /no email address/.test(r.title)));
  check('blocker raised for unsent priority',
    recs.some(r => r.type === 'blocker' && /no email has been sent/.test(r.title)));
  check('blocker raised for unpublished approved content',
    recs.some(r => r.type === 'blocker' && /not reaching publication/.test(r.title)));
  check('failures surfaced', recs.some(r => /failed/.test(r.title)));
  check('every recommendation carries evidence', recs.every(r => !!r.evidence));
  check('no recommendation claims to have acted',
    recs.every(r => !/changed|updated|applied/i.test(r.title)));

  const thin = agent.buildRecommendations({
    outbound: { priority: 0, priority_without_email: 0, emails_sent: 5, customers: 0, contacted: 5 },
    content: { approved: 0, published: 0, failed: 0, generated: 0 },
    ratios: { cac: null, denominators: { growth_cost: 0 } },
    diagnostic: { sample_sufficient: false, contacted: 5, guidance: 'too small' },
    segments: [{ dimension: 'industry', segment: 'X', contacted: 2, positive: 2, positive_rate: 100, sufficient_sample: false }],
    assets: [],
  });
  check('a 100% segment with n=2 produces no experiment',
    !thin.some(r => r.type === 'experiment'), JSON.stringify(thin.filter(r => r.type === 'experiment')));
  check('thin data is called out instead',
    thin.some(r => r.type === 'info' && /too thin/.test(r.title)));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
