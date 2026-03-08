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
  const { data } = await safeQuery((sb) =>
    sb.from('news_feed_items').select('*').eq('account_id', req.accountId).order('published_at', { ascending: false }).limit(50)
  );
  res.json({ items: data || [] });
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
