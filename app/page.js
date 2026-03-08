'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchApprovalQueue,
  fetchApprovalStats,
  approveItem,
  rejectItem,
  batchAction,
} from '../lib/api';

const TIER_LABELS = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };
const TIER_CLASSES = { 1: 'badge-tier1', 2: 'badge-tier2', 3: 'badge-tier3' };

export default function ApprovalsPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [filterAgent, setFilterAgent] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [acting, setActing] = useState(new Set());

  const load = useCallback(async () => {
    try {
      setError(null);
      const filters = {};
      if (filterAgent) filters.agent = filterAgent;
      if (filterTier) filters.tier = filterTier;
      const [queue, statsData] = await Promise.all([
        fetchApprovalQueue(filters),
        fetchApprovalStats(),
      ]);
      setItems(queue.items || []);
      setStats(statsData.stats || statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterAgent, filterTier]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id, action) {
    setActing((prev) => new Set(prev).add(id));
    try {
      if (action === 'approve') await approveItem(id);
      else await rejectItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      alert(`Failed to ${action}: ${err.message}`);
    } finally {
      setActing((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function handleBatch(action) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await batchAction(action, ids);
      setItems((prev) => prev.filter((item) => !selected.has(item.id)));
      setSelected(new Set());
    } catch (err) {
      alert(`Batch ${action} failed: ${err.message}`);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }

  const agents = [...new Set(items.map((i) => i.agent_id).filter(Boolean))];

  return (
    <>
      <div className="page-header">
        <h1>Approval Queue</h1>
        <p>Review and approve pending content and actions</p>
      </div>

      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{stats.pending ?? stats.total ?? 0}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.approved_today ?? 0}</div>
            <div className="stat-label">Approved Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.rejected_today ?? 0}</div>
            <div className="stat-label">Rejected Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.overdue ?? 0}</div>
            <div className="stat-label">Overdue</div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
          <option value="">All tiers</option>
          <option value="1">Tier 1 (High)</option>
          <option value="2">Tier 2 (Medium)</option>
          <option value="3">Tier 3 (Low)</option>
        </select>
        <button className="btn" onClick={load}>Refresh</button>
      </div>

      {selected.size > 0 && (
        <div className="batch-bar">
          <span>{selected.size} selected</span>
          <button className="btn btn-approve" onClick={() => handleBatch('approve')}>
            Approve All
          </button>
          <button className="btn btn-reject" onClick={() => handleBatch('reject')}>
            Reject All
          </button>
          <button className="btn" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {loading && <div className="loading">Loading approval queue...</div>}
      {error && <div className="error">Error: {error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="empty">No pending approvals. Everything is up to date.</div>
      )}

      {items.length > 0 && (
        <>
          <div style={{ marginBottom: 8 }}>
            <label className="checkbox-wrap" style={{ justifyContent: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" onChange={toggleAll} checked={selected.size === items.length} />
              Select all ({items.length})
            </label>
          </div>
          {items.map((item) => (
            <div key={item.id} className="approval-item">
              <div className="checkbox-wrap">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                />
              </div>
              <div className="content">
                <div className="title">
                  {item.title || item.content_type || item.type || 'Untitled'}
                </div>
                <div className="meta">
                  {item.agent_id && <span>Agent: {item.agent_id}</span>}
                  {item.tier && (
                    <span className={`badge ${TIER_CLASSES[item.tier] || 'badge-pending'}`}>
                      {TIER_LABELS[item.tier] || `Tier ${item.tier}`}
                    </span>
                  )}
                  {item.product && <span>Product: {item.product}</span>}
                  {item.created_at && (
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  )}
                </div>
                {item.preview && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                    {item.preview}
                  </p>
                )}
              </div>
              <div className="actions">
                <button
                  className="btn btn-approve"
                  disabled={acting.has(item.id)}
                  onClick={() => handleAction(item.id, 'approve')}
                >
                  Approve
                </button>
                <button
                  className="btn btn-reject"
                  disabled={acting.has(item.id)}
                  onClick={() => handleAction(item.id, 'reject')}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
