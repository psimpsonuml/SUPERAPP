// ══════════════════════════════════════════════════════════════════
// Approval Dispatcher
//
// Bridges approval -> action. Before this existed, approving an item
// only flipped approval_queue.status; executePost() and
// sendApprovedEmail() had zero callers, so nothing was ever published
// or sent and every downstream metric stayed at zero.
//
// Design rules:
//   - Dispatch NEVER throws into the approval flow. Approving must
//     succeed even when the action fails; the failure is recorded.
//   - Every attempt writes a dispatch_log row. Failures are visible.
//   - Idempotent: a unique partial index prevents a second successful
//     dispatch for the same approval item.
//   - Unknown item types are logged as 'no_handler', not silently dropped.
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../db/supabase');
const logger = require('./logger');

// ── Handler registry ──────────────────────────────────────
// Each handler: async ({ item, accountId, supabase }) -> { ok, result?, reason? }
// Agents are required lazily so the dispatcher stays cheap to import
// and a broken agent can't take down the approval routes.

const handlers = {
  // Social posts queued by social-distributor into social_post_log
  social_post: {
    name: 'social-distributor.executePost',
    async handle({ item, accountId }) {
      const postLogId = item.full_content?.postLogId
        || item.full_content?.post_log_id
        || item.full_content?.socialPostLogId;

      if (!postLogId) {
        return { ok: false, reason: 'missing_post_log_id' };
      }

      const SocialDistributorAgent = require('../agents/social-distributor');
      const agent = new SocialDistributorAgent(accountId);
      const result = await agent.executePost(postLogId);
      return { ok: true, result };
    },
  },

  // Cold outreach and partnership pitches from outreach-prospector
  outreach_email: {
    name: 'outreach-prospector.sendApprovedEmail',
    async handle({ item, accountId }) {
      return dispatchOutreachEmail({ item, accountId });
    },
  },

  partnership_pitch: {
    name: 'outreach-prospector.sendApprovedEmail',
    async handle({ item, accountId }) {
      return dispatchOutreachEmail({ item, accountId });
    },
  },

  // Growth OS content. Approval publishes immediately when the item is
  // due and the platform has a working publisher; otherwise it is
  // approved onto the calendar and the scheduled-post drainer picks it
  // up at its time. Manual platforms stop here for the human.
  growth_content: {
    name: 'growth-content.publish',
    async handle({ item, accountId }) {
      const contentId = item.full_content?.growthContentId;
      if (!contentId) return { ok: false, reason: 'missing_growth_content_id' };

      const GrowthContentService = require('./growth/content');
      const service = new GrowthContentService(accountId);

      const existing = await service.getContent(contentId);
      if (!existing) return { ok: false, reason: 'content_not_found' };

      // Spec §12 — manual platforms are approved and wait for the human.
      if (existing.requires_manual_posting) {
        await service.approve(contentId);
        return { ok: true, result: { contentId, manualPostingRequired: true } };
      }

      const approved = await service.approve(contentId, {
        scheduledFor: item.full_content?.scheduledFor || existing.scheduled_for || null,
      });

      // Scheduled for later — the publish-dispatcher will run it then.
      const dueAt = approved.scheduled_for ? new Date(approved.scheduled_for) : null;
      if (dueAt && dueAt.getTime() > Date.now()) {
        return {
          ok: true,
          result: { contentId, status: approved.status, publishesAt: approved.scheduled_for },
        };
      }

      const { publishGrowthContent } = require('./growth/publish');
      const published = await publishGrowthContent(accountId, contentId);

      // A publish that could not run is not a dispatch failure — the
      // approval stands and the reason is recorded on the content.
      if (!published.ok) {
        return { ok: false, reason: published.reason, result: published };
      }

      return { ok: true, result: published };
    },
  },
};

async function dispatchOutreachEmail({ item, accountId }) {
  const content = item.full_content || {};
  const prospectId = content.prospectId || content.prospect_id;
  const draft = content.email || content.pitch;

  if (!prospectId) return { ok: false, reason: 'missing_prospect_id' };
  if (!draft?.subject || !draft?.body) return { ok: false, reason: 'missing_email_draft' };

  const OutreachProspectorAgent = require('../agents/outreach-prospector');
  const agent = new OutreachProspectorAgent(accountId);
  const result = await agent.sendApprovedEmail(prospectId, draft);

  // sendApprovedEmail returns a structured result; treat a policy
  // refusal (suppressed, no mailbox) as a skip rather than a failure.
  if (result && typeof result === 'object' && result.sent === false) {
    return { ok: false, reason: result.reason || 'send_refused', result };
  }
  return { ok: true, result };
}

// Item types that intentionally have no automated action — they are
// review-only artifacts. Logged as 'skipped', not 'no_handler'.
const MANUAL_ONLY = new Set([
  // Spec §12: personal LinkedIn is prepared, never posted automatically.
  'linkedin_personal_post',
  'intelligence_briefing',
  'growth_briefing',
  'chronostates_scenario',
  'ad_creative',
  'video_concept',
  'manual_review',
]);

// ── Logging ───────────────────────────────────────────────

async function writeLog(accountId, item, { status, handler, result, error, attempt = 1 }) {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await getSupabase()
      .from('dispatch_log')
      .insert({
        account_id: accountId,
        approval_item_id: item.id,
        item_type: item.item_type,
        agent_id: item.agent_id,
        handler: handler || null,
        status,
        attempt,
        result: result ? JSON.parse(JSON.stringify(result)) : {},
        error_message: error || null,
        dispatched_at: status === 'dispatched' ? new Date().toISOString() : null,
      })
      .select('id')
      .single();
    return data?.id || null;
  } catch (err) {
    // A unique-violation here means it already dispatched — that's the
    // idempotency guard doing its job, not an error worth surfacing.
    if (!/duplicate key|unique constraint/i.test(err.message || '')) {
      logger.warn(`Failed to write dispatch_log: ${err.message}`, { accountId });
    }
    return null;
  }
}

async function alreadyDispatched(accountId, approvalItemId) {
  if (!isSupabaseConfigured()) return false;
  const { data } = await getSupabase()
    .from('dispatch_log')
    .select('id')
    .eq('account_id', accountId)
    .eq('approval_item_id', approvalItemId)
    .eq('status', 'dispatched')
    .limit(1);
  return (data || []).length > 0;
}

// ── Public API ────────────────────────────────────────────

/**
 * Dispatch one approved item to its handler.
 * Always resolves — never throws into the approval flow.
 *
 * @returns {Promise<{status, handler?, result?, reason?, error?}>}
 */
async function dispatch(item, accountId) {
  if (!item || !item.id) {
    return { status: 'failed', reason: 'invalid_item' };
  }

  const itemType = item.item_type;

  // Manual-only artifacts
  if (MANUAL_ONLY.has(itemType)) {
    await writeLog(accountId, item, { status: 'skipped', handler: null, result: { reason: 'manual_only' } });
    return { status: 'skipped', reason: 'manual_only' };
  }

  const handler = handlers[itemType];
  if (!handler) {
    logger.warn(`No dispatch handler for item_type "${itemType}"`, {
      accountId, approvalItemId: item.id, agentId: item.agent_id,
    });
    await writeLog(accountId, item, { status: 'no_handler', handler: null });
    return { status: 'no_handler', reason: `no handler for ${itemType}` };
  }

  // Idempotency
  if (await alreadyDispatched(accountId, item.id)) {
    logger.info(`Item ${item.id} already dispatched — skipping`, { accountId });
    return { status: 'skipped', reason: 'already_dispatched' };
  }

  try {
    const outcome = await handler.handle({ item, accountId });

    if (outcome.ok) {
      await writeLog(accountId, item, {
        status: 'dispatched', handler: handler.name, result: outcome.result,
      });
      logger.info(`Dispatched ${itemType} via ${handler.name}`, {
        accountId, approvalItemId: item.id,
      });
      return { status: 'dispatched', handler: handler.name, result: outcome.result };
    }

    // Handler declined — a policy refusal, not a crash
    const isSuppression = outcome.reason === 'suppressed';
    await writeLog(accountId, item, {
      status: isSuppression ? 'suppressed' : 'failed',
      handler: handler.name,
      result: outcome.result,
      error: outcome.reason,
    });
    logger.warn(`Dispatch declined for ${itemType}: ${outcome.reason}`, {
      accountId, approvalItemId: item.id,
    });
    return { status: isSuppression ? 'suppressed' : 'failed', handler: handler.name, reason: outcome.reason };

  } catch (err) {
    await writeLog(accountId, item, {
      status: 'failed', handler: handler.name, error: err.message,
    });
    logger.error(`Dispatch threw for ${itemType}: ${err.message}`, {
      accountId, approvalItemId: item.id, stack: err.stack,
    });
    return { status: 'failed', handler: handler.name, error: err.message };
  }
}

/**
 * Fetch an approval item by id and dispatch it.
 * Used by the API route and the retry path.
 */
async function dispatchById(approvalItemId, accountId) {
  if (!isSupabaseConfigured()) return { status: 'failed', reason: 'database_not_configured' };

  const { data: item, error } = await getSupabase()
    .from('approval_queue')
    .select('*')
    .eq('id', approvalItemId)
    .eq('account_id', accountId)
    .single();

  if (error || !item) return { status: 'failed', reason: 'item_not_found' };
  if (!['approved', 'auto_approved', 'edited'].includes(item.status)) {
    return { status: 'skipped', reason: `item status is ${item.status}` };
  }

  return dispatch(item, accountId);
}

/** Re-attempt everything that failed, for the retry endpoint. */
async function retryFailed(accountId, { limit = 25 } = {}) {
  if (!isSupabaseConfigured()) return { retried: 0, results: [] };

  const { data: failures } = await getSupabase()
    .from('dispatch_log')
    .select('approval_item_id')
    .eq('account_id', accountId)
    .in('status', ['failed'])
    .order('created_at', { ascending: false })
    .limit(limit);

  const seen = new Set();
  const results = [];

  for (const row of failures || []) {
    if (!row.approval_item_id || seen.has(row.approval_item_id)) continue;
    seen.add(row.approval_item_id);
    const result = await dispatchById(row.approval_item_id, accountId);
    results.push({ approvalItemId: row.approval_item_id, ...result });
  }

  return { retried: results.length, results };
}

function registeredTypes() {
  return { handled: Object.keys(handlers), manualOnly: Array.from(MANUAL_ONLY) };
}

module.exports = {
  dispatch,
  dispatchById,
  retryFailed,
  registeredTypes,
  handlers,
  MANUAL_ONLY,
};
