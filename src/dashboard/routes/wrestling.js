const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

const PROMOTIONS = ['WWE', 'AEW', 'NJPW', 'TNA', 'ROH', 'GCW'];

// Mirrors CASCADE_WEIGHTS.wrestling in lib/constants.js
const ROLE_WEIGHTS = { winner: 1.0, loser: 0.8, participant: 0.6 };

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// Every route needs an account — resolve from query or the middleware default
function resolveAccount(req) {
  return req.query.account_id || req.body?.account_id || req.accountId;
}

// ── FAVORITES ─────────────────────────────────────────────

// GET /api/wrestling/favorites
router.get('/favorites', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('wrestling_favorites')
        .select('*')
        .eq('account_id', accountId)
        .order('favorite_type', { ascending: true })
        .order('name', { ascending: true })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ favorites: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/wrestling/favorites
router.post('/favorites', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    const { favorite_type, name, promotion, notes } = req.body;
    if (!accountId || !favorite_type || !name) {
      return res.status(400).json({ error: 'account_id, favorite_type, and name are required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('wrestling_favorites')
        .upsert({
          account_id: accountId,
          favorite_type,
          name,
          promotion: promotion || '',
          notes: notes || '',
        }, { onConflict: 'account_id,favorite_type,name' })
        .select()
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ favorite: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/wrestling/favorites/:id
router.delete('/favorites/:id', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { error } = await safeQuery(sb =>
      sb.from('wrestling_favorites')
        .delete()
        .eq('id', req.params.id)
        .eq('account_id', accountId)
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── EVENTS ────────────────────────────────────────────────

// GET /api/wrestling/events?promotion=&limit=
router.get('/events', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    const { data, error } = await safeQuery(sb => {
      let q = sb.from('wrestling_events')
        .select('*')
        .eq('account_id', accountId)
        .order('event_date', { ascending: false })
        .limit(limit);
      if (req.query.promotion) q = q.eq('promotion', req.query.promotion);
      if (req.query.event_type) q = q.eq('event_type', req.query.event_type);
      return q;
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ events: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── MATCHES ───────────────────────────────────────────────

// GET /api/wrestling/matches?promotion=&event_id=&rated=&page=
router.get('/matches', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const offset = (page - 1) * limit;

    const { data, error } = await safeQuery(sb => {
      let q = sb.from('wrestling_matches')
        .select('*')
        .eq('account_id', accountId)
        .order('event_date', { ascending: false })
        .order('match_order', { ascending: true })
        .range(offset, offset + limit - 1);
      if (req.query.promotion) q = q.eq('promotion', req.query.promotion);
      if (req.query.event_id) q = q.eq('event_id', req.query.event_id);
      if (req.query.title_match === 'true') q = q.eq('title_match', true);
      return q;
    });
    if (error) return res.status(500).json({ error: error.message });

    // Annotate with the user's rating where one exists
    const matches = data || [];
    if (matches.length > 0 && isSupabaseConfigured()) {
      const { data: ratings } = await safeQuery(sb =>
        sb.from('wrestling_ratings')
          .select('match_id, score')
          .eq('account_id', accountId)
          .in('match_id', matches.map(m => m.id))
      );
      const byMatch = {};
      for (const r of (ratings || [])) byMatch[r.match_id] = r.score;
      for (const m of matches) m.my_score = byMatch[m.id] ?? null;
    }

    res.json({ matches, page });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── RATINGS ───────────────────────────────────────────────

// GET /api/wrestling/ratings
router.get('/ratings', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const offset = (page - 1) * limit;

    const { data, error } = await safeQuery(sb => {
      let q = sb.from('wrestling_ratings')
        .select('*')
        .eq('account_id', accountId)
        .order('event_date', { ascending: false })
        .range(offset, offset + limit - 1);
      if (req.query.promotion) q = q.eq('promotion', req.query.promotion);
      if (req.query.min_score) q = q.gte('score', parseInt(req.query.min_score, 10));
      return q;
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ratings: data || [], page });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/wrestling/ratings — rate a match
router.post('/ratings', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    const {
      match_id, promotion, event_name, event_date,
      match_description, score, participants, notes,
    } = req.body;

    if (!accountId || !promotion || !event_date || score === undefined) {
      return res.status(400).json({ error: 'account_id, promotion, event_date, and score are required' });
    }
    if (score < 1 || score > 10) {
      return res.status(400).json({ error: 'score must be between 1 and 10' });
    }

    const participantList = Array.isArray(participants) ? participants : [];

    const { data, error } = await safeQuery(sb =>
      sb.from('wrestling_ratings')
        .upsert({
          account_id: accountId,
          match_id: match_id || null,
          promotion,
          event_name: event_name || '',
          event_date,
          match_description: match_description || '',
          score,
          participants_json: participantList,
          notes: notes || '',
          rated_at: new Date().toISOString(),
        }, { onConflict: 'account_id,match_id' })
        .select()
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });

    // Propagate the score to each wrestler's cascade total
    for (const p of participantList) {
      await updateCascadeScore(accountId, p, score, promotion);
    }

    res.json({ rating: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── WRESTLER RANKINGS (cascade) ───────────────────────────

// GET /api/wrestling/wrestlers
router.get('/wrestlers', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const offset = (page - 1) * limit;

    const { data, error } = await safeQuery(sb => {
      let q = sb.from('wrestling_cascade_scores')
        .select('*')
        .eq('account_id', accountId)
        .order('composite_score', { ascending: false })
        .range(offset, offset + limit - 1);
      if (req.query.promotion) q = q.eq('promotion', req.query.promotion);
      return q;
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ wrestlers: data || [], page });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/wrestling/wrestlers/:name — detail + match history
router.get('/wrestlers/:name', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const name = decodeURIComponent(req.params.name);

    const { data: wrestlerRows } = await safeQuery(sb =>
      sb.from('wrestling_cascade_scores')
        .select('*')
        .eq('account_id', accountId)
        .eq('wrestler_name', name)
        .limit(1)
    );

    // Match history: scan participants_json for this wrestler
    const { data: allMatches } = await safeQuery(sb =>
      sb.from('wrestling_matches')
        .select('*')
        .eq('account_id', accountId)
        .order('event_date', { ascending: false })
        .limit(500)
    );

    const matches = (allMatches || []).filter(m =>
      (m.participants_json || []).some(p => p.name === name)
    );

    // Win/loss record from those matches
    let wins = 0, losses = 0, other = 0;
    for (const m of matches) {
      const role = (m.participants_json || []).find(p => p.name === name)?.role;
      if (role === 'winner') wins++;
      else if (role === 'loser') losses++;
      else other++;
    }

    res.json({
      wrestler: wrestlerRows?.[0] || null,
      matches: matches.slice(0, 50),
      record: {
        wins,
        losses,
        other,
        total: matches.length,
        win_pct: matches.length > 0 ? +((wins / matches.length) * 100).toFixed(1) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── STATISTICS ────────────────────────────────────────────

// GET /api/wrestling/stats — scraper-computed fun statistics
router.get('/stats', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('wrestling_stats')
        .select('*')
        .eq('account_id', accountId)
        .eq('stat_type', 'rolling_90d')
        .order('computed_at', { ascending: false })
        .limit(1)
    );
    if (error) return res.status(500).json({ error: error.message });

    const row = data?.[0] || null;
    res.json({
      stats: row?.payload_json || null,
      computed_at: row?.computed_at || null,
      period_start: row?.period_start || null,
      period_end: row?.period_end || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/wrestling/my-stats — the user's own rating statistics
router.get('/my-stats', async (req, res) => {
  try {
    const accountId = resolveAccount(req);
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: ratings } = await safeQuery(sb =>
      sb.from('wrestling_ratings')
        .select('score, promotion, event_date, match_description, event_name')
        .eq('account_id', accountId)
    );

    const list = ratings || [];
    const byPromotion = {};
    let total = 0;

    for (const r of list) {
      byPromotion[r.promotion] = byPromotion[r.promotion] || { count: 0, sum: 0 };
      byPromotion[r.promotion].count++;
      byPromotion[r.promotion].sum += r.score;
      total += r.score;
    }

    for (const key of Object.keys(byPromotion)) {
      byPromotion[key].avg = +(byPromotion[key].sum / byPromotion[key].count).toFixed(1);
    }

    const sorted = [...list].sort((a, b) => b.score - a.score);

    res.json({
      total_rated: list.length,
      avg_score: list.length > 0 ? +(total / list.length).toFixed(1) : 0,
      by_promotion: byPromotion,
      highest_rated: sorted[0] || null,
      lowest_rated: sorted[sorted.length - 1] || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/wrestling/promotions — static list for UI selectors
router.get('/promotions', (_req, res) => {
  res.json({ promotions: PROMOTIONS });
});

// ── Cascade helper ────────────────────────────────────────
// Weighted: a winner's performance counts fully, a loser's at 0.8,
// a plain participant's at 0.6 — matching CASCADE_WEIGHTS.wrestling.
async function updateCascadeScore(accountId, participant, score, promotion) {
  if (!isSupabaseConfigured() || !participant?.name) return;

  const weight = ROLE_WEIGHTS[participant.role] ?? ROLE_WEIGHTS.participant;
  const sb = getSupabase();

  const { data: existing } = await sb
    .from('wrestling_cascade_scores')
    .select('*')
    .eq('account_id', accountId)
    .eq('wrestler_name', participant.name)
    .maybeSingle();

  const weightedSum = (parseFloat(existing?.weighted_sum) || 0) + (score * weight);
  const weightTotal = (parseFloat(existing?.weight_total) || 0) + weight;
  const matchesRated = (existing?.matches_rated || 0) + 1;
  const avgScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // Confidence ramp: a wrestler needs 5 rated matches to reach full composite
  const composite = avgScore * Math.min(matchesRated / 5, 1) * 10;

  await sb.from('wrestling_cascade_scores').upsert({
    account_id: accountId,
    wrestler_name: participant.name,
    promotion: promotion || existing?.promotion || '',
    weighted_sum: weightedSum.toFixed(2),
    weight_total: weightTotal.toFixed(2),
    composite_score: composite.toFixed(2),
    matches_rated: matchesRated,
    avg_score: avgScore.toFixed(1),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'account_id,wrestler_name' });
}

module.exports = router;
