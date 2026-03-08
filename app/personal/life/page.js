'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchLifeReminders,
  createLifeReminder,
  completeLifeReminder,
  updateLifeReminder,
  deleteLifeReminder,
  fetchLifeUpcoming,
  fetchLifeFamily,
  addLifeFamilyEntry,
  fetchLifeFamilySummary,
  fetchLifeStreaks,
} from '../../../lib/api';

// ── Constants ────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'health', label: 'Health', icon: '💚', color: 'var(--green)' },
  { id: 'household', label: 'Household', icon: '🏠', color: 'var(--cyan)' },
  { id: 'kids', label: 'Kids', icon: '👶', color: 'var(--purple)' },
  { id: 'personal', label: 'Personal', icon: '🧘', color: 'var(--accent)' },
  { id: 'work', label: 'Work', icon: '💼', color: 'var(--orange)' },
];

const FAMILY_CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'funny_quote', label: 'Funny Quote' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'first_time', label: 'First Time' },
  { id: 'medical', label: 'Medical' },
  { id: 'school', label: 'School' },
];

const DAYS_OF_WEEK = [
  { id: 'mon', label: 'M' },
  { id: 'tue', label: 'T' },
  { id: 'wed', label: 'W' },
  { id: 'thu', label: 'T' },
  { id: 'fri', label: 'F' },
  { id: 'sat', label: 'S' },
  { id: 'sun', label: 'S' },
];

const CAT_MAP = {};
CATEGORIES.forEach(c => { CAT_MAP[c.id] = c; });

const FAM_CAT_MAP = {};
FAMILY_CATEGORIES.forEach(c => { FAM_CAT_MAP[c.id] = c; });

function catColor(id) {
  return CAT_MAP[id]?.color || 'var(--text-muted)';
}

function famCatBadge(id) {
  const map = {
    funny_quote: 'badge-yellow', milestone: 'badge-green',
    first_time: 'badge-purple', medical: 'badge-red',
    school: 'badge-cyan', general: 'badge-muted',
  };
  return map[id] || 'badge-muted';
}

export default function LifeManagerPage() {
  const [tab, setTab] = useState('routines');
  const [reminders, setReminders] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [familyEntries, setFamilyEntries] = useState([]);
  const [familyChildren, setFamilyChildren] = useState([]);
  const [streakData, setStreakData] = useState({ reminders: [], grid: {}, completion_rate: 0 });
  const [loading, setLoading] = useState(true);

  // Form states — routines
  const [showAddForm, setShowAddForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formFreq, setFormFreq] = useState('daily');
  const [formDays, setFormDays] = useState([]);
  const [formInterval, setFormInterval] = useState(3);
  const [formTime, setFormTime] = useState('09:00');
  const [formCategory, setFormCategory] = useState('personal');

  // Form states — family log
  const [logText, setLogText] = useState('');
  const [logChild, setLogChild] = useState('');
  const [logCategory, setLogCategory] = useState('general');
  const [logPhotoUrl, setLogPhotoUrl] = useState('');
  const [familyFilter, setFamilyFilter] = useState({ child: '', category: '', search: '' });
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryMonth, setSummaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Completion animation
  const [completedId, setCompletedId] = useState(null);
  const [milestoneAlert, setMilestoneAlert] = useState(null);

  // ── Data loading ──────────────────────────────────────────
  const loadReminders = useCallback(async () => {
    try {
      const [remRes, upRes] = await Promise.allSettled([
        fetchLifeReminders(),
        fetchLifeUpcoming(),
      ]);
      if (remRes.status === 'fulfilled') setReminders(remRes.value.reminders || []);
      if (upRes.status === 'fulfilled') setUpcoming(upRes.value.upcoming || []);
    } catch {}
  }, []);

  const loadFamily = useCallback(async () => {
    try {
      const res = await fetchLifeFamily(familyFilter);
      setFamilyEntries(res.entries || []);
      setFamilyChildren(res.children || []);
    } catch {}
  }, [familyFilter]);

  const loadStreaks = useCallback(async () => {
    try {
      const res = await fetchLifeStreaks();
      setStreakData(res);
    } catch {}
  }, []);

  useEffect(() => {
    async function init() {
      await Promise.allSettled([loadReminders(), loadFamily(), loadStreaks()]);
      setLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadFamily(); }, [loadFamily]);

  // ── Handlers ──────────────────────────────────────────────
  async function handleAddReminder(e) {
    e.preventDefault();
    if (!formName.trim()) return;
    try {
      await createLifeReminder({
        name: formName.trim(),
        frequency: formFreq,
        days_of_week: formFreq === 'specific_days' ? formDays : [],
        custom_interval_days: formFreq === 'custom' ? formInterval : null,
        time_of_day: formTime,
        category: formCategory,
      });
      setFormName('');
      setFormFreq('daily');
      setFormDays([]);
      setFormTime('09:00');
      setFormCategory('personal');
      setShowAddForm(false);
      await loadReminders();
    } catch (err) { alert(err.message); }
  }

  async function handleComplete(id) {
    try {
      setCompletedId(id);
      const res = await completeLifeReminder(id);
      if (res.milestone) {
        setMilestoneAlert(res.milestone);
        setTimeout(() => setMilestoneAlert(null), 3000);
      }
      setTimeout(async () => {
        setCompletedId(null);
        await loadReminders();
        await loadStreaks();
      }, 600);
    } catch (err) {
      setCompletedId(null);
      alert(err.message);
    }
  }

  async function handleToggleActive(id, active) {
    try {
      await updateLifeReminder(id, { active: !active });
      await loadReminders();
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteReminder(id) {
    try {
      await deleteLifeReminder(id);
      await loadReminders();
      await loadStreaks();
    } catch (err) { alert(err.message); }
  }

  async function handleAddFamilyEntry(e) {
    e.preventDefault();
    if (!logText.trim()) return;
    try {
      await addLifeFamilyEntry({
        entry_text: logText.trim(),
        child_tag: logChild || null,
        category: logCategory,
        photo_url: logPhotoUrl || null,
      });
      setLogText('');
      setLogChild('');
      setLogCategory('general');
      setLogPhotoUrl('');
      await loadFamily();
    } catch (err) { alert(err.message); }
  }

  async function handleLoadSummary() {
    setShowSummary(true);
    try {
      const res = await fetchLifeFamilySummary(summaryMonth);
      setSummaryData(res);
    } catch { setSummaryData(null); }
  }

  function toggleDay(day) {
    setFormDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading Life Manager...</div>;

  // Separate today's due reminders from all reminders
  const todayDue = reminders.filter(r => r.due_today);
  const completedToday = todayDue.filter(r => r.today_status === 'completed').length;
  const totalDue = todayDue.length;

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div className="page-enter">
      {/* Milestone celebration overlay */}
      {milestoneAlert && (
        <div className="life-milestone-overlay">
          <div className="life-milestone-card">
            <div style={{ fontSize: 48 }}>
              {milestoneAlert === '7_days' && '🔥'}
              {milestoneAlert === '30_days' && '⭐'}
              {milestoneAlert === '100_days' && '🏆'}
            </div>
            <h2>
              {milestoneAlert === '7_days' && '7 Day Streak!'}
              {milestoneAlert === '30_days' && '30 Day Streak!'}
              {milestoneAlert === '100_days' && '100 Day Streak!'}
            </h2>
            <p className="text-secondary">Keep it going!</p>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>Life Manager</h1>
        <p className="text-secondary">
          {totalDue > 0 ? `${completedToday}/${totalDue} routines done today` : 'Routines, family memories, and streaks'}
        </p>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'routines' ? ' tab-active' : ''}`} onClick={() => setTab('routines')}>
          Routines
        </button>
        <button className={`tab${tab === 'family' ? ' tab-active' : ''}`} onClick={() => setTab('family')}>
          Family Log
        </button>
        <button className={`tab${tab === 'streaks' ? ' tab-active' : ''}`} onClick={() => { setTab('streaks'); loadStreaks(); }}>
          Streaks
        </button>
      </div>

      {/* ═══════════════ ROUTINES TAB ═══════════════ */}
      {tab === 'routines' && (
        <>
          {/* Today's progress bar */}
          {totalDue > 0 && (
            <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="font-semibold text-sm">Today&apos;s Progress</span>
                <span className="font-mono text-sm" style={{ color: completedToday === totalDue ? 'var(--green)' : 'var(--accent)' }}>
                  {completedToday}/{totalDue}
                </span>
              </div>
              <div className="progress-track" style={{ height: 6 }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${(completedToday / totalDue) * 100}%`,
                    background: completedToday === totalDue ? 'var(--green)' : 'var(--accent)',
                    transition: 'width 0.6s var(--ease-out)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Today's checklist */}
          {todayDue.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
                Today
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {todayDue.map(rem => {
                  const cat = CAT_MAP[rem.category];
                  const isDone = rem.today_status === 'completed';
                  const isMissed = rem.today_status === 'missed';
                  const isCompleting = completedId === rem.id;

                  return (
                    <div
                      key={rem.id}
                      className={`life-routine-item${isDone ? ' life-routine-done' : ''}${isCompleting ? ' life-routine-completing' : ''}${isMissed ? ' life-routine-missed' : ''}`}
                    >
                      <button
                        className={`life-check${isDone ? ' life-check-done' : ''}`}
                        onClick={() => !isDone && handleComplete(rem.id)}
                        disabled={isDone}
                      >
                        {isDone && <CheckIcon />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={`text-sm font-semibold${isDone ? ' life-text-done' : ''}`}>{rem.name}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                          <span className="text-xs" style={{ color: cat?.color }}>{cat?.icon} {cat?.label}</span>
                          <span className="text-xs text-muted">{formatTime(rem.time_of_day)}</span>
                          {rem.streak > 0 && <span className="text-xs" style={{ color: 'var(--orange)' }}>🔥 {rem.streak}</span>}
                        </div>
                      </div>
                      {isMissed && !isDone && (
                        <span className="badge badge-red" style={{ fontSize: 10 }}>Missed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming 7-day mini calendar */}
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
                Upcoming 7 Days
              </h3>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {upcoming.map((day, i) => (
                  <div key={day.date} className="life-calendar-day" style={{ borderColor: i === 0 ? 'var(--accent)' : undefined }}>
                    <div className="text-xs font-semibold" style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-secondary)', marginBottom: 4 }}>
                      {day.label}
                    </div>
                    <div className="font-mono text-sm" style={{ marginBottom: 6 }}>{day.date.split('-')[2]}</div>
                    <div className="text-xs text-muted">{day.reminders.length} task{day.reminders.length !== 1 ? 's' : ''}</div>
                    {day.reminders.slice(0, 3).map(r => (
                      <div key={r.id} className="text-xs" style={{ color: catColor(r.category), marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>
                        {r.name}
                      </div>
                    ))}
                    {day.reminders.length > 3 && (
                      <div className="text-xs text-muted">+{day.reminders.length - 3} more</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All routines */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              All Routines ({reminders.length})
            </h3>
            <button
              className="btn btn-sm"
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ background: showAddForm ? 'var(--surface-active)' : 'var(--accent)', color: showAddForm ? 'var(--text)' : '#000', fontWeight: 600 }}
            >
              {showAddForm ? 'Cancel' : '+ Add Routine'}
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <form onSubmit={handleAddReminder}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    className="life-input"
                    type="text"
                    placeholder="Routine name..."
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {/* Frequency */}
                    <select className="life-select" value={formFreq} onChange={e => setFormFreq(e.target.value)}>
                      <option value="daily">Daily</option>
                      <option value="specific_days">Specific Days</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom Interval</option>
                    </select>

                    {/* Time */}
                    <input className="life-input" type="time" value={formTime} onChange={e => setFormTime(e.target.value)} style={{ width: 120 }} />

                    {/* Category */}
                    <select className="life-select" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>

                  {/* Days of week picker */}
                  {formFreq === 'specific_days' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {DAYS_OF_WEEK.map(d => (
                        <button
                          key={d.id}
                          type="button"
                          className={`life-day-btn${formDays.includes(d.id) ? ' life-day-active' : ''}`}
                          onClick={() => toggleDay(d.id)}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Custom interval */}
                  {formFreq === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="text-sm">Every</span>
                      <input
                        className="life-input"
                        type="number"
                        min={2}
                        max={365}
                        value={formInterval}
                        onChange={e => setFormInterval(parseInt(e.target.value) || 3)}
                        style={{ width: 70 }}
                      />
                      <span className="text-sm">days</span>
                    </div>
                  )}

                  <button className="btn" type="submit" style={{ alignSelf: 'flex-end', background: 'var(--accent)', color: '#000', fontWeight: 600 }}>
                    Create Routine
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Reminder list */}
          {reminders.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <h3>No routines yet</h3>
              <p className="text-secondary">Create your first routine to start building habits.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reminders.filter(r => !r.due_today || r.today_status !== 'completed').map(rem => {
                const cat = CAT_MAP[rem.category];
                return (
                  <div key={rem.id} className="life-routine-manage" style={{ opacity: rem.active ? 1 : 0.5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-sm font-semibold">{rem.name}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                        <span className="text-xs" style={{ color: cat?.color }}>{cat?.icon} {cat?.label}</span>
                        <span className="text-xs text-muted">{formatFrequency(rem)}</span>
                        <span className="text-xs text-muted">{formatTime(rem.time_of_day)}</span>
                        {rem.streak > 0 && <span className="text-xs" style={{ color: 'var(--orange)' }}>🔥 {rem.streak}d</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleToggleActive(rem.id, rem.active)}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                      >
                        {rem.active ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleDeleteReminder(rem.id)}
                        style={{ fontSize: 11, padding: '4px 8px', color: 'var(--red)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════ FAMILY LOG TAB ═══════════════ */}
      {tab === 'family' && (
        <>
          {/* Daily prompt */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="text-sm font-semibold" style={{ marginBottom: 10 }}>
              Anything worth remembering today?
            </h3>
            <form onSubmit={handleAddFamilyEntry}>
              <textarea
                className="life-textarea"
                rows={3}
                placeholder="A funny thing happened today..."
                value={logText}
                onChange={e => setLogText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="life-input"
                  type="text"
                  placeholder="Child name"
                  value={logChild}
                  onChange={e => setLogChild(e.target.value)}
                  style={{ width: 140 }}
                />
                <select className="life-select" value={logCategory} onChange={e => setLogCategory(e.target.value)}>
                  {FAMILY_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <input
                  className="life-input"
                  type="url"
                  placeholder="Photo URL (optional)"
                  value={logPhotoUrl}
                  onChange={e => setLogPhotoUrl(e.target.value)}
                  style={{ flex: 1, minWidth: 160 }}
                />
                <button className="btn" type="submit" disabled={!logText.trim()} style={{ background: 'var(--accent)', color: '#000', fontWeight: 600 }}>
                  Save Memory
                </button>
              </div>
            </form>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="life-input"
              type="text"
              placeholder="Search..."
              value={familyFilter.search}
              onChange={e => setFamilyFilter(prev => ({ ...prev, search: e.target.value }))}
              style={{ width: 180 }}
            />
            {familyChildren.length > 0 && (
              <select
                className="life-select"
                value={familyFilter.child}
                onChange={e => setFamilyFilter(prev => ({ ...prev, child: e.target.value }))}
              >
                <option value="">All children</option>
                {familyChildren.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select
              className="life-select"
              value={familyFilter.category}
              onChange={e => setFamilyFilter(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">All categories</option>
              {FAMILY_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="life-input"
                type="month"
                value={summaryMonth}
                onChange={e => setSummaryMonth(e.target.value)}
                style={{ width: 150 }}
              />
              <button className="btn btn-sm" onClick={handleLoadSummary}>Monthly Summary</button>
            </div>
          </div>

          {/* Monthly summary modal */}
          {showSummary && summaryData && (
            <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 className="font-semibold">This Month: {summaryData.month}</h3>
                <button className="btn btn-sm" onClick={() => setShowSummary(false)}>Close</button>
              </div>
              <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>{summaryData.total_entries} entries recorded</p>

              {Object.entries(summaryData.by_category || {}).map(([cat, entries]) => (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <span className={`badge ${famCatBadge(cat)}`} style={{ marginBottom: 6, display: 'inline-block' }}>
                    {FAM_CAT_MAP[cat]?.label || cat} ({entries.length})
                  </span>
                  {entries.map((e, i) => (
                    <div key={i} className="text-sm" style={{ paddingLeft: 12, marginBottom: 4, borderLeft: '2px solid var(--border)' }}>
                      <span className="text-xs text-muted" style={{ marginRight: 8 }}>{e.entry_date}</span>
                      {e.child_tag && <span style={{ color: 'var(--purple)', marginRight: 6 }}>[{e.child_tag}]</span>}
                      {e.entry_text}
                    </div>
                  ))}
                </div>
              ))}

              {Object.keys(summaryData.by_child || {}).length > 0 && (
                <>
                  <h4 className="text-sm font-semibold" style={{ marginTop: 16, marginBottom: 8 }}>By Child</h4>
                  {Object.entries(summaryData.by_child).map(([child, entries]) => (
                    <div key={child} style={{ marginBottom: 8 }}>
                      <span className="badge badge-purple" style={{ marginBottom: 4, display: 'inline-block' }}>{child} ({entries.length})</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Timeline */}
          {familyEntries.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
              <h3>No entries yet</h3>
              <p className="text-secondary">Start capturing family memories above.</p>
            </div>
          ) : (
            <div className="life-timeline">
              {familyEntries.map((entry, i) => {
                const prevDate = i > 0 ? familyEntries[i - 1].entry_date : null;
                const showDateHeader = entry.entry_date !== prevDate;
                return (
                  <div key={entry.id || i}>
                    {showDateHeader && (
                      <div className="life-timeline-date">
                        {formatEntryDate(entry.entry_date || entry.created_at)}
                      </div>
                    )}
                    <div className="life-timeline-entry">
                      <div className="life-timeline-dot" style={{ background: catColor(entry.category === 'milestone' ? 'health' : entry.category === 'funny_quote' ? 'personal' : 'household') }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span className={`badge badge-sm ${famCatBadge(entry.category)}`}>
                            {FAM_CAT_MAP[entry.category]?.label || entry.category}
                          </span>
                          {entry.child_tag && <span className="badge badge-sm badge-purple">{entry.child_tag}</span>}
                          <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                            {entry.created_at ? new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-sm">{entry.entry_text}</p>
                        {entry.photo_url && (
                          <img src={entry.photo_url} alt="" style={{ marginTop: 8, maxWidth: 300, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════ STREAKS TAB ═══════════════ */}
      {tab === 'streaks' && (
        <>
          {/* Overview stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
            <div className="card card-compact" style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
                {streakData.completion_rate}%
              </div>
              <div className="text-xs text-muted">Completion Rate (90d)</div>
            </div>
            <div className="card card-compact" style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>
                {streakData.total_completed || 0}
              </div>
              <div className="text-xs text-muted">Total Completions</div>
            </div>
            <div className="card card-compact" style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--orange)' }}>
                {Math.max(0, ...(streakData.reminders || []).map(r => r.streak || 0))}
              </div>
              <div className="text-xs text-muted">Best Current Streak</div>
            </div>
            <div className="card card-compact" style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--purple)' }}>
                {Math.max(0, ...(streakData.reminders || []).map(r => r.longest_streak || 0))}
              </div>
              <div className="text-xs text-muted">Longest Streak Ever</div>
            </div>
          </div>

          {/* Contribution grid */}
          <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
            <h3 className="text-sm font-semibold" style={{ marginBottom: 12 }}>Last 90 Days</h3>
            <ContributionGrid grid={streakData.grid || {}} activeCount={(streakData.reminders || []).length} />
          </div>

          {/* Per-routine streaks */}
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
            Routine Streaks
          </h3>
          {(streakData.reminders || []).length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center' }}>
              <p className="text-secondary">No active routines to track.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(streakData.reminders || []).map(rem => {
                const cat = CAT_MAP[rem.category];
                const streakPct = rem.longest_streak > 0 ? Math.min((rem.streak / rem.longest_streak) * 100, 100) : 0;
                const milestone = rem.streak >= 100 ? '🏆' : rem.streak >= 30 ? '⭐' : rem.streak >= 7 ? '🔥' : null;
                return (
                  <div key={rem.id} className="card card-compact">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: cat?.color }}>{cat?.icon}</span>
                        <span className="font-semibold text-sm">{rem.name}</span>
                        {milestone && <span style={{ fontSize: 18 }}>{milestone}</span>}
                      </div>
                      <span className="font-mono" style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 700 }}>
                        {rem.streak}d
                      </span>
                    </div>
                    <div className="progress-track" style={{ height: 4, marginBottom: 6 }}>
                      <div className="progress-fill" style={{ width: `${streakPct}%`, background: cat?.color || 'var(--accent)', transition: 'width 0.8s var(--ease-out)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-xs text-muted">Current: {rem.streak}d</span>
                      <span className="text-xs text-muted">Best: {rem.longest_streak}d</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Contribution Grid Component ─────────────────────────────
function ContributionGrid({ grid, activeCount }) {
  // Build 90-day grid (13 weeks)
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  // Pad to start on Sunday
  const firstDay = new Date(days[0]);
  const padBefore = firstDay.getDay();

  const maxCount = Math.max(1, activeCount, ...Object.values(grid));

  function cellColor(count) {
    if (!count) return 'var(--surface)';
    const intensity = count / maxCount;
    if (intensity >= 0.75) return 'var(--green)';
    if (intensity >= 0.5) return '#22c55e88';
    if (intensity >= 0.25) return '#22c55e44';
    return '#22c55e22';
  }

  const cells = [];
  for (let i = 0; i < padBefore; i++) {
    cells.push(<div key={`pad-${i}`} className="life-grid-cell" style={{ background: 'transparent' }} />);
  }
  days.forEach(date => {
    const count = grid[date] || 0;
    cells.push(
      <div
        key={date}
        className="life-grid-cell"
        title={`${date}: ${count} completed`}
        style={{ background: cellColor(count) }}
      />
    );
  });

  return (
    <div>
      <div className="life-grid-labels">
        <span>Mon</span><span>Wed</span><span>Fri</span>
      </div>
      <div className="life-grid-container">
        {cells}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
        <span className="text-xs text-muted">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <div key={i} className="life-grid-cell" style={{ background: cellColor(v * maxCount || (i === 0 ? 0 : 1)), width: 12, height: 12 }} />
        ))}
        <span className="text-xs text-muted">More</span>
      </div>
    </div>
  );
}

// ── Check icon SVG ──────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,7 6,10 11,4" />
    </svg>
  );
}

// ── Format helpers ──────────────────────────────────────────
function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatFrequency(rem) {
  if (rem.frequency === 'daily') return 'Daily';
  if (rem.frequency === 'weekly') return 'Weekly';
  if (rem.frequency === 'specific_days') {
    const days = Array.isArray(rem.days_of_week) ? rem.days_of_week : [];
    return days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
  }
  if (rem.frequency === 'custom') return `Every ${rem.custom_interval_days}d`;
  return rem.frequency;
}

function formatEntryDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
