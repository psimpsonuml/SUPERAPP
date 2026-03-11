'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchSportsTeams, addSportsTeam, removeSportsTeam,
  fetchSportsSchedule, fetchSportsStandings,
  fetchSportsGames, rateSportsGame, updateSportsGame,
  fetchSportsPlayers, fetchSportsPlayerDetail,
  fetchSportsSeasonStats, fetchSportsToday,
} from '../../../lib/api';

// ── League Config ─────────────────────────────────────────
const LEAGUES = {
  NFL:              { label: 'NFL',               color: '#013369' },
  NBA:              { label: 'NBA',               color: '#1d428a' },
  NHL:              { label: 'NHL',               color: '#000000' },
  MLB:              { label: 'MLB',               color: '#002d72' },
  MLS:              { label: 'MLS',               color: '#80b214' },
  PremierLeague:    { label: 'Premier League',    color: '#3d195b' },
  CollegeFootball:  { label: 'College Football',  color: '#c41e3a' },
  CollegeBasketball:{ label: 'College Basketball', color: '#ff6600' },
};

const GAME_TYPES = ['regular', 'playoff', 'championship', 'rivalry'];
const PLAYER_ROLES = ['MVP', 'starter', 'standout'];

function leagueBadge(league) {
  const cfg = LEAGUES[league] || { label: league, color: '#555' };
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    background: cfg.color,
    letterSpacing: 0.5,
  };
}

function scoreColor(s) {
  if (s >= 8) return '#4ade80';
  if (s >= 5) return '#facc15';
  return '#f87171';
}

const S = {
  page: { padding: 24, maxWidth: 1200, margin: '0 auto', color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  card: { background: '#1a1a2e', borderRadius: 10, padding: 20, marginBottom: 16, border: '1px solid #2a2a4a' },
  cardTitle: { fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#fff' },
  tabs: { display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid #2a2a4a' },
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
};

// ── Helpers ──────────────────────────────────────────────
const ACCOUNT_ID = typeof window !== 'undefined'
  ? (localStorage.getItem('account_id') || 'demo-account')
  : 'demo-account';

// ── Rate Game Modal ─────────────────────────────────────
function RateGameModal({ show, onClose, onSave, editGame }) {
  const [league, setLeague] = useState(editGame?.league || 'NFL');
  const [homeTeam, setHomeTeam] = useState(editGame?.home_team || '');
  const [awayTeam, setAwayTeam] = useState(editGame?.away_team || '');
  const [homeScore, setHomeScore] = useState(editGame?.home_score ?? '');
  const [awayScore, setAwayScore] = useState(editGame?.away_score ?? '');
  const [gameDate, setGameDate] = useState(editGame?.game_date || new Date().toISOString().slice(0, 10));
  const [score, setScore] = useState(editGame?.score || 5);
  const [gameType, setGameType] = useState(editGame?.game_type || 'regular');
  const [notes, setNotes] = useState(editGame?.notes || '');
  const [players, setPlayers] = useState(editGame?.players_tagged_json || []);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState('standout');

  useEffect(() => {
    if (editGame) {
      setLeague(editGame.league || 'NFL');
      setHomeTeam(editGame.home_team || '');
      setAwayTeam(editGame.away_team || '');
      setHomeScore(editGame.home_score ?? '');
      setAwayScore(editGame.away_score ?? '');
      setGameDate(editGame.game_date || new Date().toISOString().slice(0, 10));
      setScore(editGame.score || 5);
      setGameType(editGame.game_type || 'regular');
      setNotes(editGame.notes || '');
      setPlayers(editGame.players_tagged_json || []);
    }
  }, [editGame]);

  if (!show) return null;

  function addPlayer() {
    if (!newPlayerName.trim()) return;
    setPlayers(prev => [...prev, { name: newPlayerName.trim(), role: newPlayerRole, score: 7 }]);
    setNewPlayerName('');
  }

  function removePlayer(idx) {
    setPlayers(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!homeTeam || !awayTeam || !gameDate) return;
    onSave({
      id: editGame?.id,
      league, home_team: homeTeam, away_team: awayTeam,
      home_score: homeScore !== '' ? parseInt(homeScore) : null,
      away_score: awayScore !== '' ? parseInt(awayScore) : null,
      game_date: gameDate, score: parseInt(score), game_type: gameType,
      players_tagged: players, notes,
    });
  }

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalContent} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#fff' }}>
          {editGame?.id ? 'Edit Game Rating' : 'Rate a Game'}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.muted}>League</label>
            <select value={league} onChange={e => setLeague(e.target.value)} style={{ ...S.select, width: '100%', marginTop: 4 }}>
              {Object.entries(LEAGUES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.muted}>Game Type</label>
            <select value={gameType} onChange={e => setGameType(e.target.value)} style={{ ...S.select, width: '100%', marginTop: 4 }}>
              {GAME_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.muted}>Home Team</label>
            <input value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder="Home team" style={{ ...S.input, marginTop: 4 }} />
          </div>
          <div>
            <label style={S.muted}>Away Team</label>
            <input value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="Away team" style={{ ...S.input, marginTop: 4 }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.muted}>Home Score</label>
            <input type="number" value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder="0" style={{ ...S.input, marginTop: 4 }} />
          </div>
          <div>
            <label style={S.muted}>Away Score</label>
            <input type="number" value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder="0" style={{ ...S.input, marginTop: 4 }} />
          </div>
          <div>
            <label style={S.muted}>Game Date</label>
            <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} style={{ ...S.input, marginTop: 4 }} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={S.muted}>Your Rating</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setScore(n)} style={{
                width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: score === n ? scoreColor(n) : '#16162a', color: score === n ? '#000' : '#888',
              }}>{n}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={S.muted}>Standout Players</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} placeholder="Player name" style={{ ...S.input, flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && addPlayer()} />
            <select value={newPlayerRole} onChange={e => setNewPlayerRole(e.target.value)} style={S.select}>
              {PLAYER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={addPlayer} style={S.btnSm}>Add</button>
          </div>
          {players.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {players.map((p, i) => (
                <span key={i} style={{ background: '#16162a', padding: '4px 10px', borderRadius: 12, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.name} <span style={{ color: '#818cf8', fontSize: 10 }}>{p.role}</span>
                  <span onClick={() => removePlayer(i)} style={{ cursor: 'pointer', color: '#ef4444', marginLeft: 2 }}>x</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={S.muted}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Thoughts on the game..."
            style={{ ...S.input, marginTop: 4, minHeight: 60, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...S.btn, background: '#333' }}>Cancel</button>
          <button onClick={handleSubmit} style={S.btn}>{editGame?.id ? 'Update' : 'Rate Game'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────
export default function SportsPage() {
  const [tab, setTab] = useState('Dashboard');
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [seasonStats, setSeasonStats] = useState(null);
  const [todayData, setTodayData] = useState(null);
  const [schedule, setSchedule] = useState({ upcoming: [], recent: [] });
  const [standings, setStandings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showRateModal, setShowRateModal] = useState(false);
  const [editGame, setEditGame] = useState(null);
  const [expandedGame, setExpandedGame] = useState(null);
  const [playerDetail, setPlayerDetail] = useState(null);

  // Filters
  const [filterLeague, setFilterLeague] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterPosition, setFilterPosition] = useState('');

  // Setup form
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLeague, setNewTeamLeague] = useState('NFL');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, gamesRes, playersRes, statsRes, todayRes, schedRes, standRes] = await Promise.all([
        fetchSportsTeams({ account_id: ACCOUNT_ID }).catch(() => ({ teams: [] })),
        fetchSportsGames({ account_id: ACCOUNT_ID, league: filterLeague, team: filterTeam }).catch(() => ({ games: [] })),
        fetchSportsPlayers({ account_id: ACCOUNT_ID, league: filterLeague, team: filterTeam, position: filterPosition }).catch(() => ({ players: [] })),
        fetchSportsSeasonStats({ account_id: ACCOUNT_ID }).catch(() => null),
        fetchSportsToday({ account_id: ACCOUNT_ID }).catch(() => null),
        fetchSportsSchedule({ account_id: ACCOUNT_ID }).catch(() => ({ upcoming: [], recent: [] })),
        fetchSportsStandings({ account_id: ACCOUNT_ID }).catch(() => ({ standings: {} })),
      ]);
      setTeams(teamsRes.teams || []);
      setGames(gamesRes.games || []);
      setPlayers(playersRes.players || []);
      setSeasonStats(statsRes);
      setTodayData(todayRes);
      setSchedule(schedRes);
      setStandings(standRes.standings || {});
    } catch (err) {
      console.error('Load error:', err);
    }
    setLoading(false);
  }, [filterLeague, filterTeam, filterPosition]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAddTeam() {
    if (!newTeamName.trim()) return;
    try {
      await addSportsTeam({ account_id: ACCOUNT_ID, team_name: newTeamName.trim(), league: newTeamLeague });
      setNewTeamName('');
      loadData();
    } catch (err) { console.error(err); }
  }

  async function handleRemoveTeam(id) {
    try {
      await removeSportsTeam(id);
      loadData();
    } catch (err) { console.error(err); }
  }

  async function handleSaveRating(data) {
    try {
      if (data.id) {
        await updateSportsGame(data.id, data);
      } else {
        await rateSportsGame({ account_id: ACCOUNT_ID, ...data });
      }
      setShowRateModal(false);
      setEditGame(null);
      loadData();
    } catch (err) { console.error(err); }
  }

  async function handlePlayerClick(name) {
    try {
      const res = await fetchSportsPlayerDetail(name, { account_id: ACCOUNT_ID });
      setPlayerDetail(res);
    } catch (err) { console.error(err); }
  }

  const TABS = ['Dashboard', 'My Games', 'Player Rankings', 'Setup'];

  // ── Render ─────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Sports Tracker</h1>
        <button onClick={() => { setEditGame(null); setShowRateModal(true); }} style={S.btn}>+ Rate Game</button>
      </div>

      {/* Season Stats Cards */}
      {seasonStats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={S.statCard}>
            <div style={S.statVal}>{seasonStats.total_games || 0}</div>
            <div style={S.statLabel}>Games Watched</div>
          </div>
          <div style={S.statCard}>
            <div style={{ ...S.statVal, color: '#4ade80' }}>{seasonStats.win_pct || '0.0'}%</div>
            <div style={S.statLabel}>Win %</div>
          </div>
          <div style={S.statCard}>
            <div style={{ ...S.statVal, color: '#facc15' }}>{seasonStats.avg_rating || '0.0'}</div>
            <div style={S.statLabel}>Avg Rating</div>
          </div>
          <div style={S.statCard}>
            <div style={{ ...S.statVal, color: scoreColor(seasonStats.highest_rated?.score || 0) }}>
              {seasonStats.highest_rated?.score || '-'}
            </div>
            <div style={S.statLabel}>Highest Rated</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={S.tab(tab === t)}>{t}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>}

      {/* ── Dashboard Tab ──────────────────────────────── */}
      {!loading && tab === 'Dashboard' && (
        <div>
          {/* Today's Games Widget */}
          <div style={S.card}>
            <div style={{ ...S.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Today&apos;s Games</span>
              <span style={S.muted}>{todayData?.date || new Date().toISOString().slice(0, 10)}</span>
            </div>
            {(!todayData?.games || todayData.games.length === 0) ? (
              <div style={{ color: '#666', fontSize: 13, padding: 12 }}>No games today for your teams</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {todayData.games.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#16162a', borderRadius: 6 }}>
                    <span style={leagueBadge(g.league)}>{LEAGUES[g.league]?.label || g.league}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#fff' }}>
                      {g.away_team} {g.away_score != null ? g.away_score : ''} @ {g.home_team} {g.home_score != null ? g.home_score : ''}
                    </span>
                    <span style={{ fontSize: 11, color: g.status === 'in_progress' ? '#4ade80' : '#888' }}>
                      {g.status === 'in_progress' ? 'LIVE' : g.time}
                    </span>
                    <button onClick={() => { setEditGame({ league: g.league, home_team: g.home_team, away_team: g.away_team, game_date: g.game_date, home_score: g.home_score, away_score: g.away_score }); setShowRateModal(true); }}
                      style={S.btnSm}>Rate</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Results */}
          <div style={S.card}>
            <div style={S.cardTitle}>Recent Results</div>
            {schedule.recent.length === 0 ? (
              <div style={{ color: '#666', fontSize: 13 }}>No recent results</div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {schedule.recent.slice(0, 5).map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#16162a', borderRadius: 6 }}>
                    <span style={leagueBadge(g.league)}>{LEAGUES[g.league]?.label || g.league}</span>
                    <span style={{ flex: 1, fontSize: 13, color: '#ccc' }}>
                      {g.away_team} {g.away_score} @ {g.home_team} {g.home_score}
                    </span>
                    <span style={S.muted}>{g.game_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Games */}
          <div style={S.card}>
            <div style={S.cardTitle}>Upcoming This Week</div>
            {schedule.upcoming.length === 0 ? (
              <div style={{ color: '#666', fontSize: 13 }}>No upcoming games</div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {schedule.upcoming.slice(0, 7).map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#16162a', borderRadius: 6 }}>
                    <span style={leagueBadge(g.league)}>{LEAGUES[g.league]?.label || g.league}</span>
                    <span style={{ flex: 1, fontSize: 13, color: '#ccc' }}>
                      {g.away_team} @ {g.home_team}
                    </span>
                    <span style={S.muted}>{g.game_date} {g.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── My Games Tab ───────────────────────────────── */}
      {!loading && tab === 'My Games' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} style={S.select}>
              <option value="">All Leagues</option>
              {Object.entries(LEAGUES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={S.select}>
              <option value="">All Teams</option>
              {teams.map(t => <option key={t.id} value={t.team_name}>{t.team_name}</option>)}
            </select>
            <button onClick={() => { setFilterLeague(''); setFilterTeam(''); }} style={{ ...S.btnSm, background: '#333' }}>Clear</button>
          </div>

          {games.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#666' }}>
              No rated games yet. Rate your first game to get started!
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {games.map(g => (
                <div key={g.id} style={S.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpandedGame(expandedGame === g.id ? null : g.id)}>
                    <span style={leagueBadge(g.league)}>{LEAGUES[g.league]?.label || g.league}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#fff' }}>
                      {g.away_team} {g.away_score != null ? g.away_score : '?'} @ {g.home_team} {g.home_score != null ? g.home_score : '?'}
                    </span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor(g.score) }}>{g.score}</span>
                    <span style={{ ...S.muted, minWidth: 80, textAlign: 'right' }}>{g.game_date}</span>
                    {g.game_type !== 'regular' && (
                      <span style={{ background: '#2a2a4a', padding: '2px 8px', borderRadius: 4, fontSize: 10, color: '#818cf8' }}>
                        {g.game_type}
                      </span>
                    )}
                    <button onClick={e => { e.stopPropagation(); setEditGame(g); setShowRateModal(true); }} style={S.btnSm}>Edit</button>
                  </div>

                  {expandedGame === g.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #2a2a4a' }}>
                      {g.players_tagged_json && g.players_tagged_json.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ ...S.muted, marginRight: 8 }}>Players:</span>
                          {g.players_tagged_json.map((p, i) => (
                            <span key={i} style={{ background: '#16162a', padding: '3px 8px', borderRadius: 10, fontSize: 12, marginRight: 6, display: 'inline-block', marginBottom: 4 }}>
                              {p.name} <span style={{ color: '#818cf8', fontSize: 10 }}>{p.role}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {g.notes && (
                        <div style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>{g.notes}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Player Rankings Tab ────────────────────────── */}
      {!loading && tab === 'Player Rankings' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} style={S.select}>
              <option value="">All Leagues</option>
              {Object.entries(LEAGUES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={S.select}>
              <option value="">All Teams</option>
              {teams.map(t => <option key={t.id} value={t.team_name}>{t.team_name}</option>)}
            </select>
            <input value={filterPosition} onChange={e => setFilterPosition(e.target.value)} placeholder="Position" style={{ ...S.input, width: 120 }} />
            <button onClick={() => { setFilterLeague(''); setFilterTeam(''); setFilterPosition(''); }} style={{ ...S.btnSm, background: '#333' }}>Clear</button>
          </div>

          {/* Player Detail Modal */}
          {playerDetail && (
            <div style={S.modal} onClick={() => setPlayerDetail(null)}>
              <div style={S.modalContent} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
                  {playerDetail.player?.player_name || 'Player'}
                </h3>
                {playerDetail.player && (
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <div style={S.statCard}>
                      <div style={S.statVal}>{playerDetail.player.composite_score}</div>
                      <div style={S.statLabel}>Composite</div>
                    </div>
                    <div style={S.statCard}>
                      <div style={S.statVal}>{playerDetail.player.games_rated}</div>
                      <div style={S.statLabel}>Games</div>
                    </div>
                    <div style={S.statCard}>
                      <div style={S.statVal}>{playerDetail.player.avg_score}</div>
                      <div style={S.statLabel}>Avg Score</div>
                    </div>
                  </div>
                )}
                <div style={S.cardTitle}>Game History</div>
                {(playerDetail.games || []).map(g => (
                  <div key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #2a2a4a', fontSize: 13 }}>
                    <span style={leagueBadge(g.league)}>{LEAGUES[g.league]?.label || g.league}</span>
                    <span style={{ flex: 1, color: '#ccc' }}>{g.away_team} @ {g.home_team}</span>
                    <span style={{ color: scoreColor(g.score), fontWeight: 700 }}>{g.score}</span>
                    <span style={S.muted}>{g.game_date}</span>
                  </div>
                ))}
                <div style={{ textAlign: 'right', marginTop: 16 }}>
                  <button onClick={() => setPlayerDetail(null)} style={S.btn}>Close</button>
                </div>
              </div>
            </div>
          )}

          {players.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#666' }}>
              No player data yet. Tag players when rating games to build rankings!
            </div>
          ) : (
            <div style={S.card}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Rank</th>
                    <th style={S.th}>Player</th>
                    <th style={S.th}>Team</th>
                    <th style={S.th}>League</th>
                    <th style={S.th}>Position</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Composite</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Games</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => handlePlayerClick(p.player_name)}>
                      <td style={S.td}><span style={{ color: i < 3 ? '#facc15' : '#888', fontWeight: 700 }}>{i + 1}</span></td>
                      <td style={{ ...S.td, color: '#fff', fontWeight: 600 }}>{p.player_name}</td>
                      <td style={S.td}>{p.team}</td>
                      <td style={S.td}><span style={leagueBadge(p.league)}>{LEAGUES[p.league]?.label || p.league}</span></td>
                      <td style={{ ...S.td, color: '#888' }}>{p.position || '-'}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#818cf8' }}>{p.composite_score}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#888' }}>{p.games_rated}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: scoreColor(p.avg_score) }}>{p.avg_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Setup Tab ──────────────────────────────────── */}
      {!loading && tab === 'Setup' && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Add Favorite Team</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={S.muted}>Team Name</label>
                <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="e.g. Patriots"
                  style={{ ...S.input, marginTop: 4 }} onKeyDown={e => e.key === 'Enter' && handleAddTeam()} />
              </div>
              <div>
                <label style={S.muted}>League</label>
                <select value={newTeamLeague} onChange={e => setNewTeamLeague(e.target.value)} style={{ ...S.select, marginTop: 4 }}>
                  {Object.entries(LEAGUES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <button onClick={handleAddTeam} style={S.btn}>Add Team</button>
            </div>
          </div>

          {/* Teams by League */}
          {Object.entries(LEAGUES).map(([key, cfg]) => {
            const leagueTeams = teams.filter(t => t.league === key);
            if (leagueTeams.length === 0) return null;
            return (
              <div key={key} style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={leagueBadge(key)}>{cfg.label}</span>
                  <span style={S.muted}>{leagueTeams.length} team{leagueTeams.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {leagueTeams.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#16162a', padding: '8px 14px', borderRadius: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{t.team_name}</span>
                      <button onClick={() => handleRemoveTeam(t.id)} style={S.btnDanger}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {teams.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#666' }}>
              No favorite teams yet. Add your teams above to get started!
            </div>
          )}
        </div>
      )}

      {/* Rate Game Modal */}
      <RateGameModal
        show={showRateModal}
        onClose={() => { setShowRateModal(false); setEditGame(null); }}
        onSave={handleSaveRating}
        editGame={editGame}
      />
    </div>
  );
}
