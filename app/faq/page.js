'use client';

import { useState, useEffect } from 'react';
import { fetchFAQ } from '../../lib/api';

const CATEGORY_LABELS = {
  operations: 'Operations Agents',
  personal: 'Personal Modules',
  platform: 'Platform Pages',
  configuration: 'Settings & Configuration',
};

const VISIBILITY_BADGE = {
  public: { class: 'badge-green', label: 'Available' },
  premium_only: { class: 'badge-amber', label: 'Premium' },
  internal_only: { class: 'badge-purple', label: 'Internal' },
  hidden: { class: 'badge-muted', label: 'Hidden' },
};

export default function FAQPage() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFAQ();
  }, []);

  async function loadFAQ() {
    try {
      const result = await fetchFAQ({ search: search || undefined });
      setData(result);
    } catch {
      setData({ entries: [], grouped: {}, total: 0, overview: null });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadFAQ();
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  if (loading) return <div className="loading"><div className="spinner" />Loading FAQ...</div>;

  const overview = data?.overview;
  const grouped = data?.grouped || {};

  return (
    <>
      <div className="page-header">
        <h1>FAQ</h1>
        <p>Everything BeaconOps does — auto-generated from system configuration</p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Search features..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Overview */}
      {overview && !search && (
        <div className="card" style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{overview.title}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {overview.content}
          </p>
        </div>
      )}

      {/* Feature sections */}
      {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
        const entries = grouped[cat];
        if (!entries?.length) return null;
        return (
          <div key={cat} className="section">
            <div className="section-header"><h2>{label}</h2></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.map((entry) => {
                const vis = VISIBILITY_BADGE[entry.visibility] || VISIBILITY_BADGE.public;
                return (
                  <div key={entry.feature_id} className="card card-compact card-lift">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{entry.feature_name}</span>
                      <span className={`badge ${vis.class}`}>{vis.label}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {entry.description || 'No description available.'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="text-sm text-muted" style={{ marginTop: 24 }}>
        {data?.total || 0} features documented
      </div>
    </>
  );
}
