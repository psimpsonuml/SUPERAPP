'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchReleaseWeek } from '../../../lib/api';

const TMDB_IMG = 'https://image.tmdb.org/t/p';

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

const PLATFORM_COLORS = {
  'Netflix': '#E50914',
  'Hulu': '#1CE783',
  'Disney+': '#113CCF',
  'Max': '#002BE7',
  'Amazon Prime': '#00A8E1',
  'Apple TV+': '#555555',
  'Paramount+': '#0064FF',
  'Peacock': '#46b866',
};

function scoreColor(s) {
  if (s >= 7) return 'var(--green)';
  if (s >= 5) return 'var(--accent)';
  return 'var(--red)';
}

function formatWeekRange(start, end) {
  if (!start) return '';
  const s = new Date(start + 'T00:00:00');
  const e = end ? new Date(end + 'T00:00:00') : s;
  const opts = { month: 'short', day: 'numeric' };
  const yearOpts = { ...opts, year: 'numeric' };
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', yearOpts)} – ${e.toLocaleDateString('en-US', yearOpts)}`;
  }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', yearOpts)}`;
}

// ── Badge Component ─────────────────────────────────────────
function PersonalizationBadge({ badge }) {
  const isTop = badge.isTop20;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
      background: isTop ? 'var(--accent-muted)' : 'var(--green-muted)',
      color: isTop ? 'var(--accent)' : 'var(--green)',
      border: `1px solid ${isTop ? 'var(--accent)' : 'var(--green)'}20`,
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      {badge.text}
    </div>
  );
}

// ── Release Card ────────────────────────────────────────────
function ReleaseCard({ item, compact }) {
  const genres = (item.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean).slice(0, 2);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0 }}>
      <div style={{ display: 'flex', gap: 0, minHeight: compact ? 140 : 200 }}>
        {/* Poster */}
        <div style={{ width: compact ? 93 : 130, flexShrink: 0, background: 'var(--bg)' }}>
          {item.poster_path ? (
            <img
              src={`${TMDB_IMG}/w185${item.poster_path}`}
              alt={item.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 11 }}>
              No Poster
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, padding: compact ? '10px 14px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <h3 style={{ fontSize: compact ? 13 : 15, fontWeight: 700, marginBottom: 2, letterSpacing: '-0.2px' }}>
              {item.title}
              {item.media_type === 'tv' && <span className="badge badge-purple" style={{ marginLeft: 6, fontSize: 9 }}>TV</span>}
            </h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {genres.map(g => (
                <span key={g} className="tag" style={{ fontSize: 9 }}>{g}</span>
              ))}
              {item.vote_average > 0 && (
                <span className="font-mono text-xs" style={{ color: scoreColor(item.vote_average) }}>
                  {item.vote_average.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          {item.credits?.director && (
            <div className="text-xs">
              <span className="text-muted">Dir. </span>
              <span>{item.credits.director.name}</span>
            </div>
          )}

          {item.credits?.cast?.length > 0 && (
            <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.credits.cast.map(a => a.name).join(', ')}
            </div>
          )}

          {!compact && item.overview && (
            <p className="text-xs text-secondary" style={{ lineHeight: 1.5, maxHeight: 36, overflow: 'hidden' }}>
              {item.overview}
            </p>
          )}

          {/* Personalization badges */}
          {item.badges && item.badges.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
              {item.badges.map((b, i) => (
                <PersonalizationBadge key={i} badge={b} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function ReleasesPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('theaters');

  const loadWeek = useCallback(async (offset) => {
    setLoading(true);
    try {
      const result = await fetchReleaseWeek(offset);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeek(weekOffset);
  }, [weekOffset, loadWeek]);

  const theaters = data?.theaters || [];
  const streaming = data?.streaming || {};
  const streamingPlatforms = Object.keys(streaming);
  const personalizedCount = data?.personalization?.people_count || 0;

  // Count items with personalization badges
  const theaterBadgeCount = theaters.filter(t => t.badges && t.badges.length > 0).length;
  const streamBadgeCount = Object.values(streaming).flat().filter(s => s.badges && s.badges.length > 0).length;

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1>Release Tracker</h1>
        <p className="text-secondary">New movies and TV — personalized with your Entertainment Ranker data</p>
      </div>

      {/* Week navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
      }}>
        <button className="btn btn-sm" onClick={() => setWeekOffset(weekOffset - 1)}>
          &larr; Previous
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className="font-semibold" style={{ fontSize: 14 }}>
            {data ? formatWeekRange(data.week_start, data.week_end) : 'Loading...'}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
            {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : weekOffset > 0 ? 'Next Week' : `${Math.abs(weekOffset)} weeks ago`}
            {personalizedCount > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--accent)' }}>
                {personalizedCount} people tracked
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => setWeekOffset(weekOffset + 1)}>
          Next &rarr;
        </button>
      </div>

      {/* Section tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button
          className={`tab${section === 'theaters' ? ' tab-active' : ''}`}
          onClick={() => setSection('theaters')}
        >
          In Theaters
          {theaterBadgeCount > 0 && (
            <span className="badge badge-green" style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px' }}>
              {theaterBadgeCount}
            </span>
          )}
        </button>
        <button
          className={`tab${section === 'streaming' ? ' tab-active' : ''}`}
          onClick={() => setSection('streaming')}
        >
          Streaming
          {streamBadgeCount > 0 && (
            <span className="badge badge-green" style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px' }}>
              {streamBadgeCount}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" />Loading releases...</div>
      ) : (
        <>
          {/* ═══ IN THEATERS ═══ */}
          {section === 'theaters' && (
            theaters.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <p>No theatrical releases found for this week.</p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
                {theaters.map((m, i) => (
                  <ReleaseCard key={m.tmdb_id || i} item={m} />
                ))}
              </div>
            )
          )}

          {/* ═══ STREAMING ═══ */}
          {section === 'streaming' && (
            streamingPlatforms.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p>No streaming releases found for this week.</p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {streamingPlatforms.map(platform => {
                  const items = streaming[platform] || [];
                  const platformBadges = items.filter(s => s.badges && s.badges.length > 0).length;
                  const color = PLATFORM_COLORS[platform] || 'var(--accent)';

                  return (
                    <div key={platform}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: color, flexShrink: 0,
                        }} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{platform}</h3>
                        <span className="text-xs text-muted">{items.length} titles</span>
                        {platformBadges > 0 && (
                          <span className="badge badge-green" style={{ fontSize: 9, padding: '1px 5px' }}>
                            {platformBadges} personalized
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
                        {items.map((item, i) => (
                          <ReleaseCard key={item.tmdb_id || i} item={item} compact />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
