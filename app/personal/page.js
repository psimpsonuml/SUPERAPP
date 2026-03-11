'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PERSONAL_MODULES } from '../../lib/constants';
import { fetchTopStories } from '../../lib/api';

const TOPIC_COLORS = {
  politics: '#6366f1', tech: '#06b6d4', gaming: '#22c55e', history: '#d97706',
  payroll_hr: '#ec4899', personal_finance: '#8b5cf6', business: '#0ea5e9', general: '#6b7280',
};

const LEAN_STYLES = {
  left: { label: 'L', bg: '#dbeafe', color: '#1d4ed8' },
  center: { label: 'C', bg: '#f3f4f6', color: '#374151' },
  right: { label: 'R', bg: '#fee2e2', color: '#dc2626' },
};

function ModuleIcon({ d }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function PersonalDashboard() {
  const [stories, setStories] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTopStories();
        setStories(data.stories || []);
      } catch { /* noop */ }
    })();
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Personal Intelligence</h1>
        <p>Entertainment tracking, life management, self-knowledge, and personal analytics</p>
      </div>

      {/* ── Top Stories widget ──────────────────────────── */}
      {stories.length > 0 && (
        <div style={{
          background: 'var(--card-bg)', borderRadius: 10, padding: 16,
          border: '1px solid var(--border)', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Top Stories</h3>
            <Link href="/personal/news" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              View all &rarr;
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stories.map(story => {
              const topicColor = TOPIC_COLORS[story.topic] || TOPIC_COLORS.general;
              const lean = story.source_lean ? LEAN_STYLES[story.source_lean] : null;
              return (
                <a key={story.id} href={story.source_url} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    textDecoration: 'none', color: 'var(--text)',
                    padding: '8px 10px', borderRadius: 6,
                    borderLeft: `3px solid ${topicColor}`,
                    background: `${topicColor}06`,
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = `${topicColor}12`; }}
                  onMouseOut={e => { e.currentTarget.style.background = `${topicColor}06`; }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{story.headline}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                      <span className="text-xs text-muted">{story.source}</span>
                      {lean && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                          background: lean.bg, color: lean.color,
                        }}>{lean.label}</span>
                      )}
                      <span style={{
                        fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                        background: `${topicColor}18`, color: topicColor,
                      }}>{story.topic}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap', marginTop: 2 }}>
                    {story.published_at ? timeAgo(story.published_at) : ''}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="module-grid">
        {PERSONAL_MODULES.map((mod) => (
          <Link key={mod.id} href={mod.href} className="module-card">
            <div className="module-card-icon">
              <ModuleIcon d={mod.icon} />
            </div>
            <h3>{mod.name}</h3>
            <p>{mod.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
