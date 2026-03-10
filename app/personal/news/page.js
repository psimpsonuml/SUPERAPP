'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchNewsFeed, saveNewsItem, fetchMorningBriefing, fetchNewsFeedPreferences, updateNewsFeedPreferences } from '../../../lib/api';

// ── Constants ─────────────────────────────────────────────
const TOPICS = [
  { id: 'all', label: 'All' },
  { id: 'politics', label: 'Politics' },
  { id: 'tech', label: 'Tech & AI' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'history', label: 'History' },
  { id: 'payroll_hr', label: 'Payroll/HR' },
  { id: 'personal_finance', label: 'Personal Finance' },
  { id: 'business', label: 'Business' },
];

const TOPIC_COLORS = {
  politics: '#6366f1',
  tech: '#06b6d4',
  gaming: '#22c55e',
  history: '#d97706',
  payroll_hr: '#ec4899',
  personal_finance: '#8b5cf6',
  business: '#0ea5e9',
  social: '#f43f5e',
  general: '#6b7280',
};

const LEAN_STYLES = {
  left: { label: 'Left', bg: '#dbeafe', color: '#1d4ed8' },
  center: { label: 'Center', bg: '#f3f4f6', color: '#374151' },
  right: { label: 'Right', bg: '#fee2e2', color: '#dc2626' },
};

const SENTIMENT_ICONS = {
  positive: { symbol: '+', color: '#059669' },
  negative: { symbol: '-', color: '#dc2626' },
  neutral: { symbol: '~', color: '#6b7280' },
  mixed: { symbol: '?', color: '#d97706' },
};

const SOCIAL_ICONS = { twitter: 'X', x: 'X', reddit: 'R', linkedin: 'in' };

const NEWS_SOURCES = {
  politics: {
    left: ['NPR', 'MSNBC', 'The Guardian', 'Vox'],
    center: ['Reuters', 'AP', 'BBC', 'PBS'],
    right: ['Fox News', 'Wall Street Journal', 'National Review', 'The Daily Wire'],
  },
  tech: ['TechCrunch', 'The Verge', 'Ars Technica', 'Hacker News', 'The Batch', 'Import AI', "Ben's Bites"],
  gaming: ['PC Gamer', 'Kotaku', 'Rock Paper Shotgun'],
  history: ['r/alternatehistory', 'r/history'],
  payroll_hr: ['SHRM', 'APA', 'HR Dive'],
  personal_finance: ['NerdWallet', 'The Penny Hoarder', 'Mr. Money Mustache', 'r/personalfinance'],
};

export default function NewsFeedPage() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTopic, setActiveTopic] = useState('all');
  const [sortMode, setSortMode] = useState('chronological');
  const [showSaved, setShowSaved] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState(new Set());
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [disabledSources, setDisabledSources] = useState([]);
  const [totalItems, setTotalItems] = useState(0);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNewsFeed({ topic: activeTopic, saved: showSaved, sort: sortMode });
      setFeed(data.feed || []);
      setTotalItems(data.totalItems || 0);
    } catch { setFeed([]); }
    setLoading(false);
  }, [activeTopic, showSaved, sortMode]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  useEffect(() => {
    (async () => {
      try {
        const { preferences } = await fetchNewsFeedPreferences();
        if (preferences?.disabled_sources) setDisabledSources(preferences.disabled_sources);
        if (preferences?.sort_mode) setSortMode(preferences.sort_mode);
      } catch { /* use defaults */ }
    })();
  }, []);

  const handleSave = async (itemId, currentSaved) => {
    try {
      await saveNewsItem(itemId, !currentSaved);
      setFeed(prev => prev.map(entry => {
        if (entry.type === 'item' && entry.id === itemId) return { ...entry, saved: !currentSaved };
        if (entry.type === 'cluster') {
          return { ...entry, items: entry.items.map(i => i.id === itemId ? { ...i, saved: !currentSaved } : i) };
        }
        return entry;
      }));
    } catch { /* noop */ }
  };

  const toggleCluster = (clusterId) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      next.has(clusterId) ? next.delete(clusterId) : next.add(clusterId);
      return next;
    });
  };

  const loadBriefing = async (refresh = false) => {
    setBriefingLoading(true);
    setShowBriefing(true);
    try {
      const data = await fetchMorningBriefing(refresh);
      setBriefing(data.briefing);
    } catch { setBriefing(null); }
    setBriefingLoading(false);
  };

  const toggleSource = async (source) => {
    const next = disabledSources.includes(source)
      ? disabledSources.filter(s => s !== source)
      : [...disabledSources, source];
    setDisabledSources(next);
    try { await updateNewsFeedPreferences({ disabled_sources: next, sort_mode: sortMode }); } catch { /* noop */ }
  };

  const filteredFeed = feed.filter(entry => {
    if (entry.type === 'item') return !disabledSources.includes(entry.source);
    if (entry.type === 'cluster') return entry.items.some(i => !disabledSources.includes(i.source));
    return true;
  });

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>News & Social Feed</h1>
            <p>Unified multi-viewpoint news and social media across all your interests</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => loadBriefing(false)}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}>
              Morning Brief
            </button>
            <button className="btn btn-sm" onClick={() => setShowSourcePanel(!showSourcePanel)}>Sources</button>
          </div>
        </div>
      </div>

      {/* ── Morning Briefing ────────────────────────────── */}
      {showBriefing && (
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          borderRadius: 12, padding: 20, marginBottom: 20, color: '#e0e7ff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>Morning Brief</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => loadBriefing(true)} className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#e0e7ff', border: 'none', fontSize: 11 }}>
                Refresh
              </button>
              <button onClick={() => setShowBriefing(false)} className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#e0e7ff', border: 'none', fontSize: 11 }}>
                Close
              </button>
            </div>
          </div>
          {briefingLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#a5b4fc' }}>Generating your personalized briefing...</div>
          ) : briefing ? (
            <>
              <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{briefing.briefing_text}</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 11, color: '#a5b4fc' }}>
                <span>{briefing.story_count} stories covered</span>
                {briefing.topics_covered?.map(t => (
                  <span key={t} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.1)' }}>{t}</span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color: '#a5b4fc' }}>No stories available yet for today&apos;s briefing.</div>
          )}
        </div>
      )}

      {/* ── Source management panel ─────────────────────── */}
      {showSourcePanel && (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 16, marginBottom: 20,
        }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Source Management</h4>
          <div className="text-xs text-muted" style={{ marginBottom: 12 }}>
            Click a source to toggle it on/off. Political sources are labeled with their lean for coverage balance.
          </div>
          {Object.entries(NEWS_SOURCES).map(([topic, sources]) => (
            <div key={topic} style={{ marginBottom: 12 }}>
              <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', marginBottom: 6 }}>
                {TOPICS.find(t => t.id === topic)?.label || topic}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Array.isArray(sources) ? sources : [...(sources.left || []), ...(sources.center || []), ...(sources.right || [])]).map(src => {
                  const disabled = disabledSources.includes(src);
                  let lean = null;
                  if (typeof sources === 'object' && !Array.isArray(sources)) {
                    for (const [l, list] of Object.entries(sources)) {
                      if (list.includes(src)) lean = l;
                    }
                  }
                  return (
                    <button key={src} onClick={() => toggleSource(src)} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      border: '1px solid var(--border)', cursor: 'pointer',
                      background: disabled ? 'var(--bg)' : lean ? LEAN_STYLES[lean]?.bg : '#f0fdf4',
                      color: disabled ? 'var(--text-muted)' : lean ? LEAN_STYLES[lean]?.color : '#166534',
                      opacity: disabled ? 0.5 : 1,
                      textDecoration: disabled ? 'line-through' : 'none',
                    }}>
                      {src}{lean ? ` (${lean[0].toUpperCase()})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Topic filter bar ───────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {TOPICS.map(t => (
          <button key={t.id} onClick={() => setActiveTopic(t.id)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: activeTopic === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
            background: activeTopic === t.id ? 'var(--accent)' : 'var(--card-bg)',
            color: activeTopic === t.id ? '#fff' : 'var(--text)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowSaved(!showSaved)} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11, border: '1px solid var(--border)',
            background: showSaved ? '#fef3c7' : 'var(--card-bg)', cursor: 'pointer',
            color: showSaved ? '#92400e' : 'var(--text-muted)',
          }}>
            {showSaved ? 'Showing Saved' : 'Saved'}
          </button>
          <select value={sortMode} onChange={e => {
            setSortMode(e.target.value);
            updateNewsFeedPreferences({ disabled_sources: disabledSources, sort_mode: e.target.value }).catch(() => {});
          }} style={{
            padding: '5px 8px', borderRadius: 6, fontSize: 11, border: '1px solid var(--border)',
            background: 'var(--card-bg)', cursor: 'pointer',
          }}>
            <option value="chronological">Chronological</option>
            <option value="relevance">By Relevance</option>
          </select>
        </div>
      </div>

      {/* ── Feed info bar ──────────────────────────────── */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        {totalItems} items{activeTopic !== 'all' ? ` in ${TOPICS.find(t => t.id === activeTopic)?.label}` : ''}
        {showSaved ? ' (saved only)' : ''} — reverse chronological, no algorithmic ranking
      </div>

      {/* ── Feed ───────────────────────────────────────── */}
      {loading ? (
        <div className="loading"><div className="spinner" />Loading feed...</div>
      ) : filteredFeed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">N</div>
          <p>No news items yet.</p>
          <p className="text-sm text-muted mt-2">
            The News & Social Feed agent aggregates articles from configured sources.
            Items will appear here once the agent runs.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredFeed.map(entry => (
            entry.type === 'cluster'
              ? <ClusterCard key={entry.id} cluster={entry} expanded={expandedClusters.has(entry.id)} onToggle={toggleCluster} onSave={handleSave} />
              : <NewsCard key={entry.id} item={entry} onSave={handleSave} />
          ))}
        </div>
      )}
    </>
  );
}

// ── News Card Component ───────────────────────────────────
function NewsCard({ item, onSave }) {
  const topicColor = TOPIC_COLORS[item.topic] || TOPIC_COLORS.general;
  const lean = item.source_lean ? LEAN_STYLES[item.source_lean] : null;
  const isSocial = item.source_type === 'social';
  const socialIcon = isSocial ? SOCIAL_ICONS[item.social_platform] || item.social_platform?.[0]?.toUpperCase() : null;

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 8, padding: 14,
      border: '1px solid var(--border)', borderLeft: `3px solid ${topicColor}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {isSocial && socialIcon && (
            <span style={{
              width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f43f5e', color: '#fff', fontSize: 10, fontWeight: 700,
            }}>{socialIcon}</span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: `${topicColor}18`, color: topicColor,
          }}>
            {TOPICS.find(t => t.id === item.topic)?.label || item.topic}
          </span>
          <span className="text-xs text-muted">{item.source}</span>
          {lean && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              background: lean.bg, color: lean.color,
            }}>{lean.label}</span>
          )}
          {item.sentiment && (
            <span style={{ fontSize: 10, fontWeight: 700, color: SENTIMENT_ICONS[item.sentiment]?.color || '#6b7280' }}
              title={`Sentiment: ${item.sentiment}`}>
              {SENTIMENT_ICONS[item.sentiment]?.symbol || ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
            {item.published_at ? timeAgo(item.published_at) : ''}
          </span>
          <button onClick={() => onSave(item.id, item.saved)} title={item.saved ? 'Unsave' : 'Save for later'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0,
              color: item.saved ? '#d97706' : 'var(--text-muted)',
            }}>
            {item.saved ? '\u2605' : '\u2606'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>
        {item.source_url ? (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text)', textDecoration: 'none' }}
            onMouseOver={e => { e.target.style.color = 'var(--accent)'; }}
            onMouseOut={e => { e.target.style.color = 'var(--text)'; }}>
            {item.headline}
          </a>
        ) : item.headline}
      </div>

      {item.summary && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
          {item.summary}
        </p>
      )}

      {isSocial && item.social_author && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>@{item.social_author}</div>
      )}
    </div>
  );
}

// ── Cluster Card Component ────────────────────────────────
function ClusterCard({ cluster, expanded, onToggle, onSave }) {
  const topicColor = TOPIC_COLORS[cluster.topic] || TOPIC_COLORS.general;

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 10, overflow: 'hidden',
      border: '1px solid var(--border)', borderLeft: `3px solid ${topicColor}`,
    }}>
      <button onClick={() => onToggle(cluster.id)} style={{
        width: '100%', padding: '14px 16px', border: 'none', cursor: 'pointer',
        background: `${topicColor}08`, textAlign: 'left',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              background: `${topicColor}18`, color: topicColor,
            }}>
              Covered by {cluster.source_count} sources
            </span>
            {cluster.sentiment && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: `${SENTIMENT_ICONS[cluster.sentiment]?.color || '#6b7280'}18`,
                color: SENTIMENT_ICONS[cluster.sentiment]?.color || '#6b7280',
              }}>
                {cluster.sentiment}
              </span>
            )}
            <span className="text-xs text-muted">{cluster.published_at ? timeAgo(cluster.published_at) : ''}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{cluster.cluster_title}</div>
        </div>
        <span style={{
          fontSize: 18, color: 'var(--text-muted)',
          transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
        }}>&#9660;</span>
      </button>

      {cluster.synthesis && (
        <div style={{
          padding: '8px 16px', fontSize: 12, color: 'var(--text-secondary)',
          lineHeight: 1.6, background: `${topicColor}04`, borderTop: '1px solid var(--border)',
        }}>
          {cluster.synthesis}
        </div>
      )}

      {expanded && (
        <div style={{ padding: '8px 12px 12px' }}>
          <div className="text-xs text-muted font-semibold" style={{ marginBottom: 8 }}>Individual Coverage</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cluster.items.map(item => (
              <NewsCard key={item.id} item={item} onSave={onSave} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
