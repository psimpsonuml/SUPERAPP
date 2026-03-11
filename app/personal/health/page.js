'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchPersonalHealth, addHealthMetric, importHealthData, fetchHealthImports,
  fetchHealthTargets, setHealthTarget, fetchHealthWorkouts, fetchHealthCorrelations,
  generateHealthCorrelations, fetchHealthDigest, generateHealthDigest,
  fetchHealthDnaCrossref, deleteHealthData,
} from '../../../lib/api';

const METRIC_CONFIG = {
  steps:          { label: 'Steps',          unit: 'steps',  icon: '🦶', color: '#22c55e', better: 'higher' },
  active_energy:  { label: 'Active Cal',     unit: 'kcal',   icon: '🔥', color: '#f97316', better: 'higher' },
  resting_hr:     { label: 'Resting HR',     unit: 'bpm',    icon: '❤️', color: '#ef4444', better: 'lower' },
  sleep:          { label: 'Sleep',          unit: 'hrs',    icon: '😴', color: '#8b5cf6', better: 'higher' },
  weight:         { label: 'Weight',         unit: 'lbs',    icon: '⚖️', color: '#06b6d4', better: 'lower' },
  distance:       { label: 'Distance',       unit: 'mi',     icon: '🏃', color: '#0ea5e9', better: 'higher' },
  flights:        { label: 'Flights',        unit: 'floors', icon: '🪜', color: '#14b8a6', better: 'higher' },
  blood_pressure: { label: 'Blood Pressure', unit: 'mmHg',   icon: '🩺', color: '#ec4899', better: 'lower' },
  bmi:            { label: 'BMI',            unit: '',       icon: '📊', color: '#6366f1', better: 'lower' },
  workout:        { label: 'Workout',        unit: 'min',    icon: '💪', color: '#d97706', better: 'higher' },
};

const TIMEFRAMES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
  { label: 'All', days: 3650 },
];

const IMPORT_SOURCES = [
  { id: 'apple_health', label: 'Apple Health', accept: '.zip,.xml' },
  { id: 'google_fit', label: 'Google Fit', accept: '.zip,.json' },
  { id: 'fitbit', label: 'Fitbit', accept: '.zip,.json,.csv' },
  { id: 'csv', label: 'CSV Import', accept: '.csv' },
];

// ── Apple Health XML parser ─────────────────────────────
const APPLE_HEALTH_TYPES = {
  HKQuantityTypeIdentifierStepCount: { type: 'steps', unit: 'steps' },
  HKQuantityTypeIdentifierActiveEnergyBurned: { type: 'active_energy', unit: 'kcal' },
  HKQuantityTypeIdentifierRestingHeartRate: { type: 'resting_hr', unit: 'bpm' },
  HKQuantityTypeIdentifierDistanceWalkingRunning: { type: 'distance', unit: 'mi' },
  HKQuantityTypeIdentifierFlightsClimbed: { type: 'flights', unit: 'floors' },
  HKQuantityTypeIdentifierBodyMass: { type: 'weight', unit: 'lbs' },
  HKQuantityTypeIdentifierBodyMassIndex: { type: 'bmi', unit: '' },
  HKQuantityTypeIdentifierBloodPressureSystolic: { type: 'blood_pressure', unit: 'mmHg' },
  HKCategoryTypeIdentifierSleepAnalysis: { type: 'sleep', unit: 'hrs' },
};

function parseAppleHealthXml(xmlText) {
  const records = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const els = doc.querySelectorAll('Record');

  for (const el of els) {
    const hkType = el.getAttribute('type');
    const mapping = APPLE_HEALTH_TYPES[hkType];
    if (!mapping) continue;

    const value = parseFloat(el.getAttribute('value') || '0');
    const startDate = el.getAttribute('startDate') || '';
    const date = startDate.slice(0, 10);
    if (!date || isNaN(value)) continue;

    records.push({
      date,
      metricType: mapping.type,
      value: mapping.type === 'distance' ? +(value * 0.000621371).toFixed(2) : +value.toFixed(2),
      unit: mapping.unit,
      recordedAt: startDate,
    });
  }

  // Also parse workouts
  const workoutEls = doc.querySelectorAll('Workout');
  for (const el of workoutEls) {
    const duration = parseFloat(el.getAttribute('duration') || '0');
    const startDate = el.getAttribute('startDate') || '';
    const workoutType = (el.getAttribute('workoutActivityType') || '').replace('HKWorkoutActivityType', '');
    const date = startDate.slice(0, 10);
    if (!date) continue;

    records.push({
      date,
      metricType: 'workout',
      value: +duration.toFixed(1),
      unit: workoutType || 'general',
      recordedAt: startDate,
    });
  }

  return aggregateByDay(records);
}

function parseCsv(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h === 'date');
  const typeIdx = headers.findIndex(h => h.includes('metric') || h.includes('type'));
  const valueIdx = headers.findIndex(h => h === 'value');
  const unitIdx = headers.findIndex(h => h === 'unit');

  if (dateIdx < 0 || valueIdx < 0) return [];

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length <= valueIdx) continue;
    records.push({
      date: cols[dateIdx],
      metricType: typeIdx >= 0 ? cols[typeIdx] : 'custom',
      value: parseFloat(cols[valueIdx]) || 0,
      unit: unitIdx >= 0 ? cols[unitIdx] : '',
      recordedAt: cols[dateIdx] + 'T00:00:00',
    });
  }
  return records;
}

function parseJsonExport(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    // Generic: handle array of objects with date/value/type keys
    const records = [];
    const items = Array.isArray(data) ? data : (data.records || data.data || data.items || []);
    for (const item of items) {
      const date = item.date || item.dateTime || item.startTime || '';
      const value = item.value || item.steps || item.calories || 0;
      const type = item.type || item.metricType || item.metric_type || 'custom';
      if (date && value) {
        records.push({
          date: date.slice(0, 10),
          metricType: type,
          value: parseFloat(value),
          unit: item.unit || '',
          recordedAt: date,
        });
      }
    }
    return records;
  } catch {
    return [];
  }
}

// Aggregate same metric on same day by averaging (except steps/calories/distance/flights which sum)
function aggregateByDay(records) {
  const sumTypes = new Set(['steps', 'active_energy', 'distance', 'flights']);
  const grouped = {};
  for (const r of records) {
    const key = `${r.date}|${r.metricType}`;
    if (!grouped[key]) grouped[key] = { ...r, values: [r.value] };
    else grouped[key].values.push(r.value);
  }
  return Object.values(grouped).map(g => ({
    ...g,
    value: sumTypes.has(g.metricType)
      ? +g.values.reduce((s, v) => s + v, 0).toFixed(2)
      : +(g.values.reduce((s, v) => s + v, 0) / g.values.length).toFixed(2),
  }));
}

// ── Mini line chart (SVG) ───────────────────────────────
function MiniChart({ data, color, target, height = 120 }) {
  if (!data?.length) return <div className="text-sm text-muted" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No data</div>;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * w : w / 2;
    const y = height - 20 - ((d.value - min) / range) * (height - 40);
    return { x, y, ...d };
  });

  // 7-day moving average
  const maPoints = points.length >= 7 ? points.map((p, i) => {
    if (i < 6) return null;
    const avg = points.slice(i - 6, i + 1).reduce((s, pp) => s + pp.value, 0) / 7;
    const y = height - 20 - ((avg - min) / range) * (height - 40);
    return { x: p.x, y };
  }).filter(Boolean) : [];

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const maPathD = maPoints.length > 1 ? maPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') : '';

  const [hover, setHover] = useState(null);

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`-4 0 ${w + 8} ${height}`} style={{ overflow: 'visible' }}>
        {/* Target line */}
        {target != null && (
          <line
            x1={0} x2={w}
            y1={height - 20 - ((target - min) / range) * (height - 40)}
            y2={height - 20 - ((target - min) / range) * (height - 40)}
            stroke="#22c55e" strokeDasharray="4,3" strokeWidth="0.5" opacity="0.6"
          />
        )}
        {/* Main line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />
        {/* Moving average */}
        {maPathD && <path d={maPathD} fill="none" stroke={color} strokeWidth="1" opacity="0.4" strokeDasharray="3,2" />}
        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y} r={points.length > 60 ? 1 : 2}
            fill={color} opacity={hover === i ? 1 : 0.6}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ cursor: 'pointer' }}
          />
        ))}
        {/* Axis labels */}
        <text x={0} y={height - 4} fill="var(--text-muted)" fontSize="4" fontFamily="sans-serif">
          {data[0]?.date?.slice(5)}
        </text>
        <text x={w} y={height - 4} fill="var(--text-muted)" fontSize="4" fontFamily="sans-serif" textAnchor="end">
          {data[data.length - 1]?.date?.slice(5)}
        </text>
        <text x={-2} y={14} fill="var(--text-muted)" fontSize="3.5" fontFamily="sans-serif" textAnchor="end">
          {max.toLocaleString()}
        </text>
        <text x={-2} y={height - 18} fill="var(--text-muted)" fontSize="3.5" fontFamily="sans-serif" textAnchor="end">
          {min.toLocaleString()}
        </text>
      </svg>
      {hover != null && points[hover] && (
        <div style={{
          position: 'absolute', top: 0, right: 0, background: 'var(--card-bg)',
          border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px',
          fontSize: 11, zIndex: 10, whiteSpace: 'nowrap',
        }}>
          <strong>{points[hover].value.toLocaleString()}</strong>
          <span className="text-muted" style={{ marginLeft: 4 }}>{points[hover].date}</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────
export default function HealthPage() {
  const [healthData, setHealthData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [workouts, setWorkouts] = useState(null);
  const [correlations, setCorrelations] = useState([]);
  const [digest, setDigest] = useState(null);
  const [dnaCrossref, setDnaCrossref] = useState(null);
  const [imports, setImports] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [manualForm, setManualForm] = useState({ metricType: 'weight', value: '', unit: '', date: new Date().toISOString().slice(0, 10) });
  const [targetForm, setTargetForm] = useState({ metricType: 'steps', targetValue: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [health, wk, corr, dig, dna, imp] = await Promise.allSettled([
        fetchPersonalHealth(days),
        fetchHealthWorkouts(90),
        fetchHealthCorrelations(),
        fetchHealthDigest(),
        fetchHealthDnaCrossref(),
        fetchHealthImports(),
      ]);

      if (health.status === 'fulfilled') setHealthData(health.value);
      if (wk.status === 'fulfilled') setWorkouts(wk.value);
      if (corr.status === 'fulfilled') setCorrelations(corr.value?.correlations || []);
      if (dig.status === 'fulfilled') setDigest(dig.value?.digests?.[0] || null);
      if (dna.status === 'fulfilled') setDnaCrossref(dna.value);
      if (imp.status === 'fulfilled') setImports(imp.value?.imports || []);
    } catch { /* noop */ }
    setLoading(false);
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFileImport = async (source, file) => {
    setImporting(true);
    setImportResult(null);
    try {
      let records = [];
      if (source === 'apple_health' && file.name.endsWith('.zip')) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(file);
        const xmlFile = Object.keys(zip.files).find(f => f.endsWith('export.xml') || f.endsWith('Export.xml'));
        if (xmlFile) {
          const xmlText = await zip.files[xmlFile].async('text');
          records = parseAppleHealthXml(xmlText);
        }
      } else if (source === 'apple_health' && file.name.endsWith('.xml')) {
        const text = await file.text();
        records = parseAppleHealthXml(text);
      } else if (source === 'csv') {
        const text = await file.text();
        records = parseCsv(text);
      } else if (file.name.endsWith('.json')) {
        const text = await file.text();
        records = parseJsonExport(text);
      } else if (file.name.endsWith('.zip')) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(file);
        for (const fname of Object.keys(zip.files)) {
          if (fname.endsWith('.json')) {
            const text = await zip.files[fname].async('text');
            records.push(...parseJsonExport(text));
          } else if (fname.endsWith('.csv')) {
            const text = await zip.files[fname].async('text');
            records.push(...parseCsv(text));
          }
        }
      }

      if (records.length === 0) {
        setImportResult({ error: 'No parseable health data found in file' });
      } else {
        const result = await importHealthData({ source, fileName: file.name, records });
        setImportResult({ success: true, imported: result.imported });
        loadData();
      }
    } catch (e) {
      setImportResult({ error: e.message });
    }
    setImporting(false);
  };

  const handleManualEntry = async (e) => {
    e.preventDefault();
    if (!manualForm.value) return;
    try {
      await addHealthMetric(manualForm);
      setManualForm(f => ({ ...f, value: '' }));
      loadData();
    } catch { /* noop */ }
  };

  const handleSetTarget = async (e) => {
    e.preventDefault();
    if (!targetForm.targetValue) return;
    try {
      await setHealthTarget(targetForm);
      setTargetForm(f => ({ ...f, targetValue: '' }));
      loadData();
    } catch { /* noop */ }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteHealthData();
      setShowDeleteConfirm(false);
      setHealthData(null);
      loadData();
    } catch { /* noop */ }
  };

  if (loading) return <div className="loading"><div className="spinner" />Loading health data...</div>;

  const snapshot = healthData?.snapshot || {};
  const byType = healthData?.byType || {};
  const targets = healthData?.targets || {};
  const metricTypes = Object.keys(byType);

  const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'workouts', label: 'Workouts' },
    { id: 'import', label: 'Import Data' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <>
      <div className="page-header">
        <h1>Health Dashboard</h1>
        <p>Fitness and health data aggregation &mdash; single pane of glass</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <>
          {/* ── Today's Snapshot ──────────────────────────── */}
          <div style={{
            background: 'var(--card-bg)', borderRadius: 10, padding: 16,
            border: '1px solid var(--border)', marginBottom: 24,
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Today&apos;s Snapshot</h3>
            {Object.keys(snapshot).length === 0 ? (
              <div className="text-sm text-muted">No data recorded today. Use Import Data or add a manual entry below.</div>
            ) : (
              <div className="stats-row">
                {Object.entries(snapshot).map(([type, data]) => {
                  const config = METRIC_CONFIG[type] || { label: type.replace(/_/g, ' '), color: '#6b7280' };
                  const target = targets[type];
                  const hitTarget = target != null && (
                    (config.better === 'higher' && +data.value >= target) ||
                    (config.better === 'lower' && +data.value <= target)
                  );
                  return (
                    <div key={type} className="stat-card" style={{ borderTop: `3px solid ${config.color}` }}>
                      <div className="stat-label">{config.label}</div>
                      <div className="stat-value" style={{ color: hitTarget ? '#22c55e' : config.color }}>
                        {(+data.value).toLocaleString()}{hitTarget ? ' ✓' : ''}
                      </div>
                      <div className="stat-sub">
                        {data.unit || config.unit || ''}
                        {data.delta != null && (
                          <span style={{ marginLeft: 6, color: data.delta > 0 ? (config.better === 'higher' ? '#22c55e' : '#ef4444') : (config.better === 'lower' ? '#22c55e' : '#ef4444') }}>
                            {data.delta > 0 ? '+' : ''}{data.delta}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Quick Manual Entry ────────────────────────── */}
          <div style={{
            background: 'var(--card-bg)', borderRadius: 10, padding: 16,
            border: '1px solid var(--border)', marginBottom: 24,
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Quick Add</h3>
            <form onSubmit={handleManualEntry} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ fontSize: 12 }}>
                Metric
                <select value={manualForm.metricType} onChange={e => setManualForm(f => ({ ...f, metricType: e.target.value }))} className="input" style={{ display: 'block', marginTop: 4 }}>
                  {Object.entries(METRIC_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                Value
                <input type="number" step="any" value={manualForm.value} onChange={e => setManualForm(f => ({ ...f, value: e.target.value }))} className="input" placeholder="0" style={{ display: 'block', marginTop: 4, width: 100 }} required />
              </label>
              <label style={{ fontSize: 12 }}>
                Date
                <input type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} className="input" style={{ display: 'block', marginTop: 4 }} />
              </label>
              <button type="submit" className="btn btn-sm btn-primary">Add</button>
            </form>
          </div>

          {/* ── Timeframe selector ───────────────────────── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {TIMEFRAMES.map(t => (
              <button key={t.days} className={`btn btn-sm ${days === t.days ? 'btn-primary' : ''}`} onClick={() => setDays(t.days)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Trend Charts ─────────────────────────────── */}
          {metricTypes.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p>No health data yet.</p>
              <p className="text-muted text-sm" style={{ marginTop: 8 }}>Import data from Apple Health, Google Fit, Fitbit, or add entries manually.</p>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
              {metricTypes.map(type => {
                const config = METRIC_CONFIG[type] || { label: type.replace(/_/g, ' '), color: '#6b7280', unit: '' };
                const data = byType[type] || [];
                const latest = data[data.length - 1];
                const avg = data.length > 0 ? +(data.reduce((s, d) => s + d.value, 0) / data.length).toFixed(1) : 0;
                const target = targets[type];

                return (
                  <div key={type} style={{
                    background: 'var(--card-bg)', borderRadius: 10, padding: 16,
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{config.label}</span>
                        <span className="text-xs text-muted" style={{ marginLeft: 6 }}>{config.unit}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: config.color }}>{latest?.value?.toLocaleString() ?? '—'}</div>
                        <div className="text-xs text-muted">avg: {avg.toLocaleString()}</div>
                      </div>
                    </div>
                    {target != null && (
                      <div className="text-xs" style={{ marginBottom: 4 }}>
                        Target: <strong>{target.toLocaleString()}</strong>
                        {latest && (
                          <span style={{ marginLeft: 6, color: (config.better === 'higher' ? latest.value >= target : latest.value <= target) ? '#22c55e' : '#ef4444' }}>
                            {(config.better === 'higher' ? latest.value >= target : latest.value <= target) ? 'On track' : 'Below target'}
                          </span>
                        )}
                      </div>
                    )}
                    <MiniChart data={data} color={config.color} target={target} height={100} />
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Weekly Digest ─────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: 10, padding: 20, marginBottom: 24, color: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Weekly Health Digest</h3>
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}
                onClick={async () => {
                  setGenerating('digest');
                  try {
                    const r = await generateHealthDigest();
                    if (r.digest) setDigest(r.digest);
                  } catch { /* noop */ }
                  setGenerating(null);
                }}
                disabled={generating === 'digest'}
              >
                {generating === 'digest' ? 'Generating...' : digest ? 'Regenerate' : 'Generate'}
              </button>
            </div>
            {digest ? (
              <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.95 }}>
                {digest.digest_text}
                <div style={{ marginTop: 8, fontSize: 10, opacity: 0.6 }}>
                  Week of {digest.week_start}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Click Generate to create your weekly health summary. Needs at least a week of data.
              </div>
            )}
          </div>

          {/* ── Correlations ──────────────────────────────── */}
          <div style={{
            background: 'var(--card-bg)', borderRadius: 10, padding: 16,
            border: '1px solid var(--border)', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Health Correlations</h3>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  setGenerating('corr');
                  try {
                    const r = await generateHealthCorrelations();
                    if (r.correlations) setCorrelations(r.correlations);
                  } catch { /* noop */ }
                  setGenerating(null);
                }}
                disabled={generating === 'corr'}
              >
                {generating === 'corr' ? 'Analyzing...' : correlations.length > 0 ? 'Refresh' : 'Analyze'}
              </button>
            </div>
            {correlations.length === 0 ? (
              <div className="text-sm text-muted">Click Analyze to discover patterns across your health metrics. Needs 2+ weeks of data.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {correlations.map((c, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--bg)', borderLeft: '3px solid var(--accent)',
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    {c.correlation_text || c}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── DNA Cross-Reference ──────────────────────── */}
          {dnaCrossref?.available && (
            <div style={{
              background: 'var(--card-bg)', borderRadius: 10, padding: 16,
              border: '1px solid var(--border)', marginBottom: 24,
              borderLeft: '4px solid #ec4899',
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>DNA + Health Insights</h3>
              {dnaCrossref.insights?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dnaCrossref.insights.map((insight, i) => (
                    <div key={i} className="text-sm">{insight}</div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">
                  DNA data detected ({dnaCrossref.dnaTraits?.join(', ')}). Health metric cross-referencing will generate insights once enough data is collected.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Workouts Tab ─────────────────────────────── */}
      {tab === 'workouts' && (
        <>
          {!workouts || workouts.total === 0 ? (
            <div className="card"><div className="empty-state">
              <p>No workout data.</p>
              <p className="text-muted text-sm" style={{ marginTop: 8 }}>Import from Apple Health or log workouts manually.</p>
            </div></div>
          ) : (
            <>
              <div className="stats-row" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="stat-value">{workouts.total}</div>
                  <div className="stat-label">Total Workouts</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{workouts.workoutTypes?.length || 0}</div>
                  <div className="stat-label">Workout Types</div>
                </div>
              </div>

              {/* Monthly summary */}
              {workouts.byMonth && Object.keys(workouts.byMonth).length > 0 && (
                <div style={{
                  background: 'var(--card-bg)', borderRadius: 10, padding: 16,
                  border: '1px solid var(--border)', marginBottom: 16,
                }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Monthly Summary</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Month</th><th>Workouts</th><th>Total Minutes</th><th>Per Week</th><th>Top Type</th></tr>
                      </thead>
                      <tbody>
                        {Object.entries(workouts.byMonth).sort(([a], [b]) => b.localeCompare(a)).map(([month, stats]) => {
                          const topType = Object.entries(stats.types || {}).sort(([,a], [,b]) => b - a)[0];
                          return (
                            <tr key={month}>
                              <td className="text-sm font-semibold">{month}</td>
                              <td className="text-sm">{stats.count}</td>
                              <td className="text-sm">{Math.round(stats.totalMinutes)}</td>
                              <td className="text-sm">{(stats.count / 4.3).toFixed(1)}</td>
                              <td className="text-sm text-muted">{topType ? `${topType[0]} (${topType[1]})` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Workout log */}
              <div className="card card-compact">
                <div className="card-header"><h2>Workout Log</h2></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Duration</th><th>Source</th></tr></thead>
                    <tbody>
                      {workouts.workouts?.slice(0, 50).map((w, i) => (
                        <tr key={w.id || i}>
                          <td className="text-sm">{w.date}</td>
                          <td className="text-sm font-semibold">{(w.unit || 'general').replace(/([A-Z])/g, ' $1').trim()}</td>
                          <td className="text-sm">{Math.round(+w.value)} min</td>
                          <td className="text-sm text-muted">{w.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Import Tab ───────────────────────────────── */}
      {tab === 'import' && (
        <>
          <div style={{
            background: 'var(--card-bg)', borderRadius: 10, padding: 20,
            border: '1px solid var(--border)', marginBottom: 24,
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>Import Health Data</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {IMPORT_SOURCES.map(src => (
                <div key={src.id} style={{
                  border: '2px dashed var(--border)', borderRadius: 10, padding: 16,
                  textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s',
                }} onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                   onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                   onDrop={e => {
                     e.preventDefault();
                     e.currentTarget.style.borderColor = 'var(--border)';
                     const file = e.dataTransfer.files[0];
                     if (file) handleFileImport(src.id, file);
                   }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{src.label}</div>
                  <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
                    {src.id === 'apple_health' && 'iPhone > Health > Profile > Export'}
                    {src.id === 'google_fit' && 'Google Takeout > Google Fit'}
                    {src.id === 'fitbit' && 'Fitbit data export'}
                    {src.id === 'csv' && 'Columns: date, metric_type, value, unit'}
                  </div>
                  <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                    Choose File
                    <input type="file" accept={src.accept} style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileImport(src.id, f); e.target.value = ''; }} />
                  </label>
                </div>
              ))}
            </div>

            {importing && <div className="text-sm" style={{ marginTop: 12, color: 'var(--accent)' }}>Processing file... This may take a moment for large exports.</div>}
            {importResult?.success && <div className="text-sm" style={{ marginTop: 12, color: '#22c55e' }}>Imported {importResult.imported} records successfully.</div>}
            {importResult?.error && <div className="text-sm" style={{ marginTop: 12, color: '#ef4444' }}>Error: {importResult.error}</div>}
          </div>

          {/* Import history */}
          {imports.length > 0 && (
            <div className="card card-compact">
              <div className="card-header"><h2>Import History</h2></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Source</th><th>File</th><th>Records</th><th>Imported</th></tr></thead>
                  <tbody>
                    {imports.map((imp, i) => (
                      <tr key={imp.id || i}>
                        <td className="text-sm font-semibold">{imp.source}</td>
                        <td className="text-sm text-muted">{imp.file_name}</td>
                        <td className="text-sm">{imp.records_imported?.toLocaleString()}</td>
                        <td className="text-sm text-muted">{imp.imported_at ? new Date(imp.imported_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Settings Tab ─────────────────────────────── */}
      {tab === 'settings' && (
        <>
          {/* Personal Targets */}
          <div style={{
            background: 'var(--card-bg)', borderRadius: 10, padding: 20,
            border: '1px solid var(--border)', marginBottom: 24,
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>Personal Targets</h3>
            <form onSubmit={handleSetTarget} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ fontSize: 12 }}>
                Metric
                <select value={targetForm.metricType} onChange={e => setTargetForm(f => ({ ...f, metricType: e.target.value }))} className="input" style={{ display: 'block', marginTop: 4 }}>
                  {Object.entries(METRIC_CONFIG).filter(([k]) => k !== 'workout').map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                Target Value
                <input type="number" step="any" value={targetForm.targetValue} onChange={e => setTargetForm(f => ({ ...f, targetValue: e.target.value }))} className="input" placeholder="e.g. 10000" style={{ display: 'block', marginTop: 4, width: 140 }} required />
              </label>
              <button type="submit" className="btn btn-sm btn-primary">Set Target</button>
            </form>

            {Object.keys(targets).length > 0 && (
              <div>
                <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Current Targets</div>
                {Object.entries(targets).map(([type, value]) => {
                  const config = METRIC_CONFIG[type] || { label: type.replace(/_/g, ' '), unit: '' };
                  return (
                    <div key={type} className="info-row">
                      <span className="info-label">{config.label}</span>
                      <span className="info-value">{value.toLocaleString()} {config.unit}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Privacy & Data */}
          <div style={{
            background: 'var(--card-bg)', borderRadius: 10, padding: 20,
            border: '1px solid var(--border)',
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>Privacy &amp; Data</h3>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
              Your health data is stored privately and never shared. You can delete all health data at any time.
            </p>
            {!showDeleteConfirm ? (
              <button className="btn btn-sm" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => setShowDeleteConfirm(true)}>
                Delete All Health Data
              </button>
            ) : (
              <div style={{ padding: 16, border: '2px solid #ef4444', borderRadius: 8, background: '#fef2f2' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
                  Are you sure? This will permanently delete all health metrics, targets, imports, correlations, and digests.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none' }} onClick={handleDeleteAll}>
                    Yes, Delete Everything
                  </button>
                  <button className="btn btn-sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
