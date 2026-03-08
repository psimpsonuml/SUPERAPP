'use client';
import { useState, useEffect } from 'react';
import { fetchReleases } from '../../../lib/api';

export default function ReleasesPage() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchReleases().then((r) => setReleases(r.releases || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const types = ['all', ...new Set(releases.map((r) => r.release_type).filter(Boolean))];
  const filtered = filter === 'all' ? releases : releases.filter((r) => r.release_type === filter);

  return (
    <>
      <div className="page-header">
        <h1>Release Tracker</h1>
        <p>Upcoming and recent releases across streaming, theaters, and games</p>
      </div>
      {types.length > 1 && (
        <div className="tabs" style={{ marginBottom: 16 }}>
          {types.map((t) => (
            <button key={t} className={`tab ${filter === t ? 'tab-active' : ''}`} onClick={() => setFilter(t)}>
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      )}
      <div className="card card-compact">
        {loading ? <div className="loading"><div className="spinner" /></div> : filtered.length === 0 ? (
          <div className="empty-state">
            <p>No releases tracked yet.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>The Release Tracker agent populates this weekly on Fridays.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, padding: 16 }}>
            {filtered.map((r, i) => (
              <div key={r.id || i} className="card" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 className="text-sm font-semibold" style={{ margin: 0 }}>{r.title}</h3>
                  {r.release_type && <span className="badge badge-muted">{r.release_type}</span>}
                </div>
                {r.platform && <p className="text-sm text-muted" style={{ margin: '4px 0' }}>{r.platform}</p>}
                <p className="text-sm" style={{ margin: '4px 0', color: 'var(--accent)' }}>
                  {r.release_date ? new Date(r.release_date).toLocaleDateString() : 'TBA'}
                </p>
                {r.notes && <p className="text-sm text-muted" style={{ marginTop: 6 }}>{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
