const BaseAgent = require('./base-agent');
const { dispatch } = require('../shared/dispatcher');
const { publishDueContent } = require('../shared/growth/publish');

// ══════════════════════════════════════════════════════════════════
// Publish Dispatcher
//
// Drains two backlogs that previously had no consumer:
//
//   1. approval_queue rows that are approved/auto_approved but were
//      never dispatched (approved before the dispatcher existed, or
//      whose dispatch failed transiently).
//   2. social_post_log rows scheduled for a time that has now passed.
//
// Runs frequently and cheaply. Everything it does is idempotent — the
// unique index on dispatch_log prevents double-sending.
// ══════════════════════════════════════════════════════════════════

const MAX_PER_RUN = 25;

class PublishDispatcherAgent extends BaseAgent {
  static agentId = 'publish-dispatcher';
  static agentName = 'Publish Dispatcher';

  constructor(accountId) {
    super(accountId, {
      agentId: 'publish-dispatcher',
      agentName: 'Publish Dispatcher',
      cycle: 'continuous',
      defaultTier: 2,
    });
  }

  async run() {
    const results = {
      approvedScanned: 0,
      dispatched: 0,
      skipped: 0,
      failed: 0,
      scheduledDue: 0,
      byStatus: {},
    };

    // ── 1. Undispatched approvals ─────────────────────────
    const pending = await this.findUndispatchedApprovals(MAX_PER_RUN);
    results.approvedScanned = pending.length;

    for (const item of pending) {
      const outcome = await dispatch(item, this.accountId);
      results.byStatus[outcome.status] = (results.byStatus[outcome.status] || 0) + 1;

      if (outcome.status === 'dispatched') results.dispatched++;
      else if (outcome.status === 'failed') results.failed++;
      else results.skipped++;
    }

    // ── 2. Scheduled social posts whose time has come ─────
    const due = await this.findDueScheduledPosts(MAX_PER_RUN);
    results.scheduledDue = due.length;

    for (const postLog of due) {
      try {
        const SocialDistributorAgent = require('./social-distributor');
        const agent = new SocialDistributorAgent(this.accountId);
        await agent.executePost(postLog.id);
        results.dispatched++;
      } catch (err) {
        results.failed++;
        this.errors.push({ message: `Scheduled post ${postLog.id}: ${err.message}` });
        this.logger.warn(`Failed to publish scheduled post ${postLog.id}: ${err.message}`, {
          agentId: this.agentId,
        });
      }
    }

    // ── 3. Growth content whose scheduled time has arrived ──
    try {
      const growth = await publishDueContent(this.accountId, { limit: MAX_PER_RUN });
      results.growthDue = growth.attempted;
      results.growthPublished = growth.published;
      results.growthManual = growth.manual;
      results.dispatched += growth.published;
      results.failed += growth.failed;
      if (growth.failed > 0) {
        results.growthFailures = growth.outcomes.filter(o => !o.ok && o.reason !== 'manual_posting_required');
      }
    } catch (err) {
      this.logger.warn(`Growth content publish pass failed: ${err.message}`, { agentId: this.agentId });
      this.errors.push({ message: `Growth publish: ${err.message}` });
    }

    this.itemsProduced = results.dispatched;

    if (results.failed > 0) {
      this.logger.warn(`Publish dispatcher completed with ${results.failed} failure(s)`, {
        agentId: this.agentId,
        ...results,
      });
    }

    return results;
  }

  /**
   * Approved items with no successful dispatch_log row.
   * Done as two queries rather than a NOT EXISTS join because PostgREST
   * has no clean anti-join.
   */
  async findUndispatchedApprovals(limit) {
    const { data: approved } = await this.supabase
      .from('approval_queue')
      .select('*')
      .eq('account_id', this.accountId)
      .in('status', ['approved', 'auto_approved', 'edited'])
      .order('reviewed_at', { ascending: true, nullsFirst: true })
      .limit(limit * 4);

    const candidates = approved || [];
    if (candidates.length === 0) return [];

    const { data: logged } = await this.supabase
      .from('dispatch_log')
      .select('approval_item_id, status')
      .eq('account_id', this.accountId)
      .in('approval_item_id', candidates.map(c => c.id));

    // Anything already dispatched, deliberately skipped, or suppressed
    // is settled — only genuinely untouched or failed items are retried.
    const settled = new Set(
      (logged || [])
        .filter(l => ['dispatched', 'skipped', 'suppressed', 'no_handler'].includes(l.status))
        .map(l => l.approval_item_id)
    );

    return candidates.filter(c => !settled.has(c.id)).slice(0, limit);
  }

  /** social_post_log rows scheduled at or before now. */
  async findDueScheduledPosts(limit) {
    const { data } = await this.supabase
      .from('social_post_log')
      .select('id, platform, scheduled_for, status')
      .eq('account_id', this.accountId)
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    return data || [];
  }
}

module.exports = PublishDispatcherAgent;
