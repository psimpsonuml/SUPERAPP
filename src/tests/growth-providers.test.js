// Phase 6 — Prospect providers. The behaviour that matters most:
// Apollo's locked-email placeholder must never be stored as if it were
// a real address, and the mock provider must never be selected by
// accident.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const dbPath = path.join(ROOT, 'src/db/supabase.js');
require.cache[require.resolve(dbPath)] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { getSupabase: () => ({ from: () => ({}) }), isSupabaseConfigured: () => false },
};

const { classifyEmail, LOCKED_EMAIL_PATTERN, ProspectProvider } = require(path.join(ROOT, 'src/shared/growth/providers/base'));
const ApolloProspectProvider = require(path.join(ROOT, 'src/shared/growth/providers/apollo'));
const MockProspectProvider = require(path.join(ROOT, 'src/shared/growth/providers/mock'));
const { rangesFor } = require(path.join(ROOT, 'src/shared/growth/providers/apollo'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

(async () => {
  console.log('\n── Locked emails never look contactable ──');
  const locked = classifyEmail('email_not_unlocked@domain.com', null);
  check('locked email becomes null', locked.email === null, JSON.stringify(locked));
  check('status is unavailable', locked.emailStatus === 'unavailable');

  const lockedVariant = classifyEmail('email_not_unlocked_1234@acme.com', 'verified');
  check('locked variant also caught', lockedVariant.email === null, JSON.stringify(lockedVariant));

  const real = classifyEmail('Dana.Whitfield@Acme.com', 'verified');
  check('real email preserved', real.email === 'dana.whitfield@acme.com', real.email);
  check('real email lowercased', real.email === real.email.toLowerCase());
  check('verified status carried', real.emailStatus === 'verified');

  check('empty email is unavailable', classifyEmail('', null).emailStatus === 'unavailable');
  check('null email is unavailable', classifyEmail(null, null).emailStatus === 'unavailable');
  check('malformed email is invalid', classifyEmail('not-an-email', null).emailStatus === 'invalid');
  check('unknown provider status defaults to guessed',
    classifyEmail('a@b.com', 'something_new').emailStatus === 'guessed');

  console.log('\n── Apollo normalization ──');
  const apollo = new ApolloProspectProvider({ apiKey: 'test-key-not-real' });
  check('provider name is apollo', apollo.name === 'apollo');
  check('reports configured with a key', apollo.isConfigured());
  check('reports unconfigured without one', !new ApolloProspectProvider({ apiKey: null }).isConfigured()
    || !!process.env.APOLLO_API_KEY);

  const normalized = apollo.normalize({
    id: 'apollo-1', first_name: 'Dana', last_name: 'Whitfield',
    name: 'Dana Whitfield', title: 'Director of Payroll', seniority: 'director',
    email: 'email_not_unlocked@domain.com',
    linkedin_url: 'https://linkedin.com/in/dana',
    city: 'Boston', state: 'MA', country: 'United States',
    organization: {
      id: 'org-1', name: 'Northwind Health', primary_domain: 'northwind.com',
      estimated_num_employees: 2400, industry: 'Healthcare',
      locations: [{ state: 'MA' }, { state: 'NH' }, { state: 'VT' }],
      organization_headcount_six_month_growth: 0.31,
    },
  });

  check('locked email not stored', normalized.email === null, String(normalized.email));
  check('email status reflects reality', normalized.emailStatus === 'unavailable');
  check('title carried', normalized.title === 'Director of Payroll');
  check('company size carried', normalized.companySize === 2400);
  check('source is apollo', normalized.source === 'apollo');
  check('sourceId carried for dedup', normalized.sourceId === 'apollo-1');

  console.log('\n── Signals: real ones extracted, absent ones left absent ──');
  check('multi_state inferred from locations', normalized.metadata.multi_state === true);
  check('state_count captured', normalized.metadata.state_count === 3, String(normalized.metadata.state_count));
  check('growth converted to percent', normalized.metadata.headcount_growth_pct === 31,
    String(normalized.metadata.headcount_growth_pct));
  check('remote_friendly NOT invented', normalized.metadata.remote_friendly === undefined);
  check('hiring_payroll NOT invented', normalized.metadata.hiring_payroll === undefined);
  check('linkedin_active NOT invented', normalized.metadata.linkedin_active === undefined);

  const singleState = apollo.normalize({
    id: 'a2', name: 'Solo Person', organization: { locations: [{ state: 'CA' }] },
  });
  check('single location is not multi_state', singleState.metadata.multi_state === undefined);

  console.log('\n── Employee range mapping ──');
  const ranges = rangesFor(200, 5000);
  check('overlapping ranges returned', ranges.length > 0, JSON.stringify(ranges));
  check('includes the 201-500 band', ranges.includes('201,500'));
  check('excludes 1-10', !ranges.includes('1,10'));
  check('excludes 10001+', !ranges.includes('10001,1000000'));

  console.log('\n── Apollo without a key refuses rather than pretending ──');
  const noKey = new ApolloProspectProvider({ apiKey: null });
  noKey.apiKey = null; // ensure env doesn't leak in
  let refused = false;
  try { noKey.requireKey(); } catch (e) { refused = e.code === 'PROVIDER_UNAVAILABLE'; }
  check('throws ProviderUnavailableError', refused);

  console.log('\n── Mock provider is unmistakably fake ──');
  const mock = new MockProspectProvider();
  check('name is mock, not apollo', mock.name === 'mock');
  const { prospects } = await mock.searchPeople({ perPage: 20 });
  check('returns prospects', prospects.length > 0, String(prospects.length));
  check('source is mock on every row', prospects.every(p => p.source === 'mock'));
  check('flagged is_mock in metadata', prospects.every(p => p.metadata.is_mock === true));

  const withEmail = prospects.filter(p => p.email);
  check('all emails use the reserved .invalid TLD',
    withEmail.every(p => p.email.endsWith('@example.invalid')),
    withEmail.map(p => p.email).slice(0, 3).join(', '));
  check('no email reaches a routable domain',
    withEmail.every(p => !/\.(com|net|org|io)$/.test(p.email)));

  const withoutEmail = prospects.filter(p => !p.email);
  check('some results withhold email, like Apollo', withoutEmail.length > 0,
    `${withoutEmail.length} of ${prospects.length}`);
  check('withheld ones marked unavailable',
    withoutEmail.every(p => p.emailStatus === 'unavailable'));

  console.log('\n── Mock honours filters ──');
  const filtered = await mock.searchPeople({ perPage: 30, employeeMin: 2000 });
  check('employeeMin respected', filtered.prospects.every(p => p.companySize >= 2000),
    filtered.prospects.map(p => p.companySize).slice(0, 5).join(', '));

  const titled = await mock.searchPeople({ perPage: 30, titles: ['Payroll'] });
  check('title filter respected', titled.prospects.every(p => /payroll/i.test(p.title)),
    titled.prospects.map(p => p.title).slice(0, 3).join(', '));

  console.log('\n── Mock enrichment reveals an address ──');
  const enriched = await mock.enrichPerson({ firstName: 'Dana', lastName: 'Whitfield', companyDomain: 'x.example' });
  check('email revealed', !!enriched.email);
  check('still .invalid', enriched.email.endsWith('@example.invalid'), enriched.email);
  check('marked enriched', enriched.metadata.enriched === true);

  console.log('\n── Provider selection never falls back to mock ──');
  const saved = { p: process.env.PROSPECT_PROVIDER, k: process.env.APOLLO_API_KEY };
  delete process.env.PROSPECT_PROVIDER;
  delete process.env.APOLLO_API_KEY;
  delete require.cache[require.resolve(path.join(ROOT, 'src/shared/growth/providers/index.js'))];
  const providers = require(path.join(ROOT, 'src/shared/growth/providers'));

  check('no key + no choice returns null', providers.getProvider() === null);
  check('isConfigured is false', providers.isConfigured() === false);
  check('providerName is null', providers.providerName() === null);
  check('explicit mock still works', providers.getProvider('mock').name === 'mock');

  let apolloRefused = false;
  try { providers.getProvider('apollo'); } catch (e) { apolloRefused = e.code === 'PROVIDER_UNAVAILABLE'; }
  check('explicit apollo without a key throws', apolloRefused);

  if (saved.p) process.env.PROSPECT_PROVIDER = saved.p;
  if (saved.k) process.env.APOLLO_API_KEY = saved.k;

  console.log('\n── Interface contract ──');
  const base = new ProspectProvider();
  let notImpl = 0;
  for (const m of ['searchPeople', 'getPerson', 'enrichPerson', 'searchCompanies']) {
    try { await base[m](); } catch { notImpl++; }
  }
  check('base methods are abstract', notImpl === 4, String(notImpl));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
