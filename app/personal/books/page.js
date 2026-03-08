'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchBookDiscover, searchBooks, fetchBookSubjects, rateBookNew,
  fetchBookLibrary, fetchBookRatedIds, fetchBookAuthors, fetchBookAuthorDetail,
} from '../../../lib/api';

function scoreColor(s) {
  if (s >= 8) return 'var(--green)';
  if (s >= 5) return 'var(--accent)';
  return 'var(--red)';
}

const STATUS_LABELS = {
  rated: 'Rated',
  want_to_read: 'Want to Read',
  reading: 'Reading',
  abandoned: 'Abandoned',
};

const STATUS_BADGE = {
  rated: 'badge-green',
  want_to_read: 'badge-cyan',
  reading: 'badge-yellow',
  abandoned: 'badge-red',
};

// ── Book Card (Discover view) ─────────────────────────────
function BookCard({ book, score, setScore, onRate, onStatus, justRated, ratedIds }) {
  if (!book) return null;
  const alreadyRated = ratedIds.has(book.open_library_id);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
        {/* Cover */}
        <div style={{ width: 240, flexShrink: 0, background: 'var(--bg)' }}>
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14, flexDirection: 'column', gap: 8, padding: 20, textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span style={{ fontSize: 12 }}>No Cover</span>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4 }}>{book.title}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {book.author && <span className="text-sm" style={{ color: 'var(--accent)' }}>{book.author}</span>}
              {book.year && <span className="text-sm text-muted">{book.year}</span>}
            </div>
          </div>

          {book.genre && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {book.genre.split(',').map(g => g.trim()).filter(Boolean).slice(0, 4).map(g => (
                <span key={g} className="tag" style={{ fontSize: 10 }}>{g}</span>
              ))}
            </div>
          )}

          {book.page_count && (
            <div className="text-sm text-muted">{book.page_count} pages</div>
          )}

          {book.description && (
            <p className="text-sm text-secondary" style={{ lineHeight: 1.6, maxHeight: 96, overflow: 'hidden' }}>
              {book.description.slice(0, 300)}{book.description.length > 300 ? '...' : ''}
            </p>
          )}

          <div style={{ flex: 1 }} />

          {/* Rating / Status area */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            {alreadyRated || justRated === book.open_library_id ? (
              <div style={{ textAlign: 'center' }}>
                <span className="badge badge-green" style={{ fontSize: 14, padding: '6px 16px' }}>
                  {justRated === book.open_library_id ? `Rated ${score}/10` : 'Already in library'}
                </span>
              </div>
            ) : (
              <>
                {/* Score selector */}
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

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn"
                    onClick={onRate}
                    style={{ flex: 1, background: 'var(--accent)', color: '#000', fontWeight: 600 }}
                  >
                    Rate {score}/10
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => onStatus('want_to_read')}
                    style={{ flex: 1, fontSize: 11 }}
                  >
                    Want to Read
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => onStatus('abandoned')}
                    style={{ flex: 1, fontSize: 11 }}
                  >
                    Abandoned
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function BooksPage() {
  const [tab, setTab] = useState('discover');

  // Discover state
  const [feed, setFeed] = useState('trending');
  const [subject, setSubject] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [feedPage, setFeedPage] = useState(1);
  const [feedLoading, setFeedLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(7);
  const [justRated, setJustRated] = useState(null);
  const [ratedIds, setRatedIds] = useState(new Set());

  // Search state
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);

  // Library state
  const [library, setLibrary] = useState([]);
  const [libraryGenres, setLibraryGenres] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState({ status: '', sort: 'rated_at', genre: '' });

  // Author rankings state
  const [authors, setAuthors] = useState([]);
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [authorDetail, setAuthorDetail] = useState(null);
  const [authorDetailLoading, setAuthorDetailLoading] = useState(false);

  // Load rated IDs + subjects on mount
  useEffect(() => {
    fetchBookRatedIds().then(r => setRatedIds(new Set(r.ids || []))).catch(() => {});
    fetchBookSubjects().then(r => setSubjects(r.subjects || [])).catch(() => {});
  }, []);

  // Load feed
  const loadFeed = useCallback(async (page = 1, append = false) => {
    setFeedLoading(true);
    try {
      const params = { feed, page };
      if (subject) params.subject = subject;
      const result = await fetchBookDiscover(params);
      const items = (result.results || []).filter(item => !ratedIds.has(item.open_library_id));
      if (append) {
        setFeedItems(prev => [...prev, ...items]);
      } else {
        setFeedItems(items);
        setCurrentIndex(0);
      }
      setFeedPage(page);
    } catch {} finally {
      setFeedLoading(false);
    }
  }, [feed, subject, ratedIds]);

  useEffect(() => {
    if (tab === 'discover' && !searchMode) loadFeed(1, false);
  }, [tab, feed, subject, searchMode, loadFeed]);

  const items = searchMode ? searchResults : feedItems;
  const currentItem = items[currentIndex];

  // Reset score on item change
  useEffect(() => {
    setScore(7);
    setJustRated(null);
  }, [currentItem?.open_library_id]);

  // Rate handler
  async function handleRate() {
    if (!currentItem) return;
    try {
      await rateBookNew({
        open_library_id: currentItem.open_library_id,
        title: currentItem.title,
        author: currentItem.author,
        year: currentItem.year,
        genre: currentItem.genre,
        cover_url: currentItem.cover_url,
        page_count: currentItem.page_count,
        description: currentItem.description,
        score,
        status: 'rated',
      });

      setJustRated(currentItem.open_library_id);
      setRatedIds(prev => new Set(prev).add(currentItem.open_library_id));
      setTimeout(() => advanceToNext(), 800);
    } catch (err) {
      alert(`Rating failed: ${err.message}`);
    }
  }

  // Status handler (want_to_read / abandoned)
  async function handleStatus(status) {
    if (!currentItem) return;
    try {
      await rateBookNew({
        open_library_id: currentItem.open_library_id,
        title: currentItem.title,
        author: currentItem.author,
        year: currentItem.year,
        genre: currentItem.genre,
        cover_url: currentItem.cover_url,
        page_count: currentItem.page_count,
        description: currentItem.description,
        status,
      });

      setJustRated(currentItem.open_library_id);
      setRatedIds(prev => new Set(prev).add(currentItem.open_library_id));
      setTimeout(() => advanceToNext(), 600);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  }

  function advanceToNext() {
    let nextIdx = currentIndex + 1;
    while (nextIdx < items.length && ratedIds.has(items[nextIdx]?.open_library_id)) nextIdx++;

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
    try {
      const result = await searchBooks(searchQuery);
      setSearchResults(result.results || []);
      setCurrentIndex(0);
    } catch {} finally {
      setSearchLoading(false);
    }
  }

  // Load library
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const res = await fetchBookLibrary(libraryFilter);
      setLibrary(res.ratings || []);
      setLibraryGenres(res.genres || []);
    } catch {} finally {
      setLibraryLoading(false);
    }
  }, [libraryFilter]);

  useEffect(() => {
    if (tab === 'library') loadLibrary();
  }, [tab, loadLibrary]);

  // Load authors
  useEffect(() => {
    if (tab === 'authors' && authors.length === 0) {
      setAuthorsLoading(true);
      fetchBookAuthors().then(r => setAuthors(r.authors || [])).catch(() => {}).finally(() => setAuthorsLoading(false));
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load author detail
  async function handleAuthorClick(name) {
    setSelectedAuthor(name);
    setAuthorDetailLoading(true);
    try {
      const res = await fetchBookAuthorDetail(name);
      setAuthorDetail(res);
    } catch {
      setAuthorDetail(null);
    } finally {
      setAuthorDetailLoading(false);
    }
  }

  const isLoading = searchMode ? searchLoading : feedLoading;
  const hasItems = items.length > 0 && currentIndex < items.length;

  // Group library by status
  const libraryByStatus = {};
  library.forEach(r => {
    const s = r.status || 'rated';
    if (!libraryByStatus[s]) libraryByStatus[s] = [];
    libraryByStatus[s].push(r);
  });

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Book Ranker</h1>
        <p className="text-secondary">Browse, rate, and build your author leaderboard</p>
      </div>

      <div className="tabs">
        {[
          { id: 'discover', label: 'Discover' },
          { id: 'library', label: 'My Library' },
          { id: 'authors', label: 'Author Rankings' },
        ].map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' tab-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

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
              {searchMode ? 'Back to Feed' : 'Search'}
            </button>

            {!searchMode && (
              <>
                <button
                  className={`btn btn-sm${feed === 'trending' && !subject ? ' btn-primary' : ''}`}
                  onClick={() => { setFeed('trending'); setSubject(''); }}
                >
                  Trending
                </button>
                <select
                  value={subject}
                  onChange={e => { setSubject(e.target.value); if (e.target.value) setFeed('subject'); }}
                  style={{ padding: '5px 10px', fontSize: 12, minWidth: 120 }}
                >
                  <option value="">All Genres</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </>
            )}

            <div style={{ flex: 1 }} />
            <span className="text-xs text-muted font-mono">{ratedIds.size} in library</span>
          </div>

          {/* Search bar */}
          {searchMode && (
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search books by title or author..."
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
            <div className="loading"><div className="spinner" />Loading books...</div>
          ) : !hasItems ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p>{searchMode ? 'No results found. Try a different search.' : 'No more books in this feed. Try a different genre.'}</p>
              </div>
            </div>
          ) : (
            <>
              <BookCard
                book={currentItem}
                score={score}
                setScore={setScore}
                onRate={handleRate}
                onStatus={handleStatus}
                justRated={justRated}
                ratedIds={ratedIds}
              />

              {/* Navigation */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16, alignItems: 'center' }}>
                <button className="btn btn-sm" onClick={goBack} disabled={currentIndex === 0}>Previous</button>
                <span className="text-sm text-muted font-mono">{currentIndex + 1} / {items.length}</span>
                <button className="btn btn-sm" onClick={advanceToNext}>Skip</button>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════ MY LIBRARY TAB ═══════════════ */}
      {tab === 'library' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="life-select"
              value={libraryFilter.status}
              onChange={e => setLibraryFilter(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              className="life-select"
              value={libraryFilter.sort}
              onChange={e => setLibraryFilter(prev => ({ ...prev, sort: e.target.value }))}
            >
              <option value="rated_at">Sort: Date Rated</option>
              <option value="score">Sort: Rating</option>
              <option value="created_at">Sort: Date Added</option>
            </select>
            {libraryGenres.length > 0 && (
              <select
                className="life-select"
                value={libraryFilter.genre}
                onChange={e => setLibraryFilter(prev => ({ ...prev, genre: e.target.value }))}
              >
                <option value="">All Genres</option>
                {libraryGenres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            <div style={{ flex: 1 }} />
            <span className="text-xs text-muted font-mono">{library.length} books</span>
          </div>

          {libraryLoading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : library.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ marginBottom: 12 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ display: 'inline' }}>
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3>No books yet</h3>
              <p className="text-secondary">Discover and rate books to build your library.</p>
            </div>
          ) : (
            <>
              {/* If filtering by status, show flat list. Otherwise group by status */}
              {libraryFilter.status ? (
                <div className="card card-compact">
                  <LibraryTable ratings={library} />
                </div>
              ) : (
                Object.entries(STATUS_LABELS).map(([statusKey, statusLabel]) => {
                  const group = libraryByStatus[statusKey];
                  if (!group || group.length === 0) return null;
                  return (
                    <div key={statusKey} style={{ marginBottom: 20 }}>
                      <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                        {statusLabel} ({group.length})
                      </h3>
                      <div className="card card-compact">
                        <LibraryTable ratings={group} />
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </>
      )}

      {/* ═══════════════ AUTHOR RANKINGS TAB ═══════════════ */}
      {tab === 'authors' && (
        <>
          {selectedAuthor && authorDetail ? (
            // Author detail view
            <div>
              <button className="btn btn-sm" onClick={() => { setSelectedAuthor(null); setAuthorDetail(null); }} style={{ marginBottom: 16 }}>
                &larr; Back to Rankings
              </button>

              {authorDetailLoading ? (
                <div className="loading"><div className="spinner" /></div>
              ) : (
                <>
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2 style={{ fontSize: 20, fontWeight: 700 }}>{authorDetail.author}</h2>
                        <span className="text-sm text-secondary">{(authorDetail.rated || []).length} books rated</span>
                      </div>
                      {(() => {
                        const authorScore = authors.find(a => a.person_name === authorDetail.author);
                        return authorScore ? (
                          <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: scoreColor(authorScore.composite_score) }}>
                            {authorScore.composite_score?.toFixed(1)}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Rated books */}
                  {(authorDetail.rated || []).length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                        My Rated Books
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(authorDetail.rated || []).map(item => {
                          const rating = (item.book_ratings || [])[0];
                          return (
                            <div key={item.id} className="card card-compact" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              {item.cover_url ? (
                                <img src={item.cover_url} alt="" style={{ width: 40, height: 60, borderRadius: 4, objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: 40, height: 60, borderRadius: 4, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253" />
                                  </svg>
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="font-semibold text-sm">{item.title}</div>
                                <div className="text-xs text-muted">{item.year || ''} {item.genre ? `· ${item.genre}` : ''}</div>
                              </div>
                              {rating?.score && (
                                <span className="font-mono font-semibold" style={{ color: scoreColor(rating.score), fontSize: 18 }}>
                                  {rating.score}/10
                                </span>
                              )}
                              {rating && !rating.score && (
                                <span className={`badge ${STATUS_BADGE[rating.status] || 'badge-muted'}`}>
                                  {STATUS_LABELS[rating.status] || rating.status}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Unrated books */}
                  {(authorDetail.unrated || []).length > 0 && (
                    <div>
                      <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                        More by {authorDetail.author}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(authorDetail.unrated || []).map((book, i) => (
                          <div key={book.open_library_id || i} className="card card-compact" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            {book.cover_url ? (
                              <img src={book.cover_url} alt="" style={{ width: 32, height: 48, borderRadius: 4, objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: 32, height: 48, borderRadius: 4, background: 'var(--bg)' }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="text-sm font-semibold">{book.title}</div>
                              <div className="text-xs text-muted">{book.year || ''}</div>
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
            // Author rankings list
            <div className="card card-compact">
              {authorsLoading ? (
                <div className="loading"><div className="spinner" /></div>
              ) : authors.length === 0 ? (
                <div className="empty-state">
                  <p>No author rankings yet.</p>
                  <p className="text-xs text-muted" style={{ marginTop: 8 }}>Rate books to generate cascade scores for authors.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Author</th>
                        <th>Score</th>
                        <th>Books Rated</th>
                        <th>Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {authors.map((a, i) => (
                        <tr
                          key={a.id || i}
                          onClick={() => handleAuthorClick(a.person_name)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="font-mono text-muted" style={{ fontSize: 12 }}>{i + 1}</td>
                          <td className="font-semibold text-sm">{a.person_name}</td>
                          <td>
                            <span className="font-mono font-semibold" style={{ color: scoreColor(a.composite_score) }}>
                              {a.composite_score?.toFixed(1)}
                            </span>
                          </td>
                          <td className="text-sm text-muted font-mono">{a.ratings_count}</td>
                          <td className="text-sm text-muted font-mono">
                            {a.ratings_count > 0 ? (a.weighted_sum / a.ratings_count).toFixed(1) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Library Table Component ─────────────────────────────────
function LibraryTable({ ratings }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 48 }}></th>
            <th>Title</th>
            <th>Author</th>
            <th>Genre</th>
            <th>Status</th>
            <th>Score</th>
            <th>Rated</th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((r, i) => {
            const book = r.book_items || {};
            return (
              <tr key={r.id || i}>
                <td style={{ padding: '4px 8px' }}>
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="" style={{ width: 32, height: 48, borderRadius: 4, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 32, height: 48, borderRadius: 4, background: 'var(--bg)' }} />
                  )}
                </td>
                <td className="font-semibold text-sm">{book.title || '—'}</td>
                <td className="text-sm" style={{ color: 'var(--accent)' }}>{book.author || '—'}</td>
                <td className="text-sm text-muted">{book.genre ? book.genre.split(',')[0].trim() : '—'}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[r.status] || 'badge-muted'}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </td>
                <td>
                  {r.score ? (
                    <span className="font-mono font-semibold" style={{ color: scoreColor(r.score) }}>{r.score}/10</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
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
