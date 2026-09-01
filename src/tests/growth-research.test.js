// Phase 7 — Fit scoring completion + research cards.
// The rule that matters: a signal without cited evidence must never
// become a scoring point.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const db = { growth_settings: [], growth_prospects: [], growth_prospect_events: [] };

function makeQuery(table) {
  let rows = [...(db[table] || [])];
  const q = {
    select() { return q; },
    eq(col, val) { rows = rows.filter(r => String(r[col]) === String(val)); return q; },
    neq() { return q; }, in() { return q; }, is() { return q; }, not() { return q; },
    ilike() { return q; }, gte() { return q; }, lte() { return q; }, lt() { return q; },
    order() { return q; }, limit(n) { rows = rows.slice(0, n); return q; }, range() { return q; },
    insert(rec) {
      const recs = Array.isArray(rec) ? rec : [rec];
      const created = recs.map((r, i) => ({ id: `${table}-${db[table].length + i + 1}`, ...r }));
      db[table].push(...created); rows = created; return q;
    },
    upsert(rec) {
      const existing = db[table].find(r => r.key === rec.key && r.account_id === rec.account_id);
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

const ProspectResearchService = require(path.join(ROOT, 'src/shared/growth/research'));
const { PAYROLL_BEACON_ASSETS, ASSET_KEYS } = require(path.join(ROOT, 'src/shared/growth/research'));
const GrowthProspectsService = require(path.join(ROOT, 'src/shared/growth/prospects'));
const { DEFAULT_SCORING_WEIGHTS } = require(path.join(ROOT, 'src/shared/growth/settings'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

const PROSPECT = {
  id: 'p1', full_name: 'Dana Whitfield', title: 'Director of Payroll',
  company_name: 'Northwind Health', company_size: 2400, industry: 'Healthcare',
  payroll_fit_score: 70, fit_band: 'good',
  metadata: { multi_state: true, state_count: 4 },
};

(async () => {
  const research = new ProspectResearchService('acct-1');

  console.log('\n── Signals need cited evidence (spec §7) ──');
  const evidence = [{ title: 'Careers', url: 'https://x.example/jobs', snippet: 'Payroll Manager opening' }];

  const supported = research.extractSignals({
    signals: { remote_friendly: true, hiring_payroll: true },
    signal_evidence: { remote_friendly: 'https://x.example/remote', hiring_payroll: 'https://x.example/jobs' },
  }, evidence);
  check('evidenced signals kept', supported.remote_friendly === true && supported.hiring_payroll === true);
  check('evidence stored alongside', !!supported.remote_friendly_evidence);

  const unsupported = research.extractSignals({
    signals: { remote_friendly: true, hiring_payroll: true, linkedin_active: true },
    signal_evidence: {},
  }, evidence);
  check('uncited signals discarded', Object.keys(unsupported).length === 0,
    JSON.stringify(unsupported));

  const noSearch = research.extractSignals({
    signals: { remote_friendly: true },
    signal_evidence: { remote_friendly: 'claimed' },
  }, []);
  check('no evidence gathered means no signal', Object.keys(noSearch).length === 0,
    JSON.stringify(noSearch));

  const nulls = research.extractSignals({
    signals: { remote_friendly: null, hiring_payroll: false },
    signal_evidence: { remote_friendly: 'x', hiring_payroll: 'y' },
  }, evidence);
  check('null and false are not signals', Object.keys(nulls).length === 0, JSON.stringify(nulls));

  console.log('\n── PEO is a risk, not a scoring signal ──');
  const peo = research.extractSignals({
    signals: { uses_peo: true },
    signal_evidence: { uses_peo: 'https://x.example/peo' },
  }, evidence);
  check('uses_peo captured', peo.uses_peo === true);
  check('uses_peo is not a scored component',
    !Object.keys(DEFAULT_SCORING_WEIGHTS).includes('uses_peo'));

  console.log('\n── Card normalization ──');
  const card = research.normalizeCard({
    why_they_fit: ['a', 'b', 'c', 'd', 'e', 'f'],
    company_complexity: ['multi-state', 'large headcount'],
    recommended_asset: 'local_wage_database',
    asset_reason: 'four states',
    conversation_angle: 'Local ordinances stack on top of the CA state rate.',
    risks: ['may use a PEO'],
  }, PROSPECT);

  check('why_they_fit capped at 4', card.why_they_fit.length === 4, String(card.why_they_fit.length));
  check('asset label resolved', card.recommended_asset_label === PAYROLL_BEACON_ASSETS.local_wage_database.label);
  check('prospect summary embedded', card.prospect.name === 'Dana Whitfield');
  check('conversation angle carried', !!card.conversation_angle);
  check('generated_at stamped', !!card.generated_at);

  const badAsset = research.normalizeCard({ recommended_asset: 'not_a_real_asset' }, PROSPECT);
  check('invalid asset falls back to a real one', ASSET_KEYS.includes(badAsset.recommended_asset),
    badAsset.recommended_asset);
  check('multi-state falls back to wage database',
    badAsset.recommended_asset === 'local_wage_database', badAsset.recommended_asset);

  const remoteProspect = { ...PROSPECT, metadata: { remote_friendly: true } };
  check('remote workforce falls back to jurisdiction guide',
    research.fallbackAsset(remoteProspect) === 'jurisdiction_guide');
  check('large headcount falls back to multi-state guide',
    research.fallbackAsset({ company_size: 3000, metadata: {} }) === 'multi_state_guide');

  console.log('\n── Research is required to reach 100 ──');
  const svc = new GrowthProspectsService('acct-1');

  const apolloOnly = await svc.score({
    title: 'Director of Payroll', company_size: 2400, industry: 'Healthcare',
    metadata: { multi_state: true, headcount_growth_pct: 30 },
  });
  check('Apollo-only data caps at 80', apolloOnly.payroll_fit_score === 80,
    String(apolloOnly.payroll_fit_score));
  check('still lands in priority band', apolloOnly.fit_band === 'priority');

  const withResearch = await svc.score({
    title: 'Director of Payroll', company_size: 2400, industry: 'Healthcare',
    metadata: {
      multi_state: true, headcount_growth_pct: 30,
      remote_friendly: true, hiring_payroll: true, linkedin_active: true,
    },
  });
  check('research signals add the last 20', withResearch.payroll_fit_score === 100,
    String(withResearch.payroll_fit_score));

  const researchOnlyPoints = withResearch.payroll_fit_score - apolloOnly.payroll_fit_score;
  check('the gap is exactly the three research components',
    researchOnlyPoints === DEFAULT_SCORING_WEIGHTS.distributed_workforce
      + DEFAULT_SCORING_WEIGHTS.payroll_hiring
      + DEFAULT_SCORING_WEIGHTS.linkedin_activity,
    String(researchOnlyPoints));

  console.log('\n── Asset catalogue ──');
  check('six assets defined', ASSET_KEYS.length === 6, String(ASSET_KEYS.length));
  check('every asset has a label and bestFor',
    ASSET_KEYS.every(k => PAYROLL_BEACON_ASSETS[k].label && PAYROLL_BEACON_ASSETS[k].bestFor));

  console.log('\n── Prompt discipline (spec §8) ──');
  const prompt = research.buildPrompt(PROSPECT, evidence);
  check('forbids inventing company facts', prompt.includes('Do not invent facts about this company'));
  check('requires evidence for signals', prompt.includes('ONLY when the evidence above supports them'));
  check('demands a compact card', prompt.includes('not a report'));
  check('caps conversation angle at one sentence', prompt.includes('ONE sentence'));
  check('lists the real assets', prompt.includes('local_wage_database'));
  check('includes the fit reason', prompt.includes('Fit score: 70/100'));

  const noEvidencePrompt = research.buildPrompt(PROSPECT, []);
  check('states plainly when no evidence exists',
    noEvidencePrompt.includes('None available'), '');

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
