'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchApprovalQueue, fetchApprovalStats, fetchOverdueItems,
  approveItem, rejectItem, batchAction,
} from '../lib/api';

const TIER_BADGE = { 1: 'badge-red', 2: 'badge-orange', 3: 'badge-blue' };
const TIER_LABEL = { 1: 'Tier 1 — Critical', 2: 'Tier 2 — Standard', 3: 'Tier 3 — Routine' };

export default function ApprovalsPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [filterAgent, setFilterAgent] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [acting, setActing] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [editItem, setEditItem] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [tab, setTab] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const filters = {};
      if (filterAgent) filters.agent = filterAgent;
      if (filterTier) filters.tier = filterTier;
      const [queue, statsData] = await Promise.all([
        tab === 'overdue' ? fetchOverdueItems() : fetchApprovalQueue(filters),
        fetchApprovalStats(),
      ]);
      setItems(queue.items || []);
      setStats(statsData.stats || statsData);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterAgent, filterTier, tab]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id, action, notes) {
    setActing((prev) => new Set(prev).add(id));
    try {
      if (action === 'approve') await approveItem(id, notes);
      else await rejectItem(id, notes);
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
    setActing(new Set(ids));
    try {
      await batchAction(action, ids);
      setItems((prev) => prev.filter((item) => !selected.has(item.id)));
      setSelected(new Set());
    } catch (err) {
      alert(`Batch ${action} failed: ${err.message}`);
    } finally {
      setActing(new Set());
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));
  }

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openEdit(item) {
    setEditItem(item);
    setEditNotes('');
  }

  function handleEditApprove() {
    if (!editItem) return;
    handleAction(editItem.id, 'approve', editNotes);
    setEditItem(null);
  }

  const agents = [...new Set(items.map((i) => i.agent_id).filter(Boolean))].sort();

  return (
    <>
      <div className="page-header">
        <h1>Approval Queue</h1>
        <p>Review, edit, and approve pending content and actions from all agents</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{stats.pending ?? stats.total ?? 0}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.approved_today ?? 0}</div>
            <div className="stat-label">Approved Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--red)' }}>{stats.rejected_today ?? 0}</div>
            <div className="stat-label">Rejected Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: stats.overdue > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>
              {stats.overdue ?? 0}
            </div>
            <div className="stat-label">Overdue</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.auto_approved_today ?? 0}</div>
            <div className="stat-label">Auto-Approved</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${tab === 'pending' ? ' tab-active' : ''}`} onClick={() => setTab('pending')}>
          Pending{stats?.pending ? ` (${stats.pending})` : ''}
        </button>
        <button className={`tab${tab === 'overdue' ? ' tab-active' : ''}`} onClick={() => setTab('overdue')}>
          Overdue{stats?.overdue ? ` (${stats.overdue})` : ''}
        </button>
      </div>

      {/* Filters */}
      {tab === 'pending' && (
        <div className="filter-bar">
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
            <option value="">All tiers</option>
            <option value="1">Tier 1 — Critical</option>
            <option value="2">Tier 2 — Standard</option>
            <option value="3">Tier 3 — Routine</option>
          </select>
          <button className="btn btn-sm" onClick={load}>Refresh</button>
        </div>
      )}

      {/* Batch actions bar */}
      {selected.size > 0 && (
        <div className="batch-bar">
          <span>{selected.size} item{selected.size > 1 ? 's' : ''} selected</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-approve btn-sm" onClick={() => handleBatch('approve')}>
            Approve Selected
          </button>
          <button className="btn btn-reject btn-sm" onClick={() => handleBatch('reject')}>
            Reject Selected
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* Content */}
      {loading && <div className="loading"><div className="spinner" />Loading...</div>}
      {error && <div className="error-state">Error: {error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">&#10003;</div>
          <p>No {tab} approvals. Everything is up to date.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" onChange={toggleAll} checked={selected.size === items.length && items.length > 0} />
            <span className="text-sm text-muted">Select all ({items.length})</span>
          </div>

          {items.map((item) => {
            const isExpanded = expanded.has(item.id);
            const preview = item.content_preview || item.preview || '';
            const fullContent = item.full_content || {};
            const hasContent = preview || Object.keys(fullContent).length > 0;

            return (
              <div key={item.id} className="approval-item">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  style={{ marginTop: 2 }}
                />
                <div className="approval-content">
                  <div className="approval-title">
                    {item.item_type || item.title || item.content_type || 'Untitled'}
                  </div>
                  <div className="approval-meta">
                    {item.agent_id && <span>{item.agent_id}</span>}
                    {item.tier && (
                      <span className={`badge ${TIER_BADGE[item.tier] || 'badge-muted'}`}>
                        {TIER_LABEL[item.tier] || `Tier ${item.tier}`}
                      </span>
                    )}
                    {item.product && <span className="badge badge-purple">{item.product}</span>}
                    {item.auto_approve_eligible && <span className="badge badge-cyan">Auto-eligible</span>}
                    {item.escalated && <span className="badge badge-red">Escalated</span>}
                    {item.created_at && (
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    )}
                  </div>

                  {/* Content preview */}
                  {hasContent && (
                    <>
                      <div
                        className={`approval-preview${isExpanded ? ' approval-preview-expanded' : ''}`}
                        onClick={() => toggleExpand(item.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {preview || JSON.stringify(fullContent, null, 2)}
                      </div>
                      {!isExpanded && preview && preview.length > 200 && (
                        <button
                          className="btn btn-ghost btn-xs mt-1"
                          onClick={() => toggleExpand(item.id)}
                          style={{ color: 'var(--accent-hover)' }}
                        >
                          Show more
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="approval-actions" style={{ flexDirection: 'column', gap: 4 }}>
                  <button
                    className="btn btn-approve btn-sm"
                    disabled={acting.has(item.id)}
                    onClick={() => handleAction(item.id, 'approve')}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={acting.has(item.id)}
                    onClick={() => openEdit(item)}
                    style={{ color: 'var(--accent-hover)' }}
                  >
                    Edit & Send
                  </button>
                  <button
                    className="btn btn-reject btn-sm"
                    disabled={acting.has(item.id)}
                    onClick={() => handleAction(item.id, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-backdrop" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Review & Edit</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => setEditItem(null)}>Close</button>
            </div>
            <div className="modal-body">
              <div className="text-sm font-semibold mb-3">
                {editItem.item_type || editItem.title || 'Untitled'}
              </div>
              <div className="approval-meta mb-3">
                {editItem.agent_id && <span>{editItem.agent_id}</span>}
                {editItem.tier && (
                  <span className={`badge ${TIER_BADGE[editItem.tier] || 'badge-muted'}`}>
                    {TIER_LABEL[editItem.tier]}
                  </span>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="text-xs text-muted font-semibold" style={{ display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Content Preview
                </label>
                <div className="approval-preview approval-preview-expanded">
                  {editItem.content_preview || JSON.stringify(editItem.full_content || {}, null, 2)}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted font-semibold" style={{ display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Reviewer Notes
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes, edits, or instructions for the agent..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-sm" onClick={() => setEditItem(null)}>Cancel</button>
              <button
                className="btn btn-reject btn-sm"
                onClick={() => { handleAction(editItem.id, 'reject', editNotes); setEditItem(null); }}
              >
                Reject with Notes
              </button>
              <button className="btn btn-approve btn-sm" onClick={handleEditApprove}>
                Approve with Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
