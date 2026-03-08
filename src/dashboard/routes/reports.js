const express = require('express');
const AnalyticsPipeline = require('../../shared/analytics');
const { getSupabase } = require('../../db/supabase');

const router = express.Router();

// GET /api/reports/daily — get today's or a specific day's report data
router.get('/daily', async (req, res) => {
  try {
    const analytics = new AnalyticsPipeline(req.accountId);
    const data = await analytics.getDailyReportData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/content-performance — content performance analytics
router.get('/content-performance', async (req, res) => {
  try {
    const analytics = new AnalyticsPipeline(req.accountId);
    const product = req.query.product;
    const days = parseInt(req.query.days, 10) || 30;

    if (!product) {
      return res.status(400).json({ error: 'product query parameter required' });
    }

    const data = await analytics.getContentPerformance(product, days);
    res.json({ product, days, content: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/health — system health overview
router.get('/health', async (req, res) => {
  try {
    const analytics = new AnalyticsPipeline(req.accountId);
    const health = await analytics.getAccountHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/pain-points — pain point trends
router.get('/pain-points', async (req, res) => {
  try {
    const supabase = getSupabase();
    const days = parseInt(req.query.days, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await supabase
      .from('pain_points')
      .select('*')
      .eq('account_id', req.accountId)
      .gte('date_found', since.toISOString())
      .order('date_found', { ascending: false });

    res.json({ days, painPoints: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/pipeline — CRM pipeline overview
router.get('/pipeline', async (req, res) => {
  try {
    const supabase = getSupabase();
    const track = req.query.track || 'user';

    const { data } = await supabase
      .from('prospect_pipeline')
      .select('stage, product, track')
      .eq('account_id', req.accountId)
      .eq('track', track);

    // Aggregate by stage
    const stages = {};
    for (const prospect of data || []) {
      const key = `${prospect.stage}`;
      stages[key] = (stages[key] || 0) + 1;
    }

    res.json({ track, stages, total: (data || []).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/product-intelligence — product intelligence summary
router.get('/product-intelligence', async (req, res) => {
  try {
    const supabase = getSupabase();
    const product = req.query.product;

    let query = supabase
      .from('product_intelligence')
      .select('*')
      .eq('account_id', req.accountId)
      .neq('status', 'stays')
      .order('created_at', { ascending: false })
      .limit(50);

    if (product) query = query.eq('product', product);

    const { data } = await query;
    res.json({ recommendations: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
