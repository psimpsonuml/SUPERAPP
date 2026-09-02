const BaseAgent = require('./base-agent');
const OutreachService = require('../shared/growth/outreach');
const GrowthProspectsService = require('../shared/growth/prospects');
const GrowthCostService = require('../shared/growth/cost');
const llm = require('../shared/llm');

// ══════════════════════════════════════════════════════════════════
// Worker 5 — Outreach Assistant (spec §20)
//
// Drafts messages and builds the daily queue. It sends NOTHING.
// Email goes through the approval queue, and from there the dispatcher
// (which enforces suppression and mailbox caps). LinkedIn is prepared
// for the human and has no send path at all (spec §11).
//
// Capacity is checked BEFORE drafting so the agent never generates
// messages that cannot ship today.
// ══════════════════════════════════════════════════════════════════

class GrowthOutreachAssistantAgent extends BaseAgent {
  static agentId = 'growth-outreach-assistant';
  static agentName = 'Growth Outreach Assistant';

  constructor(accountId) {
    super(accountId, {
      agentId: 'growth-outreach-assistant',
      agentName: 'Growth Outreach Assistant',
      cycle: 'daily',
      defaultTier: 2,
    });

    this.cost = new GrowthCostService(accountId);
    this.outreach = new OutreachService(accountId, { costService: this.cost });
    this.prospects = new GrowthProspectsService(accountId);
  }

  async run(options = {}) {
    if (!llm.isConfigured()) {
      throw new Error('ANTHROPIC_API_KEY not configured — cannot draft outreach');
    }

    const results = {
      emailCapacity: null,
      linkedinCapacity: null,
      firstTouchDrafted: 0,
      followUpsDrafted: 0,
      linkedinPrepared: 0,
      blocked: [],
      failed: 0,
      errors: [],
    };

    // Spec §10 — check capacity before drafting anything
    const emailCap = await this.outreach.remainingDailyCapacity();
    results.emailCapacity = emailCap;

    if (emailCap.remaining > 0) {
      await this.draftFollowUps(results, emailCap);
      await this.draftFirstTouches(results, emailCap);
    } else {
      this.logger.info(`Daily email cap reached (${emailCap.used}/${emailCap.cap}) — drafting nothing`, {
        agentId: this.agentId,
      });
    }

    // LinkedIn: prepared only, never sent
    if (options.linkedin !== false) {
      const liCap = await this.outreach.linkedinCapacity();
      results.linkedinCapacity = liCap;
      if (liCap.remaining > 0) {
        await this.prepareLinkedIn(results, liCap);
      }
    }

    this.itemsProduced = results.firstTouchDrafted + results.followUpsDrafted + results.linkedinPrepared;
    return results;
  }

  /** Follow-ups come first — an in-flight sequence beats a new name. */
  async draftFollowUps(results, cap) {
    const due = await this.prospects.listFollowupsDue({ limit: cap.remaining });

    for (const prospect of due) {
      if (this.usedSoFar(results) >= cap.remaining) break;

      try {
        const next = await this.outreach.nextStepFor(prospect, 'cold');
        if (!next) {
          // Sequence complete or they replied — clear the reminder so it
          // does not resurface every day.
          await this.prospects.scheduleFollowup(prospect.id, 3650);
          continue;
        }

        const drafted = await this.draftAndQueue(prospect, 'cold', next.step, results);
        if (drafted) results.followUpsDrafted++;
      } catch (err) {
        results.failed++;
        results.errors.push({ prospectId: prospect.id, stage: 'followup', error: err.message });
      }
    }
  }

  /** New priority prospects that have never been contacted. */
  async draftFirstTouches(results, cap) {
    const queue = await this.prospects.listPriorityQueue({ limit: cap.remaining });

    for (const prospect of queue) {
      if (this.usedSoFar(results) >= cap.remaining) break;

      try {
        const existing = await this.outreach.list({ prospectId: prospect.id, limit: 1 });
        if (existing.length > 0) continue;

        const drafted = await this.draftAndQueue(prospect, 'cold', 1, results);
        if (drafted) results.firstTouchDrafted++;
      } catch (err) {
        results.failed++;
        results.errors.push({ prospectId: prospect.id, stage: 'first_touch', error: err.message });
      }
    }
  }

  async draftAndQueue(prospect, sequence, step, results) {
    const draft = await this.outreach.draft({ prospect, sequence, step, channel: 'email' });
    const queued = await this.outreach.queueOutreach({ prospect, draft, channel: 'email' });

    if (!queued.queued) {
      // Record why rather than dropping it silently
      results.blocked.push({
        prospectId: prospect.id,
        name: prospect.full_name,
        reason: queued.reason,
      });
      return false;
    }

    // Human approval before anything sends (spec §20)
    await this.submitForApproval({
      itemType: 'outreach_email',
      tier: 2,
      contentPreview: `[${prospect.company_name}] ${draft.subject}`,
      fullContent: {
        prospectId: prospect.id,
        outreachId: queued.outreach.id,
        prospect: {
          name: prospect.full_name, title: prospect.title,
          company: prospect.company_name, email: prospect.email,
          fitScore: prospect.payroll_fit_score,
        },
        email: { subject: draft.subject, body: draft.body },
        sequence, step, asset: draft.asset,
      },
    });

    await this.prospects.setStatus(prospect.id, 'ready');
    return true;
  }

  /**
   * Prepare LinkedIn messages for the human to send.
   * Spec §11 — no automation, no send path. These are drafts to copy.
   */
  async prepareLinkedIn(results, cap) {
    const candidates = (await this.prospects.list({ band: 'priority', limit: cap.remaining * 3 }))
      .filter(p => p.linkedin_url && !['do_not_contact', 'disqualified', 'converted'].includes(p.status));

    for (const prospect of candidates.slice(0, cap.remaining)) {
      try {
        const existing = await this.outreach.list({ prospectId: prospect.id, channel: 'linkedin', limit: 1 });
        if (existing.length > 0) continue;

        const draft = await this.outreach.draft({
          prospect, sequence: 'cold', step: 1, channel: 'linkedin',
        });
        const queued = await this.outreach.queueOutreach({ prospect, draft, channel: 'linkedin' });

        if (queued.queued) results.linkedinPrepared++;
        else results.blocked.push({ prospectId: prospect.id, reason: queued.reason });
      } catch (err) {
        results.failed++;
        results.errors.push({ prospectId: prospect.id, stage: 'linkedin', error: err.message });
      }
    }
  }

  usedSoFar(results) {
    return results.firstTouchDrafted + results.followUpsDrafted;
  }
}

module.exports = GrowthOutreachAssistantAgent;
