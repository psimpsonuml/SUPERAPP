'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchNostalgiaToday, fetchNostalgiaDate, fetchNostalgiaWeek,
  fetchNostalgiaCalendar, fetchNostalgiaBrowse, rebuildNostalgiaCache,
  shareNostalgiaMemory, fetchNostalgiaStats,
} from '../../../lib/api';

// ── Module colors & labels ──────────────────────────────────

const MODULE_META = {
  facebook:      { color: '#1877f2', label: 'Facebook',      icon: 'f' },
  journal:       { color: '#8b5cf6', label: 'Journal',       icon: 'J' },
  entertainment: { color: '#ef4444', label: 'Entertainment', icon: 'E' },
  books:         { color: '#10b981', label: 'Books',         icon: 'B' },
  music:         { color: '#f59e0b', label: 'Music',         icon: 'M' },
  goals:         { color: '#3b82f6', label: 'Goals',         icon: 'G' },
  family:        { color: '#ec4899', label: 'Family',        icon: 'F' },
  learning:      { color: '#06b6d4', label: 'Learning',      icon: 'L' },
};

function moduleMeta(mod) {
  return MODULE_META[mod] || { color: '#888', label: mod, icon: '?' };
}

// ── Styles ──────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: '#1a1a2e',
    color: '#e2e2e2',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '32px 24px',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 15,
  },
  layout: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  sidebar: {
    width: 280,
    flexShrink: 0,
  },
  card: {
    background: '#16213e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    border: '1px solid #1e3a5f',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 24,
    background: '#16213e',
    borderRadius: 10,
    padding: 4,
  },
  tab: (active) => ({
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    background: active ? '#0f3460' : 'transparent',
    color: active ? '#f59e0b' : '#9ca3af',
    transition: 'all 0.2s',
  }),
  yearGroup: {
    marginBottom: 24,
  },
  yearLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f59e0b',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  yearsAgo: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: 400,
  },
  memoryCard: {
    background: '#1e293b',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    border: '1px solid #2d3a4f',
    transition: 'border-color 0.2s',
  },
  moduleBadge: (color) => ({
    width: 36,
    height: 36,
    borderRadius: 8,
    background: color + '22',
    color: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 14,
    flexShrink: 0,
  }),
  moduleTag: (color) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background: color + '22',
    color: color,
  }),
  preview: {
    fontSize: 14,
    lineHeight: 1.5,
    color: '#d1d5db',
    marginBottom: 6,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  shareBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #374151',
    background: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: 12,
    marginLeft: 'auto',
  },
  btn: (variant) => ({
    padding: '8px 18px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: variant === 'primary' ? '#f59e0b' : variant === 'danger' ? '#ef4444' : '#374151',
    color: variant === 'primary' ? '#1a1a2e' : '#e2e2e2',
    transition: 'opacity 0.2s',
  }),
  statBox: {
    textAlign: 'center',
    padding: 12,
  },
  statNum: {
    fontSize: 28,
    fontWeight: 800,
    color: '#f59e0b',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  calGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
  },
  calDay: (hasMemory, isSelected) => ({
    width: '100%',
    aspectRatio: '1',
    borderRadius: 8,
    border: isSelected ? '2px solid #f59e0b' : '1px solid #2d3a4f',
    background: hasMemory ? '#1e3a5f' : '#16213e',
    color: hasMemory ? '#f59e0b' : '#6b7280',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: hasMemory ? 'pointer' : 'default',
    fontSize: 13,
    fontWeight: hasMemory ? 700 : 400,
    position: 'relative',
    transition: 'all 0.2s',
  }),
  dot: (color) => ({
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: color,
  }),
  filterRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  filterChip: (active) => ({
    padding: '6px 14px',
    borderRadius: 20,
    border: active ? '1px solid #f59e0b' : '1px solid #374151',
    background: active ? '#f59e0b22' : 'transparent',
    color: active ? '#f59e0b' : '#9ca3af',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  }),
  select: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #374151',
    background: '#16213e',
    color: '#e2e2e2',
    fontSize: 13,
  },
  pieContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  pieItem: (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: '#d1d5db',
  }),
  pieDot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),
  empty: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#6b7280',
  },
};

// ── Memory Card Component ───────────────────────────────────

function MemoryCard({ memory, onShare }) {
  const meta = moduleMeta(memory.source_module);
  return (
    <div style={S.memoryCard}>
      <div style={S.moduleBadge(meta.color)}>{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.preview}>{memory.content_preview}</div>
        <div style={S.metaRow}>
          <span style={S.moduleTag(meta.color)}>{meta.label}</span>
          <span>{memory.year}</span>
          {memory.years_ago != null && (
            <span style={{ color: '#f59e0b' }}>{memory.years_ago} year{memory.years_ago !== 1 ? 's' : ''} ago</span>
          )}
          <button
            style={S.shareBtn}
            onClick={() => onShare(memory.id)}
            title="Share this memory"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Today Tab ───────────────────────────────────────────────

function TodayTab({ memories, dateLabel, onShare, loading }) {
  const years = Object.keys(memories).sort((a, b) => b - a);

  if (loading) return <div style={S.empty}>Loading memories...</div>;
  if (years.length === 0) return (
    <div style={S.empty}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>No memories for today</div>
      <p>Try rebuilding your cache or check back on another day.</p>
    </div>
  );

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: '#9ca3af' }}>On This Day</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{dateLabel}</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{years.length} year{years.length !== 1 ? 's' : ''} of memories</div>
      </div>
      {years.map(year => (
        <div key={year} style={S.yearGroup}>
          <div style={S.yearLabel}>
            <span>{year}</span>
            <span style={S.yearsAgo}>
              {memories[year][0]?.years_ago} year{memories[year][0]?.years_ago !== 1 ? 's' : ''} ago
            </span>
          </div>
          {memories[year].map((m, i) => (
            <MemoryCard key={m.id || i} memory={m} onShare={onShare} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Browse Tab ──────────────────────────────────────────────

function BrowseTab({ onShare }) {
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterModule, setFilterModule] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNostalgiaBrowse({ page, source_module: filterModule || undefined, year: filterYear || undefined });
      setMemories(res.memories || []);
      setTotal(res.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, filterModule, filterYear]);

  useEffect(() => { load(); }, [load]);

  const allModules = Object.keys(MODULE_META);
  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div>
      <div style={S.filterRow}>
        <button style={S.filterChip(!filterModule)} onClick={() => { setFilterModule(''); setPage(1); }}>All</button>
        {allModules.map(mod => (
          <button
            key={mod}
            style={S.filterChip(filterModule === mod)}
            onClick={() => { setFilterModule(mod); setPage(1); }}
          >
            {moduleMeta(mod).label}
          </button>
        ))}
        <select
          style={S.select}
          value={filterYear}
          onChange={e => { setFilterYear(e.target.value); setPage(1); }}
        >
          <option value="">All Years</option>
          {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={S.empty}>Loading...</div>
      ) : memories.length === 0 ? (
        <div style={S.empty}>No memories found. Try rebuilding the cache.</div>
      ) : (
        <>
          {memories.map((m, i) => (
            <MemoryCard key={m.id || i} memory={m} onShare={onShare} />
          ))}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
            <button
              style={S.btn()}
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <span style={{ color: '#9ca3af', fontSize: 13, alignSelf: 'center' }}>
              Page {page} of {totalPages}
            </span>
            <button
              style={S.btn()}
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Calendar Tab ────────────────────────────────────────────

function CalendarTab({ onShare }) {
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [days, setDays] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateMemories, setDateMemories] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchNostalgiaCalendar({ month: calMonth, year: calYear });
        setDays(res.days || {});
      } catch (e) { console.error(e); }
    })();
  }, [calMonth, calYear]);

  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
  const blanks = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Mon start

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const handleDayClick = async (day) => {
    const hasM = days[day];
    if (!hasM) return;
    const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setLoading(true);
    try {
      const res = await fetchNostalgiaDate(dateStr);
      setDateMemories(res.memories || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const prevMonth = () => {
    if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
    setSelectedDate(null);
  };

  const dateYears = Object.keys(dateMemories).sort((a, b) => b - a);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button style={S.btn()} onClick={prevMonth}>&lt;</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>
          {monthNames[calMonth - 1]} {calYear}
        </span>
        <button style={S.btn()} onClick={nextMonth}>&gt;</button>
      </div>

      <div style={S.calGrid}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', padding: 4, fontWeight: 600 }}>{d}</div>
        ))}
        {Array.from({ length: blanks }).map((_, i) => <div key={'b' + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const hasM = !!days[day];
          const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSel = selectedDate === dateStr;
          return (
            <div
              key={day}
              style={S.calDay(hasM, isSel)}
              onClick={() => handleDayClick(day)}
            >
              <span>{day}</span>
              {hasM && (
                <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                  {days[day].slice(0, 3).map((mod, j) => (
                    <div key={j} style={S.dot(moduleMeta(mod).color)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }}>
            Memories on {selectedDate}
          </div>
          {loading ? (
            <div style={S.empty}>Loading...</div>
          ) : dateYears.length === 0 ? (
            <div style={S.empty}>No memories found for this date.</div>
          ) : (
            dateYears.map(year => (
              <div key={year} style={S.yearGroup}>
                <div style={S.yearLabel}>{year}</div>
                {dateMemories[year].map((m, i) => (
                  <MemoryCard key={m.id || i} memory={m} onShare={onShare} />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Stats Sidebar ───────────────────────────────────────────

function StatsSidebar({ stats, onRebuild, rebuilding }) {
  const modules = stats.by_module || {};
  const total = stats.total || 0;

  return (
    <div>
      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}>Memory Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={S.statBox}>
            <div style={S.statNum}>{total}</div>
            <div style={S.statLabel}>Total Memories</div>
          </div>
          <div style={S.statBox}>
            <div style={S.statNum}>{stats.years_covered || 0}</div>
            <div style={S.statLabel}>Years Covered</div>
          </div>
        </div>
        {stats.oldest_year && stats.newest_year && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            {stats.oldest_year} — {stats.newest_year}
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#f59e0b' }}>By Source</div>
        {Object.entries(modules).sort((a, b) => b[1] - a[1]).map(([mod, count]) => {
          const meta = moduleMeta(mod);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={mod} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={S.pieDot(meta.color)} />
                  {meta.label}
                </span>
                <span style={{ color: '#9ca3af' }}>{count} ({pct}%)</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#2d3a4f' }}>
                <div style={{ height: '100%', borderRadius: 2, background: meta.color, width: pct + '%', transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })}
        {Object.keys(modules).length === 0 && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>No data yet</div>
        )}
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#f59e0b' }}>Settings</div>
        <button
          style={{ ...S.btn('primary'), width: '100%', opacity: rebuilding ? 0.6 : 1 }}
          onClick={onRebuild}
          disabled={rebuilding}
        >
          {rebuilding ? 'Rebuilding...' : 'Rebuild Cache'}
        </button>
        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
          Scans all source modules and rebuilds the nostalgia cache.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────

export default function NostalgiaPage() {
  const [tab, setTab] = useState('today');
  const [todayMemories, setTodayMemories] = useState({});
  const [todayDate, setTodayDate] = useState('');
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [shareToast, setShareToast] = useState(null);

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchNostalgiaToday();
      setTodayMemories(res.memories || {});
      setTodayDate(res.date || '');
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchNostalgiaStats();
      setStats(res || {});
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    loadToday();
    loadStats();
  }, [loadToday, loadStats]);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      await rebuildNostalgiaCache();
      await loadToday();
      await loadStats();
    } catch (e) { console.error(e); }
    setRebuilding(false);
  };

  const handleShare = async (memoryId) => {
    try {
      const res = await shareNostalgiaMemory(memoryId);
      if (res.text) {
        await navigator.clipboard.writeText(res.text);
        setShareToast('Copied to clipboard!');
        setTimeout(() => setShareToast(null), 2500);
      }
    } catch (e) {
      console.error(e);
      setShareToast('Failed to share');
      setTimeout(() => setShareToast(null), 2500);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <h1 style={S.title}>Nostalgia Engine</h1>
          <p style={S.subtitle}>Your personal time machine — memories across every module</p>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {['today', 'browse', 'calendar'].map(t => (
            <button
              key={t}
              style={S.tab(tab === t)}
              onClick={() => setTab(t)}
            >
              {t === 'today' ? 'Today' : t === 'browse' ? 'Browse' : 'Calendar'}
            </button>
          ))}
        </div>

        {/* Layout */}
        <div style={S.layout}>
          <div style={S.main}>
            {tab === 'today' && (
              <TodayTab
                memories={todayMemories}
                dateLabel={formatDate(todayDate)}
                onShare={handleShare}
                loading={loading}
              />
            )}
            {tab === 'browse' && (
              <BrowseTab onShare={handleShare} />
            )}
            {tab === 'calendar' && (
              <CalendarTab onShare={handleShare} />
            )}
          </div>

          <div style={S.sidebar}>
            <StatsSidebar
              stats={stats}
              onRebuild={handleRebuild}
              rebuilding={rebuilding}
            />
          </div>
        </div>

        {/* Share toast */}
        {shareToast && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#10b981',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 14,
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            {shareToast}
          </div>
        )}
      </div>
    </div>
  );
}
