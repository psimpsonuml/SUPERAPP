// Multi-brand — brand resolution and the three-layer settings merge.
//
// The failure this suite is really guarding against: a brand silently
// running on another brand's ICP. Everything here is either "the wrong
// brand cannot be reached by accident" or "inheritance is visible".
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

// ── Fake Supabase ─────────────────────────────────────────
// `is()` actually filters here, unlike the shared harness in
// growth-core.test.js — the whole account-vs-brand layering turns on
// `brand_id IS NULL`, so a no-op `is()` would make this suite vacuous.
const db = { growth_brands: [], growth_settings: [] };
let seq = 0;

function makeQuery(table) {
  let rows = [...(db[table] || [])];
  let pendingUpdate = null;

  // PostgREST applies the filters before the update regardless of the
  // order the builder methods are chained in. A fake that patched rows
  // at .update() time would patch the whole table whenever .eq() came
  // after, so the write is deferred until the query is awaited.
  function settle() {
    if (pendingUpdate) {
      rows.forEach(r => Object.assign(r, pendingUpdate));
      pendingUpdate = null;
    }
    return rows;
  }

  const q = {
    select() { return q; },
    eq(col, val) { rows = rows.filter(r => String(r[col]) === String(val)); return q; },
    neq(col, val) { rows = rows.filter(r => String(r[col]) !== String(val)); return q; },
    is(col, val) {
      if (val === null) rows = rows.filter(r => r[col] === null || r[col] === undefined);
      else rows = rows.filter(r => r[col] === val);
      return q;
    },
    order() { return q; },
    limit(n) { rows = rows.slice(0, n); return q; },
    insert(rec) {
      const recs = Array.isArray(rec) ? rec : [rec];
      const created = recs.map(r => ({ id: `${table}-${++seq}`, ...r }));
      db[table].push(...created);
      rows = created;
      return q;
    },
    update(patch) { pendingUpdate = { ...(pendingUpdate || {}), ...patch }; return q; },
    delete() { return q; },
    single() {
      const r = settle();
      return Promise.resolve({
        data: r[0] || null,
        error: r[0] ? null : { message: 'not found' },
      });
    },
    maybeSingle() { return Promise.resolve({ data: settle()[0] || null, error: null }); },
    then(res) { return Promise.resolve({ data: settle(), error: null }).then(res); },
  };
  return q;
}

const dbPath = path.join(ROOT, 'src/db/supabase.js');
require.cache[require.resolve(dbPath)] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { getSupabase: () => ({ from: makeQuery }), isSupabaseConfigured: () => true },
};

const BrandService = require(path.join(ROOT, 'src/shared/growth/brands'));
const { UnknownBrandError } = BrandService;
const GrowthSettingsService = require(path.join(ROOT, 'src/shared/growth/settings'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

const ACCT = 'acct-1';

(async () => {
  // Stand in for what migration 004 seeds.
  db.growth_brands.push({
    id: '11111111-1111-4111-8111-111111111111', account_id: ACCT, slug: 'payroll_beacon', name: 'Payroll Beacon',
    description: 'B2B payroll compliance', product: 'payroll_beacon',
    positioning: { audience: 'Multi-state payroll leaders', offer: 'Compliance monitoring' },
    voice: { tone: 'direct, evidence-led' }, channels: ['facebook', 'linkedin_company'],
    website_url: 'https://payrollbeacon.com', is_default: true, status: 'active',
  });
  db.growth_brands.push({
    id: '22222222-2222-4222-8222-222222222222', account_id: ACCT, slug: 'pl_maren', name: 'P.L. Maren',
    description: 'Author business', product: 'pl_maren',
    positioning: {}, voice: {}, channels: [],
    website_url: null, is_default: false, status: 'active',
  });

  const brands = new BrandService(ACCT);

  console.log('\n── Resolution ──');
  check('resolves by slug', (await brands.resolve('pl_maren')).id === '22222222-2222-4222-8222-222222222222');
  check('resolves by id', (await brands.resolve('11111111-1111-4111-8111-111111111111')).slug === 'payroll_beacon');
  check('null resolves to the default', (await brands.resolve(null)).slug === 'payroll_beacon');
  check('empty string resolves to the default',
    (await brands.resolve('')).slug === 'payroll_beacon');

  let threw = null;
  try { await brands.resolve('payrol_beacon'); } catch (e) { threw = e; }
  check('a typo throws rather than falling back', threw instanceof UnknownBrandError);
  check('the error names the bad value', /payrol_beacon/.test(threw?.message || ''));
  check('the error carries a 404', threw?.status === 404);

  console.log('\n── Configuration is not invented ──');
  const pb = await brands.resolve('payroll_beacon');
  const plm = await brands.resolve('pl_maren');
  check('a described brand is configured', pb.configured === true);
  check('an empty brand is not configured', plm.configured === false);
  check('it names what is missing',
    plm.missing_config.includes('positioning.audience')
    && plm.missing_config.includes('voice.tone'),
    JSON.stringify(plm.missing_config));
  check('a brand with channels may auto-publish', pb.can_auto_publish === true);
  check('a brand with no channels may not', plm.can_auto_publish === false);

  console.log('\n── Listing ──');
  const all = await brands.list();
  check('both brands listed', all.length === 2);
  check('every row is decorated',
    all.every(b => 'configured' in b && Array.isArray(b.missing_config)));

  console.log('\n── Settings: three layers ──');
  // Account-wide row: the owner lowered the cold-email cap for everyone.
  db.growth_settings.push({
    id: 's1', account_id: ACCT, brand_id: null, key: 'limits',
    value: { max_daily_cold_emails: 12 }, updated_by: 'user',
  });
  // Brand row for the author business: fewer still.
  db.growth_settings.push({
    id: 's2', account_id: ACCT, brand_id: '22222222-2222-4222-8222-222222222222', key: 'limits',
    value: { max_daily_cold_emails: 3 }, updated_by: 'user',
  });

  const acctSettings = new GrowthSettingsService(ACCT);
  const pbSettings = new GrowthSettingsService(ACCT, '11111111-1111-4111-8111-111111111111');
  const plmSettings = new GrowthSettingsService(ACCT, '22222222-2222-4222-8222-222222222222');

  check('account layer overrides the module default',
    (await acctSettings.get('limits')).max_daily_cold_emails === 12);
  check('a brand with no override inherits the account layer',
    (await pbSettings.get('limits')).max_daily_cold_emails === 12);
  check('a brand override wins',
    (await plmSettings.get('limits')).max_daily_cold_emails === 3);
  check('unstated keys still come from the module defaults',
    (await plmSettings.get('limits')).max_weekly_blog_posts === 1);

  console.log('\n── An empty brand row inherits rather than blanking ──');
  // Migration 004 seeds `{}` placeholders for the author brand's ICP.
  db.growth_settings.push({
    id: 's3', account_id: ACCT, brand_id: '22222222-2222-4222-8222-222222222222', key: 'icp',
    value: {}, updated_by: 'system',
  });
  const plmIcp = await plmSettings.get('icp');
  check('an empty override does not erase the inherited ICP',
    Array.isArray(plmIcp.primary_titles) && plmIcp.primary_titles.length > 0);
  check('and it is the payroll ICP, which is the point of flagging it',
    plmIcp.name === 'Multi-State Payroll Leaders');

  console.log('\n── Provenance makes inheritance visible ──');
  const prov = await plmSettings.provenance('limits');
  check('the overridden key reads as brand', prov.max_daily_cold_emails === 'brand');
  check('an account-set key reads as account',
    (await pbSettings.provenance('limits')).max_daily_cold_emails === 'account');
  check('an untouched key reads as default', prov.max_weekly_blog_posts === 'default');

  console.log('\n── Writes land on one layer only ──');
  plmSettings.clearCache();
  await plmSettings.set('limits', { max_weekly_facebook_posts: 1 }, { source: 'user' });
  const brandRow = db.growth_settings.find(r => r.brand_id === '22222222-2222-4222-8222-222222222222' && r.key === 'limits');
  check('the brand row gained the new key', brandRow.value.max_weekly_facebook_posts === 1);
  check('the brand row did not absorb the whole effective config',
    Object.keys(brandRow.value).length === 2,
    JSON.stringify(brandRow.value));
  check('the account row is untouched',
    db.growth_settings.find(r => r.brand_id === null && r.key === 'limits')
      .value.max_weekly_facebook_posts === undefined);

  console.log('\n── Scoping rules ──');
  let scopeErr = null;
  try {
    await acctSettings.set('limits', { max_daily_cold_emails: 9 }, { scope: 'brand' });
  } catch (e) { scopeErr = e; }
  check('a brand write without a brand is refused',
    /without a brand/.test(scopeErr?.message || ''), scopeErr?.message);

  plmSettings.clearCache();
  await plmSettings.set('limits', { max_daily_cold_emails: 11 },
    { source: 'user', scope: 'account' });
  check('an explicit account scope writes the account row',
    db.growth_settings.find(r => r.brand_id === null && r.key === 'limits')
      .value.max_daily_cold_emails === 11);

  console.log('\n── Guarded limits still hold per brand (spec §29) ──');
  plmSettings.clearCache();
  let raised = false;
  try {
    await plmSettings.set('limits', { max_daily_cold_emails: 500 }, { source: 'automation' });
  } catch (e) { raised = /may not raise guarded limits/.test(e.message); }
  check('automation cannot raise a brand limit', raised);

  plmSettings.clearCache();
  let lowered = true;
  try {
    await plmSettings.set('limits', { max_daily_cold_emails: 1 }, { source: 'automation' });
  } catch { lowered = false; }
  check('automation may still lower one', lowered);

  console.log('\n── Weights validate after inheritance, not in isolation ──');
  plmSettings.clearCache();
  let partialOk = true;
  try {
    // Shifting 5 points between two weights keeps the effective total
    // at 100 even though the stored override sums to 30.
    await plmSettings.set('scoring_weights', { title_fit: 30, company_size: 15 });
  } catch (e) { partialOk = false; console.log(`       ${e.message}`); }
  check('a partial override that still totals 100 is accepted', partialOk);

  plmSettings.clearCache();
  let badRejected = false;
  try {
    await plmSettings.set('scoring_weights', { title_fit: 90 });
  } catch (e) { badRejected = /must total 100/.test(e.message); }
  check('one that breaks the total is rejected', badRejected);

  console.log('\n── Suppressions stay account-wide by design ──');
  const fs = require('fs');
  const migration = fs.readFileSync(
    path.join(ROOT, 'src/db/migrations/004_multi_brand.sql'), 'utf8');
  check('004 does not add brand_id to growth_suppressions',
    !/ALTER TABLE growth_suppressions/.test(migration));
  check('and says why',
    /unsubscribe is a person saying/.test(migration));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
