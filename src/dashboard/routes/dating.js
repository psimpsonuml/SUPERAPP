const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── GET /profiles — list dating profiles across platforms ──────
router.get('/profiles', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('dating_profiles').select('*').eq('account_id', accountId).order('platform')
    );
    if (error) return res.status(500).json({ error: error.message });

    const profiles = (data || []).map(p => ({
      ...p,
      photos: typeof p.photos_json === 'string' ? JSON.parse(p.photos_json) : (p.photos_json || []),
      prompts: typeof p.prompts_json === 'string' ? JSON.parse(p.prompts_json) : (p.prompts_json || []),
      preferences: typeof p.preferences_json === 'string' ? JSON.parse(p.preferences_json) : (p.preferences_json || {}),
    }));

    res.json({ profiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /profiles/:platform — get profile for a platform ──────
router.get('/profiles/:platform', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('dating_profiles').select('*')
        .eq('account_id', accountId)
        .eq('platform', req.params.platform)
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Profile not found' });

    res.json({
      profile: {
        ...data,
        photos: typeof data.photos_json === 'string' ? JSON.parse(data.photos_json) : (data.photos_json || []),
        prompts: typeof data.prompts_json === 'string' ? JSON.parse(data.prompts_json) : (data.prompts_json || []),
        preferences: typeof data.preferences_json === 'string' ? JSON.parse(data.preferences_json) : (data.preferences_json || {}),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /profiles — create/update profile (upsert) ───────────
router.post('/profiles', async (req, res) => {
  try {
    const { account_id, platform, bio_text, photos_json, prompts_json, preferences_json } = req.body;
    if (!account_id || !platform) return res.status(400).json({ error: 'account_id and platform required' });

    const row = {
      account_id,
      platform,
      bio_text: bio_text || '',
      photos_json: photos_json || [],
      prompts_json: prompts_json || [],
      preferences_json: preferences_json || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await safeQuery(sb =>
      sb.from('dating_profiles').upsert(row, { onConflict: 'account_id,platform' }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ profile: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /profiles/:platform — update profile ──────────────────
router.put('/profiles/:platform', async (req, res) => {
  try {
    const accountId = req.body.account_id || req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const updates = {};
    if (req.body.bio_text !== undefined) updates.bio_text = req.body.bio_text;
    if (req.body.photos_json !== undefined) updates.photos_json = req.body.photos_json;
    if (req.body.prompts_json !== undefined) updates.prompts_json = req.body.prompts_json;
    if (req.body.preferences_json !== undefined) updates.preferences_json = req.body.preferences_json;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await safeQuery(sb =>
      sb.from('dating_profiles').update(updates)
        .eq('account_id', accountId)
        .eq('platform', req.params.platform)
        .select()
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Profile not found' });

    res.json({ profile: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /profiles/:platform — remove profile ───────────────
router.delete('/profiles/:platform', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { error } = await safeQuery(sb =>
      sb.from('dating_profiles').delete()
        .eq('account_id', accountId)
        .eq('platform', req.params.platform)
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /profiles/:platform/optimize — Claude API stub ───────
router.post('/profiles/:platform/optimize', async (req, res) => {
  try {
    const accountId = req.body.account_id || req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: profile } = await safeQuery(sb =>
      sb.from('dating_profiles').select('*')
        .eq('account_id', accountId)
        .eq('platform', req.params.platform)
        .single()
    );

    // Stub: In production, send profile data to Claude API for optimization suggestions
    const suggestions = {
      bio: [
        'Add a specific hobby or interest to make your bio more engaging',
        'Include a conversation starter or question',
        'Keep it concise — 3-4 sentences max',
      ],
      photos: [
        'Lead with a clear, smiling headshot',
        'Include at least one full-body photo',
        'Add a photo showing a hobby or activity',
      ],
      prompts: [
        'Be specific in your answers — avoid generic responses',
        'Show personality and humor where appropriate',
        'Reference shared interests your target audience might have',
      ],
      overall_score: 72,
      platform: req.params.platform,
    };

    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /matches — list matches with filters ──────────────────
router.get('/matches', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    let query = getSupabase()
      ? getSupabase().from('dating_matches').select('*').eq('account_id', accountId)
      : null;

    if (!query) return res.json({ matches: [] });

    if (req.query.platform) query = query.eq('platform', req.query.platform);
    if (req.query.outcome) query = query.eq('outcome', req.query.outcome);
    if (req.query.start_date) query = query.gte('match_date', req.query.start_date);
    if (req.query.end_date) query = query.lte('match_date', req.query.end_date);

    query = query.order('match_date', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ matches: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /matches — log a match ───────────────────────────────
router.post('/matches', async (req, res) => {
  try {
    const { account_id, platform, match_name, match_date, conversation_started, date_scheduled, date_happened, outcome, notes } = req.body;
    if (!account_id || !platform) return res.status(400).json({ error: 'account_id and platform required' });

    const row = {
      account_id,
      platform,
      match_name: match_name || '',
      match_date: match_date || new Date().toISOString().slice(0, 10),
      conversation_started: conversation_started || false,
      date_scheduled: date_scheduled || false,
      date_happened: date_happened || false,
      outcome: outcome || '',
      notes: notes || '',
    };

    const { data, error } = await safeQuery(sb =>
      sb.from('dating_matches').insert(row).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ match: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /matches/:id — update match ───────────────────────────
router.put('/matches/:id', async (req, res) => {
  try {
    const updates = {};
    const fields = ['match_name', 'match_date', 'conversation_started', 'date_scheduled', 'date_happened', 'outcome', 'notes', 'platform'];
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const { data, error } = await safeQuery(sb =>
      sb.from('dating_matches').update(updates).eq('id', req.params.id).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Match not found' });

    res.json({ match: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /matches/:id — remove match ────────────────────────
router.delete('/matches/:id', async (req, res) => {
  try {
    const { error } = await safeQuery(sb =>
      sb.from('dating_matches').delete().eq('id', req.params.id)
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /analytics — analytics dashboard ──────────────────────
router.get('/analytics', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: analytics, error } = await safeQuery(sb =>
      sb.from('dating_analytics').select('*')
        .eq('account_id', accountId)
        .order('week_start', { ascending: false })
        .limit(52)
    );
    if (error) return res.status(500).json({ error: error.message });

    // Matches per week grouped by platform
    const weeklyByPlatform = {};
    (analytics || []).forEach(row => {
      if (!weeklyByPlatform[row.platform]) weeklyByPlatform[row.platform] = [];
      weeklyByPlatform[row.platform].push({
        week_start: row.week_start,
        matches: row.matches,
        conversations: row.conversations,
        dates: row.dates,
      });
    });

    // Conversion rates
    const totals = (analytics || []).reduce((acc, row) => {
      acc.matches += row.matches || 0;
      acc.conversations += row.conversations || 0;
      acc.dates += row.dates || 0;
      return acc;
    }, { matches: 0, conversations: 0, dates: 0 });

    const conversationRate = totals.matches > 0 ? ((totals.conversations / totals.matches) * 100).toFixed(1) : 0;
    const dateRate = totals.conversations > 0 ? ((totals.dates / totals.conversations) * 100).toFixed(1) : 0;

    // Best performing days from matches
    const { data: matches } = await safeQuery(sb =>
      sb.from('dating_matches').select('match_date, platform')
        .eq('account_id', accountId)
    );
    const dayCount = [0, 0, 0, 0, 0, 0, 0];
    (matches || []).forEach(m => {
      const d = new Date(m.match_date);
      if (!isNaN(d)) dayCount[d.getDay()]++;
    });
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const bestDays = dayCount.map((count, i) => ({ day: dayNames[i], count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      weekly_by_platform: weeklyByPlatform,
      totals,
      conversation_rate: parseFloat(conversationRate),
      date_rate: parseFloat(dateRate),
      best_days: bestDays,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /analytics/funnel — conversion funnel ─────────────────
router.get('/analytics/funnel', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: matches, error } = await safeQuery(sb =>
      sb.from('dating_matches').select('*').eq('account_id', accountId)
    );
    if (error) return res.status(500).json({ error: error.message });

    const platforms = {};
    (matches || []).forEach(m => {
      if (!platforms[m.platform]) {
        platforms[m.platform] = { matches: 0, conversations: 0, dates: 0, second_dates: 0 };
      }
      platforms[m.platform].matches++;
      if (m.conversation_started) platforms[m.platform].conversations++;
      if (m.date_happened) platforms[m.platform].dates++;
      if (m.outcome === 'second_date' || m.outcome === 'relationship') platforms[m.platform].second_dates++;
    });

    const funnel = Object.entries(platforms).map(([platform, stats]) => ({
      platform,
      ...stats,
      conversation_rate: stats.matches > 0 ? ((stats.conversations / stats.matches) * 100).toFixed(1) : 0,
      date_rate: stats.conversations > 0 ? ((stats.dates / stats.conversations) * 100).toFixed(1) : 0,
      second_date_rate: stats.dates > 0 ? ((stats.second_dates / stats.dates) * 100).toFixed(1) : 0,
    }));

    res.json({ funnel });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /conversation-helper — Claude API stub ───────────────
router.post('/conversation-helper', async (req, res) => {
  try {
    const { conversation, context } = req.body;
    if (!conversation) return res.status(400).json({ error: 'conversation text required' });

    // Stub: In production, send to Claude API for response suggestions
    const suggestions = [
      'Ask about something specific they mentioned in their profile',
      'Share a related personal anecdote to build connection',
      'Suggest a low-pressure activity based on shared interests',
      'Use humor to keep the conversation light and engaging',
    ];

    res.json({
      suggestions,
      tone_analysis: 'conversational',
      engagement_level: 'moderate',
      tip: 'Try to move from small talk to deeper topics within 5-8 messages',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /red-flag-check — Claude API stub ────────────────────
router.post('/red-flag-check', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    // Stub: In production, send to Claude API for red flag analysis
    const analysis = {
      risk_level: 'low',
      flags: [],
      positive_signs: [
        'Asks questions and shows interest',
        'Consistent communication style',
        'Respects boundaries',
      ],
      summary: 'No significant red flags detected. Communication appears healthy and balanced.',
    };

    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /stats — overall stats ────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: matches, error } = await safeQuery(sb =>
      sb.from('dating_matches').select('*').eq('account_id', accountId)
    );
    if (error) return res.status(500).json({ error: error.message });

    const all = matches || [];
    const totalMatches = all.length;
    const conversations = all.filter(m => m.conversation_started).length;
    const dates = all.filter(m => m.date_happened).length;
    const conversationRate = totalMatches > 0 ? ((conversations / totalMatches) * 100).toFixed(1) : 0;
    const dateRate = conversations > 0 ? ((dates / conversations) * 100).toFixed(1) : 0;

    // Platform comparison
    const platformStats = {};
    all.forEach(m => {
      if (!platformStats[m.platform]) {
        platformStats[m.platform] = { matches: 0, conversations: 0, dates: 0, second_dates: 0 };
      }
      platformStats[m.platform].matches++;
      if (m.conversation_started) platformStats[m.platform].conversations++;
      if (m.date_happened) platformStats[m.platform].dates++;
      if (m.outcome === 'second_date' || m.outcome === 'relationship') platformStats[m.platform].second_dates++;
    });

    // Best platform by date rate
    let bestPlatform = 'N/A';
    let bestRate = 0;
    Object.entries(platformStats).forEach(([platform, stats]) => {
      const rate = stats.matches > 0 ? (stats.dates / stats.matches) : 0;
      if (rate > bestRate) { bestRate = rate; bestPlatform = platform; }
    });

    res.json({
      total_matches: totalMatches,
      total_conversations: conversations,
      total_dates: dates,
      conversation_rate: parseFloat(conversationRate),
      date_rate: parseFloat(dateRate),
      best_platform: bestPlatform,
      platform_comparison: platformStats,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
