'use client';
import { useState } from 'react';

export default function FacebookPage() {
  const [tab, setTab] = useState('overview');

  return (
    <>
      <div className="page-header">
        <h1>Facebook Archaeologist</h1>
        <p>Analyze your Facebook data export for insights and memories</p>
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {['overview', 'posts', 'connections', 'activity'].map((t) => (
          <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card">
          <div className="empty-state">
            <p>Facebook archive not yet uploaded.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>
              Download your Facebook data export from Settings → Your Information → Download Your Information.
              Upload the JSON export here and the Facebook Archaeologist agent will analyze your posts, connections,
              activity patterns, and generate insights.
            </p>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" disabled>Upload FB Export (Coming Soon)</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'posts' && (
        <div className="card">
          <div className="card-header"><h2>Post Analysis</h2></div>
          <div className="empty-state">
            <p>No post data available.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>Post timeline, sentiment analysis, and topic clustering will appear here after upload.</p>
          </div>
        </div>
      )}

      {tab === 'connections' && (
        <div className="card">
          <div className="card-header"><h2>Connection Graph</h2></div>
          <div className="empty-state">
            <p>No connection data available.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>Friend network analysis and interaction patterns will appear here after upload.</p>
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="card">
          <div className="card-header"><h2>Activity Patterns</h2></div>
          <div className="empty-state">
            <p>No activity data available.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>Usage patterns, peak activity times, and behavioral insights will appear here after upload.</p>
          </div>
        </div>
      )}
    </>
  );
}
