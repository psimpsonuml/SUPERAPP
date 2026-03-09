'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  tmdbDiscover, tmdbSearch, tmdbCredits, tmdbGenres, tmdbRate, tmdbRatedIds,
  fetchEntertainmentRatings, fetchCascadeScores,
} from '../../../lib/api';
import { CASCADE_WEIGHTS } from '../../../lib/constants';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

const FEEDS = [
  { id: 'popular', label: 'Popular' },
  { id: 'top_rated', label: 'Top Rated' },
  { id: 'now_playing', label: 'Now Playing' },
];

function scoreColor(s) {
  if (s >= 8) return 'var(--green)';
  if (s >= 5) return 'var(--accent)';
  return 'var(--red)';
}

// ── Movie Card ──────────────────────────────────────────────
function MovieCard({ item, credits, score, setScore, onRate, rating, mediaType }) {
  const title = item.title || item.name || '—';
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const director = credits?.find(p => p.role === 'director');
  const leads = credits?.filter(p => p.role === 'lead_actor').slice(0, 3) || [];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 0, minHeight: 390 }}>
        {/* Poster */}
        <div style={{ width: 260, flexShrink: 0, background: 'var(--bg)' }}>
          {item.poster_path ? (
            <img
              src={`${TMDB_IMG}/w342${item.poster_path}`}
              alt={title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
              No Poster
            </div>
          )}
        </div>

        {/* Info panel */}
        <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4 }}>{title}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {year && <span className="text-sm text-muted">{year}</span>}
              <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{mediaType}</span>
            </div>
          </div>

          {item.genre_names && item.genre_names.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {item.genre_names.map(g => (
                <span key={g} className="tag" style={{ fontSize: 10 }}>{g}</span>
              ))}
            </div>
          )}

          {director && (
            <div className="text-sm">
              <span className="text-muted">Director </span>
              <span className="font-semibold">{director.name}</span>
            </div>
          )}

          {leads.length > 0 && (
            <div className="text-sm">
              <span className="text-muted">Cast </span>
              <span>{leads.map(l => l.name).join(', ')}</span>
            </div>
          )}

          {item.overview && (
            <p className="text-sm text-secondary" style={{ lineHeight: 1.6, maxHeight: 80, overflow: 'hidden' }}>
              {item.overview}
            </p>
          )}

          {item.vote_average > 0 && (
            <div className="text-xs text-muted">
              TMDB: <span className="font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {item.vote_average.toFixed(1)}
              </span> / 10
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Rating area */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            {rating ? (
              <div style={{ textAlign: 'center' }}>
                <span className="badge badge-green" style={{ fontSize: 14, padding: '6px 16px' }}>
                  Rated {rating}/10
                </span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      onClick={() => setScore(n)}
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        border: score === n ? `2px solid ${scoreColor(n)}` : '1px solid var(--border)',
                        background: score === n ? `${scoreColor(n)}15` : 'var(--surface)',
                        color: score === n ? scoreColor(n) : 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={onRate} style={{ width: '100%' }}>
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

// ── Main Component ──────────────────────────────────────────
export default function EntertainmentPage() {
  const [tab, setTab] = useState('browse');
  const [mediaType, setMediaType] = useState('movie');
  const [feed, setFeed] = useState('popular');
  const [genreFilter, setGenreFilter] = useState('');
  const [genres, setGenres] = useState([]);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [feedItems, setFeedItems] = useState([]);
  const [feedPage, setFeedPage] = useState(1);
  const [feedLoading, setFeedLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [credits, setCredits] = useState(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [score, setScore] = useState(7);
  const [justRated, setJustRated] = useState(null);

  const [ratedIds, setRatedIds] = useState(new Set());
  const [feedError, setFeedError] = useState(null);

  const [ratings, setRatings] = useState([]);
  const [cascade, setCascade] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  const searchInputRef = useRef(null);

  // Load rated IDs + genres on mount
  useEffect(() => {
    tmdbRatedIds().then(r => setRatedIds(new Set(r.ids || []))).catch(() => {});
    tmdbGenres(mediaType).then(r => setGenres(r.genres || [])).catch(() => {});
  }, [mediaType]);

  // Load feed
  const loadFeed = useCallback(async (page = 1, append = false) => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const params = { feed, page, media_type: mediaType };
      if (genreFilter) params.genre = genreFilter;
      const result = await tmdbDiscover(params);
      const items = (result.results || []).filter(item => !ratedIds.has(item.id));
      if (append) {
        setFeedItems(prev => [...prev, ...items]);
      } else {
        setFeedItems(items);
        setCurrentIndex(0);
      }
      setFeedPage(page);
    } catch (err) {
      console.error('[Entertainment] Feed load failed:', err);
      setFeedError(err.message || 'Failed to load feed');
    } finally {
      setFeedLoading(false);
    }
  }, [feed, mediaType, genreFilter, ratedIds]);

  useEffect(() => {
    if (tab === 'browse' && !searchMode) loadFeed(1, false);
  }, [tab, feed, mediaType, genreFilter, searchMode, loadFeed]);

  // Load credits for current item
  const currentItem = searchMode ? searchResults[currentIndex] : feedItems[currentIndex];

  useEffect(() => {
    if (!currentItem) { setCredits(null); return; }
    setCreditsLoading(true);
    setCredits(null);
    setScore(7);
    setJustRated(null);
    tmdbCredits(currentItem.id, mediaType)
      .then(r => setCredits(r.people || []))
      .catch(() => setCredits([]))
      .finally(() => setCreditsLoading(false));
  }, [currentItem?.id, mediaType]);

  // Attach genre names
  if (currentItem && genres.length > 0 && !currentItem.genre_names) {
    currentItem.genre_names = (currentItem.genre_ids || [])
      .map(id => genres.find(g => g.id === id)?.name)
      .filter(Boolean);
  }

  // Rate handler
  async function handleRate() {
    if (!currentItem) return;
    const title = currentItem.title || currentItem.name;
    const year = parseInt((currentItem.release_date || currentItem.first_air_date || '').slice(0, 4)) || undefined;

    try {
      await tmdbRate({
        tmdb_id: currentItem.id,
        title,
        item_type: mediaType,
        year,
        score,
        poster_path: currentItem.poster_path,
        overview: currentItem.overview,
        genres: currentItem.genre_names || [],
        people: credits || [],
      });

      setJustRated(currentItem.id);
      setRatedIds(prev => new Set(prev).add(currentItem.id));

      // Auto-advance
      setTimeout(() => advanceToNext(), 800);
    } catch (err) {
      alert(`Rating failed: ${err.message}`);
    }
  }

  function advanceToNext() {
    const items = searchMode ? searchResults : feedItems;
    let nextIdx = currentIndex + 1;
    while (nextIdx < items.length && ratedIds.has(items[nextIdx]?.id)) nextIdx++;

    if (nextIdx >= items.length && !searchMode) {
      loadFeed(feedPage + 1, true);
      setCurrentIndex(nextIdx);
    } else {
      setCurrentIndex(nextIdx);
    }
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
      const result = await tmdbSearch(searchQuery, { media_type: mediaType });
      setSearchResults(result.results || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error('[Entertainment] Search failed:', err);
      setFeedError(err.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }

  // Load ratings/cascade on tab switch
  useEffect(() => {
    if (tab === 'ratings' && ratings.length === 0) {
      setRatingsLoading(true);
      fetchEntertainmentRatings().then(r => setRatings(r.ratings || [])).catch(() => {}).finally(() => setRatingsLoading(false));
    }
    if (tab === 'cascade' && cascade.length === 0) {
      setRatingsLoading(true);
      fetchCascadeScores().then(r => setCascade(r.scores || [])).catch(() => {}).finally(() => setRatingsLoading(false));
    }
  }, [tab]);

  const items = searchMode ? searchResults : feedItems;
  const isLoading = searchMode ? searchLoading : feedLoading;
  const hasItems = items.length > 0 && currentIndex < items.length;

  return (
    <>
      <div className="page-header">
        <h1>Entertainment Ranker</h1>
        <p>Browse, rate, and discover. Your scores cascade to directors, actors, writers, and more.</p>
      </div>

      <div className="tabs">
        {[
          { id: 'browse', label: 'Browse & Rate' },
          { id: 'ratings', label: 'My Ratings' },
          { id: 'cascade', label: 'Cascade Scores' },
          { id: 'weights', label: 'Weights' },
        ].map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' tab-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ BROWSE & RATE ═══ */}
      {tab === 'browse' && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {['movie', 'tv'].map(mt => (
                <button
                  key={mt}
                  onClick={() => { setMediaType(mt); setSearchMode(false); }}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: mediaType === mt ? 'var(--accent)' : 'var(--surface)',
                    color: mediaType === mt ? '#0f1117' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {mt === 'movie' ? 'Movies' : 'TV Shows'}
                </button>
              ))}
            </div>

            <button
              className={`btn btn-sm ${searchMode ? 'btn-primary' : ''}`}
              onClick={() => {
                setSearchMode(!searchMode);
                if (!searchMode) setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
            >
              {searchMode ? 'Back to Feed' : 'Search'}
            </button>

            {!searchMode && (
              <>
                {FEEDS.map(f => (
                  <button
                    key={f.id}
                    className={`btn btn-sm${feed === f.id && !genreFilter ? ' btn-primary' : ''}`}
                    onClick={() => { setFeed(f.id); setGenreFilter(''); }}
                  >
                    {f.label}
                  </button>
                ))}
                <select
                  value={genreFilter}
                  onChange={e => { setGenreFilter(e.target.value); if (e.target.value) setFeed('popular'); }}
                  style={{ padding: '5px 10px', fontSize: 12, minWidth: 100 }}
                >
                  <option value="">All Genres</option>
                  {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
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
                placeholder={`Search ${mediaType === 'tv' ? 'TV shows' : 'movies'}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={searchLoading}>
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>
          )}

          {/* Card / Loading / Empty */}
          {isLoading && !hasItems ? (
            <div className="loading"><div className="spinner" />Loading {searchMode ? 'results' : 'feed'}...</div>
          ) : feedError ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon" style={{ color: 'var(--red)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <p style={{ color: 'var(--red)', fontWeight: 600 }}>{feedError}</p>
                <p className="text-xs text-muted" style={{ marginTop: 8 }}>Check that TMDB_API_KEY is set in .env and the server is running.</p>
                <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => loadFeed(1, false)}>Retry</button>
              </div>
            </div>
          ) : !hasItems ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                </div>
                <p>{searchMode ? 'No results found. Try a different search.' : 'No more items in this feed. Try a different feed or genre.'}</p>
              </div>
            </div>
          ) : (
            <>
              <MovieCard
                item={currentItem}
                credits={credits}
                score={score}
                setScore={setScore}
                onRate={handleRate}
                rating={justRated === currentItem?.id ? score : null}
                mediaType={mediaType}
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

              {/* Cascade preview */}
              {credits && credits.length > 0 && !justRated && (
                <div className="card" style={{ marginTop: 16, maxWidth: 720, margin: '16px auto 0' }}>
                  <div className="card-header">
                    <h2>Cascade Preview</h2>
                    <span className="text-xs text-muted">Rating {score}/10 cascades to:</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {credits.map((p, i) => {
                      const w = { director: 1.0, lead_actor: 0.8, writer: 0.7, supporting_actor: 0.5, cinematographer: 0.4, composer: 0.3 }[p.role] || 0.5;
                      const weighted = (score * w).toFixed(1);
                      return (
                        <div key={`${p.name}-${p.role}-${i}`} style={{
                          padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
                          border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <div>
                            <div className="text-sm font-semibold">{p.name}</div>
                            <div className="text-xs text-muted">{p.role.replace(/_/g, ' ')} ({(w * 100).toFixed(0)}%)</div>
                          </div>
                          <div className="font-mono font-semibold" style={{ color: scoreColor(score), fontSize: 14 }}>
                            {weighted}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══ MY RATINGS ═══ */}
      {tab === 'ratings' && (
        <div className="card card-compact">
          {ratingsLoading ? <div className="loading"><div className="spinner" /></div> : ratings.length === 0 ? (
            <div className="empty-state">No ratings yet. Browse & Rate to build your profile.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th style={{ width: 48 }}></th><th>Title</th><th>Type</th><th>Year</th><th>Score</th><th>Rated</th></tr></thead>
                <tbody>
                  {ratings.map((r, i) => {
                    const item = r.entertainment_items || {};
                    return (
                      <tr key={r.id || i}>
                        <td style={{ padding: '4px 8px' }}>
                          {item.poster_path ? (
                            <img src={`${TMDB_IMG}/w92${item.poster_path}`} alt="" style={{ width: 32, height: 48, borderRadius: 4, objectFit: 'cover' }} />
                          ) : <div style={{ width: 32, height: 48, borderRadius: 4, background: 'var(--bg)' }} />}
                        </td>
                        <td className="font-semibold text-sm">{item.title || '—'}</td>
                        <td><span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>{item.item_type}</span></td>
                        <td className="text-sm text-muted">{item.year || '—'}</td>
                        <td><span className="font-mono font-semibold" style={{ color: scoreColor(r.score) }}>{r.score}/10</span></td>
                        <td className="text-sm text-muted">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ CASCADE SCORES ═══ */}
      {tab === 'cascade' && (
        <div className="card card-compact">
          {ratingsLoading ? <div className="loading"><div className="spinner" /></div> : cascade.length === 0 ? (
            <div className="empty-state">
              <p>No cascade scores yet.</p>
              <p className="text-xs text-muted mt-2">Rate movies and TV to generate cascade scores for directors, actors, writers, and more.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Person</th><th>Role</th><th>Composite Score</th><th>Ratings Count</th></tr></thead>
                <tbody>
                  {cascade.map((c, i) => (
                    <tr key={c.id || i}>
                      <td className="font-semibold text-sm">{c.person_name}</td>
                      <td><span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>{(c.primary_role || '').replace(/_/g, ' ')}</span></td>
                      <td><span className="font-mono font-semibold" style={{ color: scoreColor(c.composite_score) }}>{c.composite_score?.toFixed(1)}</span></td>
                      <td className="text-sm text-muted font-mono">{c.ratings_count || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ WEIGHTS ═══ */}
      {tab === 'weights' && (
        <div className="grid-2">
          {Object.entries(CASCADE_WEIGHTS).map(([type, roles]) => (
            <div key={type} className="card card-compact">
              <div className="card-header"><h2 style={{ textTransform: 'capitalize' }}>{type}</h2></div>
              {Object.entries(roles).map(([role, { weight, label }]) => (
                <div key={role} className="info-row">
                  <span className="info-label">{label}</span>
                  <span className="info-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="font-mono">{(weight * 100).toFixed(0)}%</span>
                    <div className="progress-track" style={{ width: 80 }}>
                      <div className="progress-fill" style={{ width: `${weight * 100}%`, background: 'var(--accent)' }} />
                    </div>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
