'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchRecLists, fetchRecList, createRecList, updateRecList, deleteRecList,
  autoGenerateRecList, fetchWatchParties, createWatchParty, updateWatchParty,
  deleteWatchParty, generateRecommendation,
} from '../../../lib/api';

const COLORS = {
  bg: '#1a1a2e',
  bgCard: '#16213e',
  bgInput: '#0f3460',
  accent: '#f59e0b',
  accentHover: '#d97706',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  border: '#334155',
  danger: '#ef4444',
  success: '#22c55e',
};

const TYPE_BADGES = {
  top_movies: { label: 'Top Movies', color: '#3b82f6' },
  top_directors: { label: 'Top Directors', color: '#8b5cf6' },
  hidden_gems: { label: 'Hidden Gems', color: '#10b981' },
  best_books: { label: 'Best Books', color: '#f97316' },
  top_artists: { label: 'Top Artists', color: '#ec4899' },
  custom: { label: 'Custom', color: '#6b7280' },
};

const AUTO_TYPES = [
  { type: 'top_movies', label: 'Top 20 Movies', icon: '\u{1F3AC}' },
  { type: 'hidden_gems', label: 'Hidden Gems', icon: '\u{1F48E}' },
  { type: 'best_books', label: 'Best Books', icon: '\u{1F4DA}' },
  { type: 'top_artists', label: 'Top Artists', icon: '\u{1F3B5}' },
];

const SOCIAL_LINKS = {
  x: (url, title) => `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  facebook: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  linkedin: (url, title) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
};

// ── Styles ───────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh', background: COLORS.bg, color: COLORS.text,
    padding: '32px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: { maxWidth: 1200, margin: '0 auto 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  title: { fontSize: 28, fontWeight: 700, color: COLORS.accent, margin: 0 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  tabs: { display: 'flex', gap: 0, borderBottom: `2px solid ${COLORS.border}`, maxWidth: 1200, margin: '0 auto 24px' },
  tab: (active) => ({
    padding: '12px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 14,
    color: active ? COLORS.accent : COLORS.textMuted,
    borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
    marginBottom: -2, background: 'none', border: 'none', transition: 'all 0.2s',
  }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, maxWidth: 1200, margin: '0 auto' },
  card: {
    background: COLORS.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${COLORS.border}`,
    transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer',
  },
  cardTitle: { fontSize: 18, fontWeight: 600, marginBottom: 8 },
  badge: (color) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11,
    fontWeight: 600, background: `${color}22`, color, marginBottom: 8,
  }),
  btn: (variant = 'primary') => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13,
    cursor: 'pointer', transition: 'all 0.2s',
    ...(variant === 'primary' && { background: COLORS.accent, color: '#000' }),
    ...(variant === 'secondary' && { background: COLORS.bgInput, color: COLORS.text, border: `1px solid ${COLORS.border}` }),
    ...(variant === 'danger' && { background: COLORS.danger, color: '#fff' }),
    ...(variant === 'ghost' && { background: 'transparent', color: COLORS.textMuted, padding: '4px 8px' }),
  }),
  btnRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
    background: COLORS.bgInput, color: COLORS.text, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
    background: COLORS.bgInput, color: COLORS.text, fontSize: 14, outline: 'none',
    minHeight: 80, resize: 'vertical', boxSizing: 'border-box',
  },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24,
  },
  modalContent: {
    background: COLORS.bgCard, borderRadius: 16, padding: 28, maxWidth: 520,
    width: '100%', maxHeight: '85vh', overflowY: 'auto', border: `1px solid ${COLORS.border}`,
  },
  modalTitle: { fontSize: 20, fontWeight: 700, marginBottom: 20, color: COLORS.accent },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: {
    width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`,
    background: COLORS.bgInput, color: COLORS.text, fontSize: 14, outline: 'none',
  },
  itemRow: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    background: COLORS.bgInput, borderRadius: 8, marginBottom: 8,
  },
  itemPoster: { width: 40, height: 56, borderRadius: 6, objectFit: 'cover', background: COLORS.border },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: 600 },
  itemMeta: { fontSize: 12, color: COLORS.textMuted },
  countdown: { fontSize: 13, color: COLORS.accent, fontWeight: 600 },
  shareBar: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 },
  socialBtn: {
    padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', background: COLORS.bgInput, color: COLORS.text,
  },
  emptyState: { textAlign: 'center', padding: '60px 20px', color: COLORS.textMuted },
  autoRow: { display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 1200, margin: '0 auto 24px' },
  autoBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${COLORS.border}`,
    background: COLORS.bgCard, color: COLORS.text, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
  },
  compatBar: { height: 8, borderRadius: 4, background: COLORS.bgInput, overflow: 'hidden', marginTop: 8 },
  compatFill: (pct) => ({ height: '100%', width: `${pct}%`, background: COLORS.accent, borderRadius: 4, transition: 'width 0.6s' }),
  section: { maxWidth: 1200, margin: '0 auto 24px' },
  sectionTitle: { fontSize: 16, fontWeight: 600, marginBottom: 12, color: COLORS.textMuted },
};

// ── Helpers ──────────────────────────────────────────────

function getCountdown(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  if (diff <= 0) return 'Already started';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function shareUrl(slug, type = 'list') {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return type === 'list'
    ? `${base}/api/recommendations/lists/public/${slug}`
    : `${base}/api/recommendations/parties/invite/${slug}`;
}

function copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text);
}

// ── ACCOUNT ID ───────────────────────────────────────────

function useAccountId() {
  const [accountId, setAccountId] = useState(null);
  useEffect(() => {
    const stored = localStorage.getItem('account_id') || localStorage.getItem('accountId') || 'demo-account';
    setAccountId(stored);
  }, []);
  return accountId;
}

// ── MAIN PAGE ────────────────────────────────────────────

export default function RecommendationsPage() {
  const accountId = useAccountId();
  const [activeTab, setActiveTab] = useState('lists');
  const [lists, setLists] = useState([]);
  const [parties, setParties] = useState([]);
  const [expandedList, setExpandedList] = useState(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showCreateParty, setShowCreateParty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(null);

  // Discover state
  const [friendPrefs, setFriendPrefs] = useState('');
  const [discoverResult, setDiscoverResult] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  // Create list form
  const [newList, setNewList] = useState({ title: '', list_type: 'custom', description: '', items: [] });
  const [itemSearch, setItemSearch] = useState('');

  // Create party form
  const [newParty, setNewParty] = useState({ title: '', item_id: '', item_type: 'movie', proposed_date: '', notes: '' });

  // Edit state
  const [editingList, setEditingList] = useState(null);

  const loadLists = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await fetchRecLists(accountId);
      setLists(res.lists || []);
    } catch { setLists([]); }
    setLoading(false);
  }, [accountId]);

  const loadParties = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetchWatchParties(accountId);
      setParties(res.parties || []);
    } catch { setParties([]); }
  }, [accountId]);

  useEffect(() => { loadLists(); loadParties(); }, [loadLists, loadParties]);

  // ── List actions ─────────────────────────────────────

  const handleCreateList = async () => {
    if (!newList.title.trim()) return;
    try {
      await createRecList({ account_id: accountId, ...newList, items_json: newList.items });
      setShowCreateList(false);
      setNewList({ title: '', list_type: 'custom', description: '', items: [] });
      loadLists();
    } catch (e) { console.error(e); }
  };

  const handleDeleteList = async (id) => {
    if (!confirm('Delete this list?')) return;
    try { await deleteRecList(id); loadLists(); setExpandedList(null); }
    catch (e) { console.error(e); }
  };

  const handleAutoGenerate = async (type) => {
    setGenerating(type);
    try {
      await autoGenerateRecList({ account_id: accountId, list_type: type });
      loadLists();
    } catch (e) { console.error(e); }
    setGenerating(null);
  };

  const handleAddItem = () => {
    if (!itemSearch.trim()) return;
    setNewList(prev => ({
      ...prev,
      items: [...prev.items, { rank: prev.items.length + 1, title: itemSearch.trim(), item_id: itemSearch.trim().toLowerCase().replace(/\s+/g, '-'), comment: '' }],
    }));
    setItemSearch('');
  };

  const handleRemoveItem = (idx) => {
    setNewList(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, rank: i + 1 })),
    }));
  };

  // ── Party actions ────────────────────────────────────

  const handleCreateParty = async () => {
    if (!newParty.title.trim()) return;
    try {
      await createWatchParty({ account_id: accountId, ...newParty });
      setShowCreateParty(false);
      setNewParty({ title: '', item_id: '', item_type: 'movie', proposed_date: '', notes: '' });
      loadParties();
    } catch (e) { console.error(e); }
  };

  const handleDeleteParty = async (id) => {
    if (!confirm('Cancel this watch party?')) return;
    try { await deleteWatchParty(id); loadParties(); }
    catch (e) { console.error(e); }
  };

  // ── Discover actions ─────────────────────────────────

  const handleDiscover = async () => {
    if (!friendPrefs.trim()) return;
    setDiscoverLoading(true);
    try {
      let prefs;
      try { prefs = JSON.parse(friendPrefs); }
      catch {
        prefs = friendPrefs.split('\n').filter(Boolean).map(line => {
          const parts = line.split(',').map(s => s.trim());
          return { title: parts[0], item_id: parts[0].toLowerCase().replace(/\s+/g, '-'), item_type: parts[1] || 'movie', score: parseFloat(parts[2]) || 80 };
        });
      }
      const res = await generateRecommendation({ account_id: accountId, friend_preferences: prefs });
      setDiscoverResult(res);
    } catch (e) { console.error(e); }
    setDiscoverLoading(false);
  };

  // ── Edit list inline ─────────────────────────────────

  const handleSaveEdit = async () => {
    if (!editingList) return;
    try {
      await updateRecList(editingList.id, {
        title: editingList.title,
        description: editingList.description,
        items_json: editingList.items_json,
      });
      setEditingList(null);
      loadLists();
    } catch (e) { console.error(e); }
  };

  // ── RENDER ─────────────────────────────────────────────

  const now = new Date();
  const upcomingParties = parties.filter(p => !p.proposed_date || new Date(p.proposed_date) >= now);
  const pastParties = parties.filter(p => p.proposed_date && new Date(p.proposed_date) < now);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Recommendations & Watch Parties</h1>
          <p style={s.subtitle}>Share your taste, discover together</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn('primary')} onClick={() => setShowCreateList(true)}>+ New List</button>
          <button style={s.btn('secondary')} onClick={() => setShowCreateParty(true)}>+ Watch Party</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {['lists', 'parties', 'discover'].map(tab => (
          <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'lists' ? 'My Lists' : tab === 'parties' ? 'Watch Parties' : 'Discover'}
          </button>
        ))}
      </div>

      {/* ── MY LISTS TAB ────────────────────────────────── */}
      {activeTab === 'lists' && (
        <>
          {/* Auto-generate buttons */}
          <div style={s.autoRow}>
            {AUTO_TYPES.map(at => (
              <button
                key={at.type}
                style={{ ...s.autoBtn, opacity: generating === at.type ? 0.6 : 1 }}
                onClick={() => handleAutoGenerate(at.type)}
                disabled={!!generating}
              >
                <span>{at.icon}</span>
                {generating === at.type ? 'Generating...' : at.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={s.emptyState}>Loading lists...</div>
          ) : lists.length === 0 ? (
            <div style={s.emptyState}>
              <p style={{ fontSize: 18, marginBottom: 8 }}>No lists yet</p>
              <p>Create a custom list or auto-generate one from your taste profile.</p>
            </div>
          ) : (
            <div style={s.grid}>
              {lists.map(list => {
                const items = Array.isArray(list.items_json) ? list.items_json : [];
                const badge = TYPE_BADGES[list.list_type] || TYPE_BADGES.custom;
                const isExpanded = expandedList === list.id;

                return (
                  <div
                    key={list.id}
                    style={{ ...s.card, ...(isExpanded ? { gridColumn: '1 / -1' } : {}) }}
                    onClick={() => setExpandedList(isExpanded ? null : list.id)}
                  >
                    <span style={s.badge(badge.color)}>{badge.label}</span>
                    <div style={s.cardTitle}>{list.title}</div>
                    <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}>
                      {items.length} item{items.length !== 1 ? 's' : ''} &middot; Updated {new Date(list.updated_at).toLocaleDateString()}
                    </div>
                    {list.description && (
                      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 12, fontStyle: 'italic' }}>{list.description}</div>
                    )}

                    {/* Expanded view */}
                    {isExpanded && (
                      <div onClick={e => e.stopPropagation()}>
                        {items.length === 0 ? (
                          <div style={{ padding: 16, textAlign: 'center', color: COLORS.textMuted }}>No items in this list yet.</div>
                        ) : (
                          items.map((item, idx) => (
                            <div key={idx} style={s.itemRow}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent, minWidth: 24 }}>#{item.rank || idx + 1}</div>
                              {item.poster && <img src={item.poster} alt="" style={s.itemPoster} />}
                              <div style={s.itemInfo}>
                                <div style={s.itemTitle}>{item.title}</div>
                                {item.score && <div style={s.itemMeta}>Score: {item.score}</div>}
                                {item.comment && <div style={s.itemMeta}>{item.comment}</div>}
                              </div>
                            </div>
                          ))
                        )}

                        {/* Share bar */}
                        <div style={s.shareBar}>
                          <button
                            style={s.btn('secondary')}
                            onClick={() => copyToClipboard(shareUrl(list.public_slug))}
                          >
                            Copy Link
                          </button>
                          <a href={SOCIAL_LINKS.x(shareUrl(list.public_slug), list.title)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                            <button style={s.socialBtn}>X</button>
                          </a>
                          <a href={SOCIAL_LINKS.facebook(shareUrl(list.public_slug))} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                            <button style={s.socialBtn}>Facebook</button>
                          </a>
                          <a href={SOCIAL_LINKS.linkedin(shareUrl(list.public_slug), list.title)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                            <button style={s.socialBtn}>LinkedIn</button>
                          </a>
                        </div>

                        {/* Action buttons */}
                        <div style={s.btnRow}>
                          <button style={s.btn('primary')} onClick={() => setEditingList({ ...list })}>Edit</button>
                          <button style={s.btn('danger')} onClick={() => handleDeleteList(list.id)}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── WATCH PARTIES TAB ───────────────────────────── */}
      {activeTab === 'parties' && (
        <div style={s.section}>
          {/* Upcoming */}
          <div style={s.sectionTitle}>Upcoming Parties</div>
          {upcomingParties.length === 0 ? (
            <div style={{ ...s.emptyState, padding: '30px 20px' }}>No upcoming watch parties. Create one!</div>
          ) : (
            <div style={s.grid}>
              {upcomingParties.map(party => (
                <div key={party.id} style={s.card}>
                  <div style={s.cardTitle}>{party.title}</div>
                  <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 4 }}>
                    {party.item_type} {party.item_id ? `\u2014 ${party.item_id}` : ''}
                  </div>
                  {party.proposed_date && (
                    <>
                      <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                        {new Date(party.proposed_date).toLocaleString()}
                      </div>
                      <div style={s.countdown}>{getCountdown(party.proposed_date)}</div>
                    </>
                  )}
                  {party.notes && <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6, fontStyle: 'italic' }}>{party.notes}</div>}
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6 }}>
                    {(Array.isArray(party.attendees_json) ? party.attendees_json : []).length} attendee(s)
                  </div>

                  <div style={s.shareBar}>
                    <button
                      style={s.btn('secondary')}
                      onClick={() => copyToClipboard(shareUrl(party.invite_slug, 'party'))}
                    >
                      Copy Invite Link
                    </button>
                    <a href={SOCIAL_LINKS.x(shareUrl(party.invite_slug, 'party'), party.title)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <button style={s.socialBtn}>X</button>
                    </a>
                    <a href={SOCIAL_LINKS.facebook(shareUrl(party.invite_slug, 'party'))} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <button style={s.socialBtn}>Facebook</button>
                    </a>
                    <a href={SOCIAL_LINKS.linkedin(shareUrl(party.invite_slug, 'party'), party.title)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <button style={s.socialBtn}>LinkedIn</button>
                    </a>
                  </div>

                  <div style={s.btnRow}>
                    <button style={s.btn('danger')} onClick={() => handleDeleteParty(party.id)}>Cancel Party</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Past */}
          {pastParties.length > 0 && (
            <>
              <div style={{ ...s.sectionTitle, marginTop: 32 }}>Past Parties</div>
              <div style={s.grid}>
                {pastParties.map(party => (
                  <div key={party.id} style={{ ...s.card, opacity: 0.7 }}>
                    <div style={s.cardTitle}>{party.title}</div>
                    <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                      {new Date(party.proposed_date).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                      {(Array.isArray(party.attendees_json) ? party.attendees_json : []).length} attendee(s)
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DISCOVER TAB ────────────────────────────────── */}
      {activeTab === 'discover' && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Taste Comparison</div>
          <p style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
            Paste a friend's preferences (JSON array or one per line: title, type, score) to find mutual recommendations.
          </p>
          <div style={s.field}>
            <textarea
              style={s.textarea}
              placeholder={'The Godfather, movie, 95\nPulp Fiction, movie, 90\nDune, book, 88\n\nOR paste a JSON array:\n[{"title":"The Godfather","item_type":"movie","score":95}]'}
              value={friendPrefs}
              onChange={e => setFriendPrefs(e.target.value)}
              rows={6}
            />
          </div>
          <button
            style={{ ...s.btn('primary'), opacity: discoverLoading ? 0.6 : 1 }}
            onClick={handleDiscover}
            disabled={discoverLoading}
          >
            {discoverLoading ? 'Analyzing...' : 'Find Mutual Recommendations'}
          </button>

          {discoverResult && (
            <div style={{ marginTop: 24 }}>
              <div style={{ ...s.card, cursor: 'default' }}>
                <div style={s.cardTitle}>Taste Compatibility</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.accent }}>{discoverResult.compatibility}%</div>
                <div style={s.compatBar}><div style={s.compatFill(discoverResult.compatibility)} /></div>
                <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 8 }}>
                  {discoverResult.taste_overlap} overlapping items found
                </div>
              </div>

              {discoverResult.overlap_items?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={s.sectionTitle}>What You Both Love</div>
                  {discoverResult.overlap_items.map((item, idx) => (
                    <div key={idx} style={s.itemRow}>
                      <div style={s.itemInfo}>
                        <div style={s.itemTitle}>{item.title}</div>
                        {item.score && <div style={s.itemMeta}>Score: {item.score}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {discoverResult.suggestions_for_you?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={s.sectionTitle}>Recommended For You</div>
                  {discoverResult.suggestions_for_you.map((item, idx) => (
                    <div key={idx} style={s.itemRow}>
                      <div style={s.itemInfo}>
                        <div style={s.itemTitle}>{item.title}</div>
                        <div style={s.itemMeta}>{item.item_type} &middot; Score: {item.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {discoverResult.suggestions_for_friend?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={s.sectionTitle}>Recommend To Your Friend</div>
                  {discoverResult.suggestions_for_friend.map((item, idx) => (
                    <div key={idx} style={s.itemRow}>
                      <div style={s.itemInfo}>
                        <div style={s.itemTitle}>{item.title}</div>
                        <div style={s.itemMeta}>{item.item_type} &middot; Score: {item.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE LIST MODAL ───────────────────────────── */}
      {showCreateList && (
        <div style={s.modal} onClick={() => setShowCreateList(false)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Create New List</div>

            <div style={s.field}>
              <label style={s.label}>Title</label>
              <input style={s.input} placeholder="My Top Movies" value={newList.title} onChange={e => setNewList(p => ({ ...p, title: e.target.value }))} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Type</label>
              <select style={s.select} value={newList.list_type} onChange={e => setNewList(p => ({ ...p, list_type: e.target.value }))}>
                {Object.entries(TYPE_BADGES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div style={s.field}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="What this list is about..." value={newList.description} onChange={e => setNewList(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Add Items</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...s.input, flex: 1 }}
                  placeholder="Search by title..."
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                />
                <button style={s.btn('primary')} onClick={handleAddItem}>Add</button>
              </div>
            </div>

            {newList.items.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {newList.items.map((item, idx) => (
                  <div key={idx} style={s.itemRow}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.accent, minWidth: 24 }}>#{item.rank}</div>
                    <div style={s.itemInfo}>
                      <div style={s.itemTitle}>{item.title}</div>
                    </div>
                    <button style={s.btn('ghost')} onClick={() => handleRemoveItem(idx)}>x</button>
                  </div>
                ))}
              </div>
            )}

            <div style={s.btnRow}>
              <button style={s.btn('primary')} onClick={handleCreateList}>Create List</button>
              <button style={s.btn('secondary')} onClick={() => setShowCreateList(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE PARTY MODAL ──────────────────────────── */}
      {showCreateParty && (
        <div style={s.modal} onClick={() => setShowCreateParty(false)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Create Watch Party</div>

            <div style={s.field}>
              <label style={s.label}>Party Title</label>
              <input style={s.input} placeholder="Movie night: Inception" value={newParty.title} onChange={e => setNewParty(p => ({ ...p, title: e.target.value }))} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Item</label>
              <input style={s.input} placeholder="Movie or show title" value={newParty.item_id} onChange={e => setNewParty(p => ({ ...p, item_id: e.target.value }))} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Type</label>
              <select style={s.select} value={newParty.item_type} onChange={e => setNewParty(p => ({ ...p, item_type: e.target.value }))}>
                <option value="movie">Movie</option>
                <option value="tv">TV Show</option>
                <option value="book">Book</option>
                <option value="music">Music</option>
              </select>
            </div>

            <div style={s.field}>
              <label style={s.label}>Date & Time</label>
              <input style={s.input} type="datetime-local" value={newParty.proposed_date} onChange={e => setNewParty(p => ({ ...p, proposed_date: e.target.value }))} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Notes</label>
              <textarea style={s.textarea} placeholder="Any notes for attendees..." value={newParty.notes} onChange={e => setNewParty(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <div style={s.btnRow}>
              <button style={s.btn('primary')} onClick={handleCreateParty}>Create Party</button>
              <button style={s.btn('secondary')} onClick={() => setShowCreateParty(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT LIST MODAL ─────────────────────────────── */}
      {editingList && (
        <div style={s.modal} onClick={() => setEditingList(null)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Edit List</div>

            <div style={s.field}>
              <label style={s.label}>Title</label>
              <input style={s.input} value={editingList.title} onChange={e => setEditingList(p => ({ ...p, title: e.target.value }))} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} value={editingList.description || ''} onChange={e => setEditingList(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div style={s.btnRow}>
              <button style={s.btn('primary')} onClick={handleSaveEdit}>Save Changes</button>
              <button style={s.btn('secondary')} onClick={() => setEditingList(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
