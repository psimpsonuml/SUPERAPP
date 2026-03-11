'use client';

import { useState, useEffect } from 'react';
import { fetchFeatureVisibility, updateFeatureVisibility, bulkUpdateVisibility } from '../../../lib/api';
import { VISIBILITY_LEVELS } from '../../../lib/constants';

export default function FeatureVisibilityPage() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterVisibility, setFilterVisibility] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [bulkLevel, setBulkLevel] = useState('public');
  const [saving, setSaving] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const result = await fetchFeatureVisibility();
      setFeatures(result.features || []);
    } catch {} finally { setLoading(false); }
  }

  async function handleChangeVisibility(featureId, visibility) {
    setSaving(featureId);
    try {
      await updateFeatureVisibility(featureId, visibility);
      setFeatures(prev => prev.map(f => f.feature_id === featureId ? { ...f, visibility } : f));
    } catch (err) { alert(err.message); }
    finally { setSaving(null); }
  }

  async function handleBulkUpdate() {
    if (selected.size === 0) return;
    setSaving('bulk');
    try {
      await bulkUpdateVisibility([...selected], bulkLevel);
      setFeatures(prev => prev.map(f => selected.has(f.feature_id) ? { ...f, visibility: bulkLevel } : f));
      setSelected(new Set());
    } catch (err) { alert(err.message); }
    finally { setSaving(null); }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll(filtered) {
    const allSelected = filtered.every(f => selected.has(f.feature_id));
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(f => next.delete(f.feature_id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(f => next.add(f.feature_id));
        return next;
      });
    }
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading features...</div>;

  const categories = [...new Set(features.map(f => f.category).filter(Boolean))].sort();

  let filtered = features;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(f =>
      f.feature_name?.toLowerCase().includes(q) ||
      f.feature_id?.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q)
    );
  }
  if (filterCategory !== 'all') filtered = filtered.filter(f => f.category === filterCategory);
  if (filterVisibility !== 'all') filtered = filtered.filter(f => f.visibility === filterVisibility);

  const grouped = {};
  for (const f of filtered) {
    const cat = f.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  }

  const visibilityBadge = (level) => {
    const colors = {
      public: 'badge-green',
      premium_only: 'badge-amber',
      internal_only: 'badge-blue',
      hidden: 'badge-red',
    };
    return colors[level] || '';
  };

  const allSelected = filtered.length > 0 && filtered.every(f => selected.has(f.feature_id));

  return (
    <>
      <div className="page-header">
        <h1>Feature Visibility</h1>
        <p>Control which features are visible to customers based on their plan</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search features..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterVisibility} onChange={(e) => setFilterVisibility(e.target.value)}>
          <option value="all">All Visibility</option>
          {VISIBILITY_LEVELS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="card card-compact" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
          <select value={bulkLevel} onChange={(e) => setBulkLevel(e.target.value)} style={{ width: 160 }}>
            {VISIBILITY_LEVELS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleBulkUpdate} disabled={saving === 'bulk'}>
            {saving === 'bulk' ? 'Updating...' : 'Apply to Selected'}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {VISIBILITY_LEVELS.map(v => {
          const count = features.filter(f => f.visibility === v.id).length;
          return (
            <div key={v.id} className="stat-card" style={{ flex: 1, cursor: 'pointer' }} onClick={() => setFilterVisibility(filterVisibility === v.id ? 'all' : v.id)}>
              <div className="stat-label">{v.name}</div>
              <div className="stat-value" style={{ fontSize: 24 }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Feature list */}
      {Object.keys(grouped).sort().map(cat => (
        <div key={cat} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize', margin: 0 }}>{cat}</h3>
            <span className="badge" style={{ fontSize: 10 }}>{grouped[cat].length}</span>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', width: 32 }}>
                    <input
                      type="checkbox"
                      checked={grouped[cat].every(f => selected.has(f.feature_id))}
                      onChange={() => toggleSelectAll(grouped[cat])}
                    />
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Feature</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', width: 180 }}>Visibility</th>
                </tr>
              </thead>
              <tbody>
                {grouped[cat].map(f => (
                  <tr key={f.feature_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <input type="checkbox" checked={selected.has(f.feature_id)} onChange={() => toggleSelect(f.feature_id)} />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 500 }}>{f.feature_name}</div>
                      {f.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{f.description}</div>}
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{f.feature_id}</div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <select
                        value={f.visibility || 'public'}
                        onChange={(e) => handleChangeVisibility(f.feature_id, e.target.value)}
                        disabled={saving === f.feature_id}
                        style={{ width: '100%' }}
                      >
                        {VISIBILITY_LEVELS.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-message">No features match your filters</div>
          <div className="empty-state-hint">Try adjusting your search or filter criteria</div>
        </div>
      )}
    </>
  );
}
