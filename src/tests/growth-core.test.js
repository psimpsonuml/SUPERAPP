// Phase 3 Growth OS core services — fit scoring, settings guards,
// attribution URL building, and cost estimation.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

// ── Fake Supabase ─────────────────────────────────────────
const db = {
  growth_settings: [],
  growth_prospects: [],
  growth_prospect_events: [],
  growth_suppressions: [],
  growth_cost_events: [],
  growth_attribution_events: [],
};

function makeQuery(table) {
  let rows = [...(db[table] || [])];
  const q = {
    select() { return q; },
    eq(col, val) { rows = rows.filter(r => String(r[col]) === String(val)); return q; },
    neq(col, val) { rows = rows.filter(r => String(r[col]) !== String(val)); return q; },
    in(col, vals) { rows = rows.filter(r => vals.map(String).includes(String(r[col]))); return q; },
    ilike(col, val) { rows = rows.filter(r => (r[col] || '').toLowerCase() === String(val).toLowerCase()); return q; },
    not() { return q; },
    is() { return q; },
    gte() { return q; },
    lte() { return q; },
    order() { return q; },
    limit(n) { rows = rows.slice(0, n); return q; },
    range() { return q; },
    insert(rec) {
      const recs = Array.isArray(rec) ? rec : [rec];
      const created = recs.map((r, i) => ({ id: `${table}-${db[table].length + i + 1}`, ...r }));
      db[table].push(...created);
      rows = created;
      return q;
    },
    upsert(rec) {
      const key = rec.key;
      const existing = db[table].find(r => r.key === key && r.account_id === rec.account_id);
      if (existing) { Object.assign(existing, rec); rows = [existing]; return q; }
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

const GrowthSettingsService = require(path.join(ROOT, 'src/shared/growth/settings'));
const GrowthProspectsService = require(path.join(ROOT, 'src/shared/growth/prospects'));
const { buildUrl, contentUrl, outreachUrl } = require(path.join(ROOT, 'src/shared/growth/attribution'));
const { estimateLlmCost, estimateUnitCost } = require(path.join(ROOT, 'src/shared/growth/cost'));
const { normalizeDomain } = require(path.join(ROOT, 'src/shared/growth/prospects'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

(async () => {
  const ACCT = 'acct-1';

  console.log('\n── Settings defaults ──');
  const settings = new GrowthSettingsService(ACCT);
  const limits = await settings.get('limits');
  check('cold email cap is 20', limits.max_daily_cold_emails === 20);
  check('personal LinkedIn cap is 2', limits.max_weekly_personal_linkedin_posts === 2);
  const weights = await settings.get('scoring_weights');
  const weightTotal = Object.values(weights).reduce((s, n) => s + n, 0);
  check('scoring weights total 100', weightTotal === 100, `got ${weightTotal}`);

  console.log('\n── Settings guards (spec §29) ──');
  let raised = false;
  try {
    await settings.set('limits', { max_daily_cold_emails: 500 }, { source: 'automation' });
  } catch (e) { raised = /may not raise guarded limits/.test(e.message); }
  check('automation cannot raise a limit', raised);

  settings.clearCache();
  let lowered = true;
  try {
    await settings.set('limits', { max_daily_cold_emails: 5 }, { source: 'automation' });
  } catch { lowered = false; }
  check('automation may lower a limit', lowered);

  settings.clearCache();
  let userRaised = true;
  try {
    await settings.set('limits', { max_daily_cold_emails: 50 }, { source: 'user' });
  } catch { userRaised = false; }
  check('user may raise a limit', userRaised);

  let badWeights = false;
  try {
    await settings.set('scoring_weights', { title_fit: 90 }, { source: 'user' });
  } catch (e) { badWeights = /must total 100/.test(e.message); }
  check('weights must total 100', badWeights);

  console.log('\n── Fit scoring (spec §7) ──');
  const prospects = new GrowthProspectsService(ACCT);

  const ideal = {
    id: 'p1', title: 'Director of Payroll', company_size: 2000, industry: 'Healthcare',
    metadata: { multi_state: true, remote_friendly: true, headcount_growth_pct: 35,
      hiring_payroll: true, linkedin_active: true },
  };
  const idealScore = await prospects.score(ideal);
  check('ideal prospect scores 100', idealScore.payroll_fit_score === 100, `got ${idealScore.payroll_fit_score}`);
  check('ideal band is priority', idealScore.fit_band === 'priority');
  check('fit reason is populated', idealScore.fit_reason.includes('Director of Payroll'));

  const weak = { id: 'p2', title: 'Software Engineer', company_size: 40, industry: 'Technology', metadata: {} };
  const weakScore = await prospects.score(weak);
  check('poor fit scores 0', weakScore.payroll_fit_score === 0, `got ${weakScore.payroll_fit_score}`);
  check('poor fit band is ignore', weakScore.fit_band === 'ignore');
  check('no-signal reason stated', weakScore.fit_reason === 'No strong fit signals');

  const mid = {
    id: 'p3', title: 'Payroll Manager', company_size: 800, industry: 'Technology',
    metadata: { multi_state: true },
  };
  const midScore = await prospects.score(mid);
  check('mid prospect scores 60 (25+20+15)', midScore.payroll_fit_score === 60, `got ${midScore.payroll_fit_score}`);
  check('mid band is good', midScore.fit_band === 'good', midScore.fit_band);

  // Score never escapes 0..100
  const inflated = {
    id: 'p4', title: 'VP Payroll', company_size: 3000, industry: 'Hospitality',
    metadata: { multi_state: true, remote_friendly: true, headcount_growth_pct: 90,
      hiring_payroll: true, linkedin_active: true },
  };
  const infScore = await prospects.score(inflated);
  check('score is capped at 100', infScore.payroll_fit_score <= 100, `got ${infScore.payroll_fit_score}`);

  console.log('\n── Domain normalization (dedup) ──');
  check('strips https and www', normalizeDomain('https://www.Acme.com/careers') === 'acme.com',
    normalizeDomain('https://www.Acme.com/careers'));
  check('bare domain lowercased', normalizeDomain('ACME.com') === 'acme.com');
  check('null passthrough', normalizeDomain(null) === null);

  console.log('\n── Attribution URLs (spec §14) ──');
  const oUrl = outreachUrl({ channel: 'email', campaign: 'multistate_payroll', asset: 'local_wage_database' });
  check('utm_source=apollo', oUrl.includes('utm_source=apollo'), oUrl);
  check('utm_medium=email', oUrl.includes('utm_medium=email'));
  check('utm_campaign set', oUrl.includes('utm_campaign=multistate_payroll'));
  check('utm_content set', oUrl.includes('utm_content=local_wage_database'));

  const cUrl = contentUrl({ platform: 'linkedin_personal', campaign: 'q1_content', contentSlug: 'ca-local-wages' });
  check('personal LinkedIn source tagged', cUrl.includes('utm_source=linkedin_personal'), cUrl);

  const clean = buildUrl({ url: 'https://payrollbeacon.com/tools', source: 'x', campaign: undefined });
  check('undefined params omitted', !clean.includes('undefined'), clean);
  check('no empty utm_campaign', !clean.includes('utm_campaign='), clean);

  console.log('\n── Cost estimation (spec §17) ──');
  const haiku = estimateLlmCost('claude-haiku-4-5-20251001', 10000, 2000);
  check('haiku cost computed', haiku > 0 && haiku < 0.05, String(haiku));
  const sonnet = estimateLlmCost('claude-sonnet-4-6', 10000, 2000);
  check('sonnet costs more than haiku', sonnet > haiku, `${sonnet} vs ${haiku}`);
  check('unknown model costs 0', estimateLlmCost('made-up-model', 10000, 2000) === 0);
  check('image unit priced', estimateUnitCost('dalle-3-1792', 2) === 0.16, String(estimateUnitCost('dalle-3-1792', 2)));
  check('unknown unit costs 0', estimateUnitCost('nope', 5) === 0);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
