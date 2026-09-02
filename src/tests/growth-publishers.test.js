// Phase 10 — Publishers. The defects this phase exists to fix:
// placeholder images, ignored status codes, and LinkedIn reading the
// post id from the wrong place.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const dbPath = path.join(ROOT, 'src/db/supabase.js');
require.cache[require.resolve(dbPath)] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { getSupabase: () => ({ from: () => ({}) }), isSupabaseConfigured: () => false },
};

const publishers = require(path.join(ROOT, 'src/shared/growth/publishers'));
const FacebookPublisher = require(path.join(ROOT, 'src/shared/growth/publishers/facebook'));
const InstagramPublisher = require(path.join(ROOT, 'src/shared/growth/publishers/instagram'));
const LinkedInCompanyPublisher = require(path.join(ROOT, 'src/shared/growth/publishers/linkedin'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

(async () => {
  console.log('\n── Registry ──');
  check('facebook is automated', publishers.canAutoPublish('facebook'));
  check('instagram is automated', publishers.canAutoPublish('instagram'));
  check('linkedin_company is automated', publishers.canAutoPublish('linkedin_company'));

  console.log('\n── Personal LinkedIn has no publisher at all (spec §12) ──');
  check('not auto-publishable', !publishers.canAutoPublish('linkedin_personal'));
  check('no publisher class exists', publishers.getPublisher('linkedin_personal') === null);
  check('not in the PUBLISHERS map',
    !Object.keys(publishers.PUBLISHERS).includes('linkedin_personal'));
  check('reason cites the spec',
    /never auto-published/.test(publishers.manualReason('linkedin_personal')));

  console.log('\n── Instagram refuses without a real image (spec §4) ──');
  const ig = new InstagramPublisher({ igUserId: 'x', accessToken: 'y' });

  const noImage = ig.canPublish({ body: 'caption text' });
  check('no image is not publishable', noImage.publishable === false);
  check('reason is no_image_available', noImage.reason === 'no_image_available', noImage.reason);
  check('explains the pipeline gap', /image prompt, not a rendered image/.test(noImage.detail));

  const published = await ig.publish({ body: 'caption' });
  check('publish() refuses rather than calling the API', published.ok === false);
  check('refusal names the reason', published.reason === 'no_image_available');

  check('http image rejected',
    ig.canPublish({ body: 'x', imageUrl: 'http://insecure.example/a.jpg' }).reason === 'image_url_not_https');
  check('https image accepted',
    ig.canPublish({ body: 'x', imageUrl: 'https://cdn.example/a.jpg' }).publishable === true);
  check('empty caption rejected',
    ig.canPublish({ body: '  ', imageUrl: 'https://cdn.example/a.jpg' }).reason === 'empty_caption');

  console.log('\n── No placeholder URL anywhere in the publishers ──');
  const fs = require('fs');
  // Strip comments first — the files explain the old bug, and a comment
  // describing a placeholder must not read as one being used.
  const stripComments = s => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  const dir = path.join(ROOT, 'src/shared/growth/publishers');
  const code = fs.readdirSync(dir)
    .map(f => stripComments(fs.readFileSync(path.join(dir, f), 'utf8'))).join('\n');

  check('no placeholder.com in code', !/placeholder\.com/.test(code));
  check('no via.placeholder in code', !/via\.placeholder/.test(code));
  check('no hardcoded image fallback in code', !/img\.jpg/.test(code));

  console.log('\n── Facebook ──');
  const fb = new FacebookPublisher({ pageId: '123', accessToken: 'tok' });
  check('configured with both values', fb.isConfigured());
  check('unconfigured without a page id',
    !new FacebookPublisher({ pageId: null, accessToken: 'tok' }).isConfigured()
    || !!process.env.FB_PAGE_ID);
  check('empty body rejected', fb.canPublish({ body: '   ' }).reason === 'empty_body');
  check('normal body accepted', fb.canPublish({ body: 'A real post' }).publishable === true);

  const unconfigured = new FacebookPublisher({ pageId: null, accessToken: null });
  unconfigured.pageId = null; unconfigured.accessToken = null;
  const fbResult = await unconfigured.publish({ body: 'text' });
  check('unconfigured publish refuses', fbResult.ok === false);
  check('reason is not_configured', fbResult.reason === 'not_configured');
  check('names the missing vars', /FB_PAGE/.test(fbResult.detail || ''), fbResult.detail);

  console.log('\n── LinkedIn company page ──');
  const li = new LinkedInCompanyPublisher({ organizationId: '999', accessToken: 'tok' });
  check('platform is linkedin_company', li.platform === 'linkedin_company');
  check('builds an organization URN', li.authorUrn === 'urn:li:organization:999', li.authorUrn);
  check('accepts a full URN too',
    new LinkedInCompanyPublisher({ organizationId: 'urn:li:organization:42', accessToken: 't' }).authorUrn
      === 'urn:li:organization:42');
  check('over-long body rejected',
    li.canPublish({ body: 'x'.repeat(3100) }).reason === 'body_too_long');
  check('normal body accepted', li.canPublish({ body: 'A post' }).publishable === true);

  const liSource = require('fs').readFileSync(
    path.join(ROOT, 'src/shared/growth/publishers/linkedin.js'), 'utf8');
  check('reads the id from x-restli-id header', /x-restli-id/.test(liSource));
  check('uses /rest/posts not deprecated ugcPosts',
    /\/rest\/posts/.test(liSource) && !/ugcPosts'/.test(liSource));
  check('sends a LinkedIn-Version header', /LinkedIn-Version/.test(liSource));

  console.log('\n── Transport checks status codes ──');
  const baseSource = require('fs').readFileSync(
    path.join(ROOT, 'src/shared/growth/publishers/base.js'), 'utf8');
  check('rejects non-2xx', /statusCode < 200 \|\| .*statusCode >= 300/.test(baseSource));
  check('exposes response headers', /headers: res\.headers/.test(baseSource));
  check('catches 200-with-error envelopes', /parsed\?\.error/.test(baseSource));

  console.log('\n── The live social-distributor bugs are fixed ──');
  const sdRaw = require('fs').readFileSync(
    path.join(ROOT, 'src/agents/social-distributor.js'), 'utf8');
  const sdCode = stripComments(sdRaw);
  check('httpsPost no longer ignores status',
    /statusCode < 200 \|\| res\.statusCode >= 300/.test(sdCode));
  check('placeholder image fallback removed from code', !/placeholder\.com/.test(sdCode));
  check('the old placeholder is documented in a comment',
    /placeholder\.com/.test(sdRaw) && !/placeholder\.com/.test(sdCode));
  check('Instagram now refuses without an image',
    /Instagram requires a hosted image URL/.test(sdCode));

  console.log('\n── Status report ──');
  const status = publishers.status();
  check('every automated platform lists required env',
    Object.entries(status).filter(([, v]) => v.automated)
      .every(([, v]) => Array.isArray(v.required_env) && v.required_env.length > 0));
  check('manual platforms carry a reason',
    Object.entries(status).filter(([, v]) => !v.automated).every(([, v]) => !!v.reason));
  check('blog is manual', status.blog?.automated === false);
  check('unconfigured platforms report missing env',
    status.facebook.configured === false ? status.facebook.missing_env.length > 0 : true);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
