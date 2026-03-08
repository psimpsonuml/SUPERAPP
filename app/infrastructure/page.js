'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchInfraStatus, fetchInfraUptime, fetchInfraAlerts, resolveInfraAlert } from '../../lib/api';

const STATUS_COLORS = {
  healthy: 'var(--green)',
  warning: 'var(--yellow)',
  critical: 'var(--red)',
  error: 'var(--red)',
  unknown: 'var(--text-muted)',
};

const STATUS_BADGES = {
  healthy: 'badge-green',
  warning: 'badge-yellow',
  critical: 'badge-red',
  error: 'badge-red',
  unknown: 'badge-muted',
};

const PERIODS = ['24h', '7d', '30d'];

function StatusDot({ status }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  return (
    <span style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: color,
      marginRight: 8,
      boxShadow: status === 'critical' ? `0 0 6px ${color}` : undefined,
    }} />
  );
}

function StatBlock({ value, label, color, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : undefined}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function UptimeBar({ timeline }) {
  if (!timeline || timeline.length === 0) return <div className="text-xs text-muted">No data</div>;
  return (
    <div style={{ display: 'flex', gap: 1, height: 24, alignItems: 'flex-end' }}>
      {timeline.map((point, i) => {
        const color = point.status === 'healthy' ? 'var(--green)'
          : point.status === 'warning' ? 'var(--yellow)'
          : point.status === 'critical' || point.status === 'error' ? 'var(--red)'
          : 'var(--border)';
        return (
          <div
            key={i}
            title={`${point.time || ''}: ${point.status} (${point.response_time_ms ?? '—'}ms)`}
            style={{
              flex: 1,
              height: '100%',
              background: color,
              borderRadius: 2,
              minWidth: 2,
              opacity: 0.85,
            }}
          />
        );
      })}
    </div>
  );
}

export default function InfrastructurePage() {
  const [status, setStatus] = useState(null);
  const [uptimeData, setUptimeData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [period, setPeriod] = useState('24h');
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);

  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchInfraStatus(),
      fetchInfraAlerts({ resolved: showResolved }),
    ]);

    const val = (i) => results[i]?.status === 'fulfilled' ? results[i].value : null;
    const statusData = val(0);
    setStatus(statusData);
    setAlerts(val(1)?.alerts || []);

    // Load uptime for each service
    const services = (statusData?.services || []).map(s => s.service);
    if (services.length > 0) {
      const uptimeResults = await Promise.allSettled(
        services.map(s => fetchInfraUptime(s, period))
      );
      const map = {};
      services.forEach((s, i) => {
        if (uptimeResults[i]?.status === 'fulfilled') map[s] = uptimeResults[i].value;
      });
      setUptimeData(map);
    }

    setLoading(false);
  }, [period, showResolved]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function handleResolve(id) {
    setResolving(id);
    try {
      await resolveInfraAlert(id);
      await loadData();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
    setResolving(null);
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading infrastructure status...</div>;

  const overall = status?.overall || 'unknown';
  const services = status?.services || [];
  const unresolvedCount = status?.unresolvedAlerts ?? 0;

  return (
    <>
      <div className="page-header">
        <h1>Infrastructure</h1>
        <p>Real-time health monitoring across all services</p>
      </div>

      {/* ── Overall Status ──────────────────────────── */}
      <div className="section">
        <div className="section-header"><h2>System Status</h2></div>
        <div className="stats-row">
          <StatBlock
            value={overall.charAt(0).toUpperCase() + overall.slice(1)}
            label="Overall Status"
            color={STATUS_COLORS[overall]}
          />
          <StatBlock value={services.length} label="Services Monitored" />
          <StatBlock
            value={services.filter(s => s.status === 'healthy').length}
            label="Healthy"
            color="var(--green)"
          />
          <StatBlock
            value={unresolvedCount}
            label="Active Alerts"
            color={unresolvedCount > 0 ? 'var(--red)' : 'var(--green)'}
          />
        </div>
      </div>

      {/* ── Service Status Grid ─────────────────────── */}
      <div className="section">
        <div className="section-header">
          <h2>Services</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODS.map(p => (
              <button
                key={p}
                className={`btn btn-sm${period === p ? ' btn-active' : ''}`}
                onClick={() => setPeriod(p)}
                style={period === p ? { background: 'var(--accent)', color: '#fff' } : {}}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {services.map(svc => {
            const uptime = uptimeData[svc.service];
            return (
              <div key={svc.service} className="card card-compact" style={{ margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <StatusDot status={svc.status} />
                    <span className="font-semibold text-sm">{svc.service}</span>
                  </div>
                  <span className={`badge ${STATUS_BADGES[svc.status] || 'badge-muted'}`} style={{ fontSize: 10 }}>
                    {svc.status}
                  </span>
                </div>

                {svc.message && (
                  <div className="text-xs text-muted" style={{ marginBottom: 6 }}>{svc.message}</div>
                )}

                <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                  <div className="text-xs">
                    <span className="text-muted">Latency: </span>
                    <span className="font-semibold">{svc.response_time_ms != null ? `${svc.response_time_ms}ms` : '—'}</span>
                  </div>
                  {uptime && (
                    <div className="text-xs">
                      <span className="text-muted">Uptime: </span>
                      <span className="font-semibold" style={{
                        color: (uptime.uptimePercent || 0) >= 99.9 ? 'var(--green)'
                          : (uptime.uptimePercent || 0) >= 99 ? 'var(--yellow)'
                          : 'var(--red)',
                      }}>
                        {uptime.uptimePercent != null ? `${uptime.uptimePercent}%` : '—'}
                      </span>
                    </div>
                  )}
                  {uptime?.avgLatency != null && (
                    <div className="text-xs">
                      <span className="text-muted">Avg: </span>
                      <span>{uptime.avgLatency}ms</span>
                    </div>
                  )}
                  {uptime?.p95Latency != null && (
                    <div className="text-xs">
                      <span className="text-muted">P95: </span>
                      <span>{uptime.p95Latency}ms</span>
                    </div>
                  )}
                </div>

                <UptimeBar timeline={uptime?.timeline} />

                {svc.checked_at && (
                  <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                    Last check: {new Date(svc.checked_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
            );
          })}

          {services.length === 0 && (
            <div className="card card-compact" style={{ margin: 0 }}>
              <div className="text-sm text-muted">No service data available. The Infrastructure Monitor agent runs every 60 seconds.</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────── */}
      <div className="section">
        <div className="section-header">
          <h2>Alerts</h2>
          <button
            className="btn btn-sm"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? 'Hide Resolved' : 'Show Resolved'}
          </button>
        </div>

        {alerts.length === 0 ? (
          <div className="card card-compact">
            <div className="text-sm text-muted">
              {showResolved ? 'No alerts found' : 'No active alerts'}
            </div>
          </div>
        ) : (
          <div className="card card-compact">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Severity</th>
                    <th>Message</th>
                    <th>Product</th>
                    <th>Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => {
                    const sevBadge = alert.severity === 'critical' ? 'badge-red'
                      : alert.severity === 'warning' ? 'badge-yellow'
                      : alert.severity === 'info' ? 'badge-blue'
                      : 'badge-muted';
                    return (
                      <tr key={alert.id}>
                        <td className="text-sm font-semibold">{alert.service}</td>
                        <td><span className={`badge ${sevBadge}`}>{alert.severity}</span></td>
                        <td className="text-sm">{alert.message}</td>
                        <td className="text-sm text-muted">{alert.product || '—'}</td>
                        <td className="text-sm text-muted">
                          {alert.created_at ? new Date(alert.created_at).toLocaleString() : '—'}
                        </td>
                        <td>
                          {!alert.resolved_at ? (
                            <button
                              className="btn btn-sm"
                              onClick={() => handleResolve(alert.id)}
                              disabled={resolving === alert.id}
                              style={{ fontSize: 10, padding: '3px 8px' }}
                            >
                              {resolving === alert.id ? '...' : 'Resolve'}
                            </button>
                          ) : (
                            <span className="badge badge-green" style={{ fontSize: 10 }}>Resolved</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
