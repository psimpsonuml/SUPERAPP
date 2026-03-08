'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAgents, fetchAgentRuns, triggerAgent } from '../../lib/api';
import { AGENTS, CATEGORY_LABELS } from '../../lib/constants';

function StatusDot({ status }) {
  const color = status === 'completed' ? 'var(--green)'
    : status === 'failed' ? 'var(--red)'
    : status === 'running' ? 'var(--yellow)'
    : status === 'skipped' ? 'var(--text-muted)'
    : 'var(--border)';
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, boxShadow: status === 'running' ? `0 0 6px ${color}` : 'none',
      flexShrink: 0,
    }} />
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AgentsPage() {
  const [agentData, setAgentData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [triggering, setTriggering] = useState(new Set());
  const [filterCategory, setFilterCategory] = useState('all');

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchAgents();
      const map = {};
      (result.agents || []).forEach((a) => { map[a.id] = a; });
      setAgentData(map);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadRuns(agentId) {
    setSelectedAgent(agentId);
    setRunsLoading(true);
    try {
      const result = await fetchAgentRuns(agentId);
      setRuns(result.runs || []);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }

  async function handleTrigger(agentId) {
    setTriggering((prev) => new Set(prev).add(agentId));
    try {
      await triggerAgent(agentId);
      setTimeout(load, 2000);
    } catch (err) {
      alert(`Failed to trigger ${agentId}: ${err.message}`);
    } finally {
      setTriggering((prev) => { const next = new Set(prev); next.delete(agentId); return next; });
    }
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading agents...</div>;
  if (error) return <div className="error-state">Error: {error}</div>;

  const categories = filterCategory === 'all'
    ? ['continuous', 'daily', 'weekly', 'event']
    : [filterCategory];

  const totalAgents = AGENTS.length;
  const runningAgents = AGENTS.filter((a) => agentData[a.id]?.lastRun?.status === 'running').length;
  const completedToday = AGENTS.filter((a) => {
    const run = agentData[a.id]?.lastRun;
    if (!run?.run_started_at || run.status !== 'completed') return false;
    return new Date(run.run_started_at).toDateString() === new Date().toDateString();
  }).length;
  const failedToday = AGENTS.filter((a) => {
    const run = agentData[a.id]?.lastRun;
    if (!run?.run_started_at || run.status !== 'failed') return false;
    return new Date(run.run_started_at).toDateString() === new Date().toDateString();
  }).length;

  return (
    <>
      <div className="page-header">
        <h1>Agents</h1>
        <p>{totalAgents} agents configured across {Object.keys(CATEGORY_LABELS).length} schedules</p>
      </div>

      {/* Summary Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{totalAgents}</div>
          <div className="stat-label">Total Agents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{runningAgents}</div>
          <div className="stat-label">Running Now</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--green)' }}>{completedToday}</div>
          <div className="stat-label">Completed Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: failedToday > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{failedToday}</div>
          <div className="stat-label">Failed Today</div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="filter-bar">
        {['all', ...Object.keys(CATEGORY_LABELS)].map((cat) => (
          <button
            key={cat}
            className={`btn btn-sm${filterCategory === cat ? ' btn-primary' : ''}`}
            onClick={() => setFilterCategory(cat)}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={load}>Refresh</button>
      </div>

      {/* Agent Cards by Category */}
      {categories.map((cat) => {
        const catAgents = AGENTS.filter((a) => a.category === cat);
        if (catAgents.length === 0) return null;

        return (
          <div key={cat} className="section">
            <div className="section-header">
              <h2>{CATEGORY_LABELS[cat]}</h2>
              <span className="text-sm text-muted">{catAgents.length} agent{catAgents.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="agent-grid">
              {catAgents.map((agentMeta) => {
                const live = agentData[agentMeta.id];
                const lastRun = live?.lastRun;
                const status = lastRun?.status || 'idle';
                const statusBadge = status === 'completed' ? 'badge-green'
                  : status === 'failed' ? 'badge-red'
                  : status === 'running' ? 'badge-yellow'
                  : status === 'skipped' ? 'badge-muted'
                  : 'badge-muted';

                return (
                  <div key={agentMeta.id} className="agent-card">
                    <div className="agent-card-header">
                      <div>
                        <div className="agent-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <StatusDot status={status} />
                          {agentMeta.name}
                          {agentMeta.essential && (
                            <span className="badge badge-cyan" style={{ fontSize: 9 }}>Essential</span>
                          )}
                        </div>
                        <div className="agent-desc">{agentMeta.desc}</div>
                      </div>
                      <span className={`badge ${statusBadge}`}>{status}</span>
                    </div>

                    <div className="agent-meta">
                      <div className="agent-meta-item">
                        <span className="agent-meta-label">Schedule</span>
                        <span className="agent-meta-value">{agentMeta.schedule}</span>
                      </div>
                      <div className="agent-meta-item">
                        <span className="agent-meta-label">Last Run</span>
                        <span className="agent-meta-value">{timeAgo(lastRun?.run_started_at)}</span>
                      </div>
                      {lastRun?.duration_ms != null && (
                        <div className="agent-meta-item">
                          <span className="agent-meta-label">Duration</span>
                          <span className="agent-meta-value">{(lastRun.duration_ms / 1000).toFixed(1)}s</span>
                        </div>
                      )}
                      {lastRun?.items_produced != null && (
                        <div className="agent-meta-item">
                          <span className="agent-meta-label">Items</span>
                          <span className="agent-meta-value">{lastRun.items_produced}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                      <button
                        className="btn btn-xs"
                        onClick={() => loadRuns(agentMeta.id)}
                        style={{ color: 'var(--accent-hover)' }}
                      >
                        View Runs
                      </button>
                      <button
                        className="btn btn-xs"
                        onClick={() => handleTrigger(agentMeta.id)}
                        disabled={triggering.has(agentMeta.id) || status === 'running'}
                      >
                        {triggering.has(agentMeta.id) ? 'Triggering...' : 'Trigger'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Run History Modal */}
      {selectedAgent && (
        <div className="modal-backdrop" onClick={() => setSelectedAgent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3>Run History — {selectedAgent}</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => setSelectedAgent(null)}>Close</button>
            </div>
            <div className="modal-body">
              {runsLoading ? (
                <div className="loading"><div className="spinner" />Loading runs...</div>
              ) : runs.length === 0 ? (
                <div className="text-sm text-muted" style={{ padding: 24, textAlign: 'center' }}>No run history found</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Started</th>
                        <th>Duration</th>
                        <th>Items</th>
                        <th>Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run, i) => {
                        const badge = run.status === 'completed' ? 'badge-green'
                          : run.status === 'failed' ? 'badge-red'
                          : run.status === 'running' ? 'badge-yellow'
                          : 'badge-muted';
                        const errors = Array.isArray(run.errors) ? run.errors : [];
                        return (
                          <tr key={run.id || i}>
                            <td><span className={`badge ${badge}`}>{run.status}</span></td>
                            <td className="text-sm">
                              {run.run_started_at ? new Date(run.run_started_at).toLocaleString() : '—'}
                            </td>
                            <td className="text-sm">
                              {run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                            </td>
                            <td className="text-sm">{run.items_produced ?? '—'}</td>
                            <td className="text-sm">
                              {errors.length > 0 ? (
                                <span className="text-sm" style={{ color: 'var(--red)' }}>{errors.length} error{errors.length > 1 ? 's' : ''}</span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
