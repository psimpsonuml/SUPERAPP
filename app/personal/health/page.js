'use client';
import { useState, useEffect } from 'react';
import { fetchPersonalHealth } from '../../../lib/api';

export default function HealthPage() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetchPersonalHealth(days).then((r) => setMetrics(r.metrics || [])).catch(() => {}).finally(() => setLoading(false));
  }, [days]);

  // Group metrics by type for summary cards
  const latest = {};
  metrics.forEach((m) => {
    if (!latest[m.metric_type]) latest[m.metric_type] = m;
  });
  const metricTypes = Object.keys(latest);

  return (
    <>
      <div className="page-header">
        <h1>Health Dashboard</h1>
        <p>Fitness and health data aggregation</p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[7, 30, 90].map((d) => (
          <button key={d} className={`btn btn-sm ${days === d ? 'btn-primary' : ''}`} onClick={() => setDays(d)}>
            {d}d
          </button>
        ))}
      </div>
      {loading ? <div className="loading"><div className="spinner" /></div> : metricTypes.length === 0 ? (
        <div className="card"><div className="empty-state">
          <p>No health data yet.</p>
          <p className="text-muted text-sm" style={{ marginTop: 8 }}>The Health Dashboard agent aggregates data from connected fitness sources.</p>
        </div></div>
      ) : (
        <>
          <div className="stats-row">
            {metricTypes.slice(0, 6).map((type) => (
              <div key={type} className="stat-card">
                <div className="stat-label">{type.replace(/_/g, ' ')}</div>
                <div className="stat-value">{latest[type].value}{latest[type].unit ? ` ${latest[type].unit}` : ''}</div>
                <div className="stat-sub">{new Date(latest[type].recorded_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
          <div className="card card-compact">
            <div className="card-header"><h2>Recent Readings</h2></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Metric</th><th>Value</th><th>Unit</th><th>Source</th><th>Recorded</th></tr></thead>
                <tbody>
                  {metrics.slice(0, 50).map((m, i) => (
                    <tr key={m.id || i}>
                      <td className="font-semibold text-sm">{(m.metric_type || '').replace(/_/g, ' ')}</td>
                      <td className="text-sm">{m.value}</td>
                      <td className="text-sm text-muted">{m.unit || '—'}</td>
                      <td className="text-sm text-muted">{m.source || '—'}</td>
                      <td className="text-sm text-muted">{m.recorded_at ? new Date(m.recorded_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
