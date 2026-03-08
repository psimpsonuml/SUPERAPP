const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── GET /api/infrastructure/status ──────────────────────────
// Current status of all monitored services
router.get('/status', async (req, res) => {
  try {
    // Get latest check result per service (last hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { data: recentChecks } = await safeQuery(sb =>
      sb.from('infra_check_results')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(200)
    );

    // Deduplicate: latest per service
    const latestByService = {};
    for (const check of (recentChecks || [])) {
      if (!latestByService[check.service]) {
        latestByService[check.service] = check;
      }
    }

    // Get unresolved alerts
    const { data: alerts } = await safeQuery(sb =>
      sb.from('infra_alerts')
        .select('*')
        .eq('account_id', req.accountId)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(50)
    );

    // Compute overall status
    const services = Object.values(latestByService);
    const criticalCount = services.filter(s => s.status === 'critical').length;
    const warningCount = services.filter(s => s.status === 'warning').length;
    const healthyCount = services.filter(s => s.status === 'healthy').length;

    const overallStatus = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy';

    res.json({
      overall: overallStatus,
      services: latestByService,
      counts: { healthy: healthyCount, warning: warningCount, critical: criticalCount },
      alerts: alerts || [],
      lastChecked: services.length > 0 ? services[0].created_at : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/infrastructure/uptime?service=supabase&period=24h ──
// Uptime history for a service
router.get('/uptime', async (req, res) => {
  try {
    const { service, period = '24h' } = req.query;

    const periodMs = {
      '24h': 24 * 3600000,
      '7d': 7 * 24 * 3600000,
      '30d': 30 * 24 * 3600000,
    };

    const since = new Date(Date.now() - (periodMs[period] || periodMs['24h'])).toISOString();

    let query = getSupabase()
      .from('infra_check_results')
      .select('service, status, response_time_ms, message, created_at')
      .eq('account_id', req.accountId)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (service) {
      query = query.eq('service', service);
    }

    const { data, error } = await query.limit(2000);
    if (error) throw error;

    const checks = data || [];

    // Compute uptime percentage per service
    const serviceStats = {};
    for (const check of checks) {
      if (!serviceStats[check.service]) {
        serviceStats[check.service] = { total: 0, healthy: 0, warning: 0, critical: 0, latencies: [], timeline: [] };
      }
      const s = serviceStats[check.service];
      s.total++;
      if (check.status === 'healthy') s.healthy++;
      else if (check.status === 'warning') s.warning++;
      else s.critical++;
      if (check.response_time_ms > 0) s.latencies.push(check.response_time_ms);
      s.timeline.push({
        status: check.status,
        time: check.created_at,
        latency: check.response_time_ms,
      });
    }

    // Compute metrics
    const uptimeByService = {};
    for (const [svc, stats] of Object.entries(serviceStats)) {
      const uptimePct = stats.total > 0 ? ((stats.healthy / stats.total) * 100).toFixed(2) : 0;
      const avgLatency = stats.latencies.length > 0
        ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
        : null;
      const p95Latency = stats.latencies.length > 0
        ? stats.latencies.sort((a, b) => a - b)[Math.floor(stats.latencies.length * 0.95)]
        : null;

      uptimeByService[svc] = {
        uptimePercent: parseFloat(uptimePct),
        totalChecks: stats.total,
        healthy: stats.healthy,
        warning: stats.warning,
        critical: stats.critical,
        avgLatencyMs: avgLatency,
        p95LatencyMs: p95Latency,
        timeline: stats.timeline,
      };
    }

    res.json({ period, since, uptime: uptimeByService });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/infrastructure/alerts ──────────────────────────
// Alert history
router.get('/alerts', async (req, res) => {
  try {
    const { resolved, severity, limit: lim = 50 } = req.query;

    let query = getSupabase()
      .from('infra_alerts')
      .select('*')
      .eq('account_id', req.accountId)
      .order('created_at', { ascending: false })
      .limit(parseInt(lim));

    if (resolved === 'true') query = query.eq('resolved', true);
    else if (resolved === 'false') query = query.eq('resolved', false);

    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ alerts: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/infrastructure/alerts/:id/resolve ─────────────
router.post('/alerts/:id/resolve', async (req, res) => {
  try {
    const { data, error } = await getSupabase()
      .from('infra_alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('account_id', req.accountId)
      .select()
      .single();

    if (error) throw error;
    res.json({ alert: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
