'use client';

import { useState, useEffect } from 'react';
import {
  fetchDailyReport,
  fetchPainPoints,
  fetchPipeline,
  fetchAgents,
  fetchHealthReport,
} from '../../lib/api';

const PIPELINE_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444',
];

export default function ReportsPage() {
  const [daily, setDaily] = useState(null);
  const [agents, setAgents] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [painPoints, setPainPoints] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const results = await Promise.allSettled([
          fetchDailyReport(),
          fetchAgents(),
          fetchPipeline(),
          fetchPainPoints(),
          fetchHealthReport(),
        ]);
        if (results[0].status === 'fulfilled') setDaily(results[0].value);
        if (results[1].status === 'fulfilled') setAgents(results[1].value.agents || []);
        if (results[2].status === 'fulfilled') setPipeline(results[2].value);
        if (results[3].status === 'fulfilled') setPainPoints(results[3].value.painPoints || []);
        if (results[4].status === 'fulfilled') setHealth(results[4].value);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading">Loading reports...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const pipelineStages = pipeline?.stages || {};
  const pipelineTotal = pipeline?.total || 0;

  return (
    <>
      <div className="page-header">
        <h1>Daily Report</h1>
        <p>Overview of agent activity, pipeline, and operational health</p>
      </div>

      {/* Agent Activity */}
      <div className="report-section">
        <h2>Agent Activity</h2>
        {agents.length === 0 ? (
          <div className="empty">No agent data available</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Last Run</th>
                  <th>Duration</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const run = agent.lastRun;
                  return (
                    <tr key={agent.id}>
                      <td style={{ fontWeight: 600 }}>{agent.id}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: run?.status === 'completed'
                              ? 'rgba(34,197,94,0.15)'
                              : run?.status === 'failed'
                              ? 'rgba(239,68,68,0.15)'
                              : 'rgba(234,179,8,0.15)',
                            color: run?.status === 'completed'
                              ? 'var(--green)'
                              : run?.status === 'failed'
                              ? 'var(--red)'
                              : 'var(--yellow)',
                          }}
                        >
                          {run?.status || 'no runs'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {run?.run_started_at
                          ? new Date(run.run_started_at).toLocaleString()
                          : '—'}
                      </td>
                      <td>
                        {run?.duration_ms != null
                          ? `${(run.duration_ms / 1000).toFixed(1)}s`
                          : '—'}
                      </td>
                      <td>{run?.items_produced ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pipeline */}
      {pipelineTotal > 0 && (
        <div className="report-section">
          <h2>Prospect Pipeline ({pipelineTotal} total)</h2>
          <div className="pipeline-bar">
            {Object.entries(pipelineStages).map(([stage, count], i) => (
              <div
                key={stage}
                className="pipeline-segment"
                style={{
                  flex: count,
                  background: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
                }}
                title={`${stage}: ${count}`}
              >
                {count > 0 && count}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
            {Object.entries(pipelineStages).map(([stage, count], i) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
                  }}
                />
                <span style={{ color: 'var(--text-muted)' }}>{stage}: {count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Summary */}
      {daily && (
        <div className="report-section">
          <h2>Daily Summary</h2>
          <div className="card">
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-muted)' }}>
              {typeof daily === 'string' ? daily : JSON.stringify(daily, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Account Health */}
      {health && (
        <div className="report-section">
          <h2>Account Health</h2>
          <div className="card">
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-muted)' }}>
              {typeof health === 'string' ? health : JSON.stringify(health, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Pain Points */}
      {painPoints.length > 0 && (
        <div className="report-section">
          <h2>Customer Pain Points (Last 30 Days)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Product</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {painPoints.map((pp, i) => (
                  <tr key={pp.id || i}>
                    <td>{pp.description || pp.issue || JSON.stringify(pp)}</td>
                    <td>{pp.product || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {pp.date_found
                        ? new Date(pp.date_found).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
