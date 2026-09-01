// Phase 4 — Content Engine. Covers the two rules the generator must
// never break: no generating from unverified sources (§32), and no
// repeating recent content (§31).
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const dbPath = path.join(ROOT, 'src/db/supabase.js');
require.cache[require.resolve(dbPath)] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { getSupabase: () => ({ from: () => ({}) }), isSupabaseConfigured: () => false },
};

const ContentGenerator = require(path.join(ROOT, 'src/shared/growth/generator'));
const { extractJson } = require(path.join(ROOT, 'src/shared/llm'));
const { PACKAGE_PLATFORMS } = require(path.join(ROOT, 'src/agents/growth-content-repurposer'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

const SOURCE = {
  id: 's1',
  title: 'California local minimum wage increases effective July 1',
  topic: 'local wage rates',
  category: 'wage',
  summary: 'Twelve California cities raise local minimum wage above the state rate.',
  raw_text: 'Los Angeles moves to $17.28. West Hollywood moves to $19.65.',
  states: ['CA'],
  jurisdictions: ['Los Angeles', 'West Hollywood'],
  effective_date: '2026-07-01',
  source_confidence: 'verified',
  source_url: 'https://example.gov/wage-notice',
};

(async () => {
  const gen = new ContentGenerator('acct-1');

  console.log('\n── Platform coverage (spec §2) ──');
  for (const p of ['blog', 'facebook', 'instagram', 'linkedin_company', 'linkedin_personal', 'x', 'video']) {
    check(`${p} supported`, ContentGenerator.SUPPORTED_PLATFORMS.includes(p));
  }

  console.log('\n── Source trust (spec §32) ──');
  let refused = false;
  try {
    await gen.generate({ source: { ...SOURCE, source_confidence: 'needs_research' }, platform: 'blog' });
  } catch (e) { refused = /needs_research/.test(e.message); }
  check('refuses to generate from needs_research source', refused);

  const unverifiedPrompt = gen.buildPrompt({
    source: { ...SOURCE, source_confidence: 'unverified' },
    spec: ContentGenerator.PLATFORM_SPECS.blog,
    platform: 'blog', recentContent: [], campaign: null,
  });
  check('unverified source gets a hedging instruction',
    unverifiedPrompt.includes('UNVERIFIED'), '');
  check('every prompt forbids inventing facts',
    unverifiedPrompt.includes('Do not invent rates, dates, thresholds'));
  check('source URL carried for provenance',
    unverifiedPrompt.includes('https://example.gov/wage-notice'));
  check('effective date carried',
    unverifiedPrompt.includes('2026-07-01'));
  check('jurisdictions carried',
    unverifiedPrompt.includes('West Hollywood'));

  console.log('\n── Repetition guard (spec §31) ──');
  const withRecent = gen.buildPrompt({
    source: SOURCE,
    spec: ContentGenerator.PLATFORM_SPECS.facebook,
    platform: 'facebook',
    recentContent: [
      { title: 'Three states raising wages', body: 'Most payroll teams miss the local layer entirely...' },
    ],
    campaign: null,
  });
  check('avoid-list included', withRecent.includes('AVOID REPEATING RECENT CONTENT'));
  check('prior headline listed', withRecent.includes('Three states raising wages'));
  check('prior opener listed', withRecent.includes('Most payroll teams miss the local layer'));

  const noRecent = gen.buildPrompt({
    source: SOURCE, spec: ContentGenerator.PLATFORM_SPECS.facebook,
    platform: 'facebook', recentContent: [], campaign: null,
  });
  check('no avoid-list when nothing recent', !noRecent.includes('AVOID REPEATING'));

  console.log('\n── Personal LinkedIn is distinct (spec §12) ──');
  const personalSpec = ContentGenerator.PLATFORM_SPECS.linkedin_personal;
  check('written in first person', /first person/i.test(personalSpec.guidance));
  check('explicitly rejects promo framing',
    personalSpec.guidance.includes('Check out our newest Payroll Beacon article!'));
  check('company page spec is separate',
    ContentGenerator.PLATFORM_SPECS.linkedin_company.label !== personalSpec.label);

  console.log('\n── Unsupported platform ──');
  let rejected = false;
  try { await gen.generate({ source: SOURCE, platform: 'myspace' }); }
  catch (e) { rejected = /Unsupported platform/.test(e.message); }
  check('unknown platform rejected', rejected);

  console.log('\n── flatten() per platform ──');
  check('blog uses title+body',
    ContentGenerator.flatten('blog', { title: 'T', body: 'B' }).body === 'B');
  check('instagram uses caption',
    ContentGenerator.flatten('instagram', { caption: 'Cap text' }).body === 'Cap text');
  const vid = ContentGenerator.flatten('video', {
    title: 'V', scenes: [{ narration: 'one' }, { narration: 'two' }],
  });
  check('video joins scene narration', vid.body === 'one\n\ntwo', vid.body);
  check('x uses body',
    ContentGenerator.flatten('x', { body: 'short post' }).body === 'short post');

  console.log('\n── Weekly caps wired to settings (spec §29) ──');
  const keys = PACKAGE_PLATFORMS.map(p => p.limitKey);
  check('personal LinkedIn capped', keys.includes('max_weekly_personal_linkedin_posts'));
  check('company LinkedIn capped', keys.includes('max_weekly_company_linkedin_posts'));
  check('facebook capped', keys.includes('max_weekly_facebook_posts'));
  check('instagram capped', keys.includes('max_weekly_instagram_posts'));
  check('blog capped', keys.includes('max_weekly_blog_posts'));
  check('every package platform has a cap',
    PACKAGE_PLATFORMS.every(p => p.limitKey && p.platform));

  console.log('\n── LLM JSON extraction ──');
  check('handles fenced json', extractJson('```json\n{"ok":true}\n```')?.ok === true);
  check('returns null on garbage', extractJson('nope') === null);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
