'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchDatingProfiles, fetchDatingProfile, saveDatingProfile, updateDatingProfile,
  deleteDatingProfile, optimizeDatingProfile, fetchDatingMatches, addDatingMatch,
  updateDatingMatch, deleteDatingMatch, fetchDatingAnalytics, fetchDatingFunnel,
  datingConversationHelper, datingRedFlagCheck, fetchDatingStats,
} from '../../../lib/api';

// ── Platform Config ──────────────────────────────────────────────
const PLATFORMS = {
  Tinder: { color: '#fe3c72', label: 'Tinder' },
  Bumble: { color: '#ffc629', label: 'Bumble' },
  Hinge: { color: '#77334c', label: 'Hinge' },
  OkCupid: { color: '#0500ff', label: 'OkCupid' },
  Match: { color: '#e25822', label: 'Match' },
  FacebookDating: { color: '#1877f2', label: 'Facebook Dating' },
  CoffeeMeetsBagel: { color: '#826b54', label: 'Coffee Meets Bagel' },
};

const TABS = ['Profiles', 'Matches', 'Analytics', 'Tools'];

const OUTCOME_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'talking', label: 'Talking' },
  { value: 'second_date', label: 'Second Date' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'ghosted', label: 'Ghosted' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'unmatched', label: 'Unmatched' },
];

const OUTCOME_COLORS = {
  '': '#6b7280',
  talking: '#3b82f6',
  second_date: '#10b981',
  not_interested: '#f59e0b',
  ghosted: '#ef4444',
  relationship: '#8b5cf6',
  unmatched: '#6b7280',
};

// ── Styles ────────────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '24px' },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  privacy: { background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: '12px 16px', marginTop: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 },
  privacyIcon: { fontSize: 20 },
  privacyText: { fontSize: 13, color: '#a0c4ff', fontWeight: 500 },
  statsRow: { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  statCard: { background: '#16213e', borderRadius: 10, padding: '16px 20px', flex: '1 1 180px', minWidth: 160 },
  statValue: { fontSize: 28, fontWeight: 700, color: '#fff' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, background: '#16213e', borderRadius: 10, padding: 4 },
  tab: { padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, background: 'transparent', color: '#888', transition: 'all 0.2s' },
  tabActive: { background: '#0f3460', color: '#fff' },
  card: { background: '#16213e', borderRadius: 10, padding: 20, marginBottom: 16 },
  btn: { padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' },
  btnPrimary: { background: '#0f3460', color: '#fff' },
  btnDanger: { background: '#4a1a2e', color: '#ef4444' },
  btnSmall: { padding: '4px 10px', fontSize: 12 },
  input: { background: '#0d1b3e', border: '1px solid #1e3a5f', borderRadius: 6, padding: '8px 12px', color: '#fff', fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box' },
  textarea: { background: '#0d1b3e', border: '1px solid #1e3a5f', borderRadius: 6, padding: '10px 12px', color: '#fff', fontSize: 14, width: '100%', outline: 'none', minHeight: 100, resize: 'vertical', boxSizing: 'border-box' },
  select: { background: '#0d1b3e', border: '1px solid #1e3a5f', borderRadius: 6, padding: '8px 12px', color: '#fff', fontSize: 14, outline: 'none' },
  badge: (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: color + '22', color, border: `1px solid ${color}44` }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#16213e', borderRadius: 12, padding: 24, width: '90%', maxWidth: 480, maxHeight: '80vh', overflow: 'auto' },
  row: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 12, color: '#888', marginBottom: 4, display: 'block' },
  divider: { border: 'none', borderTop: '1px solid #1e3a5f', margin: '16px 0' },
  toggle: (active) => ({ width: 40, height: 22, borderRadius: 11, background: active ? '#10b981' : '#333', position: 'relative', cursor: 'pointer', border: 'none', transition: 'all 0.2s' }),
  toggleKnob: (active) => ({ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 2, left: active ? 20 : 2, transition: 'all 0.2s' }),
};

// ── Component ─────────────────────────────────────────────────────
export default function DatingPage() {
  const [tab, setTab] = useState('Profiles');
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [compareMode, setCompareMode] = useState(false);

  // Tool states
  const [conversationText, setConversationText] = useState('');
  const [conversationSuggestions, setConversationSuggestions] = useState(null);
  const [redFlagText, setRedFlagText] = useState('');
  const [redFlagAnalysis, setRedFlagAnalysis] = useState(null);
  const [optimizeResult, setOptimizeResult] = useState(null);

  // Filter states
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(0);

  // Add match form
  const [newMatch, setNewMatch] = useState({
    platform: 'Tinder', match_name: '', match_date: new Date().toISOString().slice(0, 10),
    conversation_started: false, date_scheduled: false, date_happened: false, outcome: '', notes: '',
  });

  const accountId = typeof window !== 'undefined' ? (localStorage.getItem('account_id') || 'default') : 'default';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, matchesRes, statsRes] = await Promise.all([
        fetchDatingProfiles(accountId).catch(() => ({ profiles: [] })),
        fetchDatingMatches(accountId).catch(() => ({ matches: [] })),
        fetchDatingStats(accountId).catch(() => null),
      ]);
      setProfiles(profilesRes.profiles || []);
      setMatches(matchesRes.matches || []);
      setStats(statsRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const loadAnalytics = useCallback(async () => {
    try {
      const [analyticsRes, funnelRes] = await Promise.all([
        fetchDatingAnalytics(accountId).catch(() => null),
        fetchDatingFunnel(accountId).catch(() => null),
      ]);
      setAnalytics(analyticsRes);
      setFunnel(funnelRes);
    } catch (_) {}
  }, [accountId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (tab === 'Analytics') loadAnalytics(); }, [tab, loadAnalytics]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleSaveProfile = async (profile) => {
    try {
      await saveDatingProfile({ ...profile, account_id: accountId });
      setEditingProfile(null);
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleDeleteProfile = async (platform) => {
    try {
      await deleteDatingProfile(platform, accountId);
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleOptimize = async (platform) => {
    try {
      const res = await optimizeDatingProfile(platform, accountId);
      setOptimizeResult(res.suggestions || res);
    } catch (err) { setError(err.message); }
  };

  const handleAddMatch = async () => {
    try {
      await addDatingMatch({ ...newMatch, account_id: accountId });
      setShowAddMatch(false);
      setNewMatch({ platform: 'Tinder', match_name: '', match_date: new Date().toISOString().slice(0, 10), conversation_started: false, date_scheduled: false, date_happened: false, outcome: '', notes: '' });
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleUpdateMatch = async (id, updates) => {
    try {
      await updateDatingMatch(id, updates);
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleDeleteMatch = async (id) => {
    try {
      await deleteDatingMatch(id);
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleConversationHelper = async () => {
    try {
      const res = await datingConversationHelper(conversationText);
      setConversationSuggestions(res);
    } catch (err) { setError(err.message); }
  };

  const handleRedFlagCheck = async () => {
    try {
      const res = await datingRedFlagCheck(redFlagText);
      setRedFlagAnalysis(res.analysis || res);
    } catch (err) { setError(err.message); }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirm < 2) { setDeleteConfirm(deleteConfirm + 1); return; }
    try {
      for (const p of profiles) await deleteDatingProfile(p.platform, accountId);
      for (const m of matches) await deleteDatingMatch(m.id);
      setDeleteConfirm(0);
      loadData();
    } catch (err) { setError(err.message); }
  };

  const filteredMatches = matches.filter(m => {
    if (filterPlatform && m.platform !== filterPlatform) return false;
    if (filterOutcome && m.outcome !== filterOutcome) return false;
    return true;
  });

  // ── Render helpers ──────────────────────────────────────────────
  const PlatformBadge = ({ platform }) => {
    const p = PLATFORMS[platform] || { color: '#888', label: platform };
    return <span style={S.badge(p.color)}>{p.label}</span>;
  };

  const OutcomeBadge = ({ outcome }) => {
    const opt = OUTCOME_OPTIONS.find(o => o.value === outcome) || { label: outcome || 'None' };
    return <span style={S.badge(OUTCOME_COLORS[outcome] || '#888')}>{opt.label}</span>;
  };

  const Toggle = ({ active, onChange }) => (
    <button style={S.toggle(active)} onClick={() => onChange(!active)}>
      <div style={S.toggleKnob(active)} />
    </button>
  );

  // ── Stats Cards ─────────────────────────────────────────────────
  const renderStats = () => {
    if (!stats) return null;
    return (
      <div style={S.statsRow}>
        <div style={S.statCard}>
          <div style={S.statValue}>{stats.total_matches || 0}</div>
          <div style={S.statLabel}>Total Matches</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statValue, color: '#3b82f6' }}>{stats.conversation_rate || 0}%</div>
          <div style={S.statLabel}>Conversation Rate</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statValue, color: '#10b981' }}>{stats.date_rate || 0}%</div>
          <div style={S.statLabel}>Date Rate</div>
        </div>
        <div style={S.statCard}>
          <div style={{ ...S.statValue, color: PLATFORMS[stats.best_platform]?.color || '#fff' }}>
            {PLATFORMS[stats.best_platform]?.label || stats.best_platform || 'N/A'}
          </div>
          <div style={S.statLabel}>Best Platform</div>
        </div>
      </div>
    );
  };

  // ── Profiles Tab ────────────────────────────────────────────────
  const renderProfiles = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ color: '#fff', margin: 0 }}>Dating Profiles</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => setCompareMode(!compareMode)}>
            {compareMode ? 'Card View' : 'Compare View'}
          </button>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => setEditingProfile({ platform: '', bio_text: '', photos_json: [], prompts_json: [], preferences_json: {} })}>
            + Add Profile
          </button>
        </div>
      </div>

      {compareMode ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e3a5f' }}>
                <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>Platform</th>
                <th style={{ textAlign: 'left', padding: 10, color: '#888' }}>Bio</th>
                <th style={{ textAlign: 'center', padding: 10, color: '#888' }}>Photos</th>
                <th style={{ textAlign: 'center', padding: 10, color: '#888' }}>Prompts</th>
                <th style={{ textAlign: 'right', padding: 10, color: '#888' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #0d1b3e' }}>
                  <td style={{ padding: 10 }}><PlatformBadge platform={p.platform} /></td>
                  <td style={{ padding: 10, color: '#ccc', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.bio_text || '(empty)'}</td>
                  <td style={{ padding: 10, textAlign: 'center', color: '#fff' }}>{(p.photos || p.photos_json || []).length}</td>
                  <td style={{ padding: 10, textAlign: 'center', color: '#fff' }}>{(p.prompts || p.prompts_json || []).length}</td>
                  <td style={{ padding: 10, textAlign: 'right' }}>
                    <button style={{ ...S.btn, ...S.btnSmall, ...S.btnPrimary, marginRight: 4 }} onClick={() => setEditingProfile(p)}>Edit</button>
                    <button style={{ ...S.btn, ...S.btnSmall, background: '#2a1a3e', color: '#a78bfa' }} onClick={() => handleOptimize(p.platform)}>Optimize</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={S.grid}>
          {profiles.map(p => {
            const platConfig = PLATFORMS[p.platform] || { color: '#888', label: p.platform };
            const photos = p.photos || p.photos_json || [];
            const prompts = p.prompts || p.prompts_json || [];
            return (
              <div key={p.id} style={{ ...S.card, borderLeft: `3px solid ${platConfig.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <PlatformBadge platform={p.platform} />
                  <span style={{ fontSize: 11, color: '#666' }}>Updated {new Date(p.updated_at).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: 13, color: '#ccc', marginBottom: 12, lineHeight: 1.5 }}>
                  {p.bio_text ? (p.bio_text.length > 120 ? p.bio_text.slice(0, 120) + '...' : p.bio_text) : '(No bio set)'}
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 12, color: '#888' }}>{prompts.length} prompt{prompts.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...S.btn, ...S.btnSmall, ...S.btnPrimary }} onClick={() => setEditingProfile(p)}>Edit</button>
                  <button style={{ ...S.btn, ...S.btnSmall, background: '#2a1a3e', color: '#a78bfa' }} onClick={() => handleOptimize(p.platform)}>Optimize</button>
                  <button style={{ ...S.btn, ...S.btnSmall, ...S.btnDanger }} onClick={() => handleDeleteProfile(p.platform)}>Delete</button>
                </div>
              </div>
            );
          })}
          {profiles.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', color: '#666', gridColumn: '1 / -1' }}>
              No profiles yet. Add your first dating profile to get started.
            </div>
          )}
        </div>
      )}

      {optimizeResult && (
        <div style={{ ...S.card, marginTop: 16, borderLeft: '3px solid #a78bfa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ color: '#a78bfa', margin: 0 }}>Optimization Suggestions</h4>
            <button style={{ ...S.btn, ...S.btnSmall, background: '#333', color: '#888' }} onClick={() => setOptimizeResult(null)}>Close</button>
          </div>
          {optimizeResult.overall_score !== undefined && (
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 12 }}>Profile Score: <strong>{optimizeResult.overall_score}/100</strong></div>
          )}
          {['bio', 'photos', 'prompts'].map(key => optimizeResult[key] && (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>{key}</div>
              {optimizeResult[key].map((tip, i) => (
                <div key={i} style={{ fontSize: 13, color: '#ccc', padding: '4px 0', paddingLeft: 12, borderLeft: '2px solid #1e3a5f' }}>{tip}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      {editingProfile && renderProfileEditor()}
    </div>
  );

  const renderProfileEditor = () => {
    const [form, setForm] = [editingProfile, setEditingProfile];
    return (
      <div style={S.modal} onClick={() => setEditingProfile(null)}>
        <div style={S.modalContent} onClick={e => e.stopPropagation()}>
          <h3 style={{ color: '#fff', margin: '0 0 16px' }}>{form.id ? 'Edit Profile' : 'Add Profile'}</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Platform</label>
            <select style={{ ...S.select, width: '100%' }} value={form.platform} onChange={e => setEditingProfile({ ...form, platform: e.target.value })} disabled={!!form.id}>
              <option value="">Select platform</option>
              {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Bio</label>
            <textarea style={S.textarea} value={form.bio_text || ''} onChange={e => setEditingProfile({ ...form, bio_text: e.target.value })} placeholder="Your dating bio..." />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Photos (JSON array of URLs)</label>
            <textarea style={{ ...S.textarea, minHeight: 60 }} value={JSON.stringify(form.photos_json || [], null, 2)} onChange={e => { try { setEditingProfile({ ...form, photos_json: JSON.parse(e.target.value) }); } catch (_) {} }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>Prompts (JSON array)</label>
            <textarea style={{ ...S.textarea, minHeight: 60 }} value={JSON.stringify(form.prompts_json || [], null, 2)} onChange={e => { try { setEditingProfile({ ...form, prompts_json: JSON.parse(e.target.value) }); } catch (_) {} }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={{ ...S.btn, background: '#333', color: '#888' }} onClick={() => setEditingProfile(null)}>Cancel</button>
            <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => handleSaveProfile(form)}>Save</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Matches Tab ─────────────────────────────────────────────────
  const renderMatches = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ color: '#fff', margin: 0 }}>Matches</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={S.select} value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
            <option value="">All Platforms</option>
            {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select style={S.select} value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)}>
            <option value="">All Outcomes</option>
            {OUTCOME_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => setShowAddMatch(true)}>+ Add Match</button>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#666' }}>No matches found. Start logging your matches!</div>
      ) : (
        filteredMatches.map(m => (
          <div key={m.id} style={{ ...S.card, cursor: 'pointer', borderLeft: `3px solid ${PLATFORMS[m.platform]?.color || '#888'}` }} onClick={() => setExpandedMatch(expandedMatch === m.id ? null : m.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <PlatformBadge platform={m.platform} />
                <span style={{ color: '#fff', fontWeight: 600 }}>{m.match_name || 'Unnamed'}</span>
                <span style={{ color: '#666', fontSize: 12 }}>{m.match_date}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {m.conversation_started && <span style={S.badge('#3b82f6')}>Chatting</span>}
                {m.date_happened && <span style={S.badge('#10b981')}>Dated</span>}
                <OutcomeBadge outcome={m.outcome} />
              </div>
            </div>

            {expandedMatch === m.id && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1e3a5f' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ccc' }}>
                    Conversation <Toggle active={m.conversation_started} onChange={v => handleUpdateMatch(m.id, { conversation_started: v })} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ccc' }}>
                    Date Scheduled <Toggle active={m.date_scheduled} onChange={v => handleUpdateMatch(m.id, { date_scheduled: v })} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ccc' }}>
                    Date Happened <Toggle active={m.date_happened} onChange={v => handleUpdateMatch(m.id, { date_happened: v })} />
                  </label>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Outcome</label>
                  <select style={S.select} value={m.outcome || ''} onChange={e => handleUpdateMatch(m.id, { outcome: e.target.value })}>
                    {OUTCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Notes</label>
                  <textarea style={S.textarea} value={m.notes || ''} onChange={e => handleUpdateMatch(m.id, { notes: e.target.value })} placeholder="Add notes..." />
                </div>
                <button style={{ ...S.btn, ...S.btnDanger, ...S.btnSmall }} onClick={() => handleDeleteMatch(m.id)}>Delete Match</button>
              </div>
            )}
          </div>
        ))
      )}

      {showAddMatch && renderAddMatchModal()}
    </div>
  );

  const renderAddMatchModal = () => (
    <div style={S.modal} onClick={() => setShowAddMatch(false)}>
      <div style={S.modalContent} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Log New Match</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Platform</label>
          <select style={{ ...S.select, width: '100%' }} value={newMatch.platform} onChange={e => setNewMatch({ ...newMatch, platform: e.target.value })}>
            {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Name</label>
          <input style={S.input} value={newMatch.match_name} onChange={e => setNewMatch({ ...newMatch, match_name: e.target.value })} placeholder="Match name" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Date</label>
          <input style={S.input} type="date" value={newMatch.match_date} onChange={e => setNewMatch({ ...newMatch, match_date: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ccc' }}>
            Conversation <Toggle active={newMatch.conversation_started} onChange={v => setNewMatch({ ...newMatch, conversation_started: v })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ccc' }}>
            Date Scheduled <Toggle active={newMatch.date_scheduled} onChange={v => setNewMatch({ ...newMatch, date_scheduled: v })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ccc' }}>
            Date Happened <Toggle active={newMatch.date_happened} onChange={v => setNewMatch({ ...newMatch, date_happened: v })} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Outcome</label>
          <select style={{ ...S.select, width: '100%' }} value={newMatch.outcome} onChange={e => setNewMatch({ ...newMatch, outcome: e.target.value })}>
            {OUTCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Notes</label>
          <textarea style={S.textarea} value={newMatch.notes} onChange={e => setNewMatch({ ...newMatch, notes: e.target.value })} placeholder="Any notes..." />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ ...S.btn, background: '#333', color: '#888' }} onClick={() => setShowAddMatch(false)}>Cancel</button>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleAddMatch}>Save Match</button>
        </div>
      </div>
    </div>
  );

  // ── Analytics Tab ───────────────────────────────────────────────
  const renderAnalytics = () => {
    const funnelData = funnel?.funnel || [];
    const weeklyData = analytics?.weekly_by_platform || {};
    const bestDays = analytics?.best_days || [];

    // SVG bar chart for matches/week
    const allWeeks = {};
    Object.entries(weeklyData).forEach(([platform, weeks]) => {
      weeks.forEach(w => {
        if (!allWeeks[w.week_start]) allWeeks[w.week_start] = {};
        allWeeks[w.week_start][platform] = w.matches;
      });
    });
    const sortedWeeks = Object.keys(allWeeks).sort().slice(-12);
    const maxMatches = Math.max(1, ...sortedWeeks.map(w => Object.values(allWeeks[w] || {}).reduce((s, v) => s + v, 0)));
    const barWidth = Math.max(20, Math.floor(600 / Math.max(sortedWeeks.length, 1)) - 4);

    return (
      <div>
        <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Analytics</h3>

        {/* Matches per week chart */}
        <div style={S.card}>
          <h4 style={{ color: '#888', margin: '0 0 16px', fontSize: 14 }}>Matches Per Week</h4>
          {sortedWeeks.length === 0 ? (
            <div style={{ color: '#666', fontSize: 13 }}>No weekly data yet.</div>
          ) : (
            <svg viewBox={`0 0 ${Math.max(sortedWeeks.length * (barWidth + 4), 200)} 180`} style={{ width: '100%', maxHeight: 200 }}>
              {sortedWeeks.map((week, wi) => {
                let yOffset = 0;
                const platformEntries = Object.entries(allWeeks[week] || {});
                return platformEntries.map(([platform, count]) => {
                  const h = (count / maxMatches) * 140;
                  const y = 160 - yOffset - h;
                  yOffset += h;
                  return (
                    <rect key={`${week}-${platform}`} x={wi * (barWidth + 4)} y={y} width={barWidth} height={h}
                      fill={PLATFORMS[platform]?.color || '#888'} rx={2} opacity={0.85}>
                      <title>{platform}: {count} matches ({week})</title>
                    </rect>
                  );
                });
              })}
              {sortedWeeks.map((week, wi) => (
                <text key={week} x={wi * (barWidth + 4) + barWidth / 2} y={175} textAnchor="middle" fontSize={8} fill="#666">
                  {week.slice(5)}
                </text>
              ))}
            </svg>
          )}
        </div>

        {/* Conversion Funnel */}
        <div style={S.card}>
          <h4 style={{ color: '#888', margin: '0 0 16px', fontSize: 14 }}>Conversion Funnel</h4>
          {funnelData.length === 0 ? (
            <div style={{ color: '#666', fontSize: 13 }}>No funnel data yet. Log matches to see your funnel.</div>
          ) : (
            funnelData.map(f => {
              const maxVal = Math.max(f.matches, 1);
              const platColor = PLATFORMS[f.platform]?.color || '#888';
              return (
                <div key={f.platform} style={{ marginBottom: 20 }}>
                  <div style={{ marginBottom: 8 }}><PlatformBadge platform={f.platform} /></div>
                  {[
                    { label: 'Matches', value: f.matches, pct: 100 },
                    { label: 'Conversations', value: f.conversations, pct: (f.conversations / maxVal) * 100 },
                    { label: 'Dates', value: f.dates, pct: (f.dates / maxVal) * 100 },
                    { label: 'Second Dates', value: f.second_dates, pct: (f.second_dates / maxVal) * 100 },
                  ].map(bar => (
                    <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#888', width: 90, textAlign: 'right' }}>{bar.label}</span>
                      <div style={{ flex: 1, background: '#0d1b3e', borderRadius: 4, height: 20, position: 'relative' }}>
                        <div style={{ width: `${bar.pct}%`, background: platColor, height: '100%', borderRadius: 4, opacity: 0.7, transition: 'width 0.5s' }} />
                        <span style={{ position: 'absolute', right: 8, top: 2, fontSize: 11, color: '#fff' }}>{bar.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Platform Comparison Table */}
        <div style={S.card}>
          <h4 style={{ color: '#888', margin: '0 0 16px', fontSize: 14 }}>Platform Comparison</h4>
          {funnelData.length === 0 ? (
            <div style={{ color: '#666', fontSize: 13 }}>No data to compare.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e3a5f' }}>
                  {['Platform', 'Matches', 'Conv. Rate', 'Date Rate', '2nd Date Rate'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Platform' ? 'left' : 'center', padding: 8, color: '#888', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funnelData.map(f => (
                  <tr key={f.platform} style={{ borderBottom: '1px solid #0d1b3e' }}>
                    <td style={{ padding: 8 }}><PlatformBadge platform={f.platform} /></td>
                    <td style={{ padding: 8, textAlign: 'center', color: '#fff' }}>{f.matches}</td>
                    <td style={{ padding: 8, textAlign: 'center', color: '#3b82f6' }}>{f.conversation_rate}%</td>
                    <td style={{ padding: 8, textAlign: 'center', color: '#10b981' }}>{f.date_rate}%</td>
                    <td style={{ padding: 8, textAlign: 'center', color: '#a78bfa' }}>{f.second_date_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Best Performing Days */}
        <div style={S.card}>
          <h4 style={{ color: '#888', margin: '0 0 16px', fontSize: 14 }}>Best Performing Days</h4>
          {bestDays.length === 0 ? (
            <div style={{ color: '#666', fontSize: 13 }}>Not enough data yet.</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {bestDays.slice(0, 7).map((d, i) => (
                <div key={d.day} style={{ background: '#0d1b3e', borderRadius: 8, padding: '10px 16px', textAlign: 'center', opacity: 1 - (i * 0.1) }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? '#10b981' : '#fff' }}>{d.count}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{d.day}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Tools Tab ───────────────────────────────────────────────────
  const renderTools = () => (
    <div>
      <h3 style={{ color: '#fff', margin: '0 0 16px' }}>Dating Tools</h3>

      {/* Conversation Helper */}
      <div style={S.card}>
        <h4 style={{ color: '#3b82f6', margin: '0 0 12px' }}>Conversation Helper</h4>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>Paste a conversation to get response suggestions powered by AI.</p>
        <textarea style={S.textarea} value={conversationText} onChange={e => setConversationText(e.target.value)} placeholder="Paste your conversation here..." />
        <div style={{ marginTop: 8 }}>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleConversationHelper} disabled={!conversationText.trim()}>
            Get Suggestions
          </button>
        </div>
        {conversationSuggestions && (
          <div style={{ marginTop: 16, padding: 12, background: '#0d1b3e', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Suggestions:</div>
            {(conversationSuggestions.suggestions || []).map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: '#ccc', padding: '6px 0', borderBottom: '1px solid #1e3a5f' }}>{s}</div>
            ))}
            {conversationSuggestions.tip && (
              <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 8 }}>Tip: {conversationSuggestions.tip}</div>
            )}
          </div>
        )}
      </div>

      {/* Red Flag Detector */}
      <div style={S.card}>
        <h4 style={{ color: '#ef4444', margin: '0 0 12px' }}>Red Flag Detector</h4>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>Paste a conversation or profile text for red flag analysis.</p>
        <textarea style={S.textarea} value={redFlagText} onChange={e => setRedFlagText(e.target.value)} placeholder="Paste conversation or profile text..." />
        <div style={{ marginTop: 8 }}>
          <button style={{ ...S.btn, background: '#4a1a2e', color: '#ef4444' }} onClick={handleRedFlagCheck} disabled={!redFlagText.trim()}>
            Analyze
          </button>
        </div>
        {redFlagAnalysis && (
          <div style={{ marginTop: 16, padding: 12, background: '#0d1b3e', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Risk Level:</span>
              <span style={S.badge(redFlagAnalysis.risk_level === 'low' ? '#10b981' : redFlagAnalysis.risk_level === 'medium' ? '#f59e0b' : '#ef4444')}>
                {redFlagAnalysis.risk_level?.toUpperCase()}
              </span>
            </div>
            {(redFlagAnalysis.flags || []).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 4 }}>Flags:</div>
                {redFlagAnalysis.flags.map((f, i) => <div key={i} style={{ fontSize: 13, color: '#fca5a5', padding: '3px 0' }}>{f}</div>)}
              </div>
            )}
            {(redFlagAnalysis.positive_signs || []).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#10b981', marginBottom: 4 }}>Positive Signs:</div>
                {redFlagAnalysis.positive_signs.map((s, i) => <div key={i} style={{ fontSize: 13, color: '#6ee7b7', padding: '3px 0' }}>{s}</div>)}
              </div>
            )}
            {redFlagAnalysis.summary && <div style={{ fontSize: 13, color: '#ccc', marginTop: 8 }}>{redFlagAnalysis.summary}</div>}
          </div>
        )}
      </div>

      {/* A/B Test Tracker */}
      <div style={S.card}>
        <h4 style={{ color: '#a78bfa', margin: '0 0 12px' }}>A/B Test Tracker</h4>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>Compare bio versions to see which performs better. Track matches received with each version.</p>
        {profiles.length === 0 ? (
          <div style={{ color: '#666', fontSize: 13 }}>Add profiles first to start A/B testing bios.</div>
        ) : (
          <div>
            {profiles.map(p => {
              const platConfig = PLATFORMS[p.platform] || { color: '#888', label: p.platform };
              const profileMatches = matches.filter(m => m.platform === p.platform);
              return (
                <div key={p.id} style={{ marginBottom: 16, padding: 12, background: '#0d1b3e', borderRadius: 8, borderLeft: `3px solid ${platConfig.color}` }}>
                  <div style={{ marginBottom: 8 }}><PlatformBadge platform={p.platform} /></div>
                  <div style={{ fontSize: 13, color: '#ccc', marginBottom: 8 }}>
                    Current bio: {p.bio_text ? (p.bio_text.length > 80 ? p.bio_text.slice(0, 80) + '...' : p.bio_text) : '(empty)'}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    Matches with current bio: <span style={{ color: '#fff', fontWeight: 600 }}>{profileMatches.length}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── Main Render ─────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Dating Profile Monitor</h1>
        <div style={S.subtitle}>Track profiles, matches, and optimize your dating strategy</div>
      </div>

      {/* Privacy Notice */}
      <div style={S.privacy}>
        <span style={S.privacyIcon}>&#128274;</span>
        <span style={S.privacyText}>All dating data is encrypted and private. Never shared with any other module.</span>
      </div>

      {/* Stats */}
      {renderStats()}

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#4a1a2e', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#fca5a5' }}>
          {error}
          <button style={{ ...S.btn, ...S.btnSmall, marginLeft: 12, background: 'transparent', color: '#ef4444' }} onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#888' }}>Loading...</div>
      ) : (
        <>
          {tab === 'Profiles' && renderProfiles()}
          {tab === 'Matches' && renderMatches()}
          {tab === 'Analytics' && renderAnalytics()}
          {tab === 'Tools' && renderTools()}
        </>
      )}

      {/* Delete All Data */}
      <hr style={S.divider} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button
          style={{ ...S.btn, ...S.btnDanger, background: deleteConfirm > 0 ? '#7f1d1d' : '#4a1a2e' }}
          onClick={handleDeleteAllData}
        >
          {deleteConfirm === 0 ? 'Delete All Dating Data' : deleteConfirm === 1 ? 'Are you sure? Click again.' : 'CONFIRM: Delete everything permanently'}
        </button>
      </div>
    </div>
  );
}
