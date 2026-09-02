// ══════════════════════════════════════════════════════════════════
// Growth Content Calendar (spec §3)
//
// Reads from growth_content.scheduled_for. There is no separate
// calendar table — a scheduled post IS the calendar entry, so the two
// can never drift out of sync.
//
// Empty slots are reported, never auto-filled. Spec §3: "Do not create
// posts simply because the calendar has an empty slot."
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const GrowthSettingsService = require('./settings');
const logger = require('../logger');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Statuses that occupy a calendar slot.
const SCHEDULED_STATUSES = ['approved', 'scheduled', 'published'];

function startOfWeek(date = new Date(), weekOffset = 0) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay() + (weekOffset * 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

class GrowthCalendarService {
  constructor(accountId) {
    this.accountId = accountId;
    this.settings = new GrowthSettingsService(accountId);
  }

  get db() {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    return getSupabase();
  }

  // ── Views ───────────────────────────────────────────────

  /**
   * One week of scheduled content, grouped by day.
   * Includes the cadence-expected platforms per day so gaps are visible.
   */
  async week({ weekOffset = 0 } = {}) {
    const start = startOfWeek(new Date(), weekOffset);
    const end = addDays(start, 7);

    const items = await this.itemsBetween(start, end);
    const cadence = await this.settings.get('cadence');

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const key = isoDate(date);
      const dayName = DAY_NAMES[date.getDay()];
      const dayItems = items.filter(it => it.scheduled_for?.slice(0, 10) === key);
      const expected = cadence[dayName] || [];
      const presentPlatforms = new Set(dayItems.map(it => it.platform));

      days.push({
        date: key,
        day_name: dayName,
        is_today: key === isoDate(new Date()),
        items: dayItems,
        expected_platforms: expected,
        // Reported so the operator can decide — the scheduler will not
        // generate filler to close these.
        missing_platforms: expected.filter(p => !presentPlatforms.has(p)),
      });
    }

    return {
      week_start: isoDate(start),
      week_end: isoDate(addDays(start, 6)),
      week_offset: weekOffset,
      days,
      total_scheduled: items.length,
      by_status: this.countBy(items, 'status'),
      by_platform: this.countBy(items, 'platform'),
      manual_posting_required: items.filter(i => i.requires_manual_posting).length,
    };
  }

  /** One month of scheduled content, grouped by date. */
  async month({ year, month } = {}) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;

    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));

    const items = await this.itemsBetween(start, end);

    const byDate = {};
    for (const item of items) {
      const key = item.scheduled_for?.slice(0, 10);
      if (!key) continue;
      (byDate[key] = byDate[key] || []).push(item);
    }

    return {
      year: y,
      month: m,
      days_in_month: new Date(Date.UTC(y, m, 0)).getUTCDate(),
      first_weekday: start.getUTCDay(),
      by_date: byDate,
      total_scheduled: items.length,
      by_status: this.countBy(items, 'status'),
      by_platform: this.countBy(items, 'platform'),
    };
  }

  async itemsBetween(start, end) {
    const { data } = await this.db
      .from('growth_content')
      .select('id, title, platform, content_type, status, scheduled_for, published_at, published_url, requires_manual_posting, source_id, campaign_id')
      .eq('account_id', this.accountId)
      .in('status', SCHEDULED_STATUSES)
      .gte('scheduled_for', start.toISOString())
      .lt('scheduled_for', end.toISOString())
      .order('scheduled_for', { ascending: true });

    return data || [];
  }

  countBy(items, field) {
    const out = {};
    for (const item of items) out[item[field]] = (out[item[field]] || 0) + 1;
    return out;
  }

  // ── Mutations ───────────────────────────────────────────

  /** Move an item to a new datetime (drag-and-drop target). */
  async reschedule(contentId, scheduledFor) {
    if (!scheduledFor) throw new Error('scheduledFor is required');

    const when = new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) throw new Error(`Invalid date: ${scheduledFor}`);

    const { data: existing } = await this.db
      .from('growth_content')
      .select('id, status, platform')
      .eq('id', contentId).eq('account_id', this.accountId)
      .maybeSingle();

    if (!existing) throw new Error('Content not found');
    if (existing.status === 'published') {
      throw new Error('Cannot reschedule content that has already been published');
    }

    const { data, error } = await this.db
      .from('growth_content')
      .update({
        scheduled_for: when.toISOString(),
        status: existing.status === 'approved' ? 'scheduled' : existing.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId).eq('account_id', this.accountId)
      .select().single();

    if (error) throw new Error(`Failed to reschedule: ${error.message}`);

    await this.logEvent(contentId, 'scheduled', { scheduledFor: when.toISOString(), rescheduled: true });
    return data;
  }

  /** Clone an item as a fresh draft. The copy is never auto-approved. */
  async duplicate(contentId, options) {
    // `= {}` only defaults on undefined; callers legitimately pass null.
    const { scheduledFor = null } = options || {};
    const { data: original } = await this.db
      .from('growth_content').select('*')
      .eq('id', contentId).eq('account_id', this.accountId)
      .maybeSingle();

    if (!original) throw new Error('Content not found');

    const { data, error } = await this.db
      .from('growth_content')
      .insert({
        account_id: this.accountId,
        source_id: original.source_id,
        campaign_id: original.campaign_id,
        platform: original.platform,
        content_type: original.content_type,
        title: original.title ? `${original.title} (copy)` : null,
        body: original.body,
        metadata: { ...(original.metadata || {}), duplicatedFrom: contentId },
        asset_ids: original.asset_ids,
        status: 'needs_review',
        requires_manual_posting: original.requires_manual_posting,
        scheduled_for: scheduledFor,
        model: original.model,
        prompt_version: original.prompt_version,
      })
      .select().single();

    if (error) throw new Error(`Failed to duplicate: ${error.message}`);
    await this.logEvent(data.id, 'generated', { duplicatedFrom: contentId });
    return data;
  }

  /** Remove from the calendar without deleting the content. */
  async unschedule(contentId) {
    const { data, error } = await this.db
      .from('growth_content')
      .update({ scheduled_for: null, status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', contentId).eq('account_id', this.accountId)
      .neq('status', 'published')
      .select().single();

    if (error) throw new Error(`Failed to unschedule: ${error.message}`);
    return data;
  }

  // ── Slot planning ───────────────────────────────────────

  /**
   * Cadence slots for a week, each marked filled or open.
   * Reporting only — nothing here generates content.
   */
  async slots({ weekOffset = 0 } = {}) {
    const cadence = await this.settings.get('cadence');
    const start = startOfWeek(new Date(), weekOffset);
    const items = await this.itemsBetween(start, addDays(start, 7));

    const slots = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const key = isoDate(date);
      const dayName = DAY_NAMES[date.getDay()];

      for (const platform of (cadence[dayName] || [])) {
        const match = items.find(
          it => it.scheduled_for?.slice(0, 10) === key && it.platform === platform
        );
        slots.push({
          date: key,
          day_name: dayName,
          platform,
          filled: !!match,
          content_id: match?.id || null,
          status: match?.status || null,
        });
      }
    }

    return {
      week_start: isoDate(start),
      slots,
      filled: slots.filter(s => s.filled).length,
      open: slots.filter(s => !s.filled).length,
    };
  }

  /**
   * Approved content that has no date yet — the pool a human drags
   * onto the calendar.
   */
  async unscheduledApproved({ limit = 50 } = {}) {
    const { data } = await this.db
      .from('growth_content')
      .select('id, title, platform, content_type, status, requires_manual_posting, source_id, created_at')
      .eq('account_id', this.accountId)
      .eq('status', 'approved')
      .is('scheduled_for', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    return data || [];
  }

  /**
   * Topic-repetition guard (spec §20, Worker 3).
   * Flags a platform running the same source repeatedly inside a window.
   */
  async repetitionWarnings({ days = 14 } = {}) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await this.db
      .from('growth_content')
      .select('id, platform, source_id, title, scheduled_for')
      .eq('account_id', this.accountId)
      .in('status', SCHEDULED_STATUSES)
      .gte('scheduled_for', since.toISOString())
      .not('source_id', 'is', null);

    const bySourcePlatform = {};
    for (const item of data || []) {
      const key = `${item.source_id}::${item.platform}`;
      (bySourcePlatform[key] = bySourcePlatform[key] || []).push(item);
    }

    return Object.entries(bySourcePlatform)
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => {
        const [sourceId, platform] = key.split('::');
        return {
          source_id: sourceId,
          platform,
          count: items.length,
          content_ids: items.map(i => i.id),
          message: `${items.length} posts from the same source on ${platform} within ${days} days`,
        };
      });
  }

  async logEvent(contentId, eventType, metadata = {}) {
    try {
      await this.db.from('growth_content_events').insert({
        account_id: this.accountId,
        content_id: contentId,
        event_type: eventType,
        metadata,
      });
    } catch (err) {
      logger.warn(`Failed to log calendar event: ${err.message}`, { accountId: this.accountId });
    }
  }
}

module.exports = GrowthCalendarService;
module.exports.DAY_NAMES = DAY_NAMES;
module.exports.SCHEDULED_STATUSES = SCHEDULED_STATUSES;
module.exports.startOfWeek = startOfWeek;
module.exports.isoDate = isoDate;
