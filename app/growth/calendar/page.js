'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchGrowthCalendarWeek, fetchGrowthUnscheduled, fetchGrowthCalendarWarnings,
  rescheduleGrowthContent, duplicateGrowthContent, unscheduleGrowthContent,
  approveGrowthContent, rejectGrowthContent, markGrowthContentPosted,
} from '../../../lib/api';

const PLATFORM_META = {
  blog: { label: 'Blog', color: '#2563eb' },
  facebook: { label: 'Facebook', color: '#1877f2' },
  instagram: { label: 'Instagram', color: '#e1306c' },
  linkedin_company: { label: 'LI Company', color: '#0a66c2' },
  linkedin_personal: { label: 'LI Personal', color: '#7c3aed' },
  x: { label: 'X', color: '#525252' },
  video: { label: 'Video', color: '#dc2626' },
};

const STATUS_META = {
  approved: { label: 'Approved', color: 'var(--green)' },
  scheduled: { label: 'Scheduled', color: 'var(--accent)' },
  published: { label: 'Published', color: 'var(--text-muted)' },
};

const PLATFORM_URLS = {
  facebook: 'https://business.facebook.com/latest/posts',
  instagram: 'https://www.instagram.com',
  linkedin_company: 'https://www.linkedin.com/company/',
  linkedin_personal: 'https://www.linkedin.com/feed/',
  x: 'https://x.com/compose/post',
};

function platformChip(platform) {
  const meta = PLATFORM_META[platform] || { label: platform, color: 'var(--text-muted)' };
  return (
    <span style={{
      background: `${meta.color}22`, color: meta.color, padding: '1px 6px',
      borderRadius: 4, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
    }}>{meta.label}</span>
  );
}

export default function GrowthCalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [week, setWeek] = useState(null);
  const [unscheduled, setUnscheduled] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [w, u, warn] = await Promise.allSettled([
      fetchGrowthCalendarWeek(weekOffset),
      fetchGrowthUnscheduled(),
      fetchGrowthCalendarWarnings(14),
    ]);
    if (w.status === 'fulfilled') setWeek(w.value);
    else setError(w.reason?.message || 'Could not load the calendar');
    if (u.status === 'fulfilled') setUnscheduled(u.value.content || []);
    if (warn.status === 'fulfilled') setWarnings(warn.value.warnings || []);
    setLoading(false);
  }, [weekOffset]);

  useEffect(() => { load(); }, [load]);

  async function handleDrop(dateKey) {
    if (!dragging) return;
    setBusy(true);
    try {
      // Preserve the item's existing time of day where it has one
      const existingTime = dragging.scheduled_for
        ? dragging.scheduled_for.slice(11, 19)
        : '10:00:00';
      await rescheduleGrowthContent(dragging.id, `${dateKey}T${existingTime}.000Z`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setDragging(null);
      setDropTarget(null);
    }
  }

  async function act(fn, ...args) {
    setBusy(true);
    setError(null);
    try {
      await fn(...args);
      await load();
      setSelected(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner" />Loading calendar...</div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Content Calendar</h1>
        <p>Drag content onto a day to reschedule. Nothing is generated to fill an empty slot.</p>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '3px solid var(--red)', marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Week navigation + summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setWeekOffset(weekOffset - 1)}>← Previous</button>
        <button className="btn" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>This week</button>
        <button className="btn" onClick={() => setWeekOffset(weekOffset + 1)}>Next →</button>
        <span className="text-sm text-muted">
          {week?.week_start} – {week?.week_end}
        </span>
        <span style={{ marginLeft: 'auto' }} className="text-sm">
          <strong>{week?.total_scheduled || 0}</strong> scheduled
          {week?.manual_posting_required > 0 && (
            <span className="badge badge-purple" style={{ marginLeft: 8 }}>
              {week.manual_posting_required} manual
            </span>
          )}
        </span>
      </div>

      {warnings.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid var(--yellow)', marginBottom: 16 }}>
          <strong>Topic repetition</strong>
          {warnings.map((w, i) => (
            <div key={i} className="text-sm text-muted" style={{ marginTop: 4 }}>{w.message}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        {/* Week grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {(week?.days || []).map(day => (
            <div
              key={day.date}
              onDragOver={e => { e.preventDefault(); setDropTarget(day.date); }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={() => handleDrop(day.date)}
              style={{
                background: 'var(--card-bg)',
                border: `1px solid ${dropTarget === day.date ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8, padding: 8, minHeight: 220,
                outline: day.is_today ? '1px solid var(--accent)' : 'none',
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                  {day.day_name.slice(0, 3)}
                </div>
                <div className="text-xs text-muted">{day.date.slice(5)}</div>
              </div>

              {day.items.map(item => (
                <div
                  key={item.id}
                  draggable={item.status !== 'published'}
                  onDragStart={() => setDragging(item)}
                  onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                  onClick={() => setSelected(item)}
                  style={{
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${STATUS_META[item.status]?.color || 'var(--border)'}`,
                    borderRadius: 6, padding: 6, marginBottom: 6,
                    cursor: item.status === 'published' ? 'pointer' : 'grab',
                    opacity: dragging?.id === item.id ? 0.4 : 1,
                  }}
                >
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                    {platformChip(item.platform)}
                    {item.requires_manual_posting && (
                      <span className="text-xs" title="Manual posting required">✋</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.3 }}>
                    {(item.title || '(untitled)').slice(0, 60)}
                  </div>
                </div>
              ))}

              {/* Open cadence slots — reported, never auto-filled */}
              {day.missing_platforms.map(p => (
                <div key={p} style={{
                  border: '1px dashed var(--border)', borderRadius: 6,
                  padding: '4px 6px', marginBottom: 4, opacity: 0.5,
                }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {platformChip(p)}
                    <span className="text-xs text-muted">open</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Unscheduled pool */}
        <div className="card">
          <h3 style={{ fontSize: 14, marginTop: 0, marginBottom: 4 }}>Approved, no date</h3>
          <p className="text-xs text-muted" style={{ marginTop: 0 }}>
            Drag onto a day to schedule.
          </p>

          {unscheduled.length === 0 ? (
            <div className="text-sm text-muted">Nothing waiting.</div>
          ) : unscheduled.map(item => (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDragging(item)}
              onDragEnd={() => { setDragging(null); setDropTarget(null); }}
              onClick={() => setSelected(item)}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 6, padding: 8, marginBottom: 6, cursor: 'grab',
                opacity: dragging?.id === item.id ? 0.4 : 1,
              }}
            >
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                {platformChip(item.platform)}
                {item.requires_manual_posting && <span className="text-xs">✋</span>}
              </div>
              <div style={{ fontSize: 12 }}>{(item.title || '(untitled)').slice(0, 70)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card"
            style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              {platformChip(selected.platform)}
              <span className="badge" style={{ background: `${STATUS_META[selected.status]?.color}22`, color: STATUS_META[selected.status]?.color }}>
                {STATUS_META[selected.status]?.label || selected.status}
              </span>
              {selected.requires_manual_posting && (
                <span className="badge badge-purple">Manual posting</span>
              )}
            </div>

            <h2 style={{ fontSize: 18, marginTop: 0 }}>{selected.title || '(untitled)'}</h2>
            <div className="text-sm text-muted" style={{ marginBottom: 16 }}>
              {selected.scheduled_for
                ? new Date(selected.scheduled_for).toLocaleString()
                : 'Not scheduled'}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selected.status === 'approved' && (
                <button className="btn btn-primary" disabled={busy}
                  onClick={() => act(approveGrowthContent, selected.id, selected.scheduled_for)}>
                  Confirm schedule
                </button>
              )}

              {selected.requires_manual_posting && selected.status !== 'published' && (
                <>
                  <a className="btn" href={PLATFORM_URLS[selected.platform] || '#'}
                    target="_blank" rel="noopener noreferrer">
                    Open {PLATFORM_META[selected.platform]?.label}
                  </a>
                  <button className="btn btn-approve" disabled={busy}
                    onClick={() => act(markGrowthContentPosted, selected.id, null)}>
                    Mark posted
                  </button>
                </>
              )}

              <button className="btn" disabled={busy}
                onClick={() => act(duplicateGrowthContent, selected.id, null)}>
                Duplicate
              </button>

              {selected.status !== 'published' && (
                <button className="btn" disabled={busy}
                  onClick={() => act(unscheduleGrowthContent, selected.id)}>
                  Unschedule
                </button>
              )}

              {selected.status !== 'published' && (
                <button className="btn btn-reject" disabled={busy}
                  onClick={() => act(rejectGrowthContent, selected.id, 'Rejected from calendar')}>
                  Reject
                </button>
              )}

              <button className="btn" onClick={() => setSelected(null)} style={{ marginLeft: 'auto' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
