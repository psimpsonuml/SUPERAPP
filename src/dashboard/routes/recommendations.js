const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

function generateSlug() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ── RECOMMENDATION LISTS ─────────────────────────────────

// GET /lists — all my lists
router.get('/lists', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'];
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('recommendation_lists')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false })
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ lists: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /lists/public/:slug — public shareable view (no auth)
router.get('/lists/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const { data, error } = await safeQuery(sb =>
      sb.from('recommendation_lists')
        .select('id, title, list_type, items_json, description, public_slug, created_at, updated_at')
        .eq('public_slug', slug)
        .single()
    );

    if (error || !data) return res.status(404).json({ error: 'List not found' });
    res.json({ list: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /lists/:id — single list detail
router.get('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await safeQuery(sb =>
      sb.from('recommendation_lists')
        .select('*')
        .eq('id', id)
        .single()
    );

    if (error || !data) return res.status(404).json({ error: 'List not found' });
    res.json({ list: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /lists — create list
router.post('/lists', async (req, res) => {
  try {
    const { account_id, title, list_type, items_json, description } = req.body;
    if (!account_id || !title) return res.status(400).json({ error: 'account_id and title required' });

    const slug = generateSlug();

    const { data, error } = await safeQuery(sb =>
      sb.from('recommendation_lists')
        .insert({
          account_id,
          title,
          list_type: list_type || 'custom',
          items_json: items_json || [],
          description: description || '',
          public_slug: slug,
        })
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ list: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /lists/:id — update list
router.put('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowed = ['title', 'list_type', 'items_json', 'description'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await safeQuery(sb =>
      sb.from('recommendation_lists')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ list: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /lists/:id — delete list
router.delete('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await safeQuery(sb =>
      sb.from('recommendation_lists')
        .delete()
        .eq('id', id)
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /lists/auto-generate — auto-generate a list from cascade scores
router.post('/lists/auto-generate', async (req, res) => {
  try {
    const { account_id, list_type } = req.body;
    if (!account_id || !list_type) return res.status(400).json({ error: 'account_id and list_type required' });

    const typeConfig = {
      top_movies: { title: 'My Top 20 Movies', table: 'cascade_scores', filter: { item_type: 'movie' }, limit: 20 },
      top_directors: { title: 'My Favorite Directors', table: 'cascade_scores', filter: { item_type: 'director' }, limit: 15 },
      hidden_gems: { title: 'Hidden Gems I Love', table: 'cascade_scores', filter: { item_type: 'movie' }, limit: 20, maxPopularity: 50 },
      top_wrestlers: { title: 'My Top Wrestlers', table: 'wrestling_cascade_scores', filter: {}, limit: 20 },
    };

    const config = typeConfig[list_type];
    if (!config) return res.status(400).json({ error: 'Invalid list_type' });

    // Attempt to pull from cascade_scores or ratings
    let items = [];

    const { data: scores } = await safeQuery(sb => {
      let q = sb.from('cascade_scores')
        .select('*')
        .eq('account_id', account_id)
        .order('score', { ascending: false })
        .limit(config.limit);

      if (config.filter.item_type) {
        q = q.eq('item_type', config.filter.item_type);
      }
      return q;
    });

    if (scores && scores.length > 0) {
      items = scores.map((s, i) => ({
        rank: i + 1,
        item_id: s.item_id,
        item_type: s.item_type,
        title: s.title || s.item_id,
        score: s.score,
        poster: s.poster_url || null,
        comment: '',
      }));

      // For hidden gems, filter out highly popular items
      if (list_type === 'hidden_gems' && config.maxPopularity) {
        items = items.filter(item => !item.popularity || item.popularity < config.maxPopularity);
      }
    }

    const slug = generateSlug();

    const { data, error } = await safeQuery(sb =>
      sb.from('recommendation_lists')
        .insert({
          account_id,
          title: config.title,
          list_type,
          items_json: items,
          description: `Auto-generated ${config.title} based on your taste profile.`,
          public_slug: slug,
        })
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ list: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WATCH PARTIES ────────────────────────────────────────

// GET /parties — all watch parties
router.get('/parties', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'];
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('watch_parties')
        .select('*')
        .eq('account_id', accountId)
        .order('proposed_date', { ascending: true })
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ parties: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /parties/invite/:slug — public invite view (no auth)
router.get('/parties/invite/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const { data, error } = await safeQuery(sb =>
      sb.from('watch_parties')
        .select('id, title, item_id, item_type, proposed_date, invite_slug, attendees_json, notes')
        .eq('invite_slug', slug)
        .single()
    );

    if (error || !data) return res.status(404).json({ error: 'Party not found' });
    res.json({ party: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /parties — create watch party
router.post('/parties', async (req, res) => {
  try {
    const { account_id, title, item_id, item_type, proposed_date, notes } = req.body;
    if (!account_id || !title) return res.status(400).json({ error: 'account_id and title required' });

    const slug = generateSlug();

    const { data, error } = await safeQuery(sb =>
      sb.from('watch_parties')
        .insert({
          account_id,
          title,
          item_id: item_id || '',
          item_type: item_type || 'movie',
          proposed_date: proposed_date || null,
          invite_slug: slug,
          attendees_json: [],
          notes: notes || '',
        })
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ party: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /parties/:id — update party
router.put('/parties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowed = ['title', 'item_id', 'item_type', 'proposed_date', 'attendees_json', 'notes'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('watch_parties')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ party: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /parties/:id — cancel party
router.delete('/parties/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await safeQuery(sb =>
      sb.from('watch_parties')
        .delete()
        .eq('id', id)
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PERSONALIZED RECOMMENDATION ──────────────────────────

// POST /recommend — generate personalized recommendation based on taste overlap
router.post('/recommend', async (req, res) => {
  try {
    const { account_id, friend_preferences, media_type } = req.body;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    // Fetch user's own scores
    const { data: myScores } = await safeQuery(sb =>
      sb.from('cascade_scores')
        .select('*')
        .eq('account_id', account_id)
        .order('score', { ascending: false })
        .limit(100)
    );

    const userItems = myScores || [];
    const friendItems = friend_preferences || [];

    // Find overlap — items both users rated highly
    const friendIds = new Set(friendItems.map(f => f.item_id || f.title));
    const myIds = new Set(userItems.map(u => u.item_id));

    const overlap = userItems.filter(u => friendIds.has(u.item_id));
    const overlapScore = overlap.length;

    // Items the friend likes that the user hasn't seen
    const myIdSet = new Set(userItems.map(u => u.item_id));
    const suggestions = friendItems
      .filter(f => !myIdSet.has(f.item_id || f.title))
      .filter(f => !media_type || f.item_type === media_type)
      .slice(0, 10);

    // Items the user likes that the friend hasn't seen
    const friendIdSet = new Set(friendItems.map(f => f.item_id || f.title));
    const forFriend = userItems
      .filter(u => !friendIdSet.has(u.item_id))
      .filter(u => !media_type || u.item_type === media_type)
      .slice(0, 10)
      .map(u => ({
        item_id: u.item_id,
        title: u.title || u.item_id,
        item_type: u.item_type,
        score: u.score,
      }));

    res.json({
      taste_overlap: overlapScore,
      overlap_items: overlap.map(o => ({ item_id: o.item_id, title: o.title || o.item_id, score: o.score })),
      suggestions_for_you: suggestions,
      suggestions_for_friend: forFriend,
      compatibility: userItems.length > 0 ? Math.round((overlapScore / Math.min(userItems.length, friendItems.length || 1)) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
