const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

function tmdbKey() {
  return process.env.TMDB_API_KEY || '';
}

async function tmdbFetch(path, params = {}) {
  const key = tmdbKey();
  if (!key) {
    console.error('[TMDB] TMDB_API_KEY not configured — set it in .env');
    throw new Error('TMDB_API_KEY not configured');
  }
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', key);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, String(v)); });
  console.log(`[TMDB] Fetching: ${path}`, Object.keys(params).length ? params : '');
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[TMDB] API error ${res.status} for ${path}: ${body}`);
    throw new Error(`TMDB API error: ${res.status}`);
  }
  const data = await res.json();
  console.log(`[TMDB] OK: ${path} — ${data.results?.length ?? 'N/A'} results`);
  return data;
}

// ── CASCADE SCORING ENGINE ──────────────────────────────────

const CASCADE_WEIGHTS = {
  director:          1.0,
  lead_actor:        0.8,
  writer:            0.7,
  supporting_actor:  0.5,
  cinematographer:   0.4,
  composer:          0.3,
};

async function runCascade(accountId, itemId) {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();

  // Get the rating for this item
  const { data: rating } = await supabase
    .from('entertainment_ratings')
    .select('score')
    .eq('account_id', accountId)
    .eq('item_id', itemId)
    .single();
  if (!rating) return;

  // Get all people linked to this item
  const { data: people } = await supabase
    .from('entertainment_people')
    .select('*')
    .eq('account_id', accountId)
    .eq('item_id', itemId);
  if (!people || people.length === 0) return;

  // Get the item type
  const { data: item } = await supabase
    .from('entertainment_items')
    .select('item_type')
    .eq('id', itemId)
    .single();
  const itemType = item?.item_type || 'movie';

  // For each person, recalculate their cascade score across ALL rated items
  for (const person of people) {
    const weight = CASCADE_WEIGHTS[person.role] || 0.5;

    // Find all items this person is linked to that have been rated
    const { data: allLinks } = await supabase
      .from('entertainment_people')
      .select('item_id, role')
      .eq('account_id', accountId)
      .eq('person_name', person.person_name);

    if (!allLinks || allLinks.length === 0) continue;

    const itemIds = [...new Set(allLinks.map(l => l.item_id))];

    // Get all ratings for those items
    const { data: ratings } = await supabase
      .from('entertainment_ratings')
      .select('item_id, score')
      .eq('account_id', accountId)
      .in('item_id', itemIds);

    if (!ratings || ratings.length === 0) continue;

    const ratingMap = {};
    ratings.forEach(r => { ratingMap[r.item_id] = r.score; });

    // Compute weighted sum
    let weightedSum = 0;
    let weightTotal = 0;
    let count = 0;

    for (const link of allLinks) {
      const score = ratingMap[link.item_id];
      if (score == null) continue;
      const w = CASCADE_WEIGHTS[link.role] || 0.5;
      weightedSum += score * w;
      weightTotal += w;
      count++;
    }

    if (count === 0) continue;

    const compositeScore = weightedSum / weightTotal;

    // Upsert cascade score
    await supabase.from('cascade_scores').upsert({
      account_id: accountId,
      person_name: person.person_name,
      tmdb_person_id: person.tmdb_person_id,
      primary_role: person.role,
      composite_score: Math.round(compositeScore * 100) / 100,
      weighted_sum: Math.round(weightedSum * 100) / 100,
      weight_total: Math.round(weightTotal * 100) / 100,
      ratings_count: count,
      item_type: itemType,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id,person_name,primary_role,item_type' });
  }
}

// ── TMDB BROWSE ENDPOINTS ───────────────────────────────────

// GET /api/tmdb/discover?feed=popular|top_rated|now_playing&page=1&genre=28
router.get('/discover', async (req, res) => {
  try {
    const { feed = 'popular', page = 1, genre, media_type = 'movie', year, decade, language } = req.query;

    // If any filter is active, always use discover endpoint
    const hasFilters = genre || year || decade || language;

    const feedMap = {
      popular: media_type === 'tv' ? '/tv/popular' : '/movie/popular',
      top_rated: media_type === 'tv' ? '/tv/top_rated' : '/movie/top_rated',
      now_playing: media_type === 'tv' ? '/tv/on_the_air' : '/movie/now_playing',
      discover: media_type === 'tv' ? '/discover/tv' : '/discover/movie',
    };

    const path = hasFilters ? feedMap.discover : (feedMap[feed] || feedMap.popular);
    const params = { page };

    if (hasFilters) {
      params.sort_by = 'popularity.desc';
    }

    if (genre) {
      params.with_genres = genre;
      if (!hasFilters) params.sort_by = 'popularity.desc';
    }

    // Year filter: exact year
    if (year) {
      if (media_type === 'tv') {
        params.first_air_date_year = year;
      } else {
        params.primary_release_year = year;
      }
    }

    // Decade filter: e.g. "1990" means 1990-1999
    if (decade && !year) {
      const decadeStart = parseInt(decade);
      const decadeEnd = decadeStart + 9;
      if (media_type === 'tv') {
        params['first_air_date.gte'] = `${decadeStart}-01-01`;
        params['first_air_date.lte'] = `${decadeEnd}-12-31`;
      } else {
        params['primary_release_date.gte'] = `${decadeStart}-01-01`;
        params['primary_release_date.lte'] = `${decadeEnd}-12-31`;
      }
    }

    // Language filter: ISO 639-1 code (e.g. "en", "ko", "ja")
    if (language) {
      params.with_original_language = language;
    }

    const data = await tmdbFetch(path, params);
    res.json({
      results: data.results || [],
      page: data.page,
      total_pages: data.total_pages,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/search?q=dark+knight&media_type=movie
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, media_type = 'movie' } = req.query;
    if (!q) return res.status(400).json({ error: 'q parameter required' });

    const path = media_type === 'tv' ? '/search/tv' : '/search/movie';
    const data = await tmdbFetch(path, { query: q, page });
    res.json({
      results: data.results || [],
      page: data.page,
      total_pages: data.total_pages,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/credits/:tmdbId?media_type=movie
router.get('/credits/:tmdbId', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const { media_type = 'movie' } = req.query;
    const path = `/${media_type}/${tmdbId}/credits`;
    const data = await tmdbFetch(path);

    // Extract key people with roles
    const people = [];
    const cast = data.cast || [];
    const crew = data.crew || [];

    // Directors
    crew.filter(c => c.job === 'Director').forEach(c => {
      people.push({ name: c.name, tmdb_id: c.id, role: 'director', profile_path: c.profile_path });
    });

    // Writers (Screenplay, Writer, Story)
    crew.filter(c => ['Screenplay', 'Writer', 'Story'].includes(c.job)).slice(0, 3).forEach(c => {
      if (!people.find(p => p.tmdb_id === c.id && p.role === 'writer')) {
        people.push({ name: c.name, tmdb_id: c.id, role: 'writer', profile_path: c.profile_path });
      }
    });

    // Cinematographer
    crew.filter(c => c.job === 'Director of Photography').slice(0, 1).forEach(c => {
      people.push({ name: c.name, tmdb_id: c.id, role: 'cinematographer', profile_path: c.profile_path });
    });

    // Composer
    crew.filter(c => c.job === 'Original Music Composer' || c.job === 'Music').slice(0, 1).forEach(c => {
      people.push({ name: c.name, tmdb_id: c.id, role: 'composer', profile_path: c.profile_path });
    });

    // Lead actors (top 3)
    cast.slice(0, 3).forEach(c => {
      people.push({ name: c.name, tmdb_id: c.id, role: 'lead_actor', profile_path: c.profile_path, character: c.character });
    });

    // Supporting actors (next 5)
    cast.slice(3, 8).forEach(c => {
      people.push({ name: c.name, tmdb_id: c.id, role: 'supporting_actor', profile_path: c.profile_path, character: c.character });
    });

    res.json({ people });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/genres?media_type=movie
router.get('/genres', async (req, res) => {
  try {
    const { media_type = 'movie' } = req.query;
    const data = await tmdbFetch(`/genre/${media_type}/list`);
    res.json({ genres: data.genres || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/detail/:tmdbId?media_type=movie
router.get('/detail/:tmdbId', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const { media_type = 'movie' } = req.query;
    const data = await tmdbFetch(`/${media_type}/${tmdbId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── RATE WITH TMDB + CASCADE ────────────────────────────────

// POST /api/tmdb/rate — Rate a TMDB item, store people, trigger cascade
router.post('/rate', async (req, res) => {
  const { tmdb_id, title, item_type = 'movie', year, score, poster_path, overview, genres, people } = req.body;
  if (!score || score < 1 || score > 10) return res.status(400).json({ error: 'Score must be 1-10' });
  if (!tmdb_id && !title) return res.status(400).json({ error: 'tmdb_id or title required' });

  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const accountId = req.accountId;

    // 1. Upsert the item
    const itemData = {
      account_id: accountId,
      title,
      item_type,
      year,
      poster_path: poster_path || null,
      overview: overview || null,
      genres: genres || [],
      metadata: {},
      updated_at: new Date().toISOString(),
    };
    if (tmdb_id) itemData.tmdb_id = tmdb_id;

    const { data: item, error: itemErr } = await supabase
      .from('entertainment_items')
      .upsert(itemData, { onConflict: tmdb_id ? 'account_id,tmdb_id,item_type' : 'account_id,title,item_type' })
      .select()
      .single();
    if (itemErr) throw itemErr;

    // 2. Upsert the rating
    const { data: rating, error: ratingErr } = await supabase
      .from('entertainment_ratings')
      .upsert({
        account_id: accountId,
        item_id: item.id,
        score,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,item_id' })
      .select()
      .single();
    if (ratingErr) throw ratingErr;

    // 3. Store people (if provided from credits fetch)
    if (Array.isArray(people) && people.length > 0) {
      const peopleRows = people.map(p => ({
        account_id: accountId,
        item_id: item.id,
        person_name: p.name,
        tmdb_person_id: p.tmdb_id || null,
        role: p.role,
        profile_path: p.profile_path || null,
      }));

      // Delete existing people for this item and re-insert (simpler than bulk upsert)
      await supabase.from('entertainment_people').delete().eq('item_id', item.id).eq('account_id', accountId);
      await supabase.from('entertainment_people').insert(peopleRows);
    }

    // 4. Run cascade scoring (async — don't block response)
    runCascade(accountId, item.id).catch(err => console.error('Cascade error:', err));

    res.json({ item, rating });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tmdb/rated-ids — Get all TMDB IDs already rated (for filtering feed)
router.get('/rated-ids', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) return res.json({ ids: [] });
    const supabase = getSupabase();
    const { data } = await supabase
      .from('entertainment_items')
      .select('tmdb_id')
      .eq('account_id', req.accountId)
      .not('tmdb_id', 'is', null);

    const ids = (data || []).map(d => d.tmdb_id).filter(Boolean);
    res.json({ ids });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
