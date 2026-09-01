const BaseAgent = require('./base-agent');
const GrowthCalendarService = require('../shared/growth/calendar');
const GrowthContentService = require('../shared/growth/content');
const GrowthSettingsService = require('../shared/growth/settings');
const { DAY_NAMES, startOfWeek, isoDate } = require('../shared/growth/calendar');

// ══════════════════════════════════════════════════════════════════
// Worker 3 — Scheduler (spec §20)
//
// Assigns already-approved content to open cadence slots, prevents the
// same topic recurring on a platform, and flags empty periods.
//
// It does NOT generate anything. If there is no approved content for an
// open slot, the slot stays open and is reported. Spec §20: "Do not
// invent filler just to satisfy posting quotas."
// ══════════════════════════════════════════════════════════════════

// Posting hour per platform, local to the account timezone.
const PLATFORM_HOURS = {
  linkedin_company: 8,
  linkedin_personal: 8,
  blog: 9,
  facebook: 12,
  instagram: 14,
  x: 10,
  video: 15,
};

class GrowthSchedulerAgent extends BaseAgent {
  static agentId = 'growth-scheduler';
  static agentName = 'Growth Scheduler';

  constructor(accountId) {
    super(accountId, {
      agentId: 'growth-scheduler',
      agentName: 'Growth Scheduler',
      cycle: 'weekly',
      defaultTier: 1,
    });

    this.calendar = new GrowthCalendarService(accountId);
    this.content = new GrowthContentService(accountId);
    this.settings = new GrowthSettingsService(accountId);
  }

  async run(options = {}) {
    const weekOffset = options.weekOffset ?? 1; // next week by default

    const results = {
      weekOffset,
      slotsOpen: 0,
      slotsFilled: 0,
      scheduled: 0,
      unscheduledRemaining: 0,
      openSlotsLeftEmpty: [],
      repetitionWarnings: [],
      byPlatform: {},
    };

    const slotPlan = await this.calendar.slots({ weekOffset });
    results.slotsOpen = slotPlan.open;
    results.slotsFilled = slotPlan.filled;

    const openSlots = slotPlan.slots.filter(s => !s.filled);
    if (openSlots.length === 0) {
      this.logger.info('No open slots next week', { agentId: this.agentId });
    }

    // Pool of approved-but-undated content
    const pool = await this.calendar.unscheduledApproved({ limit: 100 });

    // Sources already used on a platform this window — avoids putting
    // the same source on the same platform twice in one week.
    const usedSourceByPlatform = await this.recentSourceUsage();

    for (const slot of openSlots) {
      const pick = this.pickForSlot(pool, slot, usedSourceByPlatform);

      if (!pick) {
        // Deliberately left empty rather than filled with filler.
        results.openSlotsLeftEmpty.push({
          date: slot.date, platform: slot.platform, reason: 'no_approved_content_available',
        });
        continue;
      }

      try {
        const when = this.slotDatetime(slot);
        await this.calendar.reschedule(pick.id, when.toISOString());

        // Remove from the pool and record the source usage
        pool.splice(pool.indexOf(pick), 1);
        if (pick.source_id) {
          const key = `${pick.source_id}::${slot.platform}`;
          usedSourceByPlatform.add(key);
        }

        results.scheduled++;
        results.byPlatform[slot.platform] = (results.byPlatform[slot.platform] || 0) + 1;
      } catch (err) {
        this.logger.warn(`Failed to schedule ${pick.id} into ${slot.date}: ${err.message}`, {
          agentId: this.agentId,
        });
        this.errors.push({ message: `Slot ${slot.date}/${slot.platform}: ${err.message}` });
      }
    }

    results.unscheduledRemaining = pool.length;
    results.repetitionWarnings = await this.calendar.repetitionWarnings({ days: 14 });

    if (results.openSlotsLeftEmpty.length > 0) {
      this.logger.info(
        `${results.openSlotsLeftEmpty.length} slot(s) left open — no approved content available`,
        { agentId: this.agentId }
      );
    }

    this.itemsProduced = results.scheduled;
    return results;
  }

  /**
   * Best approved item for a slot: right platform, and not from a source
   * already used on that platform this window.
   */
  pickForSlot(pool, slot, usedSourceByPlatform) {
    const candidates = pool.filter(item => item.platform === slot.platform);
    if (candidates.length === 0) return null;

    const fresh = candidates.find(item => {
      if (!item.source_id) return true;
      return !usedSourceByPlatform.has(`${item.source_id}::${slot.platform}`);
    });

    // Prefer a non-repeating source; fall back to oldest approved.
    return fresh || candidates[0];
  }

  /** Sources already scheduled per platform in the last 14 days. */
  async recentSourceUsage() {
    const since = new Date();
    since.setDate(since.getDate() - 14);

    const { data } = await this.supabase
      .from('growth_content')
      .select('source_id, platform')
      .eq('account_id', this.accountId)
      .in('status', ['approved', 'scheduled', 'published'])
      .gte('scheduled_for', since.toISOString())
      .not('source_id', 'is', null);

    const used = new Set();
    for (const row of data || []) used.add(`${row.source_id}::${row.platform}`);
    return used;
  }

  slotDatetime(slot) {
    const hour = PLATFORM_HOURS[slot.platform] ?? 10;
    const when = new Date(`${slot.date}T00:00:00.000Z`);
    when.setUTCHours(hour, 0, 0, 0);
    return when;
  }
}

module.exports = GrowthSchedulerAgent;
module.exports.PLATFORM_HOURS = PLATFORM_HOURS;
