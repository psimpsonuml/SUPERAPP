'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchMusicConnection, fetchMusicAuthUrl, disconnectSpotify,
  fetchMusicBrowse, searchMusic, fetchMusicCredits, fetchMusicGenres,
  rateMusic, fetchMusicRatedIds, fetchMusicRatings,
  fetchMusicArtists, fetchMusicArtistDetail, fetchListeningStats,
} from '../../../lib/api';
import { CASCADE_WEIGHTS } from '../../../lib/constants';

function scoreColor(s) {
  if (s >= 8) return 'var(--green)';
  if (s >= 5) return 'var(--accent)';
  return 'var(--red)';
}

const BROWSE_FEEDS = [
  { id: 'new_releases', label: 'New Releases' },
  { id: 'recent', label: 'Recently Played', requiresAuth: true },
  { id: 'top_artists', label: 'From My Artists', requiresAuth: true },
  { id: 'genre_discover', label: 'Genre Discovery' },
];

// ── Music Card ──────────────────────────────────────────────
function MusicCard({ item, credits, score, setScore, onRate, justRated, ratedIds }) {
  if (!item) return null;
  const alreadyRated = ratedIds.has(item.spotify_id);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
        {/* Album Art */}
        <div style={{ width: 260, flexShrink: 0, background: 'var(--bg)' }}>
          {item.album_art_url ? (
            <img
              src={item.album_art_url}
              alt={item.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14, flexDirection: 'column', gap: 8, padding: 20, textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <span style={{ fontSize: 12 }}>No Art</span>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4 }}>{item.title}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {item.artist && <span className="text-sm" style={{ color: 'var(--accent)' }}>{item.artist}</span>}
              {item.year && <span className="text-sm text-muted">{item.year}</span>}
              <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{item.item_type}</span>
            </div>
          </div>

          {item.album_name && item.item_type === 'song' && (
            <div className="text-sm text-muted">Album: {item.album_name}</div>
          )}

          {item.total_tracks && item.item_type === 'album' && (
            <div className="text-sm text-muted">{item.total_tracks} tracks</div>
          )}

          {item.duration_ms && (
            <div className="text-xs text-muted">
              {Math.floor(item.duration_ms / 60000)}:{String(Math.floor((item.duration_ms % 60000) / 1000)).padStart(2, '0')}
            </div>
          )}

          {/* Spotify preview player */}
          {item.preview_url && (
            <div style={{ marginTop: 4 }}>
              <audio controls preload="none" style={{ width: '100%', height: 32 }}>
                <source src={item.preview_url} type="audio/mpeg" />
              </audio>
              <div className="text-xs text-muted" style={{ marginTop: 2 }}>30-second preview</div>
            </div>
          )}

          {/* Cascade preview */}
          {credits && credits.length > 0 && !alreadyRated && !justRated && (
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--border-subtle)' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Score {score}/10 cascades to:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {credits.map((p, i) => {
                  const w = CASCADE_WEIGHTS.music[p.role]?.weight || 0.5;
                  return (
                    <div key={`${p.name}-${p.role}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="text-xs font-semibold">{p.name}</span>
                      <span className="text-xs text-muted">({p.role} {(w * 100).toFixed(0)}%)</span>
                      <span className="font-mono text-xs" style={{ color: scoreColor(score) }}>{(score * w).toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Rating area */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            {alreadyRated || justRated === item.spotify_id ? (
              <div style={{ textAlign: 'center' }}>
                <span className="badge badge-green" style={{ fontSize: 14, padding: '6px 16px' }}>
                  {justRated === item.spotify_id ? `Rated ${score}/10` : 'Already rated'}
                </span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 10 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      onClick={() => setScore(n)}
                      style={{
                        width: 34, height: 34, borderRadius: 8,
                        border: score === n ? `2px solid ${scoreColor(n)}` : '1px solid var(--border)',
                        background: score === n ? `${scoreColor(n)}15` : 'var(--surface)',
                        color: score === n ? scoreColor(n) : 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  className="btn"
                  onClick={onRate}
                  style={{ width: '100%', background: 'var(--accent)', color: '#000', fontWeight: 600 }}
                >
                  Rate {score}/10
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Listening Stats Sidebar ─────────────────────────────────
function ListeningStatsSidebar({ stats, cascadeArtists }) {
  if (!stats || !stats.connected) return null;

  // Cross-reference: are most-listened artists also highest-rated?
  const cascadeMap = new Map();
  (cascadeArtists || []).forEach(a => {
    cascadeMap.set(a.person_name.toLowerCase(), a);
  });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <h2>Listening Stats</h2>
        <span className="text-xs text-muted">This week via Spotify</span>
      </div>

      {stats.listeningTimeMinutes > 0 && (
        <div className="info-row">
          <span className="info-label">Recent Listening</span>
          <span className="info-value font-mono">
            {stats.listeningTimeMinutes >= 60
              ? `${Math.floor(stats.listeningTimeMinutes / 60)}h ${stats.listeningTimeMinutes % 60}m`
              : `${stats.listeningTimeMinutes}m`
            }
          </span>
        </div>
      )}

      {stats.topArtists && stats.topArtists.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Top Artists
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.topArtists.slice(0, 5).map((a, i) => {
              const cascadeEntry = cascadeMap.get(a.name.toLowerCase());
              return (
                <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="font-mono text-xs text-muted" style={{ width: 16 }}>{i + 1}</span>
                  {a.image && (
                    <img src={a.image} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                  )}
                  <span className="text-sm font-semibold" style={{ flex: 1 }}>{a.name}</span>
                  {cascadeEntry ? (
                    <span className="font-mono text-xs" style={{ color: scoreColor(cascadeEntry.composite_score) }}>
                      {cascadeEntry.composite_score?.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.topTracks && stats.topTracks.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Top Tracks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.topTracks.slice(0, 5).map((t, i) => (
              <div key={t.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="font-mono text-xs text-muted" style={{ width: 16 }}>{i + 1}</span>
                {t.image && (
                  <img src={t.image} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-sm font-semibold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                  <div className="text-xs text-muted">{t.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function MusicPage() {
  const [tab, setTab] = useState('discover');

  // Connection state
  const [connection, setConnection] = useState(null);
  const [connectionLoading, setConnectionLoading] = useState(true);

  // Discover state
  const [feed, setFeed] = useState('new_releases');
  const [genreFilter, setGenreFilter] = useState('');
  const [genres, setGenres] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(7);
  const [justRated, setJustRated] = useState(null);
  const [ratedIds, setRatedIds] = useState(new Set());
  const [credits, setCredits] = useState(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [feedError, setFeedError] = useState(null);

  // Search state
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);

  // Ratings state
  const [ratings, setRatings] = useState([]);
  const [ratingsGenres, setRatingsGenres] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsFilter, setRatingsFilter] = useState({ sort: 'rated_at', genre: '' });
  const [groupByAlbum, setGroupByAlbum] = useState(false);

  // Artist rankings state
  const [artists, setArtists] = useState([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [artistRoleFilter, setArtistRoleFilter] = useState('');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [artistDetail, setArtistDetail] = useState(null);
  const [artistDetailLoading, setArtistDetailLoading] = useState(false);

  // Listening stats
  const [listeningStats, setListeningStats] = useState(null);

  // Load connection + rated IDs + genres on mount
  useEffect(() => {
    fetchMusicConnection()
      .then(r => setConnection(r))
      .catch(() => setConnection({ connected: false, spotifyConfigured: false }))
      .finally(() => setConnectionLoading(false));

    fetchMusicRatedIds().then(r => setRatedIds(new Set(r.ids || []))).catch(() => {});
    fetchMusicGenres().then(r => setGenres(r.genres || [])).catch(() => {});
  }, []);

  // Load listening stats when connected
  useEffect(() => {
    if (connection?.connected) {
      fetchListeningStats().then(r => setListeningStats(r)).catch(() => {});
    }
  }, [connection?.connected]);

  // Load feed
  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const params = { feed };
      if (feed === 'genre_discover' && genreFilter) params.genre = genreFilter;
      const result = await fetchMusicBrowse(params);
      const items = (result.results || []).filter(item => !ratedIds.has(item.spotify_id));
      setFeedItems(items);
      setCurrentIndex(0);
    } catch (err) {
      setFeedError(err.message || 'Failed to load feed');
    } finally {
      setFeedLoading(false);
    }
  }, [feed, genreFilter, ratedIds]);

  useEffect(() => {
    if (tab === 'discover' && !searchMode && connection?.connected) loadFeed();
  }, [tab, feed, genreFilter, searchMode, connection?.connected, loadFeed]);

  const items = searchMode ? searchResults : feedItems;
  const currentItem = items[currentIndex];

  // Load credits for current item
  useEffect(() => {
    if (!currentItem?.spotify_id) { setCredits(null); return; }
    setCreditsLoading(true);
    setCredits(null);
    setScore(7);
    setJustRated(null);
    fetchMusicCredits(currentItem.spotify_id, currentItem.item_type === 'album' ? 'album' : 'track')
      .then(r => setCredits(r.people || []))
      .catch(() => setCredits([]))
      .finally(() => setCreditsLoading(false));
  }, [currentItem?.spotify_id]);

  // Rate handler
  async function handleRate() {
    if (!currentItem) return;
    try {
      await rateMusic({
        spotify_id: currentItem.spotify_id,
        title: currentItem.title,
        item_type: currentItem.item_type,
        artist: currentItem.artist,
        year: currentItem.year,
        genre: currentItem.genre || genreFilter,
        album_art_url: currentItem.album_art_url,
        preview_url: currentItem.preview_url,
        spotify_uri: currentItem.spotify_uri,
        album_name: currentItem.album_name,
        album_spotify_id: currentItem.album_spotify_id,
        duration_ms: currentItem.duration_ms,
        score,
        people: credits || [],
      });

      setJustRated(currentItem.spotify_id);
      setRatedIds(prev => new Set(prev).add(currentItem.spotify_id));
      setTimeout(() => advanceToNext(), 800);
    } catch (err) {
      alert(`Rating failed: ${err.message}`);
    }
  }

  function advanceToNext() {
    let nextIdx = currentIndex + 1;
    while (nextIdx < items.length && ratedIds.has(items[nextIdx]?.spotify_id)) nextIdx++;
    setCurrentIndex(nextIdx);
  }

  function goBack() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  // Search
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setFeedError(null);
    try {
      const result = await searchMusic(searchQuery);
      setSearchResults(result.results || []);
      setCurrentIndex(0);
    } catch (err) {
      setFeedError(err.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }

  // Load ratings
  const loadRatings = useCallback(async () => {
    setRatingsLoading(true);
    try {
      const res = await fetchMusicRatings(ratingsFilter);
      setRatings(res.ratings || []);
      setRatingsGenres(res.genres || []);
    } catch {} finally {
      setRatingsLoading(false);
    }
  }, [ratingsFilter]);

  useEffect(() => {
    if (tab === 'ratings') loadRatings();
  }, [tab, loadRatings]);

  // Load artists
  const loadArtists = useCallback(async () => {
    setArtistsLoading(true);
    try {
      const res = await fetchMusicArtists(artistRoleFilter || undefined);
      setArtists(res.artists || []);
    } catch {} finally {
      setArtistsLoading(false);
    }
  }, [artistRoleFilter]);

  useEffect(() => {
    if (tab === 'artists') loadArtists();
  }, [tab, loadArtists]);

  // Artist detail
  async function handleArtistClick(name) {
    setSelectedArtist(name);
    setArtistDetailLoading(true);
    try {
      const res = await fetchMusicArtistDetail(name);
      setArtistDetail(res);
    } catch {
      setArtistDetail(null);
    } finally {
      setArtistDetailLoading(false);
    }
  }

  // Spotify connect
  async function handleConnect() {
    try {
      const res = await fetchMusicAuthUrl();
      if (res.url) window.location.href = res.url;
    } catch (err) {
      alert(`Failed to get auth URL: ${err.message}`);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Spotify?')) return;
    try {
      await disconnectSpotify();
      setConnection({ connected: false, spotifyConfigured: true });
      setListeningStats(null);
    } catch (err) {
      alert(`Failed to disconnect: ${err.message}`);
    }
  }

  const isLoading = searchMode ? searchLoading : feedLoading;
  const hasItems = items.length > 0 && currentIndex < items.length;
  const spotifyConnected = connection?.connected;

  // Group ratings by album
  const ratingsByAlbum = {};
  if (groupByAlbum) {
    ratings.forEach(r => {
      const album = r.music_items?.album_name || r.music_items?.title || 'Unknown';
      if (!ratingsByAlbum[album]) ratingsByAlbum[album] = [];
      ratingsByAlbum[album].push(r);
    });
  }

  if (connectionLoading) {
    return <div className="loading"><div className="spinner" />Loading...</div>;
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Music Discovery</h1>
        <p className="text-secondary">Browse, rate, and build your artist leaderboard with Spotify integration</p>
      </div>

      {/* Spotify connection status */}
      {!spotifyConnected && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="font-semibold text-sm" style={{ marginBottom: 4 }}>
              {connection?.spotifyConfigured ? 'Connect Spotify' : 'Spotify Not Configured'}
            </div>
            <div className="text-xs text-muted">
              {connection?.spotifyConfigured
                ? 'Connect your Spotify account for personalized feeds, previews, and listening stats.'
                : 'Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env. Search still works without it.'
              }
            </div>
          </div>
          {connection?.spotifyConfigured && (
            <button className="btn btn-primary btn-sm" onClick={handleConnect}>
              Connect Spotify
            </button>
          )}
        </div>
      )}

      {spotifyConnected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
          <span className="text-xs text-muted">
            Connected as {connection.displayName || connection.userId}
          </span>
          <button className="btn btn-xs" onClick={handleDisconnect} style={{ color: 'var(--red)' }}>Disconnect</button>
        </div>
      )}

      <div className="tabs">
        {[
          { id: 'discover', label: 'Discover' },
          { id: 'ratings', label: 'My Ratings' },
          { id: 'artists', label: 'Artist Rankings' },
        ].map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' tab-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ═══════════════ DISCOVER TAB ═══════════════ */}
          {tab === 'discover' && (
            <>
              {/* Controls */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className={`btn btn-sm ${searchMode ? 'btn-primary' : ''}`}
                  onClick={() => {
                    setSearchMode(!searchMode);
                    if (!searchMode) setTimeout(() => searchInputRef.current?.focus(), 100);
                  }}
                >
                  {searchMode ? 'Back to Browse' : 'Search'}
                </button>

                {!searchMode && (
                  <>
                    {BROWSE_FEEDS.filter(f => !f.requiresAuth || spotifyConnected).map(f => (
                      <button
                        key={f.id}
                        className={`btn btn-sm${feed === f.id ? ' btn-primary' : ''}`}
                        onClick={() => { setFeed(f.id); setGenreFilter(''); }}
                      >
                        {f.label}
                      </button>
                    ))}
                    {feed === 'genre_discover' && genres.length > 0 && (
                      <select
                        value={genreFilter}
                        onChange={e => setGenreFilter(e.target.value)}
                        style={{ padding: '5px 10px', fontSize: 12, minWidth: 120 }}
                      >
                        <option value="">Select Genre</option>
                        {genres.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                    )}
                  </>
                )}

                <div style={{ flex: 1 }} />
                <span className="text-xs text-muted font-mono">{ratedIds.size} rated</span>
              </div>

              {/* Search bar */}
              {searchMode && (
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search songs, albums, or artists..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary btn-sm" type="submit" disabled={searchLoading}>
                    {searchLoading ? 'Searching...' : 'Search'}
                  </button>
                </form>
              )}

              {/* No Spotify + no search = show prompt */}
              {!spotifyConnected && !searchMode ? (
                <div className="card">
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <p>Connect Spotify to browse feeds, or use Search to find music manually.</p>
                  </div>
                </div>
              ) : isLoading && !hasItems ? (
                <div className="loading"><div className="spinner" />Loading music...</div>
              ) : feedError ? (
                <div className="card">
                  <div className="empty-state">
                    <p style={{ color: 'var(--red)', fontWeight: 600 }}>{feedError}</p>
                    <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={loadFeed}>Retry</button>
                  </div>
                </div>
              ) : !hasItems ? (
                <div className="card">
                  <div className="empty-state">
                    <p>{searchMode ? 'No results found. Try a different search.' : 'No more items in this feed.'}</p>
                  </div>
                </div>
              ) : (
                <>
                  <MusicCard
                    item={currentItem}
                    credits={credits}
                    score={score}
                    setScore={setScore}
                    onRate={handleRate}
                    justRated={justRated}
                    ratedIds={ratedIds}
                  />

                  {/* Navigation */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16, alignItems: 'center' }}>
                    <button className="btn btn-sm" onClick={goBack} disabled={currentIndex === 0}>Previous</button>
                    <span className="text-sm text-muted font-mono">{currentIndex + 1} / {items.length}</span>
                    <button className="btn btn-sm" onClick={advanceToNext}>Skip</button>
                  </div>

                  {creditsLoading && (
                    <div className="text-xs text-muted" style={{ textAlign: 'center', marginTop: 8 }}>Loading credits...</div>
                  )}
                </>
              )}
            </>
          )}

          {/* ═══════════════ MY RATINGS TAB ═══════════════ */}
          {tab === 'ratings' && (
            <>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  className="life-select"
                  value={ratingsFilter.sort}
                  onChange={e => setRatingsFilter(prev => ({ ...prev, sort: e.target.value }))}
                >
                  <option value="rated_at">Sort: Date Rated</option>
                  <option value="score">Sort: Rating</option>
                  <option value="artist">Sort: Artist</option>
                </select>
                {ratingsGenres.length > 0 && (
                  <select
                    className="life-select"
                    value={ratingsFilter.genre}
                    onChange={e => setRatingsFilter(prev => ({ ...prev, genre: e.target.value }))}
                  >
                    <option value="">All Genres</option>
                    {ratingsGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={groupByAlbum}
                    onChange={e => setGroupByAlbum(e.target.checked)}
                  />
                  Group by album
                </label>
                <div style={{ flex: 1 }} />
                <span className="text-xs text-muted font-mono">{ratings.length} ratings</span>
              </div>

              {ratingsLoading ? (
                <div className="loading"><div className="spinner" /></div>
              ) : ratings.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ marginBottom: 12 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ display: 'inline' }}>
                      <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3>No ratings yet</h3>
                  <p className="text-secondary">Discover and rate music to build your library.</p>
                </div>
              ) : groupByAlbum ? (
                Object.entries(ratingsByAlbum).map(([albumName, albumRatings]) => (
                  <div key={albumName} style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                      {albumName} ({albumRatings.length})
                    </h3>
                    <div className="card card-compact">
                      <RatingsTable ratings={albumRatings} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="card card-compact">
                  <RatingsTable ratings={ratings} />
                </div>
              )}
            </>
          )}

          {/* ═══════════════ ARTIST RANKINGS TAB ═══════════════ */}
          {tab === 'artists' && (
            <>
              {selectedArtist && artistDetail ? (
                // Artist detail view
                <div>
                  <button className="btn btn-sm" onClick={() => { setSelectedArtist(null); setArtistDetail(null); }} style={{ marginBottom: 16 }}>
                    &larr; Back to Rankings
                  </button>

                  {artistDetailLoading ? (
                    <div className="loading"><div className="spinner" /></div>
                  ) : (
                    <>
                      <div className="card" style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h2 style={{ fontSize: 20, fontWeight: 700 }}>{artistDetail.artist}</h2>
                            <span className="text-sm text-secondary">{(artistDetail.rated || []).length} tracks/albums rated</span>
                          </div>
                          {(() => {
                            const entry = artists.find(a => a.person_name === artistDetail.artist);
                            return entry ? (
                              <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: scoreColor(entry.composite_score) }}>
                                {entry.composite_score?.toFixed(1)}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      {/* Rated items */}
                      {(artistDetail.rated || []).length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                            My Rated
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(artistDetail.rated || []).map(item => {
                              const rating = (item.music_ratings || [])[0];
                              return (
                                <div key={item.id} className="card card-compact" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                  {item.album_art_url ? (
                                    <img src={item.album_art_url} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--bg)' }} />
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="font-semibold text-sm">{item.title}</div>
                                    <div className="text-xs text-muted">
                                      {item.item_type === 'album' ? 'Album' : 'Song'}
                                      {item.year ? ` · ${item.year}` : ''}
                                    </div>
                                  </div>
                                  {rating?.score && (
                                    <span className="font-mono font-semibold" style={{ color: scoreColor(rating.score), fontSize: 18 }}>
                                      {rating.score}/10
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Unrated from Spotify */}
                      {(artistDetail.unrated || []).length > 0 && (
                        <div>
                          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                            More by {artistDetail.artist}
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(artistDetail.unrated || []).map((item, i) => (
                              <div key={item.spotify_id || i} className="card card-compact" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                {item.album_art_url ? (
                                  <img src={item.album_art_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--bg)' }} />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="text-sm font-semibold">{item.title}</div>
                                  <div className="text-xs text-muted">{item.album_name || ''} {item.year ? `· ${item.year}` : ''}</div>
                                </div>
                                <span className="badge badge-muted" style={{ fontSize: 10 }}>Unrated</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                // Artist rankings list
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                    <select
                      className="life-select"
                      value={artistRoleFilter}
                      onChange={e => setArtistRoleFilter(e.target.value)}
                    >
                      <option value="">All Roles</option>
                      <option value="artist">Artist</option>
                      <option value="producer">Producer</option>
                      <option value="featured">Featured</option>
                      <option value="songwriter">Songwriter</option>
                    </select>
                    <div style={{ flex: 1 }} />
                    <span className="text-xs text-muted font-mono">{artists.length} entries</span>
                  </div>

                  <div className="card card-compact">
                    {artistsLoading ? (
                      <div className="loading"><div className="spinner" /></div>
                    ) : artists.length === 0 ? (
                      <div className="empty-state">
                        <p>No artist rankings yet.</p>
                        <p className="text-xs text-muted" style={{ marginTop: 8 }}>Rate music to generate cascade scores.</p>
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}>#</th>
                              <th>Name</th>
                              <th>Role</th>
                              <th>Score</th>
                              <th>Rated</th>
                              <th>Avg</th>
                            </tr>
                          </thead>
                          <tbody>
                            {artists.map((a, i) => (
                              <tr
                                key={a.id || i}
                                onClick={() => handleArtistClick(a.person_name)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td className="font-mono text-muted" style={{ fontSize: 12 }}>{i + 1}</td>
                                <td className="font-semibold text-sm">{a.person_name}</td>
                                <td>
                                  <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>
                                    {a.primary_role}
                                  </span>
                                </td>
                                <td>
                                  <span className="font-mono font-semibold" style={{ color: scoreColor(a.composite_score) }}>
                                    {a.composite_score?.toFixed(1)}
                                  </span>
                                </td>
                                <td className="text-sm text-muted font-mono">{a.ratings_count}</td>
                                <td className="text-sm text-muted font-mono">
                                  {a.ratings_count > 0 ? (a.weighted_sum / a.weight_total).toFixed(1) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Listening stats sidebar (only on discover tab when connected) */}
        {tab === 'discover' && spotifyConnected && listeningStats?.connected && (
          <div style={{ width: 280, flexShrink: 0 }}>
            <ListeningStatsSidebar stats={listeningStats} cascadeArtists={artists} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ratings Table Component ─────────────────────────────────
function RatingsTable({ ratings }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 48 }}></th>
            <th>Title</th>
            <th>Artist</th>
            <th>Type</th>
            <th>Genre</th>
            <th>Score</th>
            <th>Rated</th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((r, i) => {
            const item = r.music_items || {};
            return (
              <tr key={r.id || i}>
                <td style={{ padding: '4px 8px' }}>
                  {item.album_art_url ? (
                    <img src={item.album_art_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--bg)' }} />
                  )}
                </td>
                <td className="font-semibold text-sm">{item.title || '—'}</td>
                <td className="text-sm" style={{ color: 'var(--accent)' }}>{item.artist || '—'}</td>
                <td>
                  <span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>{item.item_type || 'song'}</span>
                </td>
                <td className="text-sm text-muted">{item.genre || '—'}</td>
                <td>
                  <span className="font-mono font-semibold" style={{ color: scoreColor(r.score) }}>{r.score}/10</span>
                </td>
                <td className="text-sm text-muted">{r.rated_at ? new Date(r.rated_at).toLocaleDateString() : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
