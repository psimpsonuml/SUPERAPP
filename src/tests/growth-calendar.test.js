// Phase 5 — Calendar and Scheduler. The rule that matters most:
// open slots are reported, never filled with generated filler (§3, §20).
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const db = {
  growth_content: [],
  growth_content_events: [],
  growth_settings: [],
};

function makeQuery(table) {
  let rows = [...(db[table] || [])];
  const q = {
    select() { return q; },
    eq(col, val) { rows = rows.filter(r => String(r[col]) === String(val)); return q; },
    neq(col, val) { rows = rows.filter(r => String(r[col]) !== String(val)); return q; },
    in(col, vals) { rows = rows.filter(r => vals.map(String).includes(String(r[col]))); return q; },
    is(col) { rows = rows.filter(r => r[col] === null || r[col] === undefined); return q; },
    not() { return q; },
    gte(col, val) { rows = rows.filter(r => r[col] && r[col] >= val); return q; },
    lt(col, val) { rows = rows.filter(r => r[col] && r[col] < val); return q; },
    lte() { return q; },
    order() { return q; },
    limit(n) { rows = rows.slice(0, n); return q; },
    range() { return q; },
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

const GrowthCalendarService = require(path.join(ROOT, 'src/shared/growth/calendar'));
const { startOfWeek, isoDate, DAY_NAMES } = require(path.join(ROOT, 'src/shared/growth/calendar'));
const { PLATFORM_HOURS } = require(path.join(ROOT, 'src/agents/growth-scheduler'));
const { DEFAULTS } = require(path.join(ROOT, 'src/shared/growth/settings'));

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name} ${detail}`); fail++; }
}

(async () => {
  const cal = new GrowthCalendarService('acct-1');

  console.log('\n── Week boundaries ──');
  const thisWeek = startOfWeek(new Date(), 0);
  const nextWeek = startOfWeek(new Date(), 1);
  check('week starts on Sunday', thisWeek.getDay() === 0, String(thisWeek.getDay()));
  check('offset 1 is 7 days later',
    Math.round((nextWeek - thisWeek) / 86400000) === 7);
  check('start of week is midnight', thisWeek.getHours() === 0);

  console.log('\n── Empty week reports open slots, generates nothing ──');
  const empty = await cal.week({ weekOffset: 0 });
  check('7 days returned', empty.days.length === 7);
  check('nothing scheduled', empty.total_scheduled === 0);
  const totalMissing = empty.days.reduce((s, d) => s + d.missing_platforms.length, 0);
  check('open cadence slots reported', totalMissing > 0, `got ${totalMissing}`);
  check('no content was created', db.growth_content.length === 0,
    `growth_content has ${db.growth_content.length} rows`);

  console.log('\n── Cadence matches spec §3 defaults ──');
  const cadence = DEFAULTS.cadence;
  check('Monday has 3 platforms', cadence.monday.length === 3, JSON.stringify(cadence.monday));
  check('Tuesday is personal LinkedIn only',
    cadence.tuesday.length === 1 && cadence.tuesday[0] === 'linkedin_personal');
  check('Thursday is optional/empty', cadence.thursday.length === 0);
  check('weekend is empty',
    cadence.saturday.length === 0 && cadence.sunday.length === 0);
  const weeklyPersonal = Object.values(cadence).flat().filter(p => p === 'linkedin_personal').length;
  check('personal LinkedIn appears once/week', weeklyPersonal === 1, `got ${weeklyPersonal}`);

  console.log('\n── Slots report filled vs open ──');
  const slots = await cal.slots({ weekOffset: 0 });
  const expectedSlots = Object.values(cadence).flat().length;
  check('slot count matches cadence', slots.slots.length === expectedSlots,
    `${slots.slots.length} vs ${expectedSlots}`);
  check('all open when nothing scheduled', slots.open === expectedSlots);
  check('filled is zero', slots.filled === 0);

  console.log('\n── Scheduled item lands on its day ──');
  const monday = new Date(startOfWeek(new Date(), 0));
  monday.setDate(monday.getDate() + 1);
  const mondayKey = isoDate(monday);
  db.growth_content.push({
    id: 'c1', account_id: 'acct-1', title: 'Local wage changes', platform: 'facebook',
    status: 'scheduled', scheduled_for: `${mondayKey}T12:00:00.000Z`,
    requires_manual_posting: false, source_id: 's1',
  });

  const withItem = await cal.week({ weekOffset: 0 });
  const mondayCell = withItem.days.find(d => d.date === mondayKey);
  check('item appears on the right day', mondayCell?.items.length === 1,
    `got ${mondayCell?.items.length}`);
  check('facebook no longer listed as missing',
    !mondayCell.missing_platforms.includes('facebook'));
  check('other cadence platforms still open',
    mondayCell.missing_platforms.length > 0);
  check('counted in total', withItem.total_scheduled === 1);
  check('grouped by platform', withItem.by_platform.facebook === 1);

  console.log('\n── Published content cannot be rescheduled ──');
  db.growth_content.push({
    id: 'c2', account_id: 'acct-1', title: 'Already out', platform: 'blog',
    status: 'published', scheduled_for: `${mondayKey}T09:00:00.000Z`,
  });
  let blocked = false;
  try { await cal.reschedule('c2', `${mondayKey}T15:00:00.000Z`); }
  catch (e) { blocked = /already been published/.test(e.message); }
  check('reschedule refused', blocked);

  console.log('\n── Reschedule validation ──');
  let badDate = false;
  try { await cal.reschedule('c1', 'not-a-date'); }
  catch (e) { badDate = /Invalid date/.test(e.message); }
  check('invalid date rejected', badDate);

  let missing = false;
  try { await cal.reschedule('does-not-exist', new Date().toISOString()); }
  catch (e) { missing = /not found/i.test(e.message); }
  check('unknown id rejected', missing);

  console.log('\n── Duplicate returns to review, never auto-approved ──');
  const copy = await cal.duplicate('c1', null);
  check('copy is needs_review', copy.status === 'needs_review', copy.status);
  check('copy is unscheduled', copy.scheduled_for === null);
  check('copy records its origin', copy.metadata.duplicatedFrom === 'c1');
  check('title marked as a copy', /\(copy\)$/.test(copy.title), copy.title);

  console.log('\n── Repetition warnings (spec §20) ──');
  const soon = `${mondayKey}T12:00:00.000Z`;
  db.growth_content.push(
    { id: 'c3', account_id: 'acct-1', platform: 'facebook', source_id: 'same', status: 'scheduled', scheduled_for: soon, title: 'A' },
    { id: 'c4', account_id: 'acct-1', platform: 'facebook', source_id: 'same', status: 'scheduled', scheduled_for: soon, title: 'B' },
  );
  const warnings = await cal.repetitionWarnings({ days: 14 });
  const repeat = warnings.find(w => w.source_id === 'same');
  check('same source twice on a platform is flagged', !!repeat, JSON.stringify(warnings));
  check('warning names the count', repeat?.count === 2);

  console.log('\n── Posting hours are sane ──');
  const cadencePlatforms = new Set(Object.values(cadence).flat());
  const covered = [...cadencePlatforms].every(p => PLATFORM_HOURS[p] !== undefined);
  check('every cadence platform has a posting hour', covered,
    [...cadencePlatforms].filter(p => PLATFORM_HOURS[p] === undefined).join(', '));
  check('hours are within a day',
    Object.values(PLATFORM_HOURS).every(h => h >= 0 && h <= 23));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
