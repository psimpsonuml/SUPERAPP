'use client';

import { useState, useEffect } from 'react';
import { fetchQaPlaytest, fetchQaPlaytestDay } from '../../lib/api';

const STATUS_COLORS = { pass: '#059669', warning: '#d97706', fail: '#dc2626' };
const BUG_SEVERITY = {
  critical: { label: 'Critical', color: '#dc2626', bg: '#fef2f2' },
  content: { label: 'Content Bug', color: '#d97706', bg: '#fffbeb' },
  performance: { label: 'Performance', color: '#2563eb', bg: '#eff6ff' },
  media: { label: 'Media Bug', color: '#7c3aed', bg: '#f5f3ff' },
  media_flag: { label: 'Media Flag', color: '#7c3aed', bg: '#f5f3ff' },
  synthesis: { label: 'Synthesis', color: '#dc2626', bg: '#fef2f2' },
  localization: { label: 'Localization', color: '#d97706', bg: '#fffbeb' },
  content_flag: { label: 'Content Flag', color: '#d97706', bg: '#fffbeb' },
};

export default function QaPlaytestPage() {
  const [data, setData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await fetchQaPlaytest(30);
        setData(result);
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, []);

  const loadDayDetail = async (date) => {
    setSelectedDay(date);
    try {
      const detail = await fetchQaPlaytestDay(date);
      setDayDetail(detail);
    } catch {
      setDayDetail(null);
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading QA data...</div>;
  if (!data) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>No QA data available.</div>;

  const { calendar, trends, lastNight, stats } = data;

  // Generate 30-day calendar grid
  const calendarDays = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    calendarDays.push({ date: dateStr, status: calendar?.[dateStr] || null, label: d.getDate() });
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>QA Playtest</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Nightly ChronoStates automated testing — world creation, events, audio, narrative
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <StatBadge label="30d Pass Rate" value={stats?.passRate != null ? `${(stats.passRate * 100).toFixed(0)}%` : '—'} color={stats?.passRate >= 0.9 ? '#059669' : stats?.passRate >= 0.7 ? '#d97706' : '#dc2626'} />
          <StatBadge label="Avg Latency" value={stats?.avgLatency ? `${stats.avgLatency}ms` : '—'} color={stats?.avgLatency < 3000 ? '#059669' : '#d97706'} />
          <StatBadge label="Avg Quality" value={stats?.avgNarrativeQuality || '—'} color={stats?.avgNarrativeQuality >= 7 ? '#059669' : '#d97706'} />
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>30-Day Test Calendar</h3>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {calendarDays.map(day => (
            <div
              key={day.date}
              onClick={() => day.status && loadDayDetail(day.date)}
              style={{
                width: 36, height: 36, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, cursor: day.status ? 'pointer' : 'default',
                background: day.status ? STATUS_COLORS[day.status] : '#f3f4f6',
                color: day.status ? '#fff' : '#ccc',
                border: selectedDay === day.date ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'border 0.15s',
              }}
              title={`${day.date}: ${day.status || 'No test'}`}
            >
              {day.label}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#059669', marginRight: 4 }} />Pass</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#d97706', marginRight: 4 }} />Warning</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#dc2626', marginRight: 4 }} />Fail</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f3f4f6', marginRight: 4 }} />No test</span>
        </div>
      </div>

      {/* Trend Charts (simple bar charts) */}
      {trends?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Avg Latency (30 days)</h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
              {trends.map((t, i) => {
                const maxLat = Math.max(...trends.map(x => x.avgLatency), 1);
                const h = Math.max(4, (t.avgLatency / maxLat) * 80);
                return (
                  <div key={i} title={`${t.date}: ${t.avgLatency}ms`} style={{
                    flex: 1, height: h, borderRadius: 2,
                    background: t.avgLatency > 5000 ? '#dc2626' : t.avgLatency > 3000 ? '#d97706' : '#059669',
                  }} />
                );
              })}
            </div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Narrative Quality (30 days)</h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
              {trends.map((t, i) => {
                const h = Math.max(4, (t.narrativeQuality / 10) * 80);
                return (
                  <div key={i} title={`${t.date}: ${t.narrativeQuality}/10`} style={{
                    flex: 1, height: h, borderRadius: 2,
                    background: t.narrativeQuality >= 7 ? '#059669' : t.narrativeQuality >= 5 ? '#d97706' : '#dc2626',
                  }} />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Last Night's Result */}
      {lastNight && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Last Night&apos;s Test</h3>
            <span style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
              background: lastNight.passFail === 'pass' ? '#ecfdf5' : '#fef2f2',
              color: lastNight.passFail === 'pass' ? '#059669' : '#dc2626',
            }}>
              {lastNight.passFail.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <MiniStat label="Date" value={lastNight.date} />
            <MiniStat label="World ID" value={lastNight.worldId?.slice(0, 12) || '—'} />
            <MiniStat label="Narrative Quality" value={`${lastNight.narrativeQuality}/10`} />
            <MiniStat label="Avg Latency" value={lastNight.latencyStats?.avg ? `${Math.round(lastNight.latencyStats.avg)}ms` : '—'} />
          </div>

          {lastNight.scenarioConfig && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Config: {lastNight.scenarioConfig.era} / {lastNight.scenarioConfig.region} / {lastNight.scenarioConfig.scenarioType}
            </div>
          )}

          {lastNight.bugs?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Bugs Found ({lastNight.bugs.length})</div>
              {lastNight.bugs.map((bug, i) => {
                const sev = BUG_SEVERITY[bug.severity] || { label: bug.severity, color: '#666', bg: '#f3f4f6' };
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px',
                    background: sev.bg, borderRadius: 4, marginBottom: 4, fontSize: 12,
                  }}>
                    <span style={{ fontWeight: 600, color: sev.color, minWidth: 90 }}>{sev.label}</span>
                    <span style={{ fontWeight: 500 }}>{bug.check}</span>
                    <span style={{ color: 'var(--text-muted)' }}>Expected: {bug.expected} | Got: {bug.actual}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Day Detail Modal */}
      {selectedDay && dayDetail && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => { setSelectedDay(null); setDayDetail(null); }}>
          <div style={{
            background: 'var(--card-bg, #fff)', borderRadius: 12, padding: 24, maxWidth: 800, width: '90%',
            maxHeight: '85vh', overflow: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Test Report: {selectedDay}</h3>
              <button onClick={() => { setSelectedDay(null); setDayDetail(null); }} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
              }}>&times;</button>
            </div>

            <div style={{
              padding: '8px 16px', borderRadius: 6, marginBottom: 16,
              background: dayDetail.pass_fail === 'pass' ? '#ecfdf5' : '#fef2f2',
              color: dayDetail.pass_fail === 'pass' ? '#059669' : '#dc2626',
              fontWeight: 600,
            }}>
              {dayDetail.pass_fail.toUpperCase()} — Narrative Quality: {dayDetail.narrative_quality_score}/10
            </div>

            {/* Scenario config */}
            {dayDetail.scenario_config && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Scenario</div>
                <div style={{ fontSize: 13 }}>
                  Era: {dayDetail.scenario_config.era} | Region: {dayDetail.scenario_config.region} | Type: {dayDetail.scenario_config.scenarioType}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>World: {dayDetail.world_id}</div>
              </div>
            )}

            {/* Latency chart */}
            {dayDetail.latency_stats?.all?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Event Latency (min: {dayDetail.latency_stats.min}ms, avg: {dayDetail.latency_stats.avg}ms, max: {dayDetail.latency_stats.max}ms)
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
                  {dayDetail.latency_stats.all.map((l, i) => {
                    const maxL = Math.max(...dayDetail.latency_stats.all, 1);
                    return (
                      <div key={i} style={{
                        flex: 1, height: Math.max(4, (l / maxL) * 60), borderRadius: 3,
                        background: l > 5000 ? '#dc2626' : l > 3000 ? '#d97706' : '#059669',
                      }} title={`Event ${i + 1}: ${l}ms`} />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {dayDetail.latency_stats.all.map((_, i) => <span key={i}>E{i + 1}</span>)}
                </div>
              </div>
            )}

            {/* Checks */}
            {dayDetail.checks && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Quality Checks</div>
                {Object.entries(dayDetail.checks).map(([name, check]) => (
                  <div key={name} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '6px 10px',
                    borderRadius: 4, marginBottom: 3, fontSize: 12,
                    background: check.pass ? '#ecfdf5' : '#fef2f2',
                  }}>
                    <span style={{ fontWeight: 500 }}>{name.replace(/_/g, ' ')}</span>
                    <span style={{ color: check.pass ? '#059669' : '#dc2626', fontWeight: 600 }}>
                      {check.pass ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Bugs */}
            {dayDetail.bugs?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Bugs ({dayDetail.bugs.length})</div>
                {dayDetail.bugs.map((bug, i) => {
                  const sev = BUG_SEVERITY[bug.severity] || { label: bug.severity, color: '#666', bg: '#f3f4f6' };
                  return (
                    <div key={i} style={{
                      padding: 10, background: sev.bg, borderRadius: 6, marginBottom: 6, fontSize: 12,
                    }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: sev.color }}>[{sev.label}]</span>
                        <span style={{ fontWeight: 600 }}>{bug.check}</span>
                      </div>
                      <div>Expected: {bug.expected}</div>
                      <div>Actual: {bug.actual}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{bug.timestamp}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 6 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}
