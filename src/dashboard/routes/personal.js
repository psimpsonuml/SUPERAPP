const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

// Helper: graceful fallback when table doesn't exist yet
async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try {
    return await queryFn(getSupabase());
  } catch (err) {
    return { data: [], error: err };
  }
}

// ── Entertainment ────────────────────────────────────────────

// GET /api/personal/entertainment/ratings
router.get('/entertainment/ratings', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('entertainment_ratings').select('*, entertainment_items(*)').eq('account_id', req.accountId).order('created_at', { ascending: false }).limit(100)
  );
  res.json({ ratings: data || [] });
});

// POST /api/personal/entertainment/rate
router.post('/entertainment/rate', async (req, res) => {
  const { item_id, score, item_type, title, year, metadata } = req.body;
  if (!score || score < 1 || score > 10) return res.status(400).json({ error: 'Score must be 1-10' });

  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    // Upsert item if needed
    let itemId = item_id;
    if (!itemId && title) {
      const { data: item } = await supabase
        .from('entertainment_items').upsert({
          account_id: req.accountId, title, item_type: item_type || 'movie', year, metadata: metadata || {},
        }, { onConflict: 'account_id,title,item_type' }).select().single();
      itemId = item?.id;
    }
    if (!itemId) return res.status(400).json({ error: 'item_id or title required' });

    const { data } = await supabase
      .from('entertainment_ratings').upsert({
        account_id: req.accountId, item_id: itemId, score, updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,item_id' }).select().single();
    res.json({ rating: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/personal/entertainment/cascade — computed cascade scores
router.get('/entertainment/cascade', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('cascade_scores').select('*').eq('account_id', req.accountId).order('composite_score', { ascending: false }).limit(50)
  );
  res.json({ scores: data || [] });
});

// ── Books ────────────────────────────────────────────────────

router.get('/books', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('book_items').select('*, book_ratings(*)').eq('account_id', req.accountId).order('created_at', { ascending: false }).limit(100)
  );
  res.json({ books: data || [] });
});

router.post('/books/rate', async (req, res) => {
  const { title, author, score, status } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('book_items').upsert({
      account_id: req.accountId, title, author, status: status || 'finished',
      score: score || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id,title' }).select().single();
    res.json({ book: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Reminders (Life Manager) ─────────────────────────────────

router.get('/reminders', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('reminders').select('*').eq('account_id', req.accountId).order('next_due', { ascending: true })
  );
  res.json({ reminders: data || [] });
});

router.post('/reminders', async (req, res) => {
  const { title, frequency, time, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('reminders').insert({
      account_id: req.accountId, title, frequency: frequency || 'daily',
      time: time || '09:00', notes, next_due: new Date().toISOString(),
      streak: 0, active: true,
    }).select().single();
    res.json({ reminder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/reminders/:id/complete', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data: current } = await supabase.from('reminders')
      .select('*').eq('id', req.params.id).eq('account_id', req.accountId).single();
    if (!current) return res.status(404).json({ error: 'Not found' });

    const { data } = await supabase.from('reminders')
      .update({ streak: (current.streak || 0) + 1, last_completed: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    res.json({ reminder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Family Log ───────────────────────────────────────────────

router.get('/family-log', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('family_log').select('*').eq('account_id', req.accountId).order('created_at', { ascending: false }).limit(50)
  );
  res.json({ entries: data || [] });
});

router.post('/family-log', async (req, res) => {
  const { text, child, category, photo_url } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('family_log').insert({
      account_id: req.accountId, text, child: child || null,
      category: category || 'memory', photo_url: photo_url || null,
    }).select().single();
    res.json({ entry: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Quiz ─────────────────────────────────────────────────────

router.get('/quiz/questions', async (req, res) => {
  const category = req.query.category;
  const query = safeQuery((sb) => {
    let q = sb.from('quiz_questions').select('*');
    if (category) q = q.eq('category', category);
    return q.order('sort_order', { ascending: true }).limit(20);
  });
  const { data } = await query;
  res.json({ questions: data || [] });
});

router.get('/quiz/answers', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('quiz_answers').select('*, quiz_questions(question_text, category)').eq('account_id', req.accountId).order('answered_at', { ascending: false }).limit(200)
  );
  res.json({ answers: data || [] });
});

router.post('/quiz/answer', async (req, res) => {
  const { question_id, answer } = req.body;
  if (!question_id || answer == null) return res.status(400).json({ error: 'question_id and answer required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('quiz_answers').upsert({
      account_id: req.accountId, question_id, answer, answered_at: new Date().toISOString(),
    }, { onConflict: 'account_id,question_id' }).select().single();
    res.json({ answer: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/quiz/profile', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('quiz_profile').select('*').eq('account_id', req.accountId)
  );
  res.json({ profile: data || [] });
});

// ── Learning Queue ───────────────────────────────────────────

router.get('/learning', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('learning_queue').select('*').eq('account_id', req.accountId).order('priority', { ascending: false }).limit(50)
  );
  res.json({ items: data || [] });
});

router.post('/learning', async (req, res) => {
  const { title, topic, url, estimated_time, priority } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('learning_queue').insert({
      account_id: req.accountId, title, topic, url,
      estimated_time: estimated_time || null, priority: priority || 'medium',
      status: 'queued',
    }).select().single();
    res.json({ item: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Health ────────────────────────────────────────────────────

router.get('/health', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await safeQuery((sb) =>
    sb.from('health_metrics').select('*').eq('account_id', req.accountId).gte('recorded_at', since).order('recorded_at', { ascending: false })
  );
  res.json({ metrics: data || [] });
});

// ── News Feed ────────────────────────────────────────────────

router.get('/news', async (req, res) => {
  const topic = req.query.topic || 'all';
  const limit = Math.min(parseInt(req.query.limit) || 80, 200);
  const saved = req.query.saved === 'true';
  const sort = req.query.sort || 'chronological';

  let query = getSupabase()
    .from('news_feed_items')
    .select('*')
    .eq('account_id', req.accountId);

  if (topic !== 'all') query = query.eq('topic', topic);
  if (saved) query = query.eq('saved', true);
  query = query.order('published_at', { ascending: false }).limit(limit);

  const { data, error } = await safeQuery(() => query);
  if (error) return res.json({ items: [] });

  // Group into clusters
  const items = data || [];
  const clusterIds = [...new Set(items.map(i => i.cluster_id).filter(Boolean))];

  let clusters = [];
  if (clusterIds.length > 0) {
    const { data: clusterData } = await safeQuery(() =>
      getSupabase()
        .from('news_clusters')
        .select('*')
        .eq('account_id', req.accountId)
        .in('id', clusterIds)
    );
    clusters = clusterData || [];
  }

  // Build cluster map
  const clusterMap = {};
  for (const c of clusters) {
    clusterMap[c.id] = { ...c, items: [] };
  }
  const standalone = [];
  for (const item of items) {
    if (item.cluster_id && clusterMap[item.cluster_id]) {
      clusterMap[item.cluster_id].items.push(item);
    } else {
      standalone.push(item);
    }
  }

  // Merge: clusters as grouped entries + standalone items, sorted by newest
  const feed = [];
  for (const c of Object.values(clusterMap)) {
    if (c.items.length > 0) {
      feed.push({
        type: 'cluster',
        id: c.id,
        cluster_title: c.cluster_title,
        synthesis: c.synthesis,
        sentiment: c.sentiment,
        source_count: c.items.length,
        topic: c.topic,
        published_at: c.items[0].published_at,
        items: c.items,
      });
    }
  }
  for (const item of standalone) {
    feed.push({ type: 'item', ...item });
  }

  // Sort by published_at descending
  if (sort === 'chronological') {
    feed.sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
  }

  res.json({ feed, totalItems: items.length, clusterCount: clusters.length });
});

// POST /news/save — toggle save/bookmark
router.post('/news/save', async (req, res) => {
  const { itemId, saved } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId required' });

  const { error } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_items')
      .update({ saved: saved !== false })
      .eq('id', itemId)
      .eq('account_id', req.accountId)
  );

  if (error) return res.status(500).json({ error: error.message });
  res.json({ saved: saved !== false });
});

// GET /news/briefing — get or generate morning briefing
router.get('/news/briefing', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  // Check for cached briefing
  const { data: existing } = await safeQuery(() =>
    getSupabase()
      .from('news_briefings')
      .select('*')
      .eq('account_id', req.accountId)
      .gte('generated_at', `${today}T00:00:00Z`)
      .order('generated_at', { ascending: false })
      .limit(1)
  );

  if (existing?.[0] && req.query.refresh !== 'true') {
    return res.json({ briefing: existing[0] });
  }

  // Generate fresh briefing from today's top items
  const { data: topItems } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_items')
      .select('headline, summary, topic, source, source_lean')
      .eq('account_id', req.accountId)
      .gte('published_at', `${today}T00:00:00Z`)
      .order('published_at', { ascending: false })
      .limit(30)
  );

  const items = topItems || [];
  if (items.length === 0) {
    return res.json({ briefing: null, message: 'No stories available for briefing yet' });
  }

  try {
    const config = require('../../config');
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

    // Pick top 5-8 across diverse topics
    const topicBuckets = {};
    for (const item of items) {
      if (!topicBuckets[item.topic]) topicBuckets[item.topic] = [];
      topicBuckets[item.topic].push(item);
    }
    const selected = [];
    const topics = Object.keys(topicBuckets);
    let round = 0;
    while (selected.length < 8 && round < 5) {
      for (const topic of topics) {
        if (selected.length >= 8) break;
        if (topicBuckets[topic][round]) selected.push(topicBuckets[topic][round]);
      }
      round++;
    }

    const storyList = selected.map((s, i) =>
      `${i + 1}. [${s.topic}] "${s.headline}" (${s.source}) — ${s.summary || ''}`
    ).join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Write a 2-minute morning briefing summarizing these top stories. Be conversational, informative, and cover each topic area briefly. Group related stories. Keep it under 400 words.\n\nStories:\n${storyList}`,
      }],
    });

    const briefingText = response.content[0].text;
    const topicsCovered = [...new Set(selected.map(s => s.topic))];

    // Cache it
    const { data: saved } = await safeQuery(() =>
      getSupabase()
        .from('news_briefings')
        .insert({
          account_id: req.accountId,
          briefing_text: briefingText,
          story_count: selected.length,
          topics_covered: topicsCovered,
        })
        .select()
        .single()
    );

    res.json({ briefing: saved || { briefing_text: briefingText, story_count: selected.length, topics_covered: topicsCovered } });
  } catch (err) {
    res.status(500).json({ error: `Briefing generation failed: ${err.message}` });
  }
});

// GET /news/preferences — feed preferences
router.get('/news/preferences', async (req, res) => {
  const { data } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_preferences')
      .select('*')
      .eq('account_id', req.accountId)
      .single()
  );
  res.json({ preferences: data || { active_topics: ['all'], disabled_sources: [], sort_mode: 'chronological' } });
});

// PUT /news/preferences — update feed preferences
router.put('/news/preferences', async (req, res) => {
  const { active_topics, disabled_sources, sort_mode } = req.body;
  const { data, error } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_preferences')
      .upsert({
        account_id: req.accountId,
        active_topics: active_topics || ['all'],
        disabled_sources: disabled_sources || [],
        sort_mode: sort_mode || 'chronological',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id' })
      .select()
      .single()
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ preferences: data });
});

// GET /news/top-stories — compact widget for personal dashboard
router.get('/news/top-stories', async (req, res) => {
  const { data } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_items')
      .select('id, headline, source, topic, source_lean, published_at, source_url')
      .eq('account_id', req.accountId)
      .order('published_at', { ascending: false })
      .limit(5)
  );
  res.json({ stories: data || [] });
});

// ── Release Tracker ──────────────────────────────────────────

router.get('/releases', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('release_digest').select('*').eq('account_id', req.accountId).order('release_date', { ascending: false }).limit(30)
  );
  res.json({ releases: data || [] });
});

// ── Music ────────────────────────────────────────────────────

router.get('/music', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('music_items').select('*, music_ratings(*)').eq('account_id', req.accountId).order('created_at', { ascending: false }).limit(100)
  );
  res.json({ music: data || [] });
});

// ── Finance Snapshot ─────────────────────────────────────────

router.get('/finance', async (req, res) => {
  // Read-only Budgeting Beacon integration — pulls summary
  const { data } = await safeQuery((sb) =>
    sb.from('finance_snapshot').select('*').eq('account_id', req.accountId).order('snapshot_date', { ascending: false }).limit(1)
  );
  res.json({ snapshot: data?.[0] || null });
});

module.exports = router;
