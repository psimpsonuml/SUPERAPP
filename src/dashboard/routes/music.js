const express = require('express');
const config = require('../../config');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH = 'https://accounts.spotify.com';

const MUSIC_WEIGHTS = {
  artist: 1.0,
  producer: 0.7,
  featured: 0.5,
  songwriter: 0.4,
};

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── SPOTIFY TOKEN HELPERS ──────────────────────────────────

async function getSpotifyTokens(accountId) {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabase()
    .from('spotify_tokens')
    .select('*')
    .eq('account_id', accountId)
    .single();
  return data;
}

async function refreshSpotifyToken(accountId, refreshToken) {
  const { clientId, clientSecret } = config.spotify;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(`${SPOTIFY_AUTH}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await getSupabase().from('spotify_tokens').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq('account_id', accountId);

  return data.access_token;
}

async function getValidAccessToken(accountId) {
  const tokens = await getSpotifyTokens(accountId);
  if (!tokens) return null;

  if (new Date(tokens.expires_at) > new Date(Date.now() + 60000)) {
    return tokens.access_token;
  }

  return refreshSpotifyToken(accountId, tokens.refresh_token);
}

async function spotifyFetch(accessToken, path) {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Spotify API error: ${res.status}`);
  }
  return res.json();
}

// ── SPOTIFY OAUTH FLOW ─────────────────────────────────────

// GET /api/music/auth-url — get Spotify OAuth URL
router.get('/auth-url', (req, res) => {
  const { clientId, redirectUri } = config.spotify;
  if (!clientId) {
    return res.status(400).json({ error: 'SPOTIFY_CLIENT_ID not configured' });
  }

  const scopes = [
    'user-read-recently-played',
    'user-top-read',
    'user-read-playback-state',
    'user-read-currently-playing',
    'streaming',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: req.accountId,
  });

  res.json({ url: `${SPOTIFY_AUTH}/authorize?${params}` });
});

// GET /api/music/callback — handle Spotify OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    const { clientId, clientSecret, redirectUri } = config.spotify;
    const accountId = state || req.accountId;

    const tokenRes = await fetch(`${SPOTIFY_AUTH}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      return res.status(400).json({ error: err.error_description || 'Token exchange failed' });
    }

    const tokenData = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Get user profile
    const profileRes = await fetch(`${SPOTIFY_API}/me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : {};

    if (isSupabaseConfigured()) {
      await getSupabase().from('spotify_tokens').upsert({
        account_id: accountId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_at: expiresAt,
        scope: tokenData.scope || '',
        spotify_user_id: profile.id || null,
        spotify_display_name: profile.display_name || null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id' });
    }

    // Redirect back to the music page
    res.redirect('/personal/music?connected=true');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/music/connection — check Spotify connection status
router.get('/connection', async (req, res) => {
  try {
    const tokens = await getSpotifyTokens(req.accountId);
    if (!tokens) {
      return res.json({ connected: false, spotifyConfigured: !!(config.spotify.clientId && config.spotify.clientSecret) });
    }

    const expired = new Date(tokens.expires_at) < new Date();
    res.json({
      connected: true,
      expired,
      spotifyConfigured: true,
      displayName: tokens.spotify_display_name,
      userId: tokens.spotify_user_id,
      connectedAt: tokens.connected_at,
    });
  } catch (error) {
    res.json({ connected: false, spotifyConfigured: false });
  }
});

// POST /api/music/disconnect — disconnect Spotify
router.post('/disconnect', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      await getSupabase().from('spotify_tokens')
        .delete()
        .eq('account_id', req.accountId);
    }
    res.json({ disconnected: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── BROWSE (SPOTIFY-POWERED) ───────────────────────────────

// GET /api/music/browse?feed=recent|top_artists|new_releases|genre_discover&genre=pop
router.get('/browse', async (req, res) => {
  try {
    const { feed = 'new_releases', genre } = req.query;
    const accessToken = await getValidAccessToken(req.accountId);

    if (!accessToken) {
      return res.json({ results: [], feed, spotifyConnected: false });
    }

    let results = [];

    if (feed === 'recent') {
      // Recently played tracks
      const data = await spotifyFetch(accessToken, '/me/player/recently-played?limit=50');
      const seen = new Set();
      results = (data.items || [])
        .filter(item => {
          const key = item.track?.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(item => formatTrack(item.track));
    } else if (feed === 'top_artists') {
      // Top artists' latest albums
      const topArtists = await spotifyFetch(accessToken, '/me/top/artists?limit=10&time_range=medium_term');
      const albumPromises = (topArtists.items || []).map(async (artist) => {
        try {
          const albums = await spotifyFetch(accessToken, `/artists/${artist.id}/albums?include_groups=album,single&limit=5&market=US`);
          return (albums.items || []).map(a => formatAlbum(a));
        } catch { return []; }
      });
      const albumSets = await Promise.all(albumPromises);
      results = albumSets.flat().sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 30);
    } else if (feed === 'new_releases') {
      const data = await spotifyFetch(accessToken, '/browse/new-releases?limit=30&country=US');
      results = (data.albums?.items || []).map(a => formatAlbum(a));
    } else if (feed === 'genre_discover' && genre) {
      // Genre-based recommendations
      const data = await spotifyFetch(accessToken, `/recommendations?seed_genres=${encodeURIComponent(genre)}&limit=30`);
      results = (data.tracks || []).map(t => formatTrack(t));
    }

    res.json({ results, feed, spotifyConnected: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/music/search?q=artist+name&type=track|album|artist
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'track,album' } = req.query;
    if (!q) return res.status(400).json({ error: 'q parameter required' });

    const accessToken = await getValidAccessToken(req.accountId);
    let results = [];

    if (accessToken) {
      // Use Spotify search
      const data = await spotifyFetch(accessToken, `/search?q=${encodeURIComponent(q)}&type=${type}&limit=20&market=US`);
      if (data.tracks) results.push(...(data.tracks.items || []).map(t => formatTrack(t)));
      if (data.albums) results.push(...(data.albums.items || []).map(a => formatAlbum(a)));
    } else {
      // No Spotify — use client-credentials flow for basic search
      const token = await getClientCredentialsToken();
      if (token) {
        const data = await spotifyFetch(token, `/search?q=${encodeURIComponent(q)}&type=${type}&limit=20&market=US`);
        if (data.tracks) results.push(...(data.tracks.items || []).map(t => formatTrack(t)));
        if (data.albums) results.push(...(data.albums.items || []).map(a => formatAlbum(a)));
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/music/credits/:spotifyId?type=track|album — get track/album credits
router.get('/credits/:spotifyId', async (req, res) => {
  try {
    const { spotifyId } = req.params;
    const { type = 'track' } = req.query;
    const accessToken = await getValidAccessToken(req.accountId) || await getClientCredentialsToken();

    if (!accessToken) {
      return res.json({ people: [] });
    }

    const people = [];

    if (type === 'track') {
      const track = await spotifyFetch(accessToken, `/tracks/${spotifyId}`);
      // Primary artist
      if (track.artists && track.artists.length > 0) {
        people.push({
          name: track.artists[0].name,
          spotify_id: track.artists[0].id,
          role: 'artist',
        });
        // Additional artists are "featured"
        for (let i = 1; i < track.artists.length; i++) {
          people.push({
            name: track.artists[i].name,
            spotify_id: track.artists[i].id,
            role: 'featured',
          });
        }
      }
    } else if (type === 'album') {
      const album = await spotifyFetch(accessToken, `/albums/${spotifyId}`);
      // Album artist
      if (album.artists && album.artists.length > 0) {
        people.push({
          name: album.artists[0].name,
          spotify_id: album.artists[0].id,
          role: 'artist',
        });
        for (let i = 1; i < album.artists.length; i++) {
          people.push({
            name: album.artists[i].name,
            spotify_id: album.artists[i].id,
            role: 'featured',
          });
        }
      }
      // Track artists from individual tracks
      const tracks = await spotifyFetch(accessToken, `/albums/${spotifyId}/tracks?limit=50`);
      const seenArtists = new Set(people.map(p => p.spotify_id));
      for (const track of (tracks.items || [])) {
        for (const artist of (track.artists || [])) {
          if (!seenArtists.has(artist.id)) {
            seenArtists.add(artist.id);
            people.push({
              name: artist.name,
              spotify_id: artist.id,
              role: 'featured',
            });
          }
        }
      }
    }

    res.json({ people });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/music/genres — available Spotify genre seeds
router.get('/genres', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.accountId) || await getClientCredentialsToken();
    if (!accessToken) {
      return res.json({ genres: getDefaultGenres() });
    }

    try {
      const data = await spotifyFetch(accessToken, '/recommendations/available-genre-seeds');
      res.json({ genres: (data.genres || []).map(g => ({ id: g, label: g.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })) });
    } catch {
      res.json({ genres: getDefaultGenres() });
    }
  } catch (error) {
    res.json({ genres: getDefaultGenres() });
  }
});

// ── RATE ────────────────────────────────────────────────────

// POST /api/music/rate — rate a song or album
router.post('/rate', async (req, res) => {
  try {
    const {
      spotify_id, title, item_type = 'song', artist, year, genre,
      album_art_url, preview_url, spotify_uri, album_name, album_spotify_id,
      duration_ms, score, people,
    } = req.body;

    if (!title) return res.status(400).json({ error: 'title required' });
    if (!score || score < 1 || score > 10) return res.status(400).json({ error: 'score must be 1-10' });
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });

    const supabase = getSupabase();
    const accountId = req.accountId;

    // 1. Upsert music item
    const itemData = {
      account_id: accountId,
      title,
      item_type,
      artist: artist || null,
      year: year || null,
      genre: genre || null,
      album_art_url: album_art_url || null,
      preview_url: preview_url || null,
      spotify_uri: spotify_uri || null,
      album_name: album_name || null,
      album_spotify_id: album_spotify_id || null,
      duration_ms: duration_ms || null,
      metadata_json: {},
      updated_at: new Date().toISOString(),
    };
    if (spotify_id) itemData.spotify_id = spotify_id;

    const conflictKey = spotify_id ? 'account_id,spotify_id' : 'account_id,title,artist,item_type';
    const { data: item, error: itemErr } = await supabase
      .from('music_items')
      .upsert(itemData, { onConflict: conflictKey })
      .select()
      .single();
    if (itemErr) throw itemErr;

    // 2. Upsert rating
    const { data: rating, error: ratingErr } = await supabase
      .from('music_ratings')
      .upsert({
        account_id: accountId,
        music_item_id: item.id,
        score,
        rated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,music_item_id' })
      .select()
      .single();
    if (ratingErr) throw ratingErr;

    // 3. Store people (credits) if provided
    if (people && people.length > 0) {
      const peopleRows = people.map(p => ({
        account_id: accountId,
        music_item_id: item.id,
        person_name: p.name,
        spotify_person_id: p.spotify_id || null,
        role: p.role,
      }));

      // Delete existing people for this item and re-insert
      await supabase.from('music_people')
        .delete()
        .eq('account_id', accountId)
        .eq('music_item_id', item.id);

      await supabase.from('music_people').insert(peopleRows);
    }

    // 4. Run cascade scoring
    runMusicCascade(accountId, item.id).catch(err =>
      console.error('Music cascade error:', err)
    );

    res.json({ item, rating });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── RATED IDS ──────────────────────────────────────────────

// GET /api/music/rated-ids — all Spotify IDs already rated
router.get('/rated-ids', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) return res.json({ ids: [] });
    const { data } = await getSupabase()
      .from('music_items')
      .select('spotify_id')
      .eq('account_id', req.accountId)
      .not('spotify_id', 'is', null);

    const ids = (data || []).map(d => d.spotify_id).filter(Boolean);
    res.json({ ids });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── MY RATINGS ─────────────────────────────────────────────

// GET /api/music/ratings?sort=score|rated_at|artist&genre=rock&group_by_album=true
router.get('/ratings', async (req, res) => {
  try {
    const { sort = 'rated_at', genre } = req.query;

    const sortMap = {
      score: { column: 'score', ascending: false },
      rated_at: { column: 'rated_at', ascending: false },
      artist: { column: 'rated_at', ascending: false },
    };
    const sortOpts = sortMap[sort] || sortMap.rated_at;

    const { data } = await safeQuery((sb) =>
      sb.from('music_ratings')
        .select('*, music_items(*)')
        .eq('account_id', req.accountId)
        .order(sortOpts.column, { ascending: sortOpts.ascending })
        .limit(500)
    );

    let results = data || [];

    // Genre filter
    if (genre) {
      results = results.filter(r => {
        const g = r.music_items?.genre || '';
        return g.toLowerCase().includes(genre.toLowerCase());
      });
    }

    // Sort by artist if requested (needs join data)
    if (sort === 'artist') {
      results.sort((a, b) => (a.music_items?.artist || '').localeCompare(b.music_items?.artist || ''));
    }

    // Extract unique genres
    const genres = [...new Set(results.map(r => r.music_items?.genre).filter(Boolean))];

    res.json({ ratings: results, genres });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── ARTIST RANKINGS (CASCADE) ──────────────────────────────

// GET /api/music/artists?role=artist|producer|songwriter
router.get('/artists', async (req, res) => {
  try {
    const { role } = req.query;

    let query = getSupabase()
      .from('cascade_scores')
      .select('*')
      .eq('account_id', req.accountId)
      .eq('source_type', 'music')
      .order('composite_score', { ascending: false })
      .limit(200);

    if (role) {
      query = query.eq('primary_role', role);
    }

    const { data, error } = await safeQuery(() => query);

    res.json({ artists: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/music/artists/:name — detail view with rated + unrated work
router.get('/artists/:name', async (req, res) => {
  try {
    const artistName = decodeURIComponent(req.params.name);
    const accountId = req.accountId;

    // Get all music items this person is credited on
    const { data: peopleLinks } = await safeQuery((sb) =>
      sb.from('music_people')
        .select('music_item_id, role')
        .eq('account_id', accountId)
        .eq('person_name', artistName)
    );

    const itemIds = (peopleLinks || []).map(p => p.music_item_id);
    let rated = [];

    if (itemIds.length > 0) {
      const { data: items } = await safeQuery((sb) =>
        sb.from('music_items')
          .select('*, music_ratings(*)')
          .eq('account_id', accountId)
          .in('id', itemIds)
          .order('created_at', { ascending: false })
      );
      rated = items || [];
    }

    // Search Spotify for more by this artist
    let unrated = [];
    const accessToken = await getValidAccessToken(accountId) || await getClientCredentialsToken();
    if (accessToken) {
      try {
        const data = await spotifyFetch(accessToken, `/search?q=artist:${encodeURIComponent(artistName)}&type=track&limit=30&market=US`);
        const ratedSpotifyIds = new Set(rated.map(r => r.spotify_id).filter(Boolean));
        unrated = (data.tracks?.items || [])
          .map(t => formatTrack(t))
          .filter(t => !ratedSpotifyIds.has(t.spotify_id));
      } catch {}
    }

    res.json({ artist: artistName, rated, unrated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── LISTENING STATS (SPOTIFY) ──────────────────────────────

// GET /api/music/listening-stats — top artists, tracks, listening time
router.get('/listening-stats', async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.accountId);
    if (!accessToken) {
      return res.json({ connected: false });
    }

    const [topArtists, topTracks, recentlyPlayed] = await Promise.allSettled([
      spotifyFetch(accessToken, '/me/top/artists?limit=10&time_range=short_term'),
      spotifyFetch(accessToken, '/me/top/tracks?limit=10&time_range=short_term'),
      spotifyFetch(accessToken, '/me/player/recently-played?limit=50'),
    ]);

    // Estimate listening time from recently played
    let listeningMs = 0;
    if (recentlyPlayed.status === 'fulfilled') {
      listeningMs = (recentlyPlayed.value.items || []).reduce((sum, item) => {
        return sum + (item.track?.duration_ms || 0);
      }, 0);
    }

    res.json({
      connected: true,
      topArtists: topArtists.status === 'fulfilled'
        ? (topArtists.value.items || []).map(a => ({ name: a.name, id: a.id, image: a.images?.[0]?.url, genres: a.genres?.slice(0, 3) }))
        : [],
      topTracks: topTracks.status === 'fulfilled'
        ? (topTracks.value.items || []).map(t => ({ name: t.name, artist: t.artists?.[0]?.name, id: t.id, image: t.album?.images?.[0]?.url }))
        : [],
      listeningTimeMs: listeningMs,
      listeningTimeMinutes: Math.round(listeningMs / 60000),
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

// ── CASCADE ENGINE ─────────────────────────────────────────

async function runMusicCascade(accountId, musicItemId) {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();

  // Get all people linked to this item
  const { data: people } = await supabase
    .from('music_people')
    .select('person_name, spotify_person_id, role')
    .eq('account_id', accountId)
    .eq('music_item_id', musicItemId);

  if (!people || people.length === 0) return;

  // For each person, recalculate their cascade score
  const uniquePeople = new Map();
  for (const p of people) {
    const key = `${p.person_name}::${p.role}`;
    if (!uniquePeople.has(key)) uniquePeople.set(key, p);
  }

  for (const [, person] of uniquePeople) {
    const roleWeight = MUSIC_WEIGHTS[person.role] || 0.5;

    // Find all items this person is linked to
    const { data: personItems } = await supabase
      .from('music_people')
      .select('music_item_id')
      .eq('account_id', accountId)
      .eq('person_name', person.person_name)
      .eq('role', person.role);

    if (!personItems || personItems.length === 0) continue;
    const itemIds = personItems.map(pi => pi.music_item_id);

    // Get all ratings for those items
    const { data: ratings } = await supabase
      .from('music_ratings')
      .select('music_item_id, score')
      .eq('account_id', accountId)
      .in('music_item_id', itemIds);

    if (!ratings || ratings.length === 0) continue;

    // Calculate weighted scores
    const weightedSum = ratings.reduce((sum, r) => sum + (r.score * roleWeight), 0);
    const weightTotal = ratings.length * roleWeight;
    const compositeScore = weightedSum / weightTotal;

    await supabase.from('cascade_scores').upsert({
      account_id: accountId,
      person_name: person.person_name,
      tmdb_person_id: null,
      primary_role: person.role,
      composite_score: Math.round(compositeScore * 100) / 100,
      weighted_sum: Math.round(weightedSum * 100) / 100,
      weight_total: Math.round(weightTotal * 100) / 100,
      ratings_count: ratings.length,
      item_type: 'music',
      source_type: 'music',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id,person_name,primary_role,item_type' });
  }
}

// ── FORMAT HELPERS ─────────────────────────────────────────

function formatTrack(track) {
  return {
    spotify_id: track.id,
    title: track.name,
    item_type: 'song',
    artist: (track.artists || []).map(a => a.name).join(', '),
    artists: (track.artists || []).map(a => ({ name: a.name, id: a.id })),
    year: track.album?.release_date ? parseInt(track.album.release_date.slice(0, 4)) : null,
    genre: null,
    album_art_url: track.album?.images?.[0]?.url || null,
    preview_url: track.preview_url || null,
    spotify_uri: track.uri,
    album_name: track.album?.name || null,
    album_spotify_id: track.album?.id || null,
    duration_ms: track.duration_ms || null,
    popularity: track.popularity || 0,
  };
}

function formatAlbum(album) {
  return {
    spotify_id: album.id,
    title: album.name,
    item_type: 'album',
    artist: (album.artists || []).map(a => a.name).join(', '),
    artists: (album.artists || []).map(a => ({ name: a.name, id: a.id })),
    year: album.release_date ? parseInt(album.release_date.slice(0, 4)) : null,
    genre: null,
    album_art_url: album.images?.[0]?.url || null,
    preview_url: null,
    spotify_uri: album.uri,
    album_name: album.name,
    album_spotify_id: album.id,
    duration_ms: null,
    total_tracks: album.total_tracks || null,
    album_type: album.album_type || 'album',
  };
}

async function getClientCredentialsToken() {
  const { clientId, clientSecret } = config.spotify;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(`${SPOTIFY_AUTH}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch {
    return null;
  }
}

function getDefaultGenres() {
  return [
    { id: 'pop', label: 'Pop' },
    { id: 'rock', label: 'Rock' },
    { id: 'hip-hop', label: 'Hip Hop' },
    { id: 'r-n-b', label: 'R&B' },
    { id: 'electronic', label: 'Electronic' },
    { id: 'jazz', label: 'Jazz' },
    { id: 'classical', label: 'Classical' },
    { id: 'country', label: 'Country' },
    { id: 'metal', label: 'Metal' },
    { id: 'indie', label: 'Indie' },
    { id: 'alternative', label: 'Alternative' },
    { id: 'blues', label: 'Blues' },
    { id: 'folk', label: 'Folk' },
    { id: 'soul', label: 'Soul' },
    { id: 'reggae', label: 'Reggae' },
    { id: 'latin', label: 'Latin' },
    { id: 'punk', label: 'Punk' },
    { id: 'funk', label: 'Funk' },
  ];
}

module.exports = router;
