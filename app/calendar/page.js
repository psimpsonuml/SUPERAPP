'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchCalendarWeek, fetchCalendarEntry, updateCalendarEntryStatus, fetchContentLibrary } from '../../lib/api';
import { PRODUCTS } from '../../lib/constants';

const PRODUCT_COLORS = {
  chronostates: '#6366f1',
  payroll_beacon: '#06b6d4',
  budgeting_beacon: '#22c55e',
};

const POST_TYPE_LABELS = {
  value_post: 'Value Post',
  value_post_with_mention: 'Value + Mention',
  promo_thread_entry: 'Promo Thread',
  value_engagement: 'Engagement',
  question_answer: 'Q&A',
  comment_engagement: 'Comment',
  warmup_comment: 'Warmup',
  warmup_upvote: 'Warmup',
  manual_review: 'Manual Review',
};

const STATUS_BADGES = {
  scheduled: 'badge-muted',
  approved: 'badge-blue',
  posted: 'badge-green',
  skipped: 'badge-yellow',
  failed: 'badge-red',
};

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function StatBlock({ value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : undefined}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function CalendarPage() {
  const [week, setWeek] = useState(null);
  const [offset, setOffset] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scenarioData, setScenarioData] = useState(null);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCalendarWeek(offset);
      setWeek(data);
    } catch (err) {
      console.error('Failed to load calendar:', err);
    }
    setLoading(false);
  }, [offset]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchContentLibrary(30);
        setScenarioData(data);
      } catch { /* noop */ }
    })();
  }, []);

  async function openEntry(id) {
    setDetailLoading(true);
    try {
      const data = await fetchCalendarEntry(id);
      setSelectedEntry(data);
    } catch (err) {
      console.error('Failed to load entry:', err);
    }
    setDetailLoading(false);
  }

  async function changeStatus(id, status) {
    try {
      await updateCalendarEntryStatus(id, status);
      await loadWeek();
      if (selectedEntry?.id === id) {
        setSelectedEntry(prev => ({ ...prev, status }));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  if (loading && !week) return <div className="loading"><div className="spinner" />Loading content calendar...</div>;

  const entries = week?.entries || [];
  const byDate = week?.byDate || {};

  // Build the 7-day grid
  const weekStart = week?.weekStart ? new Date(week.weekStart + 'T00:00:00') : new Date();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, dow: DOW[i], entries: byDate[dateStr] || [] });
  }

  return (
    <>
      <div className="page-header">
        <h1>Content Calendar</h1>
        <p>Rule-aware posting schedule across all communities</p>
      </div>

      {/* ── Week navigation ───────────────────────────── */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={() => setOffset(o => o - 1)}>Previous Week</button>
          <div className="font-semibold">
            {week?.weekStart} — {week?.weekEnd}
            {offset === 0 && <span className="badge badge-green" style={{ marginLeft: 8, fontSize: 10 }}>This Week</span>}
          </div>
          <button className="btn btn-sm" onClick={() => setOffset(o => o + 1)}>Next Week</button>
        </div>

        {/* ── Stats row ────────────────────────────────── */}
        <div className="stats-row" style={{ marginBottom: 16 }}>
          <StatBlock value={entries.length} label="Total Entries" />
          <StatBlock value={entries.filter(e => e.status === 'scheduled').length} label="Scheduled" />
          <StatBlock value={entries.filter(e => e.status === 'posted').length} label="Posted" color="var(--green)" />
          <StatBlock value={entries.filter(e => e.post_type === 'manual_review').length} label="Needs Review" color="var(--yellow)" />
        </div>

        {/* ── Product legend ───────────────────────────── */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          {PRODUCTS.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: PRODUCT_COLORS[p.id] || '#888',
              }} />
              <span className="text-xs">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Weekly calendar grid ──────────────────────── */}
      <div className="section">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
        }}>
          {days.map(day => {
            const isToday = day.date === new Date().toISOString().slice(0, 10);
            return (
              <div key={day.date} style={{
                background: 'var(--card-bg)',
                borderRadius: 8,
                padding: 10,
                minHeight: 160,
                border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
              }}>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-xs font-semibold" style={{ color: isToday ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {day.dow}
                  </span>
                  <span className="text-xs text-muted">{day.date.slice(5)}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {day.entries.length === 0 && (
                    <div className="text-xs text-muted" style={{ fontStyle: 'italic' }}>No entries</div>
                  )}
                  {day.entries.map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => openEntry(entry.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: `${PRODUCT_COLORS[entry.product] || '#888'}18`,
                        borderLeft: `3px solid ${PRODUCT_COLORS[entry.product] || '#888'}`,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <div className="text-xs font-semibold" style={{
                        color: PRODUCT_COLORS[entry.product] || '#888',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {POST_TYPE_LABELS[entry.post_type] || entry.post_type}
                      </div>
                      <div className="text-xs text-muted" style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                      }}>
                        {entry.community_name || entry.platform}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Entry detail modal ────────────────────────── */}
      {selectedEntry && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 600, width: '100%', maxHeight: '80vh', overflow: 'auto',
              margin: 0, position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="loading"><div className="spinner" />Loading...</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div className="font-semibold" style={{ fontSize: 16, marginBottom: 4 }}>
                      {POST_TYPE_LABELS[selectedEntry.post_type] || selectedEntry.post_type}
                    </div>
                    <div className="text-sm text-muted">
                      {selectedEntry.date} — {selectedEntry.community_name || selectedEntry.platform}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => setSelectedEntry(null)}
                    style={{ padding: '4px 10px' }}
                  >
                    Close
                  </button>
                </div>

                {/* Product + Status */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: `${PRODUCT_COLORS[selectedEntry.product] || '#888'}20`,
                    color: PRODUCT_COLORS[selectedEntry.product] || '#888',
                  }}>
                    {PRODUCTS.find(p => p.id === selectedEntry.product)?.name || selectedEntry.product}
                  </span>
                  <span className={`badge ${STATUS_BADGES[selectedEntry.status] || 'badge-muted'}`}>
                    {selectedEntry.status}
                  </span>
                  <span className="badge badge-muted" style={{ fontSize: 10 }}>
                    Tier {selectedEntry.approval_tier}
                  </span>
                </div>

                {/* Content theme */}
                {selectedEntry.content_theme && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="text-xs text-muted font-semibold" style={{ marginBottom: 4 }}>Content Theme</div>
                    <div className="text-sm">{selectedEntry.content_theme}</div>
                  </div>
                )}

                {/* Rules summary */}
                {selectedEntry.rules_summary && (
                  <div style={{
                    marginBottom: 12, padding: '10px 14px',
                    background: 'var(--bg)', borderRadius: 6,
                    borderLeft: '3px solid var(--accent)',
                  }}>
                    <div className="text-xs text-muted font-semibold" style={{ marginBottom: 4 }}>Community Rules Summary</div>
                    <div className="text-sm">{selectedEntry.rules_summary}</div>
                  </div>
                )}

                {/* Community details */}
                {selectedEntry.community && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="text-xs text-muted font-semibold" style={{ marginBottom: 4 }}>Community Details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div className="text-xs"><span className="text-muted">Platform: </span>{selectedEntry.community.platform}</div>
                      <div className="text-xs"><span className="text-muted">Members: </span>{selectedEntry.community.subscriber_count?.toLocaleString() ?? '—'}</div>
                      <div className="text-xs"><span className="text-muted">Classification: </span>{(selectedEntry.community.classification || '—').replace(/_/g, ' ')}</div>
                      <div className="text-xs"><span className="text-muted">Score: </span>{selectedEntry.community.overall_score ?? '—'}/10</div>
                      <div className="text-xs"><span className="text-muted">Engagements: </span>{selectedEntry.community.engagement_count ?? 0}</div>
                      <div className="text-xs"><span className="text-muted">Warmup: </span>{selectedEntry.community.warmup_complete ? 'Complete' : 'In Progress'}</div>
                    </div>
                    {selectedEntry.community.url && (
                      <a
                        href={selectedEntry.community.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs"
                        style={{ color: 'var(--accent)', display: 'inline-block', marginTop: 6 }}
                      >
                        Visit Community
                      </a>
                    )}
                  </div>
                )}

                {/* Metadata */}
                {selectedEntry.metadata_json?.designated_days?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="text-xs text-muted font-semibold" style={{ marginBottom: 4 }}>Promo Days</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {selectedEntry.metadata_json.designated_days.map(d => (
                        <span key={d} className="badge badge-purple" style={{ fontSize: 10 }}>{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {selectedEntry.status === 'scheduled' && (
                    <>
                      <button className="btn btn-sm" style={{ background: 'var(--green)', color: '#fff', border: 'none' }}
                        onClick={() => changeStatus(selectedEntry.id, 'approved')}>Approve</button>
                      <button className="btn btn-sm" onClick={() => changeStatus(selectedEntry.id, 'skipped')}>Skip</button>
                    </>
                  )}
                  {selectedEntry.status === 'approved' && (
                    <button className="btn btn-sm" style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
                      onClick={() => changeStatus(selectedEntry.id, 'posted')}>Mark Posted</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ChronoStates Scenario Library ──────────────── */}
      {scenarioData && (
        <div className="section" style={{ marginTop: 24 }}>
          <div className="section-header">
            <h2>ChronoStates Scenarios</h2>
            <span className="text-xs text-muted">Content Library — upcoming and recently added</span>
          </div>

          <div className="stats-row" style={{ marginBottom: 16 }}>
            <StatBlock value={scenarioData.stats?.thisWeek ?? 0} label="This Week" />
            <StatBlock value={scenarioData.stats?.pendingApproval ?? 0} label="Pending Approval" color="var(--yellow)" />
            <StatBlock value={scenarioData.stats?.injected ?? 0} label="Injected" color="var(--green)" />
            <StatBlock value={scenarioData.stats?.total ?? 0} label="Total (30d)" />
          </div>

          {scenarioData.varietyCheck && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, marginBottom: 16, fontSize: 12,
              background: scenarioData.varietyCheck.passed ? '#ecfdf5' : '#fffbeb',
              color: scenarioData.varietyCheck.passed ? '#059669' : '#d97706',
              border: `1px solid ${scenarioData.varietyCheck.passed ? '#059669' : '#d97706'}22`,
            }}>
              Variety Check: {scenarioData.varietyCheck.passed ? 'PASSED' : 'NEEDS ATTENTION'} —
              Eras: {scenarioData.varietyCheck.erasUsed?.join(', ') || 'none'} |
              Regions: {scenarioData.varietyCheck.regionsUsed?.length || 0} unique |
              Difficulties: {scenarioData.varietyCheck.difficultiesUsed?.join(', ') || 'none'}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {(scenarioData.scenarios || []).slice(0, 12).map(scenario => {
              const diffColor = scenario.difficulty === 'easy' ? '#059669' : scenario.difficulty === 'medium' ? '#d97706' : '#dc2626';
              const statusColor = scenario.injected ? '#059669' : scenario.approval_status === 'pending' ? '#d97706' : scenario.approval_status === 'auto_approved' || scenario.approval_status === 'approved' ? '#2563eb' : '#888';
              const statusLabel = scenario.injected ? 'Injected' : scenario.approval_status === 'pending' ? 'Pending' : scenario.approval_status === 'auto_approved' ? 'Auto-Approved' : scenario.approval_status || 'Unknown';

              return (
                <div key={scenario.id} style={{
                  background: 'var(--card-bg)', borderRadius: 8, padding: 14,
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${diffColor}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div className="font-semibold" style={{ fontSize: 13, lineHeight: 1.3, flex: 1 }}>{scenario.title}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                      background: `${diffColor}18`, color: diffColor, marginLeft: 8, whiteSpace: 'nowrap',
                    }}>
                      {scenario.difficulty?.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-purple" style={{ fontSize: 10 }}>{scenario.era}</span>
                    <span className="badge badge-blue" style={{ fontSize: 10 }}>{scenario.region}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                      background: `${statusColor}18`, color: statusColor,
                    }}>
                      {statusLabel}
                    </span>
                    {scenario.translations && Object.keys(scenario.translations).length > 0 && (
                      <span className="badge badge-muted" style={{ fontSize: 10 }}>
                        +{Object.keys(scenario.translations).length} langs
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-muted" style={{ lineHeight: 1.4 }}>
                    {scenario.description?.slice(0, 120)}{scenario.description?.length > 120 ? '...' : ''}
                  </div>

                  {scenario.decision_point_count > 0 && (
                    <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                      {scenario.decision_point_count} decision points
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
