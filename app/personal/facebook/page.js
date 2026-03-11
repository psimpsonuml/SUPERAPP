'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchFbStatus, uploadFbData, fetchFbAnalysis, runFbAnalysis, deleteFbData } from '../../../lib/api';

// ── Constants ─────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'friends', label: 'Friends' },
  { id: 'posts', label: 'Posts' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'photos', label: 'Photos' },
  { id: 'messages', label: 'Messages' },
  { id: 'insights', label: 'Insights' },
];

const SENTIMENT_COLORS = {
  1: '#dc2626', 2: '#ef4444', 3: '#f97316', 4: '#f59e0b', 5: '#eab308',
  6: '#84cc16', 7: '#22c55e', 8: '#10b981', 9: '#059669', 10: '#047857',
};

// ── FB data file mapping ──────────────────────────────────
const FB_FILE_MAP = {
  'posts/your_posts': 'posts',
  'comments/comments': 'comments',
  'friends/friends': 'friends',
  'friends/removed_friends': 'removed_friends',
  'likes/posts_and_comments': 'likes',
  'messages/inbox': 'messages',
  'profile_information/profile_information': 'profile',
  'photos_and_videos': 'photos',
  'search/your_search_history': 'searches',
  'other_activity/pokes': 'pokes',
};

export default function FacebookPage() {
  const [tab, setTab] = useState('overview');
  const [importStatus, setImportStatus] = useState(null);
  const [analyses, setAnalyses] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [includeMessages, setIncludeMessages] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [storyLoading, setStoryLoading] = useState(false);
  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, analysisRes] = await Promise.all([
        fetchFbStatus(),
        fetchFbAnalysis(),
      ]);
      setImportStatus(statusRes.status);
      setAnalyses(analysisRes.analyses || {});
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll during processing
  useEffect(() => {
    if (!importStatus || !['processing', 'analyzing'].includes(importStatus.status)) return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [importStatus?.status, loadData]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) { alert('Please upload a ZIP file from your Facebook data export.'); return; }

    setUploading(true);
    setUploadProgress(10);

    try {
      // Read and parse the ZIP file client-side using JSZip
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      setUploadProgress(30);

      const parsed = {};
      const entries = Object.entries(zip.files);
      let processed = 0;

      for (const [path, zipEntry] of entries) {
        if (zipEntry.dir) continue;
        if (!path.endsWith('.json')) { processed++; continue; }

        // Skip messages if not opted in
        if (!includeMessages && path.includes('messages/inbox')) { processed++; continue; }

        // Match to data type
        let dataType = null;
        for (const [prefix, type] of Object.entries(FB_FILE_MAP)) {
          if (path.includes(prefix)) { dataType = type; break; }
        }

        if (dataType) {
          try {
            const content = await zipEntry.async('string');
            const data = JSON.parse(content);
            // Merge arrays if multiple files for same type
            if (parsed[dataType] && Array.isArray(parsed[dataType]) && Array.isArray(data)) {
              parsed[dataType] = parsed[dataType].concat(data);
            } else if (parsed[dataType] && Array.isArray(parsed[dataType]) && data && typeof data === 'object') {
              // Handle keyed objects (some FB exports wrap in an object)
              const arrKey = Object.keys(data).find(k => Array.isArray(data[k]));
              if (arrKey) parsed[dataType] = parsed[dataType].concat(data[arrKey]);
            } else if (data && typeof data === 'object') {
              const arrKey = Object.keys(data).find(k => Array.isArray(data[k]));
              parsed[dataType] = arrKey ? data[arrKey] : data;
            }
          } catch { /* skip unparseable */ }
        }

        processed++;
        setUploadProgress(30 + Math.round((processed / entries.length) * 50));
      }

      setUploadProgress(85);

      // Send to API
      await uploadFbData(parsed, includeMessages);
      setUploadProgress(100);

      // Reload data
      setTimeout(() => {
        loadData();
        setUploading(false);
      }, 1000);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
      setUploading(false);
    }
  };

  const generateStory = async () => {
    setStoryLoading(true);
    try {
      await runFbAnalysis('story');
      await loadData();
    } catch { /* noop */ }
    setStoryLoading(false);
  };

  const handleDelete = async () => {
    await deleteFbData();
    setImportStatus(null);
    setAnalyses({});
    setShowDeleteConfirm(false);
  };

  const hasData = importStatus?.status === 'complete';
  const overview = analyses.overview || {};
  const tabsToShow = TABS.filter(t => t.id !== 'messages' || overview.hasMessages);

  if (loading) return <div className="loading"><div className="spinner" />Loading Facebook data...</div>;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Facebook Archaeologist</h1>
            <p>Analyze your complete Facebook history — posts, friends, engagement, memories</p>
          </div>
          {hasData && (
            <button className="btn btn-sm" onClick={() => setShowDeleteConfirm(true)}
              style={{ color: '#dc2626', borderColor: '#dc2626' }}>
              Delete My Data
            </button>
          )}
        </div>
      </div>

      {/* ── Upload / Status ────────────────────────────── */}
      {!hasData && (
        <div style={{
          background: 'var(--card-bg)', borderRadius: 10, padding: 24, marginBottom: 24,
          border: '1px solid var(--border)',
        }}>
          {uploading || ['processing', 'analyzing'].includes(importStatus?.status) ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                {uploading ? 'Uploading & parsing...' : importStatus?.status === 'analyzing' ? 'Running analysis...' : 'Processing...'}
              </div>
              <div style={{
                width: '100%', height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${uploading ? uploadProgress : importStatus?.progress || 50}%`,
                  height: '100%', borderRadius: 4,
                  background: 'var(--accent)', transition: 'width 0.3s',
                }} />
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                {importStatus?.files_parsed || 0} / {importStatus?.total_files || '?'} files parsed
              </div>
            </div>
          ) : importStatus?.status === 'error' ? (
            <div>
              <div style={{ color: '#dc2626', fontWeight: 600, marginBottom: 8 }}>Import failed</div>
              <div className="text-sm text-muted">{importStatus.error_message}</div>
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => fileInputRef.current?.click()}>
                Try Again
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>f</div>
              <h3 style={{ marginBottom: 8 }}>Upload Your Facebook Data Export</h3>
              <p className="text-sm text-muted" style={{ maxWidth: 500, margin: '0 auto 16px' }}>
                Go to Facebook &rarr; Settings &rarr; Your Information &rarr; Download Your Information.
                Select JSON format, then upload the ZIP file here.
              </p>

              <div style={{
                background: '#fffbeb', border: '1px solid #f59e0b33', borderRadius: 8,
                padding: 12, marginBottom: 16, maxWidth: 500, margin: '0 auto 16px', textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>Privacy Notice</div>
                <div style={{ fontSize: 11, color: '#78350f', lineHeight: 1.5 }}>
                  Your Facebook data is stored encrypted in our database. It is never shared with anyone.
                  You can delete all your data at any time using the &quot;Delete My Data&quot; button.
                  Analysis is performed privately using Claude AI.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeMessages} onChange={e => setIncludeMessages(e.target.checked)} />
                  Include messages (optional, may be large)
                </label>
              </div>

              <input ref={fileInputRef} type="file" accept=".zip" style={{ display: 'none' }}
                onChange={handleFileUpload} />
              <button className="btn" style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 24px' }}
                onClick={() => fileInputRef.current?.click()}>
                Upload Facebook Export (.zip)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────── */}
      {hasData && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
            {tabsToShow.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: tab === t.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: tab === t.id ? 'var(--accent)' : 'var(--card-bg)',
                color: tab === t.id ? '#fff' : 'var(--text)', cursor: 'pointer',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && <OverviewTab analyses={analyses} />}
          {tab === 'friends' && <FriendsTab data={analyses.friends} />}
          {tab === 'posts' && <PostsTab data={analyses.post_history} sentiment={analyses.sentiment} />}
          {tab === 'engagement' && <EngagementTab data={analyses.engagement} />}
          {tab === 'photos' && <PhotosTab data={analyses.photos} />}
          {tab === 'messages' && <MessagesTab data={analyses.messages} />}
          {tab === 'insights' && <InsightsTab story={analyses.story} onGenerate={generateStory} loading={storyLoading} sentiment={analyses.sentiment} />}
        </>
      )}

      {/* ── Delete confirmation ────────────────────────── */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--card-bg, #fff)', borderRadius: 12, padding: 24, maxWidth: 400,
          }}>
            <h3 style={{ margin: '0 0 12px' }}>Delete All Facebook Data?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              This will permanently delete all your imported Facebook archive data and analysis results.
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn-sm" onClick={handleDelete}
                style={{ background: '#dc2626', color: '#fff', border: 'none' }}>
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Overview Tab ──────────────────────────────────────────
function OverviewTab({ analyses }) {
  const o = analyses.overview || {};
  const postHistory = analyses.post_history || {};
  const lifeEvents = analyses.life_events?.events || [];
  const sentiment = analyses.sentiment || {};

  return (
    <div>
      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard value={o.totalPosts} label="Total Posts" />
        <StatCard value={o.totalFriends} label="Friends" />
        <StatCard value={o.yearsOnFacebook} label="Years on FB" />
        <StatCard value={o.mostActiveYear} label="Most Active Year" sub={`${o.mostActiveYearPosts || 0} posts`} />
        <StatCard value={o.totalPhotos} label="Photos" />
        <StatCard value={o.totalLikes} label="Likes Given" />
      </div>

      {/* Posting frequency chart */}
      {postHistory.postFrequency?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Posting Activity Over Time</h3>
          <BarChart data={postHistory.postFrequency} xKey="year" yKey="count" color="#6366f1" label="posts" />
        </div>
      )}

      {/* Life events timeline */}
      {lifeEvents.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Life Events Timeline</h3>
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            {lifeEvents.slice(0, 30).map((event, i) => (
              <div key={i} style={{
                position: 'relative', paddingBottom: 16, paddingLeft: 16,
                borderLeft: '2px solid var(--border)',
              }}>
                <div style={{
                  position: 'absolute', left: -6, top: 2, width: 10, height: 10,
                  borderRadius: '50%', background: event.source === 'post_detection' ? '#d97706' : '#6366f1',
                }} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                  {event.year || '?'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{event.title}</div>
                {event.description && (
                  <div className="text-xs text-muted" style={{ marginTop: 2, lineHeight: 1.4 }}>
                    {event.description.slice(0, 150)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sentiment journey preview */}
      {sentiment.sentimentByYear?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Emotional Tone Over Time</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {sentiment.sentimentByYear.map((y, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: Math.max(8, (y.score / 10) * 80), borderRadius: 4,
                  background: SENTIMENT_COLORS[y.score] || '#6b7280',
                }} title={`${y.year}: ${y.score}/10 — ${y.tone || ''}`} />
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>{y.year}</div>
              </div>
            ))}
          </div>
          {sentiment.overallArc && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, fontStyle: 'italic' }}>
              {sentiment.overallArc}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Friends Tab ───────────────────────────────────────────
function FriendsTab({ data }) {
  if (!data) return <EmptyTab message="No friends data available." />;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard value={data.totalFriends} label="Total Friends" />
        <StatCard value={data.removedCount} label="Unfriended" />
        <StatCard value={data.additionClusters?.length || 0} label="Addition Clusters" />
      </div>

      {/* Friend count over time */}
      {data.friendTimeline?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Friends Over Time</h3>
          <BarChart data={data.friendTimeline} xKey="year" yKey="total" color="#22c55e" label="total friends" />
        </div>
      )}

      {/* Addition clusters */}
      {data.additionClusters?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Friend Addition Clusters</h3>
          <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
            Periods where you added many friends quickly — new job, school, move?
          </p>
          {data.additionClusters.map((c, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
              borderRadius: 6, background: '#f0fdf4', marginBottom: 4, fontSize: 12,
            }}>
              <span>{c.start} to {c.end}</span>
              <span style={{ fontWeight: 600, color: '#059669' }}>{c.count} friends added</span>
            </div>
          ))}
        </div>
      )}

      {/* Unfriended */}
      {data.removedFriends?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Unfriended ({data.removedCount})</h3>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {data.removedFriends.map((f, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                borderBottom: '1px solid var(--border)', fontSize: 12,
              }}>
                <span>{f.name}</span>
                <span className="text-muted">{f.timestamp ? new Date(f.timestamp * 1000).toLocaleDateString() : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Posts Tab ──────────────────────────────────────────────
function PostsTab({ data, sentiment }) {
  if (!data) return <EmptyTab message="No post data available." />;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard value={data.totalPosts} label="Total Posts" />
        <StatCard value={data.mostActiveYear?.year} label="Most Active Year" sub={`${data.mostActiveYear?.count} posts`} />
        <StatCard value={data.yearsOnFacebook} label="Years Active" />
      </div>

      {/* Post frequency */}
      {data.postFrequency?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Posts Per Year</h3>
          <BarChart data={data.postFrequency} xKey="year" yKey="count" color="#6366f1" label="posts" />
        </div>
      )}

      {/* Word cloud (top words as tag cloud) */}
      {data.topWords?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Most Used Words</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.topWords.slice(0, 40).map((w, i) => {
              const maxCount = data.topWords[0].count;
              const size = 10 + Math.round((w.count / maxCount) * 16);
              const opacity = 0.4 + (w.count / maxCount) * 0.6;
              return (
                <span key={i} style={{ fontSize: size, fontWeight: 600, color: '#6366f1', opacity }}
                  title={`${w.word}: ${w.count} uses`}>
                  {w.word}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Sentiment over time */}
      {sentiment?.sentimentByYear?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Sentiment Journey</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
            {sentiment.sentimentByYear.map((y, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: Math.max(8, (y.score / 10) * 100), borderRadius: 4,
                  background: SENTIMENT_COLORS[y.score] || '#6b7280', transition: 'height 0.3s',
                }} title={`${y.year}: ${y.score}/10 — ${y.tone}`} />
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>{y.year}</div>
                <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{y.score}</div>
              </div>
            ))}
          </div>
          {sentiment.happiestPeriod && (
            <div style={{ marginTop: 12, padding: 10, background: '#ecfdf5', borderRadius: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: '#059669' }}>Happiest: </span>
              {sentiment.happiestPeriod.years} — {sentiment.happiestPeriod.reason}
            </div>
          )}
          {sentiment.hardestPeriod && (
            <div style={{ marginTop: 6, padding: 10, background: '#fef2f2', borderRadius: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: '#dc2626' }}>Hardest: </span>
              {sentiment.hardestPeriod.years} — {sentiment.hardestPeriod.reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Engagement Tab ────────────────────────────────────────
function EngagementTab({ data }) {
  if (!data) return <EmptyTab message="No engagement data available." />;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard value={data.totalLikes} label="Likes Given" />
        <StatCard value={data.totalComments} label="Comments" />
        <StatCard value={data.topInteractors?.length || 0} label="Interactors Tracked" />
      </div>

      {/* Top interactors leaderboard */}
      {data.topInteractors?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top Interactors</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.topInteractors.slice(0, 20).map((p, i) => {
              const maxTotal = data.topInteractors[0].total;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                    background: i < 3 ? '#fef3c7' : '#f3f4f6', color: i < 3 ? '#92400e' : 'var(--text-muted)',
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {p.likes} likes, {p.comments} comments
                    </div>
                  </div>
                  <div style={{
                    width: 120, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(p.total / maxTotal) * 100}%`, height: '100%',
                      background: '#6366f1', borderRadius: 3,
                    }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{p.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Photos Tab ────────────────────────────────────────────
function PhotosTab({ data }) {
  if (!data) return <EmptyTab message="No photo data available." />;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard value={data.totalPhotos} label="Total Photos" />
        <StatCard value={data.locationCount} label="Geotagged" />
        <StatCard value={data.photosByYear?.length || 0} label="Years of Photos" />
      </div>

      {data.photosByYear?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Photos Per Year</h3>
          <BarChart data={data.photosByYear} xKey="year" yKey="count" color="#d97706" label="photos" />
        </div>
      )}

      {data.locations?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Photo Locations ({data.locationCount} geotagged)</h3>
          <p className="text-sm text-muted">
            Photo locations data available. {data.locationCount} photos have GPS coordinates across {data.photosByYear?.length || 0} years.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Messages Tab ──────────────────────────────────────────
function MessagesTab({ data }) {
  if (!data) return <EmptyTab message="No message data imported. Re-upload with 'Include messages' checked." />;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard value={data.totalThreads} label="Conversations" />
        <StatCard value={data.totalMessages} label="Total Messages" />
        <StatCard value={data.topConversations?.length || 0} label="Partners Tracked" />
      </div>

      {data.topConversations?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top Conversations</h3>
          {data.topConversations.map((c, i) => {
            const maxMsg = data.topConversations[0].messageCount;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{
                  width: 24, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center',
                }}>{i + 1}</span>
                <div style={{ flex: 1, fontSize: 13 }}>{c.partner}</div>
                <div style={{
                  width: 100, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(c.messageCount / maxMsg) * 100}%`, height: '100%',
                    background: '#ec4899', borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 50, textAlign: 'right' }}>
                  {c.messageCount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Insights Tab ──────────────────────────────────────────
function InsightsTab({ story, onGenerate, loading, sentiment }) {
  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        borderRadius: 12, padding: 24, marginBottom: 20, color: '#e0e7ff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>Your Facebook Story</h3>
          <button onClick={onGenerate} disabled={loading} className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#e0e7ff', border: 'none' }}>
            {loading ? 'Generating...' : story ? 'Regenerate' : 'Generate Story'}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#a5b4fc' }}>
            Analyzing your Facebook history and writing your story...
          </div>
        ) : story?.text ? (
          <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {story.text}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 30, color: '#a5b4fc' }}>
            Click &quot;Generate Story&quot; to create a personalized narrative analysis of your Facebook history.
            Claude will analyze your posts, friends, engagement, and life events to write &quot;Your Facebook Story&quot;.
          </div>
        )}

        {story?.generatedAt && (
          <div style={{ fontSize: 10, color: '#818cf8', marginTop: 12 }}>
            Generated {new Date(story.generatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Sentiment highlights */}
      {sentiment?.biggestShifts?.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Biggest Tone Shifts</h3>
          {sentiment.biggestShifts.map((shift, i) => (
            <div key={i} style={{
              padding: 10, background: '#fffbeb', borderRadius: 6, marginBottom: 6, fontSize: 12,
            }}>
              <span style={{ fontWeight: 600, color: '#d97706' }}>{shift.from} &rarr; {shift.to}: </span>
              {shift.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────
function StatCard({ value, label, sub }) {
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 8, padding: 14,
      border: '1px solid var(--border)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, xKey, yKey, color, label }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d[yKey] || 0), 1);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              height: Math.max(4, (d[yKey] / maxVal) * 80), borderRadius: 3,
              background: color, transition: 'height 0.3s',
            }} title={`${d[xKey]}: ${d[yKey]} ${label}`} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--text-muted)' }}>
            {String(d[xKey]).slice(-2)}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyTab({ message }) {
  return (
    <div className="card">
      <div className="empty-state">
        <p>{message}</p>
      </div>
    </div>
  );
}
