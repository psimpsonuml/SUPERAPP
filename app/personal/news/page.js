'use client';

import { useState, useEffect } from 'react';
import { fetchNewsFeed } from '../../../lib/api';

export default function NewsFeedPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const { items: data } = await fetchNewsFeed();
        setItems(data || []);
      } catch { setItems([]); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="loading"><div className="spinner" />Loading news feed...</div>;

  const sourceTypes = [...new Set(items.map((i) => i.source_type).filter(Boolean))];
  const filtered = filter === 'all' ? items : items.filter((i) => i.source_type === filter);

  return (
    <>
      <div className="page-header">
        <h1>News & Social Feed</h1>
        <p>Unified multi-viewpoint news and social media across all your interests</p>
      </div>

      <div className="filter-bar">
        <button className={`btn btn-sm${filter === 'all' ? ' btn-primary' : ''}`} onClick={() => setFilter('all')}>All</button>
        {sourceTypes.map((t) => (
          <button key={t} className={`btn btn-sm${filter === t ? ' btn-primary' : ''}`} onClick={() => setFilter(t)}>
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">N</div>
          <p>No news items yet.</p>
          <p className="text-sm text-muted mt-2">The News & Social Feed agent aggregates articles from your configured sources. Items will appear here once the agent runs.</p>
        </div>
      ) : (
        filtered.map((item, i) => (
          <div key={item.id || i} className="card card-compact" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="flex items-center gap-2">
                {item.source_type && <span className="badge badge-blue">{item.source_type}</span>}
                {item.source_lean && <span className="badge badge-muted">{item.source_lean}</span>}
                {item.topic && <span className="badge badge-purple">{item.topic}</span>}
              </div>
              <span className="text-xs text-muted">
                {item.published_at ? new Date(item.published_at).toLocaleString() : '—'}
              </span>
            </div>
            <div className="font-semibold text-sm">{item.title}</div>
            {item.summary && <p className="text-sm text-secondary mt-1">{item.summary}</p>}
            {item.url && (
              <div className="mt-2">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: 'var(--accent-hover)' }}>
                  Read more &rarr;
                </a>
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
