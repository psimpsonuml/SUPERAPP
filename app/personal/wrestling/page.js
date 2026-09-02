'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchWrestlingFavorites, addWrestlingFavorite, removeWrestlingFavorite,
  fetchWrestlingEvents, fetchWrestlingMatches,
  fetchWrestlingRatings, rateWrestlingMatch,
  fetchWrestlingWrestlers, fetchWrestlingWrestlerDetail,
  fetchWrestlingStats, fetchWrestlingMyStats,
} from '../../../lib/api';

// ── Config ───────────────────────────────────────────────
const PROMOTIONS = {
  WWE: { label: 'WWE', color: '#dc2626' },
  AEW: { label: 'AEW', color: '#eab308' },
  NJPW: { label: 'NJPW', color: '#dc2626' },
  TNA: { label: 'TNA', color: '#0ea5e9' },
  ROH: { label: 'ROH', color: '#7c3aed' },
  GCW: { label: 'GCW', color: '#f97316' },
};

const FAVORITE_TYPES = ['wrestler', 'promotion', 'tag_team', 'stable'];
const PARTICIPANT_ROLES = ['winner', 'loser', 'participant'];
const TABS = ['Dashboard', 'Results', 'My Ratings', 'Wrestler Rankings', 'Statistics', 'Favorites'];

function promoBadge(promotion) {
  const cfg = PROMOTIONS[promotion];
  if (!cfg) return { background: '#33334a', color: '#aaa' };
  return { background: `${cfg.color}22`, color: cfg.color };
}

function scoreColor(s) {
  if (s >= 8) return '#22c55e';
  if (s >= 5) return '#eab308';
  return '#ef4444';
}

function fmtDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Styles ───────────────────────────────────────────────
const S = {
  page: { padding: 24, maxWidth: 1200, margin: '0 auto', color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  card: { background: '#1a1a2e', borderRadius: 10, padding: 20, marginBottom: 16, border: '1px solid #2a2a4a' },
  cardTitle: { fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#fff' },
  tabs: { display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #2a2a4a', flexWrap: 'wrap' },
  tab: (active) => ({
    padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14,
    color: active ? '#818cf8' : '#888', borderBottom: active ? '2px solid #818cf8' : '2px solid transparent',
    background: 'transparent', border: 'none', borderBottomStyle: 'solid',
  }),
  btn: { padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: '#818cf8', color: '#fff' },
  btnSm: { padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11, background: '#818cf8', color: '#fff' },
  btnDanger: { padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 11, background: '#ef4444', color: '#fff' },
  input: { padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2a4a', background: '#16162a', color: '#e0e0e0', fontSize: 13, width: '100%' },
  select: { padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2a4a', background: '#16162a', color: '#e0e0e0', fontSize: 13 },
  muted: { color: '#888', fontSize: 12 },
  statCard: { background: '#16162a', borderRadius: 8, padding: 16, textAlign: 'center', flex: 1, minWidth: 140 },
  statVal: { fontSize: 28, fontWeight: 800, color: '#818cf8' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#1a1a2e', borderRadius: 12, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #2a2a4a' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #2a2a4a', color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { padding: '8px 12px', borderBottom: '1px solid #1a1a2e' },
  badge: (style) => ({ ...style, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }),
};

// ── Rate Match Modal ─────────────────────────────────────
function RateMatchModal({ show, onClose, onSave, match }) {
  const [score, setScore] = useState(5);
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('winner');
  const [promotion, setPromotion] = useState('WWE');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!show) return;
    setScore(match?.my_score || 5);
    setNotes('');
    setParticipants(match?.participants_json || []);
    setPromotion(match?.promotion || 'WWE');
    setEventName(match?.event_name || '');
    setEventDate(match?.event_date || new Date().toISOString().slice(0, 10));
    setDescription(match?.match_type || '');
  }, [show, match]);

  if (!show) return null;

  function addParticipant() {
    if (!newName.trim()) return;
    setParticipants([...participants, { name: newName.trim(), role: newRole, team: '' }]);
    setNewName('');
  }

  function submit() {
    onSave({
      match_id: match?.id || null,
      promotion,
      event_name: eventName,
      event_date: eventDate,
      match_description: description,
      score,
      participants,
      notes,
    });
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalContent} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, fontSize: 20, color: '#fff' }}>
          {match?.id ? 'Rate Match' : 'Rate a Match'}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.muted}>Promotion</label>
            <select style={{ ...S.select, width: '100%' }} value={promotion} onChange={e => setPromotion(e.target.value)}>
              {Object.keys(PROMOTIONS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={S.muted}>Date</label>
            <input type="date" style={S.input} value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={S.muted}>Event</label>
          <input style={S.input} value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Raw, Dynamite, WrestleMania..." />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={S.muted}>Match</label>
          <input style={S.input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Singles match, ladder match..." />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={S.muted}>Rating: <strong style={{ color: scoreColor(score), fontSize: 16 }}>{score}/10</strong></label>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setScore(n)} style={{
                width: 36, height: 36, borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                border: score === n ? '2px solid #818cf8' : '1px solid #2a2a4a',
                background: score === n ? '#818cf8' : '#16162a',
                color: score === n ? '#fff' : '#888',
              }}>{n}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={S.muted}>Participants (drives wrestler rankings)</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input style={{ ...S.input, flex: 2 }} value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Wrestler name" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addParticipant(); } }} />
            <select style={S.select} value={newRole} onChange={e => setNewRole(e.target.value)}>
              {PARTICIPANT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button style={S.btnSm} onClick={addParticipant}>Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {participants.map((p, i) => (
              <span key={i} style={{
                background: '#16162a', border: '1px solid #2a2a4a', borderRadius: 12,
                padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {p.name} <span style={S.muted}>({p.role})</span>
                <button onClick={() => setParticipants(participants.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={S.muted}>Notes</label>
          <textarea style={{ ...S.input, minHeight: 70 }} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Match of the year candidate..." />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ ...S.btn, background: '#33334a' }} onClick={onClose}>Cancel</button>
          <button style={S.btn} onClick={submit}>Save Rating</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────
export default function WrestlingPage() {
  const [tab, setTab] = useState('Dashboard');
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [events, setEvents] = useState([]);
  const [matches, setMatches] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [wrestlers, setWrestlers] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsMeta, setStatsMeta] = useState(null);
  const [myStats, setMyStats] = useState(null);

  const [showRateModal, setShowRateModal] = useState(false);
  const [rateTarget, setRateTarget] = useState(null);
  const [wrestlerDetail, setWrestlerDetail] = useState(null);
  const [expandedMatch, setExpandedMatch] = useState(null);

  const [filterPromotion, setFilterPromotion] = useState('');
  const [newFavName, setNewFavName] = useState('');
  const [newFavType, setNewFavType] = useState('wrestler');
  const [newFavPromo, setNewFavPromo] = useState('WWE');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [favs, evts, mtchs, rtgs, wrstlrs, st, mySt] = await Promise.all([
      fetchWrestlingFavorites().catch(() => ({ favorites: [] })),
      fetchWrestlingEvents({ promotion: filterPromotion }).catch(() => ({ events: [] })),
      fetchWrestlingMatches({ promotion: filterPromotion }).catch(() => ({ matches: [] })),
      fetchWrestlingRatings({ promotion: filterPromotion }).catch(() => ({ ratings: [] })),
      fetchWrestlingWrestlers({ promotion: filterPromotion }).catch(() => ({ wrestlers: [] })),
      fetchWrestlingStats().catch(() => ({ stats: null })),
      fetchWrestlingMyStats().catch(() => null),
    ]);
    setFavorites(favs.favorites || []);
    setEvents(evts.events || []);
    setMatches(mtchs.matches || []);
    setRatings(rtgs.ratings || []);
    setWrestlers(wrstlrs.wrestlers || []);
    setStats(st.stats || null);
    setStatsMeta({ computed_at: st.computed_at, period_start: st.period_start, period_end: st.period_end });
    setMyStats(mySt);
    setLoading(false);
  }, [filterPromotion]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSaveRating(data) {
    try {
      await rateWrestlingMatch(data);
      setShowRateModal(false);
      setRateTarget(null);
      loadData();
    } catch (err) {
      alert(`Could not save rating: ${err.message}`);
    }
  }

  async function handleAddFavorite(e) {
    e.preventDefault();
    if (!newFavName.trim()) return;
    try {
      await addWrestlingFavorite({ favorite_type: newFavType, name: newFavName.trim(), promotion: newFavPromo });
      setNewFavName('');
      loadData();
    } catch (err) {
      alert(`Could not add favorite: ${err.message}`);
    }
  }

  async function handleRemoveFavorite(id) {
    try {
      await removeWrestlingFavorite(id);
      loadData();
    } catch (err) {
      alert(`Could not remove favorite: ${err.message}`);
    }
  }

  async function handleWrestlerClick(name) {
    try {
      const detail = await fetchWrestlingWrestlerDetail(name);
      setWrestlerDetail(detail);
    } catch {
      setWrestlerDetail(null);
    }
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: '#fff' }}>Wrestling Tracker</h1>
          <p style={{ ...S.muted, margin: '4px 0 0' }}>
            WWE · AEW · NJPW · TNA · ROH · GCW — results scraped weekly
          </p>
        </div>
        <button style={S.btn} onClick={() => { setRateTarget(null); setShowRateModal(true); }}>
          + Rate Match
        </button>
      </div>

      {/* Season stat strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={S.statCard}>
          <div style={S.statVal}>{myStats?.total_rated ?? 0}</div>
          <div style={S.statLabel}>Matches Rated</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statVal}>{myStats?.avg_score ?? '—'}</div>
          <div style={S.statLabel}>Avg Rating</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statVal}>{stats?.totalMatches ?? 0}</div>
          <div style={S.statLabel}>Matches Tracked</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statVal}>{wrestlers.length}</div>
          <div style={S.statLabel}>Wrestlers Ranked</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {loading && <div style={{ ...S.muted, padding: 40, textAlign: 'center' }}>Loading wrestling data...</div>}

      {/* ── Dashboard ── */}
      {!loading && tab === 'Dashboard' && (
        <>
          <div style={S.card}>
            <div style={S.cardTitle}>Recent Events</div>
            {events.length === 0 ? (
              <div style={S.muted}>
                No events yet. The wrestling scraper runs weekly (Tuesdays 5:00 AM ET) and will populate results here.
              </div>
            ) : (
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Promotion</th>
                    <th style={S.th}>Event</th>
                    <th style={S.th}>Type</th>
                    <th style={S.th}>Venue</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 10).map(ev => (
                    <tr key={ev.id}>
                      <td style={S.td}>{ev.event_date}</td>
                      <td style={S.td}><span style={S.badge(promoBadge(ev.promotion))}>{ev.promotion}</span></td>
                      <td style={S.td}>{ev.event_name}</td>
                      <td style={S.td}><span style={S.muted}>{ev.event_type}</span></td>
                      <td style={S.td}><span style={S.muted}>{ev.venue || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {stats?.mostWins?.length > 0 && (
            <div style={S.card}>
              <div style={S.cardTitle}>Hot Streak — Most Wins (last 90 days)</div>
              {stats.mostWins.slice(0, 5).map((w, i) => (
                <div key={w.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <span style={{ width: 22, color: i < 3 ? '#eab308' : '#888', fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ flex: 1 }}>{w.name}</span>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>{w.count} wins</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Results ── */}
      {!loading && tab === 'Results' && (
        <div style={S.card}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <select style={S.select} value={filterPromotion} onChange={e => setFilterPromotion(e.target.value)}>
              <option value="">All Promotions</option>
              {Object.keys(PROMOTIONS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {filterPromotion && <button style={S.btnSm} onClick={() => setFilterPromotion('')}>Clear</button>}
          </div>

          {matches.length === 0 ? (
            <div style={S.muted}>No scraped matches yet.</div>
          ) : matches.map(m => (
            <div key={m.id} style={{ borderBottom: '1px solid #2a2a4a', padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => setExpandedMatch(expandedMatch === m.id ? null : m.id)}>
                <span style={S.badge(promoBadge(m.promotion))}>{m.promotion}</span>
                <span style={{ flex: 1, fontSize: 13 }}>
                  {m.winner ? <><strong>{m.winner}</strong> def. {(m.participants_json || []).filter(p => p.role === 'loser').map(p => p.name).join(', ')}</> : m.match_type}
                </span>
                {m.title_match && <span style={S.badge({ background: '#eab30822', color: '#eab308' })}>TITLE</span>}
                <span style={S.muted}>{m.event_date}</span>
                {m.my_score != null
                  ? <span style={{ color: scoreColor(m.my_score), fontWeight: 700 }}>{m.my_score}/10</span>
                  : <button style={S.btnSm} onClick={e => { e.stopPropagation(); setRateTarget(m); setShowRateModal(true); }}>Rate</button>}
              </div>
              {expandedMatch === m.id && (
                <div style={{ padding: '10px 0 4px 12px', fontSize: 12, color: '#aaa' }}>
                  <div><strong>Event:</strong> {m.event_name}</div>
                  <div><strong>Type:</strong> {m.match_type}{m.stipulation ? ` · ${m.stipulation}` : ''}</div>
                  {m.title_name && <div><strong>Title:</strong> {m.title_name}</div>}
                  <div><strong>Duration:</strong> {fmtDuration(m.duration_seconds)}</div>
                  <div style={{ marginTop: 6 }}>
                    {(m.participants_json || []).map((p, i) => (
                      <span key={i} style={{ marginRight: 10 }}>
                        {p.name} <span style={S.muted}>({p.role})</span>
                      </span>
                    ))}
                  </div>
                  {m.source_url && (
                    <a href={m.source_url} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#818cf8', fontSize: 11 }}>Source →</a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── My Ratings ── */}
      {!loading && tab === 'My Ratings' && (
        <div style={S.card}>
          <div style={S.cardTitle}>My Rated Matches</div>
          {ratings.length === 0 ? (
            <div style={S.muted}>No ratings yet. Rate a match from the Results tab or use “+ Rate Match”.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Date</th>
                  <th style={S.th}>Promotion</th>
                  <th style={S.th}>Event</th>
                  <th style={S.th}>Match</th>
                  <th style={S.th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {ratings.map(r => (
                  <tr key={r.id}>
                    <td style={S.td}>{r.event_date}</td>
                    <td style={S.td}><span style={S.badge(promoBadge(r.promotion))}>{r.promotion}</span></td>
                    <td style={S.td}>{r.event_name || '—'}</td>
                    <td style={S.td}>{r.match_description || '—'}</td>
                    <td style={{ ...S.td, color: scoreColor(r.score), fontWeight: 700 }}>{r.score}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Wrestler Rankings ── */}
      {!loading && tab === 'Wrestler Rankings' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={S.cardTitle}>Cascade Rankings</div>
            <span style={S.muted}>Weighted: winner 1.0 · loser 0.8 · participant 0.6</span>
          </div>
          {wrestlers.length === 0 ? (
            <div style={S.muted}>No ranked wrestlers yet — rate some matches to build the leaderboard.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>#</th>
                  <th style={S.th}>Wrestler</th>
                  <th style={S.th}>Promotion</th>
                  <th style={S.th}>Composite</th>
                  <th style={S.th}>Matches</th>
                  <th style={S.th}>Avg</th>
                </tr>
              </thead>
              <tbody>
                {wrestlers.map((w, i) => (
                  <tr key={w.id} style={{ cursor: 'pointer' }} onClick={() => handleWrestlerClick(w.wrestler_name)}>
                    <td style={{ ...S.td, color: i < 3 ? '#eab308' : '#888', fontWeight: 700 }}>{i + 1}</td>
                    <td style={S.td}>{w.wrestler_name}</td>
                    <td style={S.td}>{w.promotion ? <span style={S.badge(promoBadge(w.promotion))}>{w.promotion}</span> : '—'}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: '#818cf8' }}>{w.composite_score}</td>
                    <td style={S.td}>{w.matches_rated}</td>
                    <td style={{ ...S.td, color: scoreColor(w.avg_score) }}>{w.avg_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Statistics ── */}
      {!loading && tab === 'Statistics' && (
        <>
          {!stats ? (
            <div style={S.card}>
              <div style={S.muted}>
                No statistics computed yet. The wrestling scraper builds these weekly from scraped results.
              </div>
            </div>
          ) : (
            <>
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={S.cardTitle}>Rolling 90-Day Statistics</div>
                  <span style={S.muted}>
                    {statsMeta?.period_start} → {statsMeta?.period_end}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                  <div style={S.statCard}>
                    <div style={S.statVal}>{stats.totalMatches}</div>
                    <div style={S.statLabel}>Matches</div>
                  </div>
                  <div style={S.statCard}>
                    <div style={S.statVal}>{stats.totalEvents}</div>
                    <div style={S.statLabel}>Events</div>
                  </div>
                  <div style={S.statCard}>
                    <div style={S.statVal}>{fmtDuration(stats.avgMatchDurationSec)}</div>
                    <div style={S.statLabel}>Avg Match</div>
                  </div>
                  <div style={S.statCard}>
                    <div style={{ ...S.statVal, fontSize: 18 }}>{stats.ironMan?.name || '—'}</div>
                    <div style={S.statLabel}>Iron Man</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                <StatList title="Most Wins" rows={stats.mostWins} suffix="wins" color="#22c55e" />
                <StatList title="Most Losses" rows={stats.mostLosses} suffix="losses" color="#ef4444" />
                <StatList title="Most Active" rows={stats.mostActive} suffix="matches" color="#818cf8" />
                <StatList title="Title Match Wins" rows={stats.titleWins} suffix="titles" color="#eab308" />
              </div>

              {stats.bestWinRate?.length > 0 && (
                <div style={S.card}>
                  <div style={S.cardTitle}>Best Win Rate (3+ matches)</div>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Wrestler</th>
                        <th style={S.th}>W</th>
                        <th style={S.th}>L</th>
                        <th style={S.th}>Matches</th>
                        <th style={S.th}>Win %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.bestWinRate.map(w => (
                        <tr key={w.name}>
                          <td style={S.td}>{w.name}</td>
                          <td style={{ ...S.td, color: '#22c55e' }}>{w.wins}</td>
                          <td style={{ ...S.td, color: '#ef4444' }}>{w.losses}</td>
                          <td style={S.td}>{w.matches}</td>
                          <td style={{ ...S.td, fontWeight: 700 }}>{w.winRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {stats.matchesByPromotion && (
                <div style={S.card}>
                  <div style={S.cardTitle}>Matches by Promotion</div>
                  {Object.entries(stats.matchesByPromotion).sort((a, b) => b[1] - a[1]).map(([promo, count]) => {
                    const max = Math.max(...Object.values(stats.matchesByPromotion), 1);
                    return (
                      <div key={promo} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ ...S.badge(promoBadge(promo)), minWidth: 54, textAlign: 'center' }}>{promo}</span>
                        <div style={{ flex: 1, background: '#16162a', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(count / max) * 100}%`, height: '100%',
                            background: PROMOTIONS[promo]?.color || '#818cf8',
                          }} />
                        </div>
                        <span style={{ minWidth: 40, textAlign: 'right', fontWeight: 700 }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Favorites ── */}
      {!loading && tab === 'Favorites' && (
        <div style={S.card}>
          <div style={S.cardTitle}>Favorites</div>
          <form onSubmit={handleAddFavorite} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <input style={{ ...S.input, flex: 2, minWidth: 180 }} value={newFavName}
              onChange={e => setNewFavName(e.target.value)} placeholder="Wrestler, promotion, tag team..." />
            <select style={S.select} value={newFavType} onChange={e => setNewFavType(e.target.value)}>
              {FAVORITE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <select style={S.select} value={newFavPromo} onChange={e => setNewFavPromo(e.target.value)}>
              {Object.keys(PROMOTIONS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button type="submit" style={S.btn}>Add</button>
          </form>

          {favorites.length === 0 ? (
            <div style={S.muted}>No favorites yet.</div>
          ) : FAVORITE_TYPES.map(type => {
            const group = favorites.filter(f => f.favorite_type === type);
            if (group.length === 0) return null;
            return (
              <div key={type} style={{ marginBottom: 16 }}>
                <div style={{ ...S.statLabel, marginBottom: 6 }}>{type.replace('_', ' ')}s</div>
                {group.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #1a1a2e' }}>
                    {f.promotion && <span style={S.badge(promoBadge(f.promotion))}>{f.promotion}</span>}
                    <span style={{ flex: 1 }}>{f.name}</span>
                    <button style={S.btnDanger} onClick={() => handleRemoveFavorite(f.id)}>Remove</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Wrestler detail modal */}
      {wrestlerDetail && (
        <div style={S.modal} onClick={() => setWrestlerDetail(null)}>
          <div style={S.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: '#fff' }}>
              {wrestlerDetail.wrestler?.wrestler_name || 'Wrestler'}
            </h2>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={S.statCard}>
                <div style={S.statVal}>{wrestlerDetail.wrestler?.composite_score ?? '—'}</div>
                <div style={S.statLabel}>Composite</div>
              </div>
              <div style={S.statCard}>
                <div style={S.statVal}>{wrestlerDetail.record?.wins ?? 0}-{wrestlerDetail.record?.losses ?? 0}</div>
                <div style={S.statLabel}>Record</div>
              </div>
              <div style={S.statCard}>
                <div style={S.statVal}>{wrestlerDetail.record?.win_pct ?? 0}%</div>
                <div style={S.statLabel}>Win Rate</div>
              </div>
            </div>

            <div style={S.cardTitle}>Match History</div>
            {(wrestlerDetail.matches || []).length === 0 ? (
              <div style={S.muted}>No tracked matches.</div>
            ) : wrestlerDetail.matches.slice(0, 20).map(m => {
              const role = (m.participants_json || []).find(p => p.name === wrestlerDetail.wrestler?.wrestler_name)?.role;
              return (
                <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a1a2e', fontSize: 12 }}>
                  <span style={S.badge(promoBadge(m.promotion))}>{m.promotion}</span>
                  <span style={{ flex: 1 }}>{m.event_name}</span>
                  <span style={{ color: role === 'winner' ? '#22c55e' : role === 'loser' ? '#ef4444' : '#888', fontWeight: 700 }}>
                    {role || '—'}
                  </span>
                  <span style={S.muted}>{m.event_date}</span>
                </div>
              );
            })}

            <button style={{ ...S.btn, marginTop: 20, width: '100%' }} onClick={() => setWrestlerDetail(null)}>Close</button>
          </div>
        </div>
      )}

      <RateMatchModal
        show={showRateModal}
        match={rateTarget}
        onClose={() => { setShowRateModal(false); setRateTarget(null); }}
        onSave={handleSaveRating}
      />
    </div>
  );
}

// ── Small leaderboard list ───────────────────────────────
function StatList({ title, rows, suffix, color }) {
  if (!rows || rows.length === 0) return null;
  const max = Math.max(...rows.map(r => r.count), 1);
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>{title}</div>
      {rows.slice(0, 8).map((r, i) => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ width: 20, color: i < 3 ? '#eab308' : '#888', fontWeight: 700, fontSize: 12 }}>{i + 1}</span>
          <span style={{ flex: 1, fontSize: 13 }}>{r.name}</span>
          <div style={{ width: 80, background: '#16162a', borderRadius: 4, height: 14, overflow: 'hidden' }}>
            <div style={{ width: `${(r.count / max) * 100}%`, height: '100%', background: color }} />
          </div>
          <span style={{ minWidth: 56, textAlign: 'right', fontSize: 12, color }}>{r.count} {suffix}</span>
        </div>
      ))}
    </div>
  );
}
