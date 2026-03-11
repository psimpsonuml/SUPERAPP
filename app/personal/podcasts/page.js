'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  searchPodcasts, fetchPodcastSubscriptions, subscribePodcast, unsubscribePodcast,
  fetchPodcastEpisodes, fetchPodcastEpisode, ratePodcastEpisode,
  fetchPodcastRatings, fetchPodcastHosts, fetchPodcastHostDetail,
  fetchPodcastQueue, fetchPodcastStats, fetchPodcastRecommendations,
} from '../../../lib/api';

const CATEGORY_COLORS = {
  tech: '#3b82f6',
  business: '#10b981',
  history: '#f59e0b',
  true_crime: '#ef4444',
  comedy: '#8b5cf6',
  personal_finance: '#06b6d4',
  ai: '#ec4899',
  gaming: '#84cc16',
};

const TABS = [
  { id: 'shows', label: 'My Shows' },
  { id: 'queue', label: 'Queue' },
  { id: 'ratings', label: 'Ratings' },
  { id: 'hosts', label: 'Hosts' },
  { id: 'discover', label: 'Discover' },
];

function scoreColor(s) {
  if (s >= 8) return '#10b981';
  if (s >= 5) return '#f59e0b';
  return '#ef4444';
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || '#6b7280';
}

// ── Styles ──────────────────────────────────────────────────

const styles = {
  page: { minHeight: '100vh', background: '#1a1a2e', color: '#e2e8f0', padding: '24px 32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#94a3b8' },
  tabBar: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #2d2d4a', paddingBottom: 0 },
  tab: (active) => ({ padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: active ? '#fff' : '#94a3b8', background: active ? '#2d2d4a' : 'transparent', border: 'none', borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent', borderRadius: '8px 8px 0 0', transition: 'all 0.2s' }),
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  statCard: { background: '#16213e', borderRadius: 12, padding: '16px 20px', border: '1px solid #2d2d4a' },
  statValue: { fontSize: 24, fontWeight: 700, color: '#fff' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card: { background: '#16213e', borderRadius: 12, border: '1px solid #2d2d4a', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s' },
  cardImage: { width: '100%', height: 160, objectFit: 'cover', display: 'block', background: '#0f0f23' },
  cardBody: { padding: '14px 16px' },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardMeta: { fontSize: 12, color: '#94a3b8' },
  badge: (color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + '22', color: color, marginLeft: 8 }),
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  listItem: { display: 'flex', alignItems: 'center', gap: 16, background: '#16213e', borderRadius: 10, padding: '12px 16px', border: '1px solid #2d2d4a' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' },
  th: { textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  td: { padding: '12px 14px', fontSize: 14, color: '#e2e8f0', background: '#16213e' },
  searchBar: { display: 'flex', gap: 8, marginBottom: 20 },
  input: { flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #2d2d4a', background: '#0f0f23', color: '#e2e8f0', fontSize: 14, outline: 'none' },
  btn: (color = '#3b82f6') => ({ padding: '10px 20px', borderRadius: 8, border: 'none', background: color, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s' }),
  btnSmall: (color = '#3b82f6') => ({ padding: '6px 12px', borderRadius: 6, border: 'none', background: color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }),
  modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#1a1a2e', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 500, border: '1px solid #2d2d4a', maxHeight: '90vh', overflowY: 'auto' },
  slider: { width: '100%', accentColor: '#3b82f6', marginTop: 8 },
  tag: (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: color + '22', color: color, marginRight: 6, marginBottom: 4 }),
  empty: { textAlign: 'center', padding: 48, color: '#64748b', fontSize: 14 },
  categoryChips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  chip: (active, color) => ({ padding: '6px 14px', borderRadius: 16, border: `1px solid ${active ? color : '#2d2d4a'}`, background: active ? color + '22' : 'transparent', color: active ? color : '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }),
  noImage: { width: '100%', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f23', color: '#4a5568', fontSize: 40 },
};

// ── Rate Episode Modal ──────────────────────────────────────

function RateModal({ episode, onClose, onRate }) {
  const [score, setScore] = useState(7);
  const [host, setHost] = useState('');
  const [guestInput, setGuestInput] = useState('');
  const [guests, setGuests] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addGuest = () => {
    const trimmed = guestInput.trim();
    if (trimmed && !guests.includes(trimmed)) {
      setGuests([...guests, trimmed]);
      setGuestInput('');
    }
  };

  const removeGuest = (g) => setGuests(guests.filter(x => x !== g));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onRate(episode.id, { score, host, guests, notes });
      onClose();
    } catch (e) {
      console.error('Rate error:', e);
    }
    setSubmitting(false);
  };

  if (!episode) return null;

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Rate Episode</h3>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{episode.title}</p>

        {/* Score Slider */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Score</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: scoreColor(score) }}>{score}</span>
          </div>
          <input type="range" min="1" max="10" value={score} onChange={e => setScore(parseInt(e.target.value))} style={styles.slider} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a5568' }}>
            <span>1</span><span>5</span><span>10</span>
          </div>
        </div>

        {/* Host */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Host</label>
          <input type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="Host name" style={{ ...styles.input, flex: 'none', width: '100%' }} />
        </div>

        {/* Guests */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Guests</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={guestInput} onChange={e => setGuestInput(e.target.value)} placeholder="Guest name" style={styles.input} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuest())} />
            <button onClick={addGuest} style={styles.btnSmall()}>Add</button>
          </div>
          {guests.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {guests.map(g => (
                <span key={g} style={{ ...styles.tag('#8b5cf6'), cursor: 'pointer' }} onClick={() => removeGuest(g)}>{g} x</span>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} style={{ ...styles.input, flex: 'none', width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...styles.btn('#4a5568'), background: 'transparent', border: '1px solid #2d2d4a' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} style={styles.btn()}>{submitting ? 'Saving...' : 'Rate Episode'}</button>
        </div>
      </div>
    </div>
  );
}

// ── My Shows Tab ────────────────────────────────────────────

function MyShowsTab({ subscriptions, onSelectPodcast, onUnsubscribe }) {
  const [expanded, setExpanded] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEps, setLoadingEps] = useState(false);

  const toggleExpand = async (podcastId) => {
    if (expanded === podcastId) { setExpanded(null); return; }
    setExpanded(podcastId);
    setLoadingEps(true);
    try {
      const res = await fetchPodcastEpisodes({ podcast_id: podcastId, limit: 10 });
      setEpisodes(res.episodes || []);
    } catch (e) { console.error(e); }
    setLoadingEps(false);
  };

  if (!subscriptions.length) return <div style={styles.empty}>No subscriptions yet. Discover podcasts to get started.</div>;

  return (
    <div>
      <div style={styles.grid}>
        {subscriptions.map(sub => {
          const podcast = sub.podcasts || sub;
          const catColor = categoryColor(podcast.category);
          const isExpanded = expanded === sub.podcast_id;
          return (
            <div key={sub.id} style={{ ...styles.card, borderColor: isExpanded ? catColor : '#2d2d4a' }}>
              <div onClick={() => toggleExpand(sub.podcast_id)}>
                {podcast.image_url ? (
                  <img src={podcast.image_url} alt={podcast.title} style={styles.cardImage} />
                ) : (
                  <div style={styles.noImage}>&#127911;</div>
                )}
                <div style={styles.cardBody}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={styles.cardTitle}>{podcast.title}</div>
                    {sub.unplayed_count > 0 && (
                      <span style={styles.badge('#3b82f6')}>{sub.unplayed_count} new</span>
                    )}
                  </div>
                  <div style={styles.cardMeta}>{podcast.author}</div>
                  {podcast.category && <span style={styles.tag(catColor)}>{podcast.category}</span>}
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid #2d2d4a', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Recent Episodes</span>
                    <button onClick={(e) => { e.stopPropagation(); onUnsubscribe(sub.podcast_id); }} style={{ ...styles.btnSmall('#ef4444'), background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }}>Unsubscribe</button>
                  </div>
                  {loadingEps ? (
                    <div style={{ color: '#64748b', fontSize: 13, padding: 8 }}>Loading...</div>
                  ) : episodes.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13, padding: 8 }}>No episodes found</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {episodes.map(ep => (
                        <div key={ep.id} onClick={() => onSelectPodcast(ep)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 6, background: '#0f0f23', cursor: 'pointer' }}>
                          <div>
                            <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{ep.title}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{formatDate(ep.published_at)} {ep.duration_seconds ? `- ${formatDuration(ep.duration_seconds)}` : ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Queue Tab ───────────────────────────────────────────────

function QueueTab({ onSelectEpisode }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPodcastQueue().then(res => setQueue(res.queue || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.empty}>Loading queue...</div>;
  if (!queue.length) return <div style={styles.empty}>Your queue is empty. Subscribe to podcasts to see new episodes here.</div>;

  return (
    <div style={styles.list}>
      {queue.map(ep => {
        const podcast = ep.podcasts || {};
        const catColor = categoryColor(podcast.category);
        return (
          <div key={ep.id} style={styles.listItem}>
            <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#0f0f23', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {podcast.image_url ? (
                <img src={podcast.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 20, color: '#4a5568' }}>&#127911;</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {podcast.title} {ep.duration_seconds ? `- ${formatDuration(ep.duration_seconds)}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{formatDate(ep.published_at)}</div>
            </div>
            {podcast.category && <span style={styles.tag(catColor)}>{podcast.category}</span>}
            <button onClick={() => onSelectEpisode(ep)} style={styles.btnSmall()}>Rate</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Ratings Tab ─────────────────────────────────────────────

function RatingsTab({ onSelectEpisode }) {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterShow, setFilterShow] = useState('');
  const [filterMinScore, setFilterMinScore] = useState('');
  const [filterMaxScore, setFilterMaxScore] = useState('');

  const loadRatings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterShow) params.show = filterShow;
      if (filterMinScore) params.min_score = filterMinScore;
      if (filterMaxScore) params.max_score = filterMaxScore;
      const res = await fetchPodcastRatings(params);
      setRatings(res.ratings || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterShow, filterMinScore, filterMaxScore]);

  useEffect(() => { loadRatings(); }, [loadRatings]);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input type="text" value={filterShow} onChange={e => setFilterShow(e.target.value)} placeholder="Filter by show..." style={{ ...styles.input, maxWidth: 200 }} />
        <input type="number" value={filterMinScore} onChange={e => setFilterMinScore(e.target.value)} placeholder="Min score" min="1" max="10" style={{ ...styles.input, maxWidth: 110 }} />
        <input type="number" value={filterMaxScore} onChange={e => setFilterMaxScore(e.target.value)} placeholder="Max score" min="1" max="10" style={{ ...styles.input, maxWidth: 110 }} />
      </div>

      {loading ? <div style={styles.empty}>Loading ratings...</div> : ratings.length === 0 ? (
        <div style={styles.empty}>No ratings yet. Rate episodes to track your listening.</div>
      ) : (
        <div style={styles.list}>
          {ratings.map(r => {
            const ep = r.podcast_episodes || {};
            const podcast = ep.podcasts || {};
            const catColor = categoryColor(podcast.category);
            const guestsArr = ep.guests_json || [];
            return (
              <div key={r.id} style={styles.listItem}>
                <div style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor(r.score) + '22', color: scoreColor(r.score), fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                  {r.score}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{ep.title || 'Unknown episode'}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{podcast.title} {podcast.author ? `- ${podcast.author}` : ''}</div>
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {podcast.category && <span style={styles.tag(catColor)}>{podcast.category}</span>}
                    {guestsArr.map((g, i) => {
                      const name = typeof g === 'string' ? g : g.name;
                      return <span key={i} style={styles.tag('#8b5cf6')}>{name}</span>;
                    })}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(r.rated_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Hosts Tab ───────────────────────────────────────────────

function HostsTab() {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHost, setSelectedHost] = useState(null);
  const [hostDetail, setHostDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchPodcastHosts().then(res => setHosts(res.hosts || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  const showHostDetail = async (name) => {
    setSelectedHost(name);
    setDetailLoading(true);
    try {
      const res = await fetchPodcastHostDetail(name);
      setHostDetail(res);
    } catch (e) { console.error(e); }
    setDetailLoading(false);
  };

  if (loading) return <div style={styles.empty}>Loading hosts...</div>;
  if (!hosts.length) return <div style={styles.empty}>No host data yet. Rate episodes and tag hosts to build your leaderboard.</div>;

  if (selectedHost) {
    const profiles = hostDetail?.profile || [];
    const episodes = hostDetail?.episodes || [];
    return (
      <div>
        <button onClick={() => { setSelectedHost(null); setHostDetail(null); }} style={{ ...styles.btnSmall('#4a5568'), marginBottom: 16, background: 'transparent', border: '1px solid #2d2d4a', color: '#94a3b8' }}>Back to Leaderboard</button>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{selectedHost}</h3>
        {profiles.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 24, marginBottom: 16, marginTop: 8 }}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{parseFloat(p.composite_score).toFixed(1)}</div>
              <div style={styles.statLabel}>Composite ({p.role})</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{p.episodes_rated}</div>
              <div style={styles.statLabel}>Episodes Rated</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{parseFloat(p.avg_score).toFixed(1)}</div>
              <div style={styles.statLabel}>Avg Score</div>
            </div>
          </div>
        ))}
        {detailLoading ? <div style={styles.empty}>Loading episodes...</div> : (
          <div style={styles.list}>
            {episodes.map(r => {
              const ep = r.podcast_episodes || {};
              const podcast = ep.podcasts || {};
              return (
                <div key={r.id} style={styles.listItem}>
                  <div style={{ width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: scoreColor(r.score) + '22', color: scoreColor(r.score), fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{r.score}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>{ep.title}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{podcast.title}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{formatDate(r.rated_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Rank</th>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Composite Score</th>
            <th style={styles.th}>Episodes Rated</th>
            <th style={styles.th}>Avg Score</th>
          </tr>
        </thead>
        <tbody>
          {hosts.map((h, i) => (
            <tr key={h.id} onClick={() => showHostDetail(h.person_name)} style={{ cursor: 'pointer' }}>
              <td style={{ ...styles.td, borderRadius: '8px 0 0 8px', fontWeight: 700, color: '#64748b' }}>{i + 1}</td>
              <td style={{ ...styles.td, fontWeight: 600, color: '#fff' }}>{h.person_name}</td>
              <td style={styles.td}>
                <span style={styles.tag(h.role === 'host' ? '#3b82f6' : '#8b5cf6')}>{h.role}</span>
              </td>
              <td style={{ ...styles.td, fontWeight: 600, color: scoreColor(parseFloat(h.avg_score)) }}>{parseFloat(h.composite_score).toFixed(1)}</td>
              <td style={styles.td}>{h.episodes_rated}</td>
              <td style={{ ...styles.td, borderRadius: '0 8px 8px 0' }}>{parseFloat(h.avg_score).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Discover Tab ────────────────────────────────────────────

function DiscoverTab({ onSubscribe }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [basedOn, setBasedOn] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(null);

  useEffect(() => {
    fetchPodcastRecommendations()
      .then(res => {
        setRecommendations(res.recommendations || []);
        setBasedOn(res.based_on || []);
      })
      .catch(console.error);
  }, []);

  const doSearch = async () => {
    if (!query && !category) return;
    setLoading(true);
    try {
      const res = await searchPodcasts({ q: query, category });
      setResults(res.results || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSubscribe = async (podcast) => {
    setSubscribing(podcast.id || podcast.podcast_index_id);
    try {
      await onSubscribe(podcast);
    } catch (e) { console.error(e); }
    setSubscribing(null);
  };

  const categories = Object.entries(CATEGORY_COLORS);

  return (
    <div>
      {/* Search */}
      <div style={styles.searchBar}>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search podcasts..." style={styles.input} onKeyDown={e => e.key === 'Enter' && doSearch()} />
        <button onClick={doSearch} style={styles.btn()}>Search</button>
      </div>

      {/* Category browse */}
      <div style={styles.categoryChips}>
        {categories.map(([cat, color]) => (
          <button key={cat} onClick={() => { setCategory(category === cat ? '' : cat); }} style={styles.chip(category === cat, color)}>
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Search results */}
      {loading ? <div style={styles.empty}>Searching...</div> : results.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Search Results</h3>
          <div style={styles.grid}>
            {results.map((p, i) => {
              const catColor = categoryColor(p.category);
              const key = p.id || p.podcast_index_id || i;
              return (
                <div key={key} style={styles.card}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} style={styles.cardImage} />
                  ) : (
                    <div style={styles.noImage}>&#127911;</div>
                  )}
                  <div style={styles.cardBody}>
                    <div style={styles.cardTitle}>{p.title}</div>
                    <div style={styles.cardMeta}>{p.author}</div>
                    {p.category && <span style={styles.tag(catColor)}>{p.category}</span>}
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>
                    <button onClick={() => handleSubscribe(p)} disabled={subscribing === (p.id || p.podcast_index_id)} style={{ ...styles.btnSmall('#10b981'), marginTop: 10, width: '100%' }}>
                      {subscribing === (p.id || p.podcast_index_id) ? 'Subscribing...' : 'Subscribe'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Recommended For You</h3>
          {basedOn.length > 0 && (
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              Based on: {basedOn.map(b => b.name).join(', ')}
            </p>
          )}
          <div style={styles.grid}>
            {recommendations.map((p, i) => {
              const catColor = categoryColor(p.category);
              return (
                <div key={p.id || i} style={styles.card}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} style={styles.cardImage} />
                  ) : (
                    <div style={styles.noImage}>&#127911;</div>
                  )}
                  <div style={styles.cardBody}>
                    <div style={styles.cardTitle}>{p.title}</div>
                    <div style={styles.cardMeta}>{p.author}</div>
                    {p.category && <span style={styles.tag(catColor)}>{p.category}</span>}
                    <button onClick={() => handleSubscribe(p)} disabled={subscribing === p.id} style={{ ...styles.btnSmall('#10b981'), marginTop: 10, width: '100%' }}>
                      {subscribing === p.id ? 'Subscribing...' : 'Subscribe'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && results.length === 0 && recommendations.length === 0 && (
        <div style={styles.empty}>Search for podcasts or rate episodes to get personalized recommendations.</div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────

export default function PodcastsPage() {
  const [tab, setTab] = useState('shows');
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [rateEpisode, setRateEpisode] = useState(null);
  const loadedRef = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subsRes, statsRes] = await Promise.all([
        fetchPodcastSubscriptions(),
        fetchPodcastStats(),
      ]);
      setSubscriptions(subsRes.subscriptions || []);
      setStats(statsRes || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadData();
    }
  }, [loadData]);

  const handleRate = async (episodeId, { score, host, guests, notes }) => {
    await ratePodcastEpisode(episodeId, { score, host, guests, notes });
    loadData();
  };

  const handleSubscribe = async (podcast) => {
    await subscribePodcast({ podcast });
    loadData();
  };

  const handleUnsubscribe = async (podcastId) => {
    await unsubscribePodcast(podcastId);
    loadData();
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Podcasts</h1>
        <p style={styles.subtitle}>Track, rate, and discover podcasts with cascade scoring</p>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.total_rated || 0}</div>
          <div style={styles.statLabel}>Episodes Rated</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.hours_listened || 0}h</div>
          <div style={styles.statLabel}>Hours Listened</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.most_rated_show?.title || '-'}</div>
          <div style={styles.statLabel}>Most Rated Show{stats.most_rated_show ? ` (${stats.most_rated_show.count})` : ''}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.highest_rated_host?.person_name || '-'}</div>
          <div style={styles.statLabel}>Top Host{stats.highest_rated_host ? ` (${parseFloat(stats.highest_rated_host.avg_score).toFixed(1)})` : ''}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={styles.tab(tab === t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      {loading && tab === 'shows' ? (
        <div style={styles.empty}>Loading...</div>
      ) : (
        <>
          {tab === 'shows' && (
            <MyShowsTab subscriptions={subscriptions} onSelectPodcast={setRateEpisode} onUnsubscribe={handleUnsubscribe} />
          )}
          {tab === 'queue' && (
            <QueueTab onSelectEpisode={setRateEpisode} />
          )}
          {tab === 'ratings' && (
            <RatingsTab onSelectEpisode={setRateEpisode} />
          )}
          {tab === 'hosts' && (
            <HostsTab />
          )}
          {tab === 'discover' && (
            <DiscoverTab onSubscribe={handleSubscribe} />
          )}
        </>
      )}

      {/* Rate Modal */}
      {rateEpisode && (
        <RateModal episode={rateEpisode} onClose={() => setRateEpisode(null)} onRate={handleRate} />
      )}
    </div>
  );
}
