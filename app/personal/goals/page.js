'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchGoals,
  fetchGoalDetail,
  createGoal,
  updateGoal,
  deleteGoal,
  addGoalMilestone,
  updateGoalMilestone,
  deleteGoalMilestone,
  fetchGoalTimeline,
  submitWeeklyCheckin,
  fetchGoalStats
} from '../../../lib/api';

const CATEGORY_CONFIG = {
  career:        { label: 'Career',        color: '#3b82f6' },
  financial:     { label: 'Financial',     color: '#10b981' },
  health:        { label: 'Health',        color: '#ef4444' },
  creative:      { label: 'Creative',      color: '#8b5cf6' },
  relationships: { label: 'Relationships', color: '#ec4899' },
  travel:        { label: 'Travel',        color: '#f59e0b' },
  learning:      { label: 'Learning',      color: '#06b6d4' },
  other:         { label: 'Other',         color: '#6b7280' }
};

const STATUS_OPTIONS = ['active', 'paused', 'completed', 'abandoned'];

function daysRemaining(targetDate) {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(targetDate);
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function progressPercent(current, target) {
  if (!target || target === 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

// --- Styles ---
const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#e2e8f0',
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffffff'
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '4px'
  },
  tab: (active) => ({
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: active ? '#3b82f6' : 'transparent',
    color: active ? '#ffffff' : '#94a3b8',
    transition: 'all 0.2s'
  }),
  btn: (bg = '#3b82f6') => ({
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: bg,
    color: '#ffffff',
    transition: 'background-color 0.2s'
  }),
  btnSmall: (bg = '#3b82f6') => ({
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: bg,
    color: '#ffffff'
  }),
  card: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid #1e3a5f'
  },
  statsCard: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #1e3a5f',
    textAlign: 'center',
    flex: '1',
    minWidth: '140px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '16px'
  },
  statsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '24px'
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: color + '22',
    color: color,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  }),
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#0f3460',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px'
  },
  progressFill: (pct, color) => ({
    height: '100%',
    width: `${pct}%`,
    backgroundColor: color,
    borderRadius: '4px',
    transition: 'width 0.3s'
  }),
  modal: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: '16px',
    padding: '28px',
    width: '520px',
    maxWidth: '95vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    border: '1px solid #1e3a5f'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #1e3a5f',
    backgroundColor: '#0f3460',
    color: '#e2e8f0',
    fontSize: '14px',
    marginTop: '4px',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #1e3a5f',
    backgroundColor: '#0f3460',
    color: '#e2e8f0',
    fontSize: '14px',
    marginTop: '4px',
    boxSizing: 'border-box'
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '4px',
    display: 'block',
    marginTop: '14px'
  },
  filterBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  checkbox: {
    marginRight: '8px',
    accentColor: '#3b82f6'
  },
  milestoneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid #1e3a5f'
  },
  deleteBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    backgroundColor: '#ef444433',
    color: '#ef4444'
  }
};

// --- Components ---

function CategoryBadge({ category }) {
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
  return <span style={styles.badge(cfg.color)}>{cfg.label}</span>;
}

function ProgressBar({ current, target, category }) {
  const pct = progressPercent(current, target);
  const color = (CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other).color;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
        <span>{current || 0} / {target || '?'}</span>
        <span>{pct}%</span>
      </div>
      <div style={styles.progressBar}>
        <div style={styles.progressFill(pct, color)} />
      </div>
    </div>
  );
}

function StatsCards({ stats }) {
  if (!stats) return null;
  return (
    <div style={styles.statsGrid}>
      <div style={styles.statsCard}>
        <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6' }}>{stats.total_active}</div>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Active Goals</div>
      </div>
      <div style={styles.statsCard}>
        <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981' }}>{stats.total_completed}</div>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Completed</div>
      </div>
      <div style={styles.statsCard}>
        <div style={{ fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>{stats.completed_this_year}</div>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Completed This Year</div>
      </div>
      <div style={styles.statsCard}>
        <div style={{ fontSize: '32px', fontWeight: '700', color: '#8b5cf6' }}>{stats.completion_rate}%</div>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Completion Rate</div>
      </div>
      {stats.by_category && Object.keys(stats.by_category).length > 0 && (
        <div style={{ ...styles.statsCard, flex: '2', minWidth: '280px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#e2e8f0' }}>By Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {Object.entries(stats.by_category).map(([cat, data]) => {
              const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
              return (
                <div key={cat} style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: cfg.color + '18' }}>
                  <span style={{ color: cfg.color, fontWeight: '600', fontSize: '13px' }}>{cfg.label}</span>
                  <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '6px' }}>{data.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onExpand }) {
  const days = daysRemaining(goal.target_date);
  const cfg = CATEGORY_CONFIG[goal.category] || CATEGORY_CONFIG.other;
  const nextMilestone = goal.milestones
    ? goal.milestones.filter(m => !m.completed).sort((a, b) => new Date(a.target_date) - new Date(b.target_date))[0]
    : null;

  return (
    <div style={{ ...styles.card, cursor: 'pointer', borderLeft: `4px solid ${cfg.color}` }} onClick={() => onExpand(goal.id)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#ffffff' }}>{goal.title}</h3>
        <CategoryBadge category={goal.category} />
      </div>
      {goal.metric_target && (
        <ProgressBar current={goal.metric_current} target={goal.metric_target} category={goal.category} />
      )}
      {!goal.metric_target && goal.milestone_total > 0 && (
        <ProgressBar current={goal.milestone_completed} target={goal.milestone_total} category={goal.category} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
        <div>
          {nextMilestone && <span>Next: {nextMilestone.title}</span>}
          {!nextMilestone && goal.milestone_total > 0 && <span>{goal.milestone_completed}/{goal.milestone_total} milestones</span>}
        </div>
        <div>
          {goal.target_date && (
            <span style={{ color: days !== null && days < 0 ? '#ef4444' : days !== null && days < 7 ? '#f59e0b' : '#94a3b8' }}>
              {days !== null ? (days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`) : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalDetail({ goalId, onClose, onRefresh, accountId }) {
  const [goal, setGoal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [newMilestone, setNewMilestone] = useState('');
  const [newMsDate, setNewMsDate] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGoalDetail(goalId);
      setGoal(data);
      setEditForm({
        title: data.title,
        description: data.description,
        category: data.category,
        target_date: data.target_date || '',
        metric_label: data.metric_label || '',
        metric_target: data.metric_target || '',
        metric_current: data.metric_current || 0,
        status: data.status
      });
    } catch (err) {
      console.error('Failed to load goal:', err);
    }
    setLoading(false);
  }, [goalId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    try {
      await updateGoal(goalId, editForm);
      setEditing(false);
      load();
      onRefresh();
    } catch (err) {
      console.error('Failed to update goal:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this goal?')) return;
    try {
      await deleteGoal(goalId);
      onClose();
      onRefresh();
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  };

  const handleToggleMilestone = async (ms) => {
    try {
      await updateGoalMilestone(ms.id, { completed: !ms.completed });
      load();
      onRefresh();
    } catch (err) {
      console.error('Failed to update milestone:', err);
    }
  };

  const handleAddMilestone = async () => {
    if (!newMilestone.trim()) return;
    try {
      await addGoalMilestone(goalId, { account_id: accountId, title: newMilestone, target_date: newMsDate || null });
      setNewMilestone('');
      setNewMsDate('');
      load();
      onRefresh();
    } catch (err) {
      console.error('Failed to add milestone:', err);
    }
  };

  const handleDeleteMilestone = async (mid) => {
    try {
      await deleteGoalMilestone(mid);
      load();
      onRefresh();
    } catch (err) {
      console.error('Failed to delete milestone:', err);
    }
  };

  if (loading) return <div style={styles.card}>Loading...</div>;
  if (!goal) return <div style={styles.card}>Goal not found</div>;

  const cfg = CATEGORY_CONFIG[goal.category] || CATEGORY_CONFIG.other;
  const milestones = goal.goal_milestones || [];

  return (
    <div style={{ ...styles.card, borderLeft: `4px solid ${cfg.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        {!editing ? (
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: '#ffffff' }}>{goal.title}</h2>
        ) : (
          <input style={styles.input} value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          {!editing && <button style={styles.btnSmall('#3b82f6')} onClick={() => setEditing(true)}>Edit</button>}
          {editing && <button style={styles.btnSmall('#10b981')} onClick={handleSave}>Save</button>}
          {editing && <button style={styles.btnSmall('#6b7280')} onClick={() => setEditing(false)}>Cancel</button>}
          <button style={styles.btnSmall('#ef4444')} onClick={handleDelete}>Delete</button>
          <button style={styles.btnSmall('#6b7280')} onClick={onClose}>Close</button>
        </div>
      </div>

      <CategoryBadge category={goal.category} />
      <span style={{ ...styles.badge(goal.status === 'active' ? '#10b981' : goal.status === 'completed' ? '#3b82f6' : '#f59e0b'), marginLeft: '8px' }}>
        {goal.status}
      </span>

      {editing ? (
        <div>
          <label style={styles.label}>Description</label>
          <textarea style={{ ...styles.input, minHeight: '60px', resize: 'vertical' }} value={editForm.description}
            onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
          <label style={styles.label}>Category</label>
          <select style={styles.select} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
            {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <label style={styles.label}>Status</label>
          <select style={styles.select} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={styles.label}>Target Date</label>
          <input style={styles.input} type="date" value={editForm.target_date} onChange={e => setEditForm({ ...editForm, target_date: e.target.value })} />
          <label style={styles.label}>Metric Label</label>
          <input style={styles.input} value={editForm.metric_label} onChange={e => setEditForm({ ...editForm, metric_label: e.target.value })} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Target</label>
              <input style={styles.input} type="number" value={editForm.metric_target} onChange={e => setEditForm({ ...editForm, metric_target: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Current</label>
              <input style={styles.input} type="number" value={editForm.metric_current} onChange={e => setEditForm({ ...editForm, metric_current: e.target.value })} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '12px' }}>
          {goal.description && <p style={{ color: '#94a3b8', fontSize: '14px', whiteSpace: 'pre-wrap' }}>{goal.description}</p>}
          {goal.metric_target && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>{goal.metric_label || 'Progress'}</div>
              <ProgressBar current={goal.metric_current} target={goal.metric_target} category={goal.category} />
            </div>
          )}
        </div>
      )}

      {/* Milestones */}
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '10px' }}>
          Milestones ({milestones.filter(m => m.completed).length}/{milestones.length})
        </h4>
        {milestones.map(ms => (
          <div key={ms.id} style={styles.milestoneRow}>
            <input type="checkbox" checked={ms.completed} onChange={() => handleToggleMilestone(ms)} style={styles.checkbox} />
            <span style={{ flex: 1, textDecoration: ms.completed ? 'line-through' : 'none', color: ms.completed ? '#6b7280' : '#e2e8f0', fontSize: '14px' }}>
              {ms.title}
            </span>
            {ms.target_date && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{ms.target_date}</span>}
            <button style={styles.deleteBtn} onClick={() => handleDeleteMilestone(ms.id)}>Remove</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <input style={{ ...styles.input, flex: 2 }} placeholder="New milestone..." value={newMilestone}
            onChange={e => setNewMilestone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMilestone()} />
          <input style={{ ...styles.input, flex: 1 }} type="date" value={newMsDate} onChange={e => setNewMsDate(e.target.value)} />
          <button style={styles.btnSmall('#3b82f6')} onClick={handleAddMilestone}>Add</button>
        </div>
      </div>
    </div>
  );
}

function TimelineView({ accountId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchGoalTimeline(accountId);
        setItems(data || []);
      } catch (err) {
        console.error('Failed to load timeline:', err);
      }
      setLoading(false);
    })();
  }, [accountId]);

  if (loading) return <div style={styles.card}>Loading timeline...</div>;
  if (items.length === 0) return <div style={styles.card}>No goals or milestones with target dates.</div>;

  const dates = items.map(i => new Date(i.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const range = maxDate - minDate || 1;

  const svgWidth = 900;
  const svgHeight = 180;
  const paddingX = 60;
  const usableWidth = svgWidth - paddingX * 2;
  const lineY = 90;

  const getX = (dateStr) => {
    const t = new Date(dateStr).getTime();
    return paddingX + ((t - minDate) / range) * usableWidth;
  };

  const formatDate = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ ...styles.card, overflowX: 'auto' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>Goal Timeline</h3>
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ display: 'block', margin: '0 auto' }}>
        {/* Timeline line */}
        <line x1={paddingX} y1={lineY} x2={svgWidth - paddingX} y2={lineY} stroke="#1e3a5f" strokeWidth="3" />

        {/* Today marker */}
        {(() => {
          const todayT = Date.now();
          if (todayT >= minDate && todayT <= maxDate) {
            const tx = paddingX + ((todayT - minDate) / range) * usableWidth;
            return (
              <g>
                <line x1={tx} y1={lineY - 30} x2={tx} y2={lineY + 30} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" />
                <text x={tx} y={lineY - 35} textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="600">TODAY</text>
              </g>
            );
          }
          return null;
        })()}

        {/* Items */}
        {items.map((item, i) => {
          const x = getX(item.date);
          const cfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
          const isGoal = item.type === 'goal';
          const above = i % 2 === 0;
          const yOff = above ? -20 : 20;
          const textY = above ? lineY - 32 : lineY + 44;

          return (
            <g key={`${item.type}-${item.id}`}>
              {isGoal ? (
                <circle cx={x} cy={lineY} r={8} fill={cfg.color} stroke="#1a1a2e" strokeWidth="2" />
              ) : (
                <rect x={x - 5} y={lineY - 5} width={10} height={10} rx={2} fill={item.completed ? cfg.color : 'transparent'}
                  stroke={cfg.color} strokeWidth="2" transform={`rotate(45, ${x}, ${lineY})`} />
              )}
              <line x1={x} y1={lineY + (above ? -10 : 10)} x2={x} y2={lineY + yOff} stroke={cfg.color} strokeWidth="1" opacity="0.5" />
              <text x={x} y={textY} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="500">
                {item.title.length > 18 ? item.title.slice(0, 16) + '..' : item.title}
              </text>
              <text x={x} y={textY + 12} textAnchor="middle" fill="#94a3b8" fontSize="9">
                {formatDate(item.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function WeeklyCheckinPanel({ goals, accountId, onDone }) {
  const [checkins, setCheckins] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const activeGoals = goals.filter(g => g.status === 'active');

  const handleSubmit = async () => {
    const entries = Object.entries(checkins)
      .filter(([, val]) => val.notes && val.notes.trim())
      .map(([goalId, val]) => ({
        goal_id: goalId,
        notes: val.notes,
        metric_current: val.metric_current !== undefined ? val.metric_current : undefined
      }));

    if (entries.length === 0) return;

    setSubmitting(true);
    try {
      await submitWeeklyCheckin({ account_id: accountId, checkins: entries });
      setCheckins({});
      if (onDone) onDone();
    } catch (err) {
      console.error('Failed to submit checkin:', err);
    }
    setSubmitting(false);
  };

  if (activeGoals.length === 0) {
    return <div style={styles.card}>No active goals for check-in.</div>;
  }

  return (
    <div style={styles.card}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>Weekly Check-In</h3>
      {activeGoals.map(goal => {
        const cfg = CATEGORY_CONFIG[goal.category] || CATEGORY_CONFIG.other;
        const val = checkins[goal.id] || {};
        return (
          <div key={goal.id} style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#0f3460', borderRadius: '8px', borderLeft: `3px solid ${cfg.color}` }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>{goal.title}</div>
            <input
              style={styles.input}
              placeholder="Any progress this week?"
              value={val.notes || ''}
              onChange={e => setCheckins({ ...checkins, [goal.id]: { ...val, notes: e.target.value } })}
            />
            {goal.metric_target && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ fontSize: '11px', color: '#94a3b8' }}>Update {goal.metric_label || 'metric'} (current: {goal.metric_current})</label>
                <input
                  style={{ ...styles.input, width: '120px' }}
                  type="number"
                  placeholder={String(goal.metric_current || 0)}
                  value={val.metric_current || ''}
                  onChange={e => setCheckins({ ...checkins, [goal.id]: { ...val, metric_current: e.target.value } })}
                />
              </div>
            )}
          </div>
        );
      })}
      <button style={styles.btn('#10b981')} onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Check-In'}
      </button>
    </div>
  );
}

function AddGoalModal({ onClose, onCreated, accountId }) {
  const [form, setForm] = useState({
    title: '', description: '', category: 'other', target_date: '',
    metric_label: '', metric_target: ''
  });
  const [milestones, setMilestones] = useState([]);
  const [msTitle, setMsTitle] = useState('');
  const [msDate, setMsDate] = useState('');
  const [saving, setSaving] = useState(false);

  const addMilestone = () => {
    if (!msTitle.trim()) return;
    setMilestones([...milestones, { title: msTitle, target_date: msDate || null }]);
    setMsTitle('');
    setMsDate('');
  };

  const removeMilestone = (idx) => {
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await createGoal({
        account_id: accountId,
        ...form,
        target_date: form.target_date || null,
        metric_target: form.metric_target ? Number(form.metric_target) : null,
        milestones
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create goal:', err);
    }
    setSaving(false);
  };

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', marginTop: 0 }}>New Goal</h2>

        <label style={styles.label}>Title *</label>
        <input style={styles.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What do you want to achieve?" />

        <label style={styles.label}>Description</label>
        <textarea style={{ ...styles.input, minHeight: '60px', resize: 'vertical' }} value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Why is this important?" />

        <label style={styles.label}>Category</label>
        <select style={styles.select} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <label style={styles.label}>Target Date</label>
        <input style={styles.input} type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} />

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Metric Label</label>
            <input style={styles.input} value={form.metric_label} onChange={e => setForm({ ...form, metric_label: e.target.value })} placeholder="e.g. Pages read" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Metric Target</label>
            <input style={styles.input} type="number" value={form.metric_target} onChange={e => setForm({ ...form, metric_target: e.target.value })} placeholder="e.g. 100" />
          </div>
        </div>

        {/* Milestones */}
        <label style={styles.label}>Milestones</label>
        {milestones.map((ms, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ flex: 1, fontSize: '13px', color: '#e2e8f0' }}>{ms.title}</span>
            {ms.target_date && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{ms.target_date}</span>}
            <button style={styles.deleteBtn} onClick={() => removeMilestone(i)}>Remove</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <input style={{ ...styles.input, flex: 2 }} placeholder="Milestone title" value={msTitle}
            onChange={e => setMsTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMilestone()} />
          <input style={{ ...styles.input, flex: 1 }} type="date" value={msDate} onChange={e => setMsDate(e.target.value)} />
          <button style={styles.btnSmall('#6b7280')} onClick={addMilestone}>Add</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button style={styles.btn('#6b7280')} onClick={onClose}>Cancel</button>
          <button style={styles.btn('#3b82f6')} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function GoalsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [goals, setGoals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCheckin, setShowCheckin] = useState(false);

  const accountId = typeof window !== 'undefined' ? localStorage.getItem('account_id') || '' : '';

  const loadGoals = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterStatus) params.status = filterStatus;
      const data = await fetchGoals(accountId, params);
      setGoals(data || []);
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
    setLoading(false);
  }, [accountId, filterCategory, filterStatus]);

  const loadStats = useCallback(async () => {
    if (!accountId) return;
    try {
      const data = await fetchGoalStats(accountId);
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [accountId]);

  useEffect(() => {
    loadGoals();
    loadStats();
  }, [loadGoals, loadStats]);

  const handleRefresh = () => {
    loadGoals();
    loadStats();
  };

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'stats', label: 'Stats' }
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Personal Goals</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={styles.btn('#8b5cf6')} onClick={() => setShowCheckin(!showCheckin)}>
            {showCheckin ? 'Hide Check-In' : 'Weekly Check-In'}
          </button>
          <button style={styles.btn('#3b82f6')} onClick={() => setShowAddModal(true)}>+ New Goal</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabBar}>
        {tabs.map(t => (
          <button key={t.key} style={styles.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Weekly Check-In Panel */}
      {showCheckin && (
        <WeeklyCheckinPanel goals={goals} accountId={accountId} onDone={() => { setShowCheckin(false); handleRefresh(); }} />
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Filters */}
          <div style={styles.filterBar}>
            <select style={{ ...styles.select, width: 'auto', minWidth: '140px' }} value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select style={{ ...styles.select, width: 'auto', minWidth: '120px' }} value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          {/* Expanded Goal Detail */}
          {expandedGoalId && (
            <GoalDetail goalId={expandedGoalId} onClose={() => setExpandedGoalId(null)} onRefresh={handleRefresh} accountId={accountId} />
          )}

          {/* Goal Cards Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading goals...</div>
          ) : goals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No goals yet. Click "+ New Goal" to get started!
            </div>
          ) : (
            <div style={styles.grid}>
              {goals.map(g => (
                <GoalCard key={g.id} goal={g} onExpand={setExpandedGoalId} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <TimelineView accountId={accountId} />
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div>
          <StatsCards stats={stats} />
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddModal && (
        <AddGoalModal accountId={accountId} onClose={() => setShowAddModal(false)} onCreated={handleRefresh} />
      )}
    </div>
  );
}
