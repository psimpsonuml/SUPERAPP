'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchLiveEvents, fetchLiveEventsUpcoming, fetchLiveEventDetail,
  createLiveEvent, updateLiveEvent, deleteLiveEvent,
  fetchLiveEventStats, fetchLiveEventHistory,
  shareLiveEventHistory,
} from '../../../lib/api';

// ── CONFIG ──────────────────────────────────────────────────
const EVENT_TYPES = {
  concert:    { label: 'Concert',    color: '#8b5cf6' },
  sports:     { label: 'Sports',     color: '#3b82f6' },
  theater:    { label: 'Theater',    color: '#ec4899' },
  comedy:     { label: 'Comedy',     color: '#f59e0b' },
  convention: { label: 'Convention', color: '#10b981' },
  festival:   { label: 'Festival',   color: '#ef4444' },
  other:      { label: 'Other',      color: '#6b7280' },
};

const TABS = ['Timeline', 'Upcoming', 'Stats'];

function getAccountId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('account_id') || null;
}

// ── Stars Display ───────────────────────────────────────────
function Stars({ rating, max = 10, size = 14 }) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    stars.push(
      <span key={i} style={{ color: i <= rating ? '#f59e0b' : '#444', fontSize: size }}>
        {i <= rating ? '\u2605' : '\u2606'}
      </span>
    );
  }
  return <span style={{ display: 'inline-flex', gap: 1 }}>{stars}</span>;
}

// ── Type Badge ──────────────────────────────────────────────
function TypeBadge({ type }) {
  const cfg = EVENT_TYPES[type] || EVENT_TYPES.other;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      background: cfg.color + '22',
      color: cfg.color,
      border: `1px solid ${cfg.color}44`,
      textTransform: 'capitalize',
    }}>
      {cfg.label}
    </span>
  );
}

// ── Event Card ──────────────────────────────────────────────
function EventCard({ event, onEdit, onDelete }) {
  const cfg = EVENT_TYPES[event.event_type] || EVENT_TYPES.other;
  const dateStr = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div style={{
      background: '#1a1a2e',
      borderRadius: 12,
      padding: 20,
      borderLeft: `4px solid ${cfg.color}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{event.event_name}</h3>
            <TypeBadge type={event.event_type} />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#94a3b8' }}>
            {event.venue && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {event.venue}
              </span>
            )}
            {event.city && <span>{event.city}</span>}
            <span>{dateStr}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(event)} style={{
            background: 'transparent', border: '1px solid #334155', borderRadius: 6,
            color: '#94a3b8', padding: '4px 10px', cursor: 'pointer', fontSize: 12,
          }}>Edit</button>
          <button onClick={() => onDelete(event.id)} style={{
            background: 'transparent', border: '1px solid #ef444466', borderRadius: 6,
            color: '#ef4444', padding: '4px 10px', cursor: 'pointer', fontSize: 12,
          }}>Delete</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {event.rating != null && <Stars rating={event.rating} />}
        {event.companions && (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            With: {event.companions}
          </span>
        )}
        {event.cost != null && parseFloat(event.cost) > 0 && (
          <span style={{ fontSize: 12, color: '#10b981' }}>
            ${parseFloat(event.cost).toFixed(2)}
          </span>
        )}
      </div>

      {event.notes && (
        <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>{event.notes}</p>
      )}
    </div>
  );
}

// ── Add/Edit Event Modal ────────────────────────────────────
function EventModal({ event, onClose, onSave }) {
  const [form, setForm] = useState({
    event_name: event?.event_name || '',
    event_type: event?.event_type || 'concert',
    venue: event?.venue || '',
    city: event?.city || '',
    event_date: event?.event_date || '',
    companions: event?.companions || '',
    cost: event?.cost || '',
    rating: event?.rating || 5,
    notes: event?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        cost: form.cost !== '' ? parseFloat(form.cost) : null,
        rating: form.rating ? parseInt(form.rating) : null,
      });
      onClose();
    } catch (err) {
      alert('Error saving event: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: '#0f0f23', border: '1px solid #334155',
    borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block', fontWeight: 600 };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto', border: '1px solid #334155',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, color: '#e2e8f0' }}>
          {event ? 'Edit Event' : 'Add Event'}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Event Name *</label>
            <input style={inputStyle} value={form.event_name}
              onChange={e => handleChange('event_name', e.target.value)} required placeholder="Artist, team, show name..." />
          </div>

          <div>
            <label style={labelStyle}>Type</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(EVENT_TYPES).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => handleChange('event_type', key)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: form.event_type === key ? `2px solid ${cfg.color}` : '1px solid #334155',
                  background: form.event_type === key ? cfg.color + '22' : 'transparent',
                  color: form.event_type === key ? cfg.color : '#94a3b8',
                }}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Venue</label>
              <input style={inputStyle} value={form.venue}
                onChange={e => handleChange('venue', e.target.value)} placeholder="Madison Square Garden" />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={form.city}
                onChange={e => handleChange('city', e.target.value)} placeholder="New York, NY" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Date *</label>
            <input style={inputStyle} type="date" value={form.event_date}
              onChange={e => handleChange('event_date', e.target.value)} required />
          </div>

          <div>
            <label style={labelStyle}>Companions</label>
            <input style={inputStyle} value={form.companions}
              onChange={e => handleChange('companions', e.target.value)} placeholder="Friends, family..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Cost ($)</label>
              <input style={inputStyle} type="number" step="0.01" min="0" value={form.cost}
                onChange={e => handleChange('cost', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Rating: {form.rating}/10</label>
              <input type="range" min="1" max="10" value={form.rating}
                onChange={e => handleChange('rating', parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#8b5cf6' }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.notes}
              onChange={e => handleChange('notes', e.target.value)} placeholder="Memorable moments..." />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid #334155',
              background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14,
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#8b5cf6', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              opacity: saving ? 0.6 : 1,
            }}>{saving ? 'Saving...' : event ? 'Update' : 'Add Event'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Timeline Tab ────────────────────────────────────────────
function TimelineTab({ accountId, onEdit, onDelete }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetchLiveEventHistory({ account_id: accountId })
      .then(res => setTimeline(res.timeline || []))
      .catch(() => setTimeline([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) return <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Loading timeline...</div>;
  if (timeline.length === 0) return <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No events yet. Add your first live event!</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 }}>
      {timeline.map(group => (
        <div key={group.year}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
          }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#8b5cf6' }}>{group.year}</h2>
            <span style={{ fontSize: 13, color: '#64748b' }}>{group.events.length} event{group.events.length !== 1 ? 's' : ''}</span>
            <div style={{ flex: 1, height: 1, background: '#334155' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 16, borderLeft: '2px solid #334155' }}>
            {group.events.map(ev => (
              <EventCard key={ev.id} event={ev} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Upcoming Tab ────────────────────────────────────────────
function UpcomingTab({ accountId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetchLiveEventsUpcoming({ account_id: accountId })
      .then(res => setEvents(res.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) return <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Loading upcoming...</div>;
  if (events.length === 0) return <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No upcoming events. Time to plan something!</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {events.map(ev => {
        const cfg = EVENT_TYPES[ev.event_type] || EVENT_TYPES.other;
        const dateStr = ev.event_date
          ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
          : '';
        return (
          <div key={ev.id} style={{
            background: '#1a1a2e', borderRadius: 12, padding: 20,
            border: `1px solid ${cfg.color}44`, display: 'flex', gap: 20, alignItems: 'center',
          }}>
            <div style={{
              width: 70, height: 70, borderRadius: 12, background: cfg.color + '22',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, border: `1px solid ${cfg.color}44`,
            }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: cfg.color }}>{ev.countdown_days}</span>
              <span style={{ fontSize: 10, color: cfg.color, textTransform: 'uppercase' }}>days</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{ev.event_name}</h3>
                <TypeBadge type={ev.event_type} />
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                {dateStr}{ev.venue ? ` \u2022 ${ev.venue}` : ''}{ev.city ? ` \u2022 ${ev.city}` : ''}
              </div>
              {ev.companions && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>With: {ev.companions}</div>}
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#0f0f23',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Stats Tab ───────────────────────────────────────────────
function StatsTab({ accountId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetchLiveEventStats({ account_id: accountId })
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) return <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Loading stats...</div>;
  if (!stats) return <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>No stats available.</div>;

  const yearEntries = Object.entries(stats.eventsPerYear || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const maxPerYear = Math.max(...yearEntries.map(([, c]) => c), 1);
  const barChartHeight = 200;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Events', value: stats.totalEvents, color: '#8b5cf6' },
          { label: 'Total Spent', value: stats.totalSpent != null ? `$${stats.totalSpent.toLocaleString()}` : '--', color: '#10b981' },
          { label: 'Avg Rating', value: stats.avgRating != null ? `${stats.avgRating}/10` : '--', color: '#f59e0b' },
          { label: 'Unique Venues', value: stats.topVenues?.length || 0, color: '#3b82f6' },
        ].map(card => (
          <div key={card.label} style={{
            background: '#1a1a2e', borderRadius: 12, padding: 20, textAlign: 'center',
            border: `1px solid ${card.color}33`,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Events Per Year Bar Chart */}
      {yearEntries.length > 0 && (
        <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#e2e8f0', fontWeight: 700 }}>Events Per Year</h3>
          <svg width="100%" height={barChartHeight + 40} viewBox={`0 0 ${yearEntries.length * 60 + 40} ${barChartHeight + 40}`}>
            {yearEntries.map(([year, count], i) => {
              const barH = (count / maxPerYear) * barChartHeight;
              const x = i * 60 + 20;
              return (
                <g key={year}>
                  <rect x={x} y={barChartHeight - barH} width={40} height={barH}
                    rx={4} fill="#8b5cf6" opacity={0.8} />
                  <text x={x + 20} y={barChartHeight - barH - 8} textAnchor="middle"
                    fill="#e2e8f0" fontSize={12} fontWeight={700}>{count}</text>
                  <text x={x + 20} y={barChartHeight + 20} textAnchor="middle"
                    fill="#94a3b8" fontSize={11}>{year}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Type Breakdown */}
      {stats.typeBreakdown && Object.keys(stats.typeBreakdown).length > 0 && (
        <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#e2e8f0', fontWeight: 700 }}>By Type</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(stats.typeBreakdown).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
              const cfg = EVENT_TYPES[type] || EVENT_TYPES.other;
              return (
                <div key={type} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                  background: cfg.color + '15', borderRadius: 10, border: `1px solid ${cfg.color}33`,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color }} />
                  <span style={{ fontSize: 13, color: '#e2e8f0' }}>{cfg.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Venues */}
      {stats.topVenues?.length > 0 && (
        <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#e2e8f0', fontWeight: 700 }}>Most Visited Venues</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.topVenues.slice(0, 8).map((v, i) => (
              <div key={v.venue} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 24, textAlign: 'center', fontSize: 13, color: '#64748b', fontWeight: 700 }}>{i + 1}</span>
                <div style={{ flex: 1, background: '#0f0f23', borderRadius: 6, overflow: 'hidden', height: 28 }}>
                  <div style={{
                    height: '100%', background: '#3b82f622', width: `${(v.count / stats.topVenues[0].count) * 100}%`,
                    display: 'flex', alignItems: 'center', paddingLeft: 10,
                  }}>
                    <span style={{ fontSize: 13, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{v.venue}</span>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', minWidth: 24, textAlign: 'right' }}>{v.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Artists / Names */}
      {stats.topNames?.length > 0 && (
        <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#e2e8f0', fontWeight: 700 }}>Most Seen Artists / Teams</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.topNames.slice(0, 8).map((n, i) => (
              <div key={n.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 24, textAlign: 'center', fontSize: 13, color: '#64748b', fontWeight: 700 }}>{i + 1}</span>
                <div style={{ flex: 1, background: '#0f0f23', borderRadius: 6, overflow: 'hidden', height: 28 }}>
                  <div style={{
                    height: '100%', background: '#8b5cf622', width: `${(n.count / stats.topNames[0].count) * 100}%`,
                    display: 'flex', alignItems: 'center', paddingLeft: 10,
                  }}>
                    <span style={{ fontSize: 13, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{n.name}</span>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6', minWidth: 24, textAlign: 'right' }}>{n.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function LiveEventsPage() {
  const [tab, setTab] = useState('Timeline');
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const accountId = getAccountId();

  const refresh = () => setRefreshKey(k => k + 1);

  const handleSave = async (formData) => {
    if (editEvent) {
      await updateLiveEvent(editEvent.id, { ...formData, account_id: accountId });
    } else {
      await createLiveEvent({ ...formData, account_id: accountId });
    }
    refresh();
  };

  const handleEdit = (event) => {
    setEditEvent(event);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return;
    try {
      await deleteLiveEvent(id, { account_id: accountId });
      refresh();
    } catch (err) {
      alert('Error deleting event: ' + err.message);
    }
  };

  const handleShare = async () => {
    try {
      const result = await shareLiveEventHistory({ account_id: accountId });
      const text = `My Live Event History\n${result.summary.totalEvents} events across ${result.summary.citiesVisited} cities and ${result.summary.uniqueVenues} venues (${result.summary.yearRange})`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert('Event summary copied to clipboard!');
      } else {
        alert(text);
      }
    } catch (err) {
      alert('Error sharing: ' + err.message);
    }
  };

  const tabColors = {
    Timeline: '#8b5cf6',
    Upcoming: '#3b82f6',
    Stats: '#f59e0b',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}>
            Live Events
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
            Track concerts, sports, theater, and more
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleShare} style={{
            padding: '10px 18px', borderRadius: 10, border: '1px solid #334155',
            background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            Share
          </button>
          <button onClick={() => { setEditEvent(null); setShowModal(true); }} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: '#8b5cf6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>
            + Add Event
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0f0f23', borderRadius: 12, padding: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
            background: tab === t ? tabColors[t] + '22' : 'transparent',
            color: tab === t ? tabColors[t] : '#64748b',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div key={refreshKey}>
        {tab === 'Timeline' && <TimelineTab accountId={accountId} onEdit={handleEdit} onDelete={handleDelete} />}
        {tab === 'Upcoming' && <UpcomingTab accountId={accountId} />}
        {tab === 'Stats' && <StatsTab accountId={accountId} />}
      </div>

      {/* Modal */}
      {showModal && (
        <EventModal
          event={editEvent}
          onClose={() => { setShowModal(false); setEditEvent(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
