const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

const TMDB_BASE = 'https://api.themoviedb.org/3';

function tmdbKey() {
  return process.env.TMDB_API_KEY || '';
}

async function tmdbFetch(path, params = {}) {
  const key = tmdbKey();
  if (!key) throw new Error('TMDB_API_KEY not configured');
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', key);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, String(v)); });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
  return res.json();
}

// TMDB Watch Provider IDs for US region
const STREAMING_PROVIDERS = {
  'Netflix':       { id: 8,   logo: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
  'Hulu':          { id: 15,  logo: '/zxrVdFjIjLqkfnwyghnfywTn3Lh.jpg' },
  'Disney+':       { id: 337, logo: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
  'Max':           { id: 1899, logo: '/6Q3YKUNA4UkZOUWnAVvCaG7cY1N.jpg' },
  'Amazon Prime':  { id: 9,   logo: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  'Apple TV+':     { id: 350, logo: '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg' },
  'Paramount+':    { id: 531, logo: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
  'Peacock':       { id: 386, logo: '/8VCV78prwd9QzWPQUv0cLyPcPVl.jpg' },
};

// Get Monday of the week containing the given date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  return dateStr ? dateStr.slice(0, 10) : null;
}

// ── GET /api/releases/week?offset=0 ─────────────────────────
// offset=0 is current week, offset=-1 is last week, etc.
router.get('/week', async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const now = new Date();
    now.setDate(now.getDate() + (offset * 7));
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const accountId = req.accountId;

    // Check cache first
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      const { data: cached } = await supabase
        .from('release_digest')
        .select('*')
        .eq('account_id', accountId)
        .eq('week_start', weekStart)
        .single();

      // Use cache if less than 12 hours old
      if (cached && (Date.now() - new Date(cached.generated_at).getTime()) < 12 * 60 * 60 * 1000) {
        return res.json({
          week_start: weekStart,
          week_end: weekEndStr,
          theaters: cached.items_json.theaters || [],
          streaming: cached.items_json.streaming || {},
          personalization: cached.personalization_json || {},
          cached: true,
        });
      }
    }

    // Fetch fresh data from TMDB
    const [theaters, streamingByPlatform, personalization] = await Promise.all([
      fetchTheaters(weekStart, weekEndStr),
      fetchStreaming(weekStart, weekEndStr),
      buildPersonalization(accountId),
    ]);

    // Personalize theater results
    const personalizedTheaters = theaters.map(m => ({
      ...m,
      badges: matchPersonalization(m, personalization),
    }));

    // Personalize streaming results
    const personalizedStreaming = {};
    for (const [platform, items] of Object.entries(streamingByPlatform)) {
      personalizedStreaming[platform] = items.map(m => ({
        ...m,
        badges: matchPersonalization(m, personalization),
      }));
    }

    const result = {
      week_start: weekStart,
      week_end: weekEndStr,
      theaters: personalizedTheaters,
      streaming: personalizedStreaming,
      personalization: { people_count: Object.keys(personalization.peopleMap || {}).length },
      cached: false,
    };

    // Cache in Supabase
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      supabase.from('release_digest').upsert({
        account_id: accountId,
        week_start: weekStart,
        items_json: { theaters: personalizedTheaters, streaming: personalizedStreaming },
        personalization_json: { people_count: Object.keys(personalization.peopleMap || {}).length },
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,week_start' }).then(() => {}).catch(() => {});
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── TMDB Data Fetchers ────────────────────────────────────

async function fetchTheaters(startDate, endDate) {
  try {
    const data = await tmdbFetch('/discover/movie', {
      'primary_release_date.gte': startDate,
      'primary_release_date.lte': endDate,
      'with_release_type': '2|3', // Theatrical (limited + wide)
      'sort_by': 'popularity.desc',
      'region': 'US',
      'page': 1,
    });

    const movies = data.results || [];

    // Fetch credits for each movie to get director/cast
    const enriched = await Promise.all(
      movies.slice(0, 20).map(async (m) => {
        let credits = { director: null, cast: [] };
        try {
          const c = await tmdbFetch(`/movie/${m.id}/credits`);
          const director = (c.crew || []).find(p => p.job === 'Director');
          const cast = (c.cast || []).slice(0, 5);
          credits = {
            director: director ? { name: director.name, id: director.id } : null,
            cast: cast.map(a => ({ name: a.name, id: a.id, character: a.character })),
          };
        } catch {}

        return {
          tmdb_id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          release_date: m.release_date,
          genre_ids: m.genre_ids || [],
          vote_average: m.vote_average,
          overview: (m.overview || '').slice(0, 200),
          popularity: m.popularity,
          credits,
        };
      })
    );

    return enriched;
  } catch {
    return [];
  }
}

async function fetchStreaming(startDate, endDate) {
  const results = {};

  // For each platform, find movies/shows recently added
  await Promise.all(
    Object.entries(STREAMING_PROVIDERS).map(async ([name, { id }]) => {
      try {
        // Movies on this platform released this week
        const [movieData, tvData] = await Promise.all([
          tmdbFetch('/discover/movie', {
            'with_watch_providers': id,
            'watch_region': 'US',
            'primary_release_date.gte': startDate,
            'primary_release_date.lte': endDate,
            'sort_by': 'popularity.desc',
            'page': 1,
          }).catch(() => ({ results: [] })),
          tmdbFetch('/discover/tv', {
            'with_watch_providers': id,
            'watch_region': 'US',
            'first_air_date.gte': startDate,
            'first_air_date.lte': endDate,
            'sort_by': 'popularity.desc',
            'page': 1,
          }).catch(() => ({ results: [] })),
        ]);

        const items = [];

        for (const m of (movieData.results || []).slice(0, 8)) {
          let credits = { director: null, cast: [] };
          try {
            const c = await tmdbFetch(`/movie/${m.id}/credits`);
            const director = (c.crew || []).find(p => p.job === 'Director');
            credits = {
              director: director ? { name: director.name, id: director.id } : null,
              cast: (c.cast || []).slice(0, 3).map(a => ({ name: a.name, id: a.id })),
            };
          } catch {}

          items.push({
            tmdb_id: m.id,
            title: m.title,
            media_type: 'movie',
            poster_path: m.poster_path,
            release_date: m.release_date,
            genre_ids: m.genre_ids || [],
            vote_average: m.vote_average,
            overview: (m.overview || '').slice(0, 150),
            credits,
          });
        }

        for (const t of (tvData.results || []).slice(0, 8)) {
          items.push({
            tmdb_id: t.id,
            title: t.name,
            media_type: 'tv',
            poster_path: t.poster_path,
            release_date: t.first_air_date,
            genre_ids: t.genre_ids || [],
            vote_average: t.vote_average,
            overview: (t.overview || '').slice(0, 150),
            credits: { director: null, cast: [] },
          });
        }

        // Sort by popularity descending, limit total
        items.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        if (items.length > 0) {
          results[name] = items.slice(0, 10);
        }
      } catch {}
    })
  );

  return results;
}

// ── Personalization Engine ────────────────────────────────

async function buildPersonalization(accountId) {
  if (!isSupabaseConfigured()) return { peopleMap: {}, topPeople: [] };

  const supabase = getSupabase();

  // Get all cascade scores for this account (entertainment)
  const { data: scores } = await supabase
    .from('cascade_scores')
    .select('person_name, tmdb_person_id, primary_role, composite_score, ratings_count')
    .eq('account_id', accountId)
    .order('composite_score', { ascending: false })
    .limit(200);

  if (!scores || scores.length === 0) return { peopleMap: {}, topPeople: [] };

  // Build lookup by tmdb_person_id and name
  const peopleMap = {};
  const topPeople = scores.slice(0, 20).map(s => s.person_name);

  for (const s of scores) {
    const key = s.tmdb_person_id ? `tmdb_${s.tmdb_person_id}` : `name_${s.person_name.toLowerCase()}`;
    peopleMap[key] = {
      name: s.person_name,
      role: s.primary_role,
      score: s.composite_score,
      count: s.ratings_count,
      isTop20: topPeople.includes(s.person_name),
    };
    // Also index by name for fallback matching
    peopleMap[`name_${s.person_name.toLowerCase()}`] = peopleMap[key];
  }

  return { peopleMap, topPeople };
}

function matchPersonalization(item, personalization) {
  const { peopleMap = {}, topPeople = [] } = personalization;
  const badges = [];

  if (!item.credits || Object.keys(peopleMap).length === 0) return badges;

  // Check director
  if (item.credits.director) {
    const d = item.credits.director;
    const match = (d.id && peopleMap[`tmdb_${d.id}`]) || peopleMap[`name_${d.name.toLowerCase()}`];
    if (match) {
      badges.push({
        type: 'director',
        text: `Director you rated ${match.score.toFixed(1)}`,
        score: match.score,
        isTop20: match.isTop20,
      });
    }
  }

  // Check cast
  for (const actor of (item.credits.cast || [])) {
    const match = (actor.id && peopleMap[`tmdb_${actor.id}`]) || peopleMap[`name_${actor.name.toLowerCase()}`];
    if (match) {
      const isTop = topPeople.includes(match.name);
      badges.push({
        type: 'actor',
        text: isTop
          ? `Stars ${match.name} (your top 20)`
          : `Stars ${match.name} (rated ${match.score.toFixed(1)})`,
        score: match.score,
        name: match.name,
        isTop20: isTop,
      });
    }
  }

  return badges;
}

// ── GENRE LOOKUP ──────────────────────────────────────────

// Static genre map (avoids extra API call)
const GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
  53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics',
};

router.get('/genres', (_req, res) => {
  res.json({ genres: GENRE_MAP });
});

module.exports = router;
