'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchJournalEntries, fetchJournalEntry, createJournalEntry, updateJournalEntry,
  deleteJournalEntry, fetchJournalStreak, fetchJournalCalendar, fetchJournalPrompt,
  fetchJournalReflections, generateMonthlyReflection, searchJournal,
} from '../../../lib/api';

// ── Constants ────────────────────────────────────────────────
const ACCOUNT_ID = 'default';

const ENTRY_TYPES = [
  { key: 'journal',         label: 'Journal',         icon: '📝', color: '#f59e0b' },
  { key: 'gratitude',       label: 'Gratitude',       icon: '🙏', color: '#10b981' },
  { key: 'goal_reflection', label: 'Goal Reflection', icon: '🎯', color: '#6366f1' },
  { key: 'vent',            label: 'Vent',            icon: '🌊', color: '#ef4444' },
  { key: 'win',             label: 'Win',             icon: '🏆', color: '#eab308' },
];

const TABS = ['Write', 'Browse', 'Calendar', 'Reflections'];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Styles ───────────────────────────────────────────────────
const s = {
  page: { minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0', padding: '24px 32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: '#f59e0b', margin: 0 },
  streakBadge: { display: 'flex', alignItems: 'center', gap: 8, background: '#f59e0b22', border: '1px solid #f59e0b44', borderRadius: 12, padding: '8px 16px', fontSize: 14 },
  streakNum: { fontSize: 24, fontWeight: 700, color: '#f59e0b' },
  tabs: { display: 'flex', gap: 4, marginBottom: 24, background: '#16162a', borderRadius: 10, padding: 4 },
  tab: (active) => ({ padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, background: active ? '#f59e0b' : 'transparent', color: active ? '#1a1a2e' : '#888', transition: 'all .2s' }),
  card: { background: '#16162a', borderRadius: 12, border: '1px solid #ffffff0a', padding: 20, marginBottom: 16 },
  promptCard: { background: 'linear-gradient(135deg, #f59e0b15, #f59e0b05)', border: '1px solid #f59e0b33', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  promptText: { fontSize: 15, color: '#f59e0b', fontStyle: 'italic', lineHeight: 1.5, flex: 1 },
  dismissBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0 },
  typeSelector: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  typeBtn: (active, color) => ({ padding: '8px 14px', borderRadius: 8, border: `1px solid ${active ? color : '#333'}`, background: active ? color + '22' : '#1a1a2e', color: active ? color : '#888', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s' }),
  toolbar: { display: 'flex', gap: 4, marginBottom: 8 },
  toolBtn: { background: '#1a1a2e', border: '1px solid #333', color: '#aaa', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  textarea: { width: '100%', minHeight: 300, background: '#0d0d1a', border: '1px solid #333', borderRadius: 10, color: '#e0e0e0', fontSize: 15, lineHeight: 1.7, padding: 16, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  gratitudeInput: { width: '100%', background: '#0d0d1a', border: '1px solid #333', borderRadius: 8, color: '#e0e0e0', fontSize: 14, padding: '10px 14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8 },
  submitBtn: { background: '#f59e0b', color: '#1a1a2e', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 12 },
  submitBtnDisabled: { background: '#f59e0b44', color: '#1a1a2e88', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'not-allowed', marginTop: 12 },
  filterBar: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  input: { background: '#0d0d1a', border: '1px solid #333', borderRadius: 8, color: '#e0e0e0', fontSize: 13, padding: '8px 12px', outline: 'none' },
  select: { background: '#0d0d1a', border: '1px solid #333', borderRadius: 8, color: '#e0e0e0', fontSize: 13, padding: '8px 12px', outline: 'none' },
  entryCard: (color) => ({ background: '#16162a', borderRadius: 10, border: '1px solid #ffffff0a', borderLeft: `3px solid ${color}`, padding: '14px 18px', marginBottom: 10, cursor: 'pointer', transition: 'background .15s' }),
  entryDate: { fontSize: 12, color: '#666', marginBottom: 4 },
  entryType: (color) => ({ fontSize: 11, color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }),
  entryContent: { fontSize: 14, color: '#ccc', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginTop: 6 },
  sentimentDot: (score) => ({ width: 8, height: 8, borderRadius: '50%', background: score > 0.6 ? '#10b981' : score > 0.35 ? '#f59e0b' : '#ef4444', display: 'inline-block', marginLeft: 6 }),
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 12 },
  calDay: (hasEntry, isToday) => ({ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: isToday ? '#f59e0b22' : hasEntry ? '#16162a' : '#0d0d1a', border: isToday ? '1px solid #f59e0b44' : '1px solid #ffffff06', cursor: hasEntry ? 'pointer' : 'default', fontSize: 13, color: hasEntry ? '#e0e0e0' : '#444', position: 'relative', transition: 'all .15s' }),
  calDot: (color) => ({ width: 5, height: 5, borderRadius: '50%', background: color, marginTop: 2 }),
  calHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNav: { background: 'none', border: '1px solid #333', color: '#aaa', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 },
  chartBar: (height, color) => ({ width: 32, height: `${height}%`, background: color, borderRadius: '4px 4px 0 0', minHeight: 2, transition: 'height .3s' }),
  chartContainer: { display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 8px' },
  reflectionCard: { background: '#16162a', borderRadius: 12, border: '1px solid #f59e0b22', padding: 20, marginTop: 16, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14, color: '#ccc' },
  deleteBtn: { background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' },
  backBtn: { background: 'none', border: '1px solid #333', color: '#aaa', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' },
  editBtn: { background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' },
  modal: { position: 'fixed', inset: 0, background: '#000000aa', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#1a1a2e', borderRadius: 14, border: '1px solid #333', padding: 24, maxWidth: 640, width: '90%', maxHeight: '80vh', overflow: 'auto' },
  empty: { textAlign: 'center', color: '#555', padding: 40, fontSize: 14 },
};

// ── Main Component ───────────────────────────────────────────
export default function JournalPage() {
  const [tab, setTab] = useState('Write');
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [prompt, setPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(true);
  const [saving, setSaving] = useState(false);

  // Write state
  const [entryType, setEntryType] = useState('journal');
  const [content, setContent] = useState('');
  const [gratitudeItems, setGratitudeItems] = useState(['', '', '']);
  const textareaRef = useRef(null);

  // Browse state
  const [entries, setEntries] = useState([]);
  const [browseFilter, setBrowseFilter] = useState({ type: '', search: '', date_from: '', date_to: '' });
  const [browsePage, setBrowsePage] = useState(1);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Calendar state
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calDates, setCalDates] = useState({});

  // Reflections state
  const [reflectionData, setReflectionData] = useState([]);
  const [monthlyReflection, setMonthlyReflection] = useState('');
  const [generatingReflection, setGeneratingReflection] = useState(false);

  // Detail modal
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  // ── Load streak and prompt on mount ──────────────────────
  useEffect(() => {
    loadStreak();
    loadPrompt();
  }, []);

  useEffect(() => {
    if (tab === 'Browse') loadEntries();
  }, [tab, browseFilter, browsePage]);

  useEffect(() => {
    if (tab === 'Calendar') loadCalendar();
  }, [tab, calYear, calMonth]);

  useEffect(() => {
    if (tab === 'Reflections') loadReflections();
  }, [tab]);

  const loadStreak = useCallback(async () => {
    try {
      const data = await fetchJournalStreak({ account_id: ACCOUNT_ID });
      setStreak(data);
    } catch { /* fallback */ }
  }, []);

  const loadPrompt = useCallback(async () => {
    try {
      const data = await fetchJournalPrompt();
      setPrompt(data.prompt || '');
    } catch { /* fallback */ }
  }, []);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const params = { account_id: ACCOUNT_ID, page: browsePage, limit: 20 };
      if (browseFilter.type) params.type = browseFilter.type;
      if (browseFilter.date_from) params.date_from = browseFilter.date_from;
      if (browseFilter.date_to) params.date_to = browseFilter.date_to;

      let data;
      if (browseFilter.search) {
        data = await searchJournal({ account_id: ACCOUNT_ID, q: browseFilter.search, page: browsePage });
        setEntries(data.results || []);
      } else {
        data = await fetchJournalEntries(params);
        setEntries(data.entries || []);
        if (data.streak) setStreak(data.streak);
      }
    } catch { setEntries([]); }
    setLoadingEntries(false);
  }, [browseFilter, browsePage]);

  const loadCalendar = useCallback(async () => {
    try {
      const data = await fetchJournalCalendar({ account_id: ACCOUNT_ID, year: calYear, month: calMonth });
      setCalDates(data.dates || {});
    } catch { setCalDates({}); }
  }, [calYear, calMonth]);

  const loadReflections = useCallback(async () => {
    try {
      const data = await fetchJournalReflections({ account_id: ACCOUNT_ID, months: 12 });
      setReflectionData(data.months || []);
    } catch { setReflectionData([]); }
  }, []);

  // ── Actions ────────────────────────────────────────────────
  const handleSave = async () => {
    let finalContent = content;
    if (entryType === 'gratitude') {
      const items = gratitudeItems.filter(g => g.trim());
      if (!items.length) return;
      finalContent = items.map((g, i) => `${i + 1}. ${g}`).join('\n');
    }
    if (!finalContent.trim()) return;

    setSaving(true);
    try {
      await createJournalEntry({
        account_id: ACCOUNT_ID,
        entry_type: entryType,
        content: finalContent,
        prompt_used: showPrompt ? prompt : '',
      });
      setContent('');
      setGratitudeItems(['', '', '']);
      loadStreak();
    } catch { /* show error */ }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteJournalEntry(id);
      setSelectedEntry(null);
      if (tab === 'Browse') loadEntries();
      if (tab === 'Calendar') loadCalendar();
    } catch { /* error */ }
  };

  const handleUpdate = async () => {
    if (!selectedEntry || !editContent.trim()) return;
    try {
      const updated = await updateJournalEntry(selectedEntry.id, { content: editContent });
      setSelectedEntry(updated);
      setEditing(false);
      if (tab === 'Browse') loadEntries();
    } catch { /* error */ }
  };

  const handleGenerateReflection = async () => {
    setGeneratingReflection(true);
    try {
      const now = new Date();
      const data = await generateMonthlyReflection({
        account_id: ACCOUNT_ID,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
      setMonthlyReflection(data.reflection || '');
    } catch { setMonthlyReflection('Could not generate reflection.'); }
    setGeneratingReflection(false);
  };

  const insertFormatting = (prefix, suffix) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end);
    const newContent = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const typeColor = (type) => ENTRY_TYPES.find(t => t.key === type)?.color || '#f59e0b';
  const typeLabel = (type) => ENTRY_TYPES.find(t => t.key === type)?.label || type;
  const typeIcon = (type) => ENTRY_TYPES.find(t => t.key === type)?.icon || '📝';

  // ── Calendar helpers ───────────────────────────────────────
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
  const todayStr = new Date().toISOString().split('T')[0];

  const prevMonth = () => {
    if (calMonth === 1) { setCalMonth(12); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalMonth(1); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  const handleCalDayClick = async (dateStr) => {
    if (!calDates[dateStr]) return;
    const entry = calDates[dateStr][0];
    try {
      const full = await fetchJournalEntry(entry.id);
      setSelectedEntry(full);
    } catch { /* error */ }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Journal & Reflections</h1>
        <div style={s.streakBadge}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <div>
            <div style={s.streakNum}>{streak.current}</div>
            <div style={{ fontSize: 11, color: '#999' }}>day streak</div>
          </div>
          <div style={{ borderLeft: '1px solid #f59e0b33', paddingLeft: 12, marginLeft: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f59e0b' }}>{streak.longest}</div>
            <div style={{ fontSize: 11, color: '#999' }}>best</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── Write Tab ──────────────────────────────────────── */}
      {tab === 'Write' && (
        <div>
          {/* Daily Prompt */}
          {showPrompt && prompt && (
            <div style={s.promptCard}>
              <div>
                <div style={{ fontSize: 11, color: '#f59e0b88', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>Today&apos;s Prompt</div>
                <div style={s.promptText}>{prompt}</div>
              </div>
              <button style={s.dismissBtn} onClick={() => setShowPrompt(false)} title="Dismiss">×</button>
            </div>
          )}

          {/* Entry Type Selector */}
          <div style={s.typeSelector}>
            {ENTRY_TYPES.map(t => (
              <button
                key={t.key}
                style={s.typeBtn(entryType === t.key, t.color)}
                onClick={() => setEntryType(t.key)}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Writing Area */}
          <div style={s.card}>
            {entryType === 'gratitude' ? (
              <div>
                <div style={{ fontSize: 14, color: '#10b981', marginBottom: 12, fontWeight: 500 }}>
                  🙏 What are you grateful for today?
                </div>
                {gratitudeItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: '#10b981', fontSize: 14, fontWeight: 600 }}>{i + 1}.</span>
                    <input
                      style={s.gratitudeInput}
                      placeholder={`I'm grateful for...`}
                      value={item}
                      onChange={(e) => {
                        const next = [...gratitudeItems];
                        next[i] = e.target.value;
                        setGratitudeItems(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {/* Formatting Toolbar */}
                <div style={s.toolbar}>
                  <button style={s.toolBtn} onClick={() => insertFormatting('**', '**')} title="Bold"><b>B</b></button>
                  <button style={s.toolBtn} onClick={() => insertFormatting('*', '*')} title="Italic"><i>I</i></button>
                  <button style={s.toolBtn} onClick={() => insertFormatting('\n- ', '')} title="List">• List</button>
                </div>
                <textarea
                  ref={textareaRef}
                  style={s.textarea}
                  placeholder={entryType === 'vent' ? 'Let it out...' : entryType === 'win' ? 'Celebrate your win!' : entryType === 'goal_reflection' ? 'Reflect on your progress...' : 'Write your thoughts...'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            )}
            <button
              style={saving ? s.submitBtnDisabled : s.submitBtn}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}

      {/* ── Browse Tab ─────────────────────────────────────── */}
      {tab === 'Browse' && (
        <div>
          <div style={s.filterBar}>
            <input
              style={{ ...s.input, flex: 1, minWidth: 160 }}
              placeholder="Search entries..."
              value={browseFilter.search}
              onChange={(e) => { setBrowseFilter(f => ({ ...f, search: e.target.value })); setBrowsePage(1); }}
            />
            <select
              style={s.select}
              value={browseFilter.type}
              onChange={(e) => { setBrowseFilter(f => ({ ...f, type: e.target.value })); setBrowsePage(1); }}
            >
              <option value="">All Types</option>
              {ENTRY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <input
              type="date"
              style={s.input}
              value={browseFilter.date_from}
              onChange={(e) => { setBrowseFilter(f => ({ ...f, date_from: e.target.value })); setBrowsePage(1); }}
            />
            <input
              type="date"
              style={s.input}
              value={browseFilter.date_to}
              onChange={(e) => { setBrowseFilter(f => ({ ...f, date_to: e.target.value })); setBrowsePage(1); }}
            />
          </div>

          {loadingEntries ? (
            <div style={s.empty}>Loading...</div>
          ) : entries.length === 0 ? (
            <div style={s.empty}>No entries found. Start writing!</div>
          ) : (
            <div>
              {entries.map(entry => (
                <div
                  key={entry.id}
                  style={s.entryCard(typeColor(entry.entry_type))}
                  onClick={async () => {
                    try {
                      const full = await fetchJournalEntry(entry.id);
                      setSelectedEntry(full);
                    } catch { setSelectedEntry(entry); }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={s.entryType(typeColor(entry.entry_type))}>{typeIcon(entry.entry_type)} {typeLabel(entry.entry_type)}</span>
                      <span style={s.entryDate}> &middot; {entry.entry_date}</span>
                    </div>
                    {entry.sentiment_score != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}>
                        <span style={s.sentimentDot(entry.sentiment_score)} />
                        {(entry.sentiment_score * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <div style={s.entryContent}>
                    {entry.content.length > 200 ? entry.content.substring(0, 200) + '...' : entry.content}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                {browsePage > 1 && (
                  <button style={s.calNav} onClick={() => setBrowsePage(p => p - 1)}>← Previous</button>
                )}
                <span style={{ color: '#666', fontSize: 13, padding: '6px 12px' }}>Page {browsePage}</span>
                {entries.length === 20 && (
                  <button style={s.calNav} onClick={() => setBrowsePage(p => p + 1)}>Next →</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Calendar Tab ───────────────────────────────────── */}
      {tab === 'Calendar' && (
        <div style={s.card}>
          <div style={s.calHeader}>
            <button style={s.calNav} onClick={prevMonth}>← Prev</button>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f59e0b' }}>
              {MONTHS[calMonth - 1]} {calYear}
            </div>
            <button style={s.calNav} onClick={nextMonth}>Next →</button>
          </div>

          {/* Day Labels */}
          <div style={s.calGrid}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#666', padding: '4px 0', fontWeight: 600 }}>{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={s.calGrid}>
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEntries = calDates[dateStr];
              const hasEntry = !!dayEntries;
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={day}
                  style={s.calDay(hasEntry, isToday)}
                  onClick={() => handleCalDayClick(dateStr)}
                >
                  <span>{day}</span>
                  {hasEntry && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      {dayEntries.slice(0, 3).map((e, j) => (
                        <span key={j} style={s.calDot(typeColor(e.type))} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Reflections Tab ────────────────────────────────── */}
      {tab === 'Reflections' && (
        <div>
          {/* Streak Display */}
          <div style={{ ...s.card, display: 'flex', gap: 32, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#f59e0b' }}>🔥 {streak.current}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Current Streak</div>
            </div>
            <div style={{ borderLeft: '1px solid #333', paddingLeft: 32 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#f59e0b' }}>⭐ {streak.longest}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Longest Streak</div>
              </div>
            </div>
          </div>

          {/* Sentiment Chart */}
          <div style={s.card}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f59e0b', marginBottom: 16 }}>Monthly Sentiment</div>
            {reflectionData.length === 0 ? (
              <div style={s.empty}>No data yet. Start journaling to see your trends!</div>
            ) : (
              <div>
                <div style={s.chartContainer}>
                  {reflectionData.map((m) => {
                    const height = m.avg_sentiment != null ? m.avg_sentiment * 100 : 10;
                    const color = m.avg_sentiment > 0.6 ? '#10b981' : m.avg_sentiment > 0.35 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{m.avg_sentiment != null ? (m.avg_sentiment * 100).toFixed(0) + '%' : '—'}</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', height: 120, width: '100%', justifyContent: 'center' }}>
                          <div style={s.chartBar(height, color)} title={`${m.entry_count} entries`} />
                        </div>
                        <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{m.month.substring(5)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Entry count + type distribution */}
                <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
                  {reflectionData.map((m) => (
                    <div key={m.month} style={{ fontSize: 11, color: '#888' }}>
                      <span style={{ color: '#aaa', fontWeight: 500 }}>{m.month}</span>: {m.entry_count} entries
                      {m.type_distribution && Object.entries(m.type_distribution).map(([type, count]) => (
                        <span key={type} style={{ marginLeft: 6, color: typeColor(type) }}>
                          {typeIcon(type)}{count}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Monthly AI Reflection */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f59e0b' }}>Monthly AI Reflection</div>
              <button
                style={generatingReflection ? s.submitBtnDisabled : s.submitBtn}
                disabled={generatingReflection}
                onClick={handleGenerateReflection}
              >
                {generatingReflection ? 'Generating...' : 'Generate Reflection'}
              </button>
            </div>
            {monthlyReflection ? (
              <div style={s.reflectionCard}>{monthlyReflection}</div>
            ) : (
              <div style={s.empty}>Click &quot;Generate Reflection&quot; to get an AI-powered summary of your month.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Entry Detail Modal ─────────────────────────────── */}
      {selectedEntry && (
        <div style={s.modal} onClick={() => { setSelectedEntry(null); setEditing(false); }}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span style={s.entryType(typeColor(selectedEntry.entry_type))}>
                  {typeIcon(selectedEntry.entry_type)} {typeLabel(selectedEntry.entry_type)}
                </span>
                <span style={{ ...s.entryDate, marginLeft: 8 }}>{selectedEntry.entry_date}</span>
                {selectedEntry.sentiment_score != null && (
                  <span style={{ marginLeft: 8 }}>
                    <span style={s.sentimentDot(selectedEntry.sentiment_score)} />
                    <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>
                      {(selectedEntry.sentiment_score * 100).toFixed(0)}%
                    </span>
                  </span>
                )}
              </div>
              <button style={s.dismissBtn} onClick={() => { setSelectedEntry(null); setEditing(false); }}>×</button>
            </div>

            {selectedEntry.prompt_used && (
              <div style={{ fontSize: 12, color: '#f59e0b88', fontStyle: 'italic', marginBottom: 12 }}>
                Prompt: {selectedEntry.prompt_used}
              </div>
            )}

            {editing ? (
              <div>
                <textarea
                  style={{ ...s.textarea, minHeight: 200 }}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={s.submitBtn} onClick={handleUpdate}>Save Changes</button>
                  <button style={s.backBtn} onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ ...s.entryContent, fontSize: 15 }}>{selectedEntry.content}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button style={s.editBtn} onClick={() => { setEditing(true); setEditContent(selectedEntry.content); }}>Edit</button>
                  <button style={s.deleteBtn} onClick={() => handleDelete(selectedEntry.id)}>Delete</button>
                  <button style={s.backBtn} onClick={() => { setSelectedEntry(null); setEditing(false); }}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
