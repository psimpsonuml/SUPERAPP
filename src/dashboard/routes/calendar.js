const express = require('express');
const { getSupabase } = require('../../db/supabase');

const router = express.Router();

// GET /api/calendar/week?offset=0 — get calendar entries for a week
router.get('/week', async (req, res) => {
  try {
    const supabase = getSupabase();
    const offset = parseInt(req.query.offset, 10) || 0;

    // Calculate week start (Monday)
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + (offset * 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const { data } = await supabase
      .from('content_calendar')
      .select('*, community:community_id(name, url, platform, rules_json, classification, rule_friendliness, subscriber_count, overall_score, engagement_count, warmup_complete)')
      .eq('account_id', req.accountId)
      .gte('date', monday.toISOString().slice(0, 10))
      .lte('date', sunday.toISOString().slice(0, 10))
      .order('date', { ascending: true });

    // Group by date
    const byDate = {};
    for (const entry of (data || [])) {
      if (!byDate[entry.date]) byDate[entry.date] = [];
      byDate[entry.date].push(entry);
    }

    res.json({
      weekStart: monday.toISOString().slice(0, 10),
      weekEnd: sunday.toISOString().slice(0, 10),
      offset,
      totalEntries: (data || []).length,
      byDate,
      entries: data || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/calendar/entry/:id — get single entry with full community details
router.get('/entry/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('content_calendar')
      .select('*, community:community_id(name, url, platform, description, rules_json, classification, rule_friendliness, subscriber_count, overall_score, engagement_count, warmup_complete)')
      .eq('account_id', req.accountId)
      .eq('id', req.params.id)
      .single();

    if (!data) return res.status(404).json({ error: 'Entry not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/calendar/entry/:id/status — update entry status
router.post('/entry/:id/status', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { status } = req.body;
    const valid = ['scheduled', 'approved', 'posted', 'skipped', 'failed'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('content_calendar')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('account_id', req.accountId)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/calendar/stats — calendar summary stats
router.get('/stats', async (req, res) => {
  try {
    const supabase = getSupabase();

    // This week's entries
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const { data } = await supabase
      .from('content_calendar')
      .select('status, post_type, product, platform')
      .eq('account_id', req.accountId)
      .gte('date', monday.toISOString().slice(0, 10))
      .lte('date', sunday.toISOString().slice(0, 10));

    const entries = data || [];
    const byStatus = {};
    const byProduct = {};
    const byType = {};
    for (const e of entries) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      byProduct[e.product] = (byProduct[e.product] || 0) + 1;
      byType[e.post_type] = (byType[e.post_type] || 0) + 1;
    }

    res.json({
      thisWeek: entries.length,
      byStatus,
      byProduct,
      byType,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
