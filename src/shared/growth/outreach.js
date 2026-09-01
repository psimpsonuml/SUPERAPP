// ══════════════════════════════════════════════════════════════════
// Outreach Service (spec §9, §10, §11)
//
// Drafts messages and builds the daily queue. It never sends — approved
// items go through the dispatcher, which enforces suppression and
// mailbox caps.
//
// Three rules enforced here rather than left to the prompt:
//   §10 Sequences STOP after touch 3. There is no endless nurture.
//   §10 The daily cold-email cap is counted before drafting, not after.
//   §11 LinkedIn is prepare-only — every LinkedIn row is created with
//       requires_manual_send = true and no send path exists.
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const GrowthSettingsService = require('./settings');
const GrowthProspectsService = require('./prospects');
const SuppressionService = require('../suppression');
const { PAYROLL_BEACON_ASSETS } = require('./research');
const { outreachUrl } = require('./attribution');
const llm = require('../llm');
const logger = require('../logger');

// Spec §10 — Sequence A stops after three touches.
const SEQUENCES = {
  cold: {
    label: 'Multi-State Payroll Compliance',
    campaign: 'multistate_payroll',
    steps: [
      { step: 1, dayOffset: 0, intent: 'Lead with one genuinely useful resource. Do not ask for a meeting.' },
      { step: 2, dayOffset: 5, intent: 'One additional useful observation or resource. Still no meeting ask.' },
      { step: 3, dayOffset: 12, intent: 'Short final follow-up. Acknowledge this is the last one.' },
    ],
  },
  engaged: {
    label: 'Engaged Follow-up',
    campaign: 'engaged_followup',
    steps: [
      { step: 1, dayOffset: 0, intent: 'Respond to what they actually did. Personal, specific, brief.' },
    ],
  },
  partnership: {
    label: 'Partnership Outreach',
    campaign: 'partnerships',
    steps: [
      { step: 1, dayOffset: 0, intent: 'Introduce the data/API angle. Partnership framing, not customer acquisition.' },
      { step: 2, dayOffset: 7, intent: 'One concrete integration example. Still no hard ask.' },
    ],
  },
};

const MAX_STEPS = Math.max(...Object.values(SEQUENCES).map(s => s.steps.length));

const SENDER_CONTEXT = `
You write cold outreach for Payroll Beacon, a payroll compliance product
that maintains searchable state/local minimum wage and local tax databases.

The sender runs payroll himself and built this because tracking state and
local requirements became unmanageable. That is the honest premise — write
from it.

Hard rules:
- NEVER open with a demo request, a meeting ask, or "I wanted to reach out".
- Lead with something useful. The resource IS the pitch.
- 90-140 words. Short paragraphs. No bullet lists.
- No superlatives, no "revolutionary", no "game-changing", no exclamation marks.
- Sound like one payroll practitioner writing to another.
`.trim();

class OutreachService {
  constructor(accountId, { costService = null } = {}) {
    this.accountId = accountId;
    this.settings = new GrowthSettingsService(accountId);
    this.prospects = new GrowthProspectsService(accountId);
    this.suppression = new SuppressionService(accountId);
    this.costService = costService;
  }

  get db() {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    return getSupabase();
  }

  // ── Capacity (spec §10) ─────────────────────────────────

  /**
   * How many cold emails may still be queued today.
   * Counted before drafting so we never generate work that cannot ship.
   */
  async remainingDailyCapacity() {
    const limits = await this.settings.get('limits');
    const cap = limits.max_daily_cold_emails ?? 20;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await this.db
      .from('growth_outreach')
      .select('id')
      .eq('account_id', this.accountId)
      .eq('channel', 'email')
      .gte('created_at', todayStart.toISOString());

    const used = (data || []).length;
    return { cap, used, remaining: Math.max(cap - used, 0) };
  }

  async linkedinCapacity() {
    const limits = await this.settings.get('limits');
    const cap = limits.max_daily_linkedin_suggestions ?? 10;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await this.db
      .from('growth_outreach')
      .select('id')
      .eq('account_id', this.accountId)
      .eq('channel', 'linkedin')
      .gte('created_at', todayStart.toISOString());

    const used = (data || []).length;
    return { cap, used, remaining: Math.max(cap - used, 0) };
  }

  // ── Drafting ────────────────────────────────────────────

  /**
   * Draft one message. Does not persist — see queueOutreach.
   * @returns {Promise<{subject, body, asset, campaign}>}
   */
  async draft({ prospect, sequence = 'cold', step = 1, channel = 'email', context = null }) {
    // Validate the request before checking external dependencies, so an
    // invalid step reports the actual problem rather than a missing key.
    const seq = SEQUENCES[sequence];
    if (!seq) throw new Error(`Unknown sequence: ${sequence}`);

    const stepDef = seq.steps.find(s => s.step === step);
    if (!stepDef) {
      throw new Error(`Sequence "${sequence}" has no step ${step} — it stops after ${seq.steps.length}`);
    }

    if (!llm.isConfigured()) {
      throw new Error('ANTHROPIC_API_KEY not configured — cannot draft outreach');
    }

    const card = prospect.research_card || {};
    const assetKey = card.recommended_asset || 'local_wage_database';
    const asset = PAYROLL_BEACON_ASSETS[assetKey] || PAYROLL_BEACON_ASSETS.local_wage_database;

    const link = outreachUrl({
      channel, campaign: seq.campaign, asset: assetKey,
    });

    const { data, usage, model } = await llm.completeJson({
      prompt: this.buildPrompt({ prospect, seq, stepDef, channel, asset, assetKey, link, card, context }),
      system: SENDER_CONTEXT,
      model: llm.MODELS.balanced,
      maxTokens: 900,
    });

    if (this.costService) {
      await this.costService.recordLlm({
        model, usage, operation: `outreach:${sequence}:${step}`, prospectId: prospect.id,
      });
    }

    return {
      subject: channel === 'email' ? (data.subject || null) : null,
      body: data.body || '',
      connectionNote: channel === 'linkedin' ? (data.connection_note || null) : null,
      asset: assetKey,
      assetLabel: asset.label,
      campaign: seq.campaign,
      link,
      sequence,
      step,
    };
  }

  buildPrompt({ prospect, seq, stepDef, channel, asset, link, card, context }) {
    const parts = [];

    parts.push(channel === 'linkedin'
      ? 'Write a LinkedIn connection note and follow-up message.'
      : `Write outreach email ${stepDef.step} of ${seq.steps.length}.`);
    parts.push('');
    parts.push(`Intent for this touch: ${stepDef.intent}`);
    parts.push('');

    parts.push('── RECIPIENT ──');
    parts.push(`${prospect.full_name}, ${prospect.title || 'unknown title'} at ${prospect.company_name || 'unknown company'}`);
    if (prospect.company_size) parts.push(`Company size: ${prospect.company_size} employees`);
    if (prospect.industry) parts.push(`Industry: ${prospect.industry}`);

    if (card.why_they_fit?.length) {
      parts.push('');
      parts.push('Why they are a fit:');
      card.why_they_fit.forEach(r => parts.push(`- ${r}`));
    }
    if (card.company_complexity?.length) {
      parts.push(`Complexity signals: ${card.company_complexity.join(', ')}`);
    }
    if (card.conversation_angle) {
      parts.push('');
      parts.push(`Suggested angle: ${card.conversation_angle}`);
    }
    if (card.risks?.length) {
      parts.push(`Known risks: ${card.risks.join('; ')}`);
    }

    parts.push('');
    parts.push('── THE RESOURCE TO LEAD WITH ──');
    parts.push(`${asset.label} — best for ${asset.bestFor}`);
    parts.push(`Link: ${link}`);

    if (stepDef.step > 1) {
      parts.push('');
      parts.push(`This is follow-up ${stepDef.step}. They have not replied. Do not repeat the first message — add something new and keep it shorter.`);
    }
    if (stepDef.step === seq.steps.length && seq.steps.length > 1) {
      parts.push('This is the LAST touch. Say so plainly and leave the door open without pressure.');
    }
    if (context) {
      parts.push('');
      parts.push(`Context: ${context}`);
    }

    parts.push('');
    parts.push('── OUTPUT ──');
    if (channel === 'linkedin') {
      parts.push('{"connection_note": "under 300 characters, no link", "body": "the follow-up message once connected, 60-100 words"}');
    } else {
      parts.push('{"subject": "under 60 characters, lowercase, no colon-heavy marketing format", "body": "the email, 90-140 words, plain text"}');
    }

    return parts.join('\n');
  }

  // ── Queue ───────────────────────────────────────────────

  /**
   * Persist a drafted message. Refuses when the prospect cannot be
   * contacted on that channel — a queued row that can never send is
   * worse than an honest refusal.
   */
  async queueOutreach({ prospect, draft, channel = 'email', scheduledFor = null }) {
    if (channel === 'email') {
      if (!prospect.email) {
        return { queued: false, reason: 'prospect_has_no_email' };
      }
      const check = await this.suppression.check(prospect.email);
      if (check.suppressed) {
        return { queued: false, reason: 'suppressed', suppressionReason: check.reason };
      }
    }
    if (channel === 'linkedin' && !prospect.linkedin_url) {
      return { queued: false, reason: 'prospect_has_no_linkedin' };
    }

    const { data, error } = await this.db
      .from('growth_outreach')
      .insert({
        account_id: this.accountId,
        prospect_id: prospect.id,
        channel,
        sequence: draft.sequence,
        step_number: draft.step,
        subject: draft.subject,
        body: draft.body,
        recommended_asset: draft.asset,
        status: 'ready',
        // Spec §11 — LinkedIn is never sent by the system.
        requires_manual_send: channel === 'linkedin',
        scheduled_for: scheduledFor,
        metadata: {
          campaign: draft.campaign,
          link: draft.link,
          assetLabel: draft.assetLabel,
          connectionNote: draft.connectionNote || null,
        },
      })
      .select().single();

    if (error) throw new Error(`Failed to queue outreach: ${error.message}`);

    await this.prospects.logEvent(prospect.id, 'email_queued', {
      channel, sequence: draft.sequence, step: draft.step,
    });

    return { queued: true, outreach: data };
  }

  // ── Sequence progression (spec §10) ──────────────────────

  /**
   * Which touch a prospect is due for, if any.
   * Returns null when the sequence has run its course — sequences STOP.
   */
  async nextStepFor(prospect, sequence = 'cold') {
    const seq = SEQUENCES[sequence];
    if (!seq) return null;

    const { data: sent } = await this.db
      .from('growth_outreach')
      .select('step_number, sent_at, status, created_at')
      .eq('account_id', this.accountId)
      .eq('prospect_id', prospect.id)
      .eq('sequence', sequence)
      .order('step_number', { ascending: false });

    const history = sent || [];

    // A reply ends the cold sequence — they move to engaged.
    if (['replied', 'positive', 'negative', 'meeting', 'converted'].includes(prospect.status)) {
      return null;
    }

    if (history.length === 0) return seq.steps[0];

    const highest = Math.max(...history.map(h => h.step_number));
    if (highest >= seq.steps.length) return null; // sequence complete — stop

    const nextStep = seq.steps.find(s => s.step === highest + 1);
    if (!nextStep) return null;

    // Respect the day offset from the previous touch
    const last = history.find(h => h.step_number === highest);
    const lastAt = last?.sent_at || last?.created_at;
    if (lastAt) {
      const prevOffset = seq.steps.find(s => s.step === highest)?.dayOffset ?? 0;
      const daysSince = (Date.now() - new Date(lastAt).getTime()) / 86400000;
      if (daysSince < (nextStep.dayOffset - prevOffset)) return null; // not due yet
    }

    return nextStep;
  }

  // ── Reads ───────────────────────────────────────────────

  async list({ status, channel, prospectId, limit = 50, offset = 0 } = {}) {
    let q = this.db
      .from('growth_outreach')
      .select('*')
      .eq('account_id', this.accountId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) q = Array.isArray(status) ? q.in('status', status) : q.eq('status', status);
    if (channel) q = q.eq('channel', channel);
    if (prospectId) q = q.eq('prospect_id', prospectId);

    const { data } = await q;
    return data || [];
  }

  /**
   * The daily workbench (spec §9): ready outreach joined to its prospect.
   */
  async queue({ limit = 50 } = {}) {
    const rows = await this.list({ status: ['draft', 'ready'], limit });
    if (rows.length === 0) return [];

    const ids = [...new Set(rows.map(r => r.prospect_id))];
    const { data: prospects } = await this.db
      .from('growth_prospects')
      .select('*')
      .eq('account_id', this.accountId)
      .in('id', ids);

    const byId = Object.fromEntries((prospects || []).map(p => [p.id, p]));

    return rows.map(row => {
      const prospect = byId[row.prospect_id] || {};
      const card = prospect.research_card || {};
      return {
        ...row,
        prospect: {
          id: prospect.id,
          full_name: prospect.full_name,
          title: prospect.title,
          company_name: prospect.company_name,
          email: prospect.email,
          email_status: prospect.email_status,
          linkedin_url: prospect.linkedin_url,
          payroll_fit_score: prospect.payroll_fit_score,
          fit_band: prospect.fit_band,
          fit_reason: prospect.fit_reason,
          status: prospect.status,
          next_followup_at: prospect.next_followup_at,
        },
        why_fit: card.why_they_fit || [],
        conversation_angle: card.conversation_angle || null,
        risks: card.risks || [],
        // Spec §9 — the Next Action column
        next_action: this.nextAction(row, prospect),
      };
    });
  }

  nextAction(outreach, prospect) {
    if (outreach.requires_manual_send) return 'Copy and send on LinkedIn';
    if (outreach.status === 'draft') return 'Review and approve';
    if (outreach.status === 'ready' && !prospect.email) return 'Blocked — no email address';
    if (outreach.status === 'ready') return 'Approve to send';
    if (outreach.status === 'sent') return 'Await reply';
    return 'Review';
  }

  async markSent(outreachId, { manual = false } = {}) {
    const { data, error } = await this.db
      .from('growth_outreach')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata_manual_send: manual || undefined,
      })
      .eq('id', outreachId).eq('account_id', this.accountId)
      .select().single();

    if (error) throw new Error(`Failed to mark sent: ${error.message}`);

    if (data?.prospect_id) {
      await this.prospects.recordContact(data.prospect_id);
      // Schedule the next touch if the sequence has one left
      const prospect = await this.prospects.get(data.prospect_id);
      const next = await this.nextStepFor(prospect, data.sequence);
      if (next) {
        const seq = SEQUENCES[data.sequence];
        const prevOffset = seq.steps.find(s => s.step === data.step_number)?.dayOffset ?? 0;
        await this.prospects.scheduleFollowup(data.prospect_id, next.dayOffset - prevOffset);
      }
    }

    return data;
  }

  async updateStatus(outreachId, status, patch = {}) {
    const { data, error } = await this.db
      .from('growth_outreach')
      .update({ status, ...patch, updated_at: new Date().toISOString() })
      .eq('id', outreachId).eq('account_id', this.accountId)
      .select().single();
    if (error) throw new Error(`Failed to update outreach: ${error.message}`);
    return data;
  }
}

module.exports = OutreachService;
module.exports.SEQUENCES = SEQUENCES;
module.exports.MAX_STEPS = MAX_STEPS;
module.exports.SENDER_CONTEXT = SENDER_CONTEXT;
