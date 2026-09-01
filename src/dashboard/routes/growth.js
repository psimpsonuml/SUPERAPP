const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const { dispatchById, retryFailed, registeredTypes } = require('../../shared/dispatcher');
const SuppressionService = require('../../shared/suppression');
const GrowthSettingsService = require('../../shared/growth/settings');
const GrowthContentService = require('../../shared/growth/content');
const GrowthProspectsService = require('../../shared/growth/prospects');
const GrowthCostService = require('../../shared/growth/cost');
const GrowthAttributionService = require('../../shared/growth/attribution');
const logger = require('../../shared/logger');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── DISPATCH ──────────────────────────────────────────────

// GET /api/growth/dispatch — recent dispatch attempts
router.get('/dispatch', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const { data, error } = await safeQuery(sb => {
      let q = sb.from('dispatch_log')
        .select('*')
        .eq('account_id', req.accountId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (req.query.status) q = q.eq('status', req.query.status);
      if (req.query.item_type) q = q.eq('item_type', req.query.item_type);
      return q;
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ dispatches: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/growth/dispatch/stats — counts by status
router.get('/dispatch/stats', async (req, res) => {
  try {
    const { data } = await safeQuery(sb =>
      sb.from('dispatch_log')
        .select('status, item_type')
        .eq('account_id', req.accountId)
    );

    const byStatus = {};
    const byType = {};
    for (const row of data || []) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      byType[row.item_type] = (byType[row.item_type] || 0) + 1;
    }

    res.json({
      byStatus,
      byType,
      total: (data || []).length,
      failed: byStatus.failed || 0,
      handlers: registeredTypes(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/growth/dispatch/retry-failed — re-attempt failures
router.post('/dispatch/retry-failed', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.body?.limit, 10) || 25, 100);
    const result = await retryFailed(req.accountId, { limit });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/growth/dispatch/:approvalItemId — manually dispatch one item
router.post('/dispatch/:approvalItemId', async (req, res) => {
  try {
    const result = await dispatchById(req.params.approvalItemId, req.accountId);
    const code = result.status === 'dispatched' ? 200
      : result.status === 'failed' ? 500
      : 202;
    res.status(code).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── SUPPRESSIONS ──────────────────────────────────────────

// GET /api/growth/suppressions
router.get('/suppressions', async (req, res) => {
  try {
    const service = new SuppressionService(req.accountId);
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    res.json({ suppressions: await service.list({ limit, offset }) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/growth/suppressions
router.post('/suppressions', async (req, res) => {
  try {
    const { email, domain, prospect_id, reason, notes } = req.body;
    if (!email && !domain) {
      return res.status(400).json({ error: 'Either email or domain is required' });
    }
    const service = new SuppressionService(req.accountId);
    const created = await service.add({
      email, domain, prospectId: prospect_id,
      reason: reason || 'manually_blocked',
      source: 'dashboard', notes,
    });
    res.json({ suppression: created });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/growth/suppressions/check — is this address contactable?
router.post('/suppressions/check', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const service = new SuppressionService(req.accountId);
    res.json(await service.check(email));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/growth/suppressions/:id
router.delete('/suppressions/:id', async (req, res) => {
  try {
    const service = new SuppressionService(req.accountId);
    res.json(await service.remove(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── MAILBOXES ─────────────────────────────────────────────

// GET /api/growth/mailboxes — rotation pool with today's usage
router.get('/mailboxes', async (req, res) => {
  try {
    const { data, error } = await safeQuery(sb =>
      sb.from('sending_mailboxes')
        .select('*')
        .eq('account_id', req.accountId)
        .order('daily_volume', { ascending: true })
    );
    if (error) return res.status(500).json({ error: error.message });

    const today = new Date().toISOString().slice(0, 10);
    const mailboxes = (data || []).map(m => {
      const usedToday = m.volume_date === today ? m.daily_volume : 0;
      return { ...m, used_today: usedToday, remaining_today: Math.max(m.max_daily_volume - usedToday, 0) };
    });

    res.json({
      mailboxes,
      capacity_today: mailboxes
        .filter(m => m.active && m.warmup_status === 'ready')
        .reduce((sum, m) => sum + m.remaining_today, 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/growth/mailboxes
router.post('/mailboxes', async (req, res) => {
  try {
    const { email, display_name, domain_id, product, max_daily_volume, warmup_status } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('sending_mailboxes')
        .upsert({
          account_id: req.accountId,
          email: email.trim().toLowerCase(),
          display_name: display_name || null,
          domain_id: domain_id || null,
          product: product || null,
          max_daily_volume: max_daily_volume || 20,
          warmup_status: warmup_status || 'pending',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'account_id,email' })
        .select()
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ mailbox: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ── SETTINGS ──────────────────────────────────────────────

// GET /api/growth/settings
router.get('/settings', async (req, res) => {
  try {
    const service = new GrowthSettingsService(req.accountId);
    res.json({ settings: await service.all() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/growth/settings/:key — user-sourced writes may raise limits
router.put('/settings/:key', async (req, res) => {
  try {
    const service = new GrowthSettingsService(req.accountId);
    const updated = await service.set(req.params.key, req.body.value || req.body, { source: 'user' });
    res.json({ setting: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ── CAMPAIGNS ─────────────────────────────────────────────

router.get('/campaigns', async (req, res) => {
  try {
    const { data, error } = await safeQuery(sb =>
      sb.from('growth_campaigns').select('*')
        .eq('account_id', req.accountId)
        .order('created_at', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ campaigns: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    const { slug, name, campaign_type, description, goal } = req.body;
    if (!slug || !name) return res.status(400).json({ error: 'slug and name are required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('growth_campaigns').upsert({
        account_id: req.accountId,
        slug, name,
        campaign_type: campaign_type || 'cold',
        description: description || null,
        goal: goal || null,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,slug' }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ campaign: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── CONTENT SOURCES ───────────────────────────────────────

router.get('/sources', async (req, res) => {
  try {
    const service = new GrowthContentService(req.accountId);
    res.json({
      sources: await service.listSources({
        status: req.query.status,
        sourceType: req.query.source_type,
        limit: Math.min(parseInt(req.query.limit, 10) || 50, 200),
        offset: parseInt(req.query.offset, 10) || 0,
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sources', async (req, res) => {
  try {
    const service = new GrowthContentService(req.accountId);
    res.json({ source: await service.createSource(req.body) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/sources/:id', async (req, res) => {
  try {
    const service = new GrowthContentService(req.accountId);
    res.json({ source: await service.updateSource(req.params.id, req.body) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ── PROSPECTS ─────────────────────────────────────────────

router.get('/prospects', async (req, res) => {
  try {
    const service = new GrowthProspectsService(req.accountId);
    res.json({
      prospects: await service.list({
        status: req.query.status,
        band: req.query.band,
        minScore: req.query.min_score ? parseInt(req.query.min_score, 10) : undefined,
        limit: Math.min(parseInt(req.query.limit, 10) || 50, 200),
        offset: parseInt(req.query.offset, 10) || 0,
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/prospects/queue', async (req, res) => {
  try {
    const service = new GrowthProspectsService(req.accountId);
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    res.json({ prospects: await service.listPriorityQueue({ limit }) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/prospects/followups', async (req, res) => {
  try {
    const service = new GrowthProspectsService(req.accountId);
    res.json({ prospects: await service.listFollowupsDue({ limit: 50 }) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/prospects/:id/events', async (req, res) => {
  try {
    const service = new GrowthProspectsService(req.accountId);
    res.json({ events: await service.getEvents(req.params.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/prospects/:id/score', async (req, res) => {
  try {
    const service = new GrowthProspectsService(req.accountId);
    res.json({ prospect: await service.scoreAndSave(req.params.id) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/prospects/:id/status', async (req, res) => {
  try {
    const { status, event } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const service = new GrowthProspectsService(req.accountId);
    res.json({ prospect: await service.setStatus(req.params.id, status, { event }) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ── COST + ATTRIBUTION ────────────────────────────────────

router.get('/costs', async (req, res) => {
  try {
    const service = new GrowthCostService(req.accountId);
    const days = parseInt(req.query.days, 10) || 30;
    const [summary, periods, cac] = await Promise.all([
      service.summary({ days }),
      service.periods(),
      service.costPerConversion({ days }),
    ]);
    const settings = new GrowthSettingsService(req.accountId);
    const savings = await settings.get('savings');

    res.json({
      summary, periods, cac,
      savings,
      net_monthly: +(periods.month - (savings.content_creator_monthly || 0)).toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/attribution', async (req, res) => {
  try {
    const service = new GrowthAttributionService(req.accountId);
    res.json(await service.funnel({ days: parseInt(req.query.days, 10) || 30 }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── UNSUBSCRIBE (public — no account middleware) ──────────
// Mounted separately in server.js before the /api account guard.
const publicRouter = express.Router();

publicRouter.get('/unsubscribe', async (req, res) => {
  const prospectId = req.query.p;
  if (!prospectId) return res.status(400).send('Missing unsubscribe token.');

  try {
    if (!isSupabaseConfigured()) return res.status(503).send('Unavailable.');
    const sb = getSupabase();

    const { data: prospect } = await sb
      .from('prospect_pipeline')
      .select('id, account_id, email')
      .eq('id', prospectId)
      .single();

    if (!prospect) return res.status(404).send('Not found.');

    const service = new SuppressionService(prospect.account_id);
    await service.add({
      email: prospect.email,
      prospectId: prospect.id,
      reason: 'unsubscribed',
      source: 'unsubscribe_link',
    });

    await sb.from('outreach_sends')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('prospect_id', prospect.id)
      .is('unsubscribed_at', null);

    logger.info(`Unsubscribed ${prospect.email} via link`, { accountId: prospect.account_id });

    res.set('Content-Type', 'text/html').send(
      '<!doctype html><meta charset="utf-8"><title>Unsubscribed</title>'
      + '<div style="font:16px/1.6 system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">'
      + '<h1 style="font-size:1.25rem">You\'re unsubscribed</h1>'
      + '<p>We won\'t email you again. No further action needed.</p></div>'
    );
  } catch (err) {
    logger.error(`Unsubscribe failed: ${err.message}`);
    res.status(500).send('Something went wrong.');
  }
});

module.exports = router;
module.exports.publicRouter = publicRouter;
