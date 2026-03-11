const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── GET /api/revenue — Overview metrics ─────────────────────
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

    const thisStart = `${thisMonth}-01`;
    const lastStart = `${lastMonth}-01`;
    const lastEnd = `${thisMonth}-01`;

    // Current month snapshots
    const { data: current } = await safeQuery(sb =>
      sb.from('revenue_snapshots')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('date', thisStart)
        .order('date', { ascending: false })
        .limit(500)
    );

    // Last month snapshots
    const { data: previous } = await safeQuery(sb =>
      sb.from('revenue_snapshots')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('date', lastStart)
        .lt('date', lastEnd)
        .order('date', { ascending: false })
        .limit(500)
    );

    const rows = current || [];
    const prevRows = previous || [];

    // Aggregate current
    const latestByProduct = {};
    for (const r of rows) {
      if (!latestByProduct[r.product]) latestByProduct[r.product] = r;
    }
    const latestRows = Object.values(latestByProduct);

    const totalMrr = latestRows.reduce((s, r) => s + Number(r.mrr || 0), 0);
    const activeSubs = latestRows.reduce((s, r) => s + (r.active_subs || 0), 0);
    const newSubs = rows.reduce((s, r) => s + (r.new_subs || 0), 0);
    const churns = rows.reduce((s, r) => s + (r.churns || 0), 0);
    const failedPayments = rows.reduce((s, r) => s + (r.failed_payments || 0), 0);
    const avgLtv = latestRows.length > 0
      ? latestRows.reduce((s, r) => s + Number(r.avg_ltv || 0), 0) / latestRows.length
      : 0;
    const churnRate = activeSubs > 0 ? (churns / activeSubs) * 100 : 0;

    // Aggregate previous
    const prevByProduct = {};
    for (const r of prevRows) {
      if (!prevByProduct[r.product]) prevByProduct[r.product] = r;
    }
    const prevLatest = Object.values(prevByProduct);

    const prevMrr = prevLatest.reduce((s, r) => s + Number(r.mrr || 0), 0);
    const prevActiveSubs = prevLatest.reduce((s, r) => s + (r.active_subs || 0), 0);
    const prevNewSubs = prevRows.reduce((s, r) => s + (r.new_subs || 0), 0);
    const prevChurns = prevRows.reduce((s, r) => s + (r.churns || 0), 0);
    const prevFailed = prevRows.reduce((s, r) => s + (r.failed_payments || 0), 0);
    const prevAvgLtv = prevLatest.length > 0
      ? prevLatest.reduce((s, r) => s + Number(r.avg_ltv || 0), 0) / prevLatest.length
      : 0;
    const prevChurnRate = prevActiveSubs > 0 ? (prevChurns / prevActiveSubs) * 100 : 0;

    function delta(cur, prev) {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return ((cur - prev) / Math.abs(prev)) * 100;
    }

    res.json({
      mrr: { value: totalMrr, delta: delta(totalMrr, prevMrr) },
      activeSubs: { value: activeSubs, delta: delta(activeSubs, prevActiveSubs) },
      churnRate: { value: churnRate, delta: delta(churnRate, prevChurnRate) },
      avgLtv: { value: avgLtv, delta: delta(avgLtv, prevAvgLtv) },
      newSubs: { value: newSubs, delta: delta(newSubs, prevNewSubs) },
      failedPayments: { value: failedPayments, delta: delta(failedPayments, prevFailed) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/revenue/chart?months=6 — MRR over time ────────
router.get('/chart', async (req, res) => {
  try {
    const months = parseInt(req.query.months, 10) || 6;
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data } = await safeQuery(sb =>
      sb.from('revenue_snapshots')
        .select('date, product, mrr')
        .eq('account_id', req.accountId)
        .gte('date', sinceStr)
        .order('date', { ascending: true })
        .limit(5000)
    );

    const rows = data || [];

    // Group by date
    const byDate = {};
    const products = new Set();
    for (const r of rows) {
      products.add(r.product);
      if (!byDate[r.date]) byDate[r.date] = {};
      byDate[r.date][r.product] = Number(r.mrr || 0);
    }

    const productList = [...products].sort();
    const dates = Object.keys(byDate).sort();

    const series = dates.map(date => {
      const entry = { date, total: 0 };
      for (const p of productList) {
        const val = byDate[date][p] || 0;
        entry[p] = val;
        entry.total += val;
      }
      return entry;
    });

    res.json({ series, products: productList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/revenue/subscriptions — Plan breakdown ─────────
router.get('/subscriptions', async (req, res) => {
  try {
    const { data } = await safeQuery(sb =>
      sb.from('revenue_snapshots')
        .select('*')
        .eq('account_id', req.accountId)
        .order('date', { ascending: false })
        .limit(500)
    );

    const rows = data || [];

    // Latest snapshot per product
    const latest = {};
    for (const r of rows) {
      if (!latest[r.product]) latest[r.product] = r;
    }

    const totalMrr = Object.values(latest).reduce((s, r) => s + Number(r.mrr || 0), 0);

    const subscriptions = Object.values(latest).map(r => {
      const plans = r.data_json?.plans || [{ name: r.product, price: totalMrr > 0 ? Number(r.mrr) / (r.active_subs || 1) : 0 }];
      return {
        product: r.product,
        mrr: Number(r.mrr || 0),
        activeSubs: r.active_subs || 0,
        percentage: totalMrr > 0 ? (Number(r.mrr) / totalMrr) * 100 : 0,
        plans,
      };
    });

    res.json({ subscriptions, totalMrr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/revenue/new — New subscriptions (30 days) ──────
router.get('/new', async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const { data } = await safeQuery(sb =>
      sb.from('revenue_snapshots')
        .select('date, product, new_subs, data_json')
        .eq('account_id', req.accountId)
        .gte('date', since)
        .gt('new_subs', 0)
        .order('date', { ascending: false })
        .limit(200)
    );

    const feed = (data || []).map(r => ({
      date: r.date,
      product: r.product,
      count: r.new_subs,
      details: r.data_json?.new_signups || [],
    }));

    res.json({ feed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/revenue/churn — Cancellations (30 days) ────────
router.get('/churn', async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const { data } = await safeQuery(sb =>
      sb.from('revenue_snapshots')
        .select('date, product, churns, data_json')
        .eq('account_id', req.accountId)
        .gte('date', since)
        .gt('churns', 0)
        .order('date', { ascending: false })
        .limit(200)
    );

    const feed = (data || []).map(r => ({
      date: r.date,
      product: r.product,
      count: r.churns,
      details: r.data_json?.cancellations || [],
    }));

    res.json({ feed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/revenue/failed — Failed payments ───────────────
router.get('/failed', async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const { data } = await safeQuery(sb =>
      sb.from('revenue_snapshots')
        .select('date, product, failed_payments, data_json')
        .eq('account_id', req.accountId)
        .gte('date', since)
        .gt('failed_payments', 0)
        .order('date', { ascending: false })
        .limit(200)
    );

    const feed = (data || []).map(r => ({
      date: r.date,
      product: r.product,
      count: r.failed_payments,
      details: r.data_json?.failed_payment_details || [],
    }));

    res.json({ feed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/revenue/by-source — Revenue by UTM source ──────
router.get('/by-source', async (req, res) => {
  try {
    const { data } = await safeQuery(sb =>
      sb.from('revenue_snapshots')
        .select('product, mrr, data_json')
        .eq('account_id', req.accountId)
        .order('date', { ascending: false })
        .limit(500)
    );

    const rows = data || [];

    // Latest per product
    const latest = {};
    for (const r of rows) {
      if (!latest[r.product]) latest[r.product] = r;
    }

    // Aggregate UTM sources from data_json
    const sourceMap = {};
    for (const r of Object.values(latest)) {
      const sources = r.data_json?.utm_sources || {};
      for (const [src, val] of Object.entries(sources)) {
        if (!sourceMap[src]) sourceMap[src] = { source: src, mrr: 0, subs: 0 };
        sourceMap[src].mrr += Number(val.mrr || 0);
        sourceMap[src].subs += val.subs || 0;
      }
    }

    const sources = Object.values(sourceMap).sort((a, b) => b.mrr - a.mrr);

    res.json({ sources });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/revenue/forecast?months=6 — MRR projection ────
router.get('/forecast', async (req, res) => {
  try {
    const forecastMonths = parseInt(req.query.months, 10) || 6;

    // Get last 3 months to calculate growth rate
    const since = new Date();
    since.setMonth(since.getMonth() - 3);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data } = await safeQuery(sb =>
      sb.from('revenue_snapshots')
        .select('date, mrr, active_subs, churns')
        .eq('account_id', req.accountId)
        .gte('date', sinceStr)
        .order('date', { ascending: true })
        .limit(1000)
    );

    const rows = data || [];

    // Aggregate MRR by month
    const byMonth = {};
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { mrr: 0, subs: 0, churns: 0 };
      byMonth[m].mrr += Number(r.mrr || 0);
      byMonth[m].subs += r.active_subs || 0;
      byMonth[m].churns += r.churns || 0;
    }

    const months = Object.keys(byMonth).sort();
    let growthRate = 0;
    if (months.length >= 2) {
      const first = byMonth[months[0]].mrr;
      const last = byMonth[months[months.length - 1]].mrr;
      if (first > 0) {
        growthRate = ((last - first) / first) / (months.length - 1);
      }
    }

    const currentMrr = months.length > 0 ? byMonth[months[months.length - 1]].mrr : 0;

    // Build projections for 3 scenarios
    const scenarios = {
      optimistic: { label: 'Optimistic', rate: growthRate * 1.5 },
      baseline: { label: 'Baseline', rate: growthRate },
      pessimistic: { label: 'Pessimistic', rate: growthRate * 0.5 },
    };

    const projections = {};
    for (const [key, scenario] of Object.entries(scenarios)) {
      const points = [];
      let mrr = currentMrr;
      const start = new Date();
      for (let i = 1; i <= forecastMonths; i++) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + i);
        mrr = mrr * (1 + scenario.rate);
        points.push({
          month: d.toISOString().slice(0, 7),
          mrr: Math.round(mrr * 100) / 100,
        });
      }
      projections[key] = {
        label: scenario.label,
        monthlyGrowth: Math.round(scenario.rate * 10000) / 100,
        points,
        endMrr: points.length > 0 ? points[points.length - 1].mrr : currentMrr,
      };
    }

    res.json({
      currentMrr,
      growthRate: Math.round(growthRate * 10000) / 100,
      forecastMonths,
      projections,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/revenue/refresh — Stub: seed sample data ──────
router.post('/refresh', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json({ message: 'Supabase not configured — skipping refresh', seeded: false });
    }

    const sb = getSupabase();
    const accountId = req.accountId;
    const products = ['Pro Plan', 'Enterprise', 'Starter'];
    const now = new Date();
    const snapshots = [];

    for (let m = 0; m < 6; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const dateStr = d.toISOString().slice(0, 10);

      for (const product of products) {
        const base = product === 'Enterprise' ? 4500 : product === 'Pro Plan' ? 2200 : 800;
        const growth = 1 + (6 - m) * 0.04;
        const mrr = Math.round(base * growth * 100) / 100;
        const activeSubs = Math.round((mrr / (product === 'Enterprise' ? 150 : product === 'Pro Plan' ? 29 : 9)));
        const newSubs = Math.max(1, Math.round(activeSubs * 0.08));
        const churns = Math.max(0, Math.round(activeSubs * 0.03));
        const failedPayments = Math.max(0, Math.round(activeSubs * 0.02));

        snapshots.push({
          account_id: accountId,
          date: dateStr,
          product,
          mrr,
          active_subs: activeSubs,
          new_subs: newSubs,
          churns,
          failed_payments: failedPayments,
          avg_ltv: Math.round(mrr / (activeSubs || 1) * 14 * 100) / 100,
          data_json: {
            plans: [
              { name: `${product} Monthly`, price: product === 'Enterprise' ? 150 : product === 'Pro Plan' ? 29 : 9, count: Math.round(activeSubs * 0.6) },
              { name: `${product} Annual`, price: (product === 'Enterprise' ? 150 : product === 'Pro Plan' ? 29 : 9) * 10, count: Math.round(activeSubs * 0.4) },
            ],
            utm_sources: {
              organic: { mrr: Math.round(mrr * 0.4 * 100) / 100, subs: Math.round(activeSubs * 0.4) },
              google: { mrr: Math.round(mrr * 0.3 * 100) / 100, subs: Math.round(activeSubs * 0.3) },
              referral: { mrr: Math.round(mrr * 0.2 * 100) / 100, subs: Math.round(activeSubs * 0.2) },
              twitter: { mrr: Math.round(mrr * 0.1 * 100) / 100, subs: Math.round(activeSubs * 0.1) },
            },
            new_signups: Array.from({ length: newSubs }, (_, i) => ({
              email: `user${i + 1}@example.com`,
              plan: i % 2 === 0 ? `${product} Monthly` : `${product} Annual`,
              date: dateStr,
            })),
            cancellations: Array.from({ length: churns }, (_, i) => ({
              email: `churned${i + 1}@example.com`,
              reason: ['Too expensive', 'Not enough features', 'Switched competitor', 'No longer needed'][i % 4],
              date: dateStr,
            })),
            failed_payment_details: Array.from({ length: failedPayments }, (_, i) => ({
              email: `failed${i + 1}@example.com`,
              amount: product === 'Enterprise' ? 150 : product === 'Pro Plan' ? 29 : 9,
              reason: ['Card declined', 'Insufficient funds', 'Expired card', 'Bank error'][i % 4],
              date: dateStr,
            })),
          },
          refreshed_at: new Date().toISOString(),
        });
      }
    }

    const { error } = await sb
      .from('revenue_snapshots')
      .upsert(snapshots, { onConflict: 'account_id,date,product' });

    if (error) throw error;

    res.json({ message: 'Revenue data refreshed', seeded: true, count: snapshots.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
