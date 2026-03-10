'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAdCreatives, markCreativeUsed, approveItem, rejectItem } from '../../lib/api';

const PRODUCTS = {
  chronostates: { label: 'ChronoStates', color: '#7c3aed' },
  payroll_beacon: { label: 'Payroll Beacon', color: '#2563eb' },
  budgeting_beacon: { label: 'Budgeting Beacon', color: '#059669' },
};

const PLATFORMS = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  reddit: { label: 'Reddit', color: '#FF4500' },
  google_search: { label: 'Google Search', color: '#4285F4' },
  google_display: { label: 'Google Display', color: '#34A853' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  video: { label: 'Video Concept', color: '#9333ea' },
};

const ANGLE_LABELS = {
  pain_point: { label: 'Pain Point', color: '#dc2626', bg: '#fef2f2' },
  curiosity: { label: 'Curiosity', color: '#7c3aed', bg: '#f5f3ff' },
  social_proof: { label: 'Social Proof', color: '#2563eb', bg: '#eff6ff' },
  direct_benefit: { label: 'Direct Benefit', color: '#059669', bg: '#ecfdf5' },
  video: { label: 'Video', color: '#9333ea', bg: '#faf5ff' },
};

const STATUS_BADGE = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  approved: { label: 'Approved', color: '#059669', bg: '#ecfdf5' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2' },
  auto_approved: { label: 'Auto-Approved', color: '#2563eb', bg: '#eff6ff' },
};

export default function AdCreativesPage() {
  const [creatives, setCreatives] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [showMockup, setShowMockup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterProduct) params.product = filterProduct;
      if (filterPlatform) params.platform = filterPlatform;
      if (filterStatus) params.status = filterStatus;
      const data = await fetchAdCreatives(params);
      setCreatives(data.creatives || []);
      setStats(data.stats || null);
    } catch {
      setCreatives([]);
    }
    setLoading(false);
  }, [filterProduct, filterPlatform, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    await approveItem(id);
    load();
  };

  const handleReject = async (id) => {
    await rejectItem(id);
    load();
  };

  const handleMarkUsed = async (id) => {
    await markCreativeUsed(id);
    load();
  };

  // Group by product, then platform
  const grouped = {};
  for (const c of creatives) {
    const pid = c.product || 'unknown';
    if (!grouped[pid]) grouped[pid] = {};
    const plat = c.platform || 'unknown';
    if (!grouped[pid][plat]) grouped[pid][plat] = [];
    grouped[pid][plat].push(c);
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Ad Creatives</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Generated ad copy, image prompts, and video concepts across all platforms
          </p>
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: 16 }}>
            <StatBadge label="Total" value={stats.total} color="#333" />
            <StatBadge label="Pending" value={stats.byStatus?.pending || 0} color="#d97706" />
            <StatBadge label="Approved" value={stats.byStatus?.approved || 0} color="#059669" />
            {stats.complianceFlags > 0 && (
              <StatBadge label="Flags" value={stats.complianceFlags} color="#dc2626" />
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}>
          <option value="">All Products</option>
          {Object.entries(PRODUCTS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
        </select>

        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}>
          <option value="">All Platforms</option>
          {Object.entries(PLATFORMS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['grid', 'list'].map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: viewMode === m ? 'var(--accent)' : 'transparent',
              color: viewMode === m ? '#fff' : 'var(--text)',
            }}>
              {m === 'grid' ? 'Grid' : 'List'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading creatives...</div>
      ) : creatives.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          No ad creatives found. The agent runs weekly on Wednesdays at 9:30 AM ET.
        </div>
      ) : (
        Object.entries(grouped).map(([productId, platforms]) => (
          <div key={productId} style={{ marginBottom: 32 }}>
            <h3 style={{
              fontSize: 16, fontWeight: 600, marginBottom: 16,
              color: PRODUCTS[productId]?.color || '#333',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: PRODUCTS[productId]?.color, display: 'inline-block',
              }} />
              {PRODUCTS[productId]?.label || productId}
            </h3>

            {Object.entries(platforms).map(([platformId, platCreatives]) => (
              <div key={platformId} style={{ marginBottom: 20 }}>
                <h4 style={{
                  fontSize: 13, fontWeight: 600, marginBottom: 10,
                  color: PLATFORMS[platformId]?.color || '#666',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {PLATFORMS[platformId]?.label || platformId} ({platCreatives.length})
                </h4>

                <div style={{
                  display: viewMode === 'grid' ? 'grid' : 'flex',
                  gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : undefined,
                  flexDirection: viewMode === 'list' ? 'column' : undefined,
                  gap: 12,
                }}>
                  {platCreatives.map(creative => (
                    <CreativeCard
                      key={creative.id}
                      creative={creative}
                      expanded={expandedId === creative.id}
                      onToggle={() => setExpandedId(expandedId === creative.id ? null : creative.id)}
                      onApprove={() => handleApprove(creative.id)}
                      onReject={() => handleReject(creative.id)}
                      onMarkUsed={() => handleMarkUsed(creative.id)}
                      onShowMockup={() => setShowMockup(creative)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Mockup Modal */}
      {showMockup && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowMockup(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, maxWidth: 600, width: '90%',
            maxHeight: '80vh', overflow: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                Ad Preview — {PLATFORMS[showMockup.platform]?.label}
              </h3>
              <button onClick={() => setShowMockup(null)} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666',
              }}>&times;</button>
            </div>
            {showMockup.mockupHtml ? (
              <div dangerouslySetInnerHTML={{ __html: showMockup.mockupHtml }} />
            ) : (
              <div style={{ padding: 20, color: 'var(--text-muted)' }}>No mockup preview available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreativeCard({ creative, expanded, onToggle, onApprove, onReject, onMarkUsed, onShowMockup }) {
  const angle = ANGLE_LABELS[creative.angle] || { label: creative.angle, color: '#666', bg: '#f3f4f6' };
  const statusInfo = STATUS_BADGE[creative.status] || { label: creative.status, color: '#666', bg: '#f3f4f6' };
  const copy = creative.copy || {};
  const compliance = creative.compliance || { pass: true, issues: [] };

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8, padding: 14,
      background: 'var(--card-bg)', transition: 'box-shadow 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
          color: angle.color, background: angle.bg,
        }}>{angle.label}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
          color: statusInfo.color, background: statusInfo.bg,
        }}>{statusInfo.label}</span>
        {!compliance.pass && (
          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#dc2626', background: '#fef2f2' }}>
            {compliance.issues?.length || 0} flag{compliance.issues?.length !== 1 ? 's' : ''}
          </span>
        )}
        {creative.used && (
          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#059669', background: '#ecfdf5' }}>
            Placed
          </span>
        )}
      </div>

      {/* Copy preview */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {copy.headline || copy.title || copy.headline1 || copy.longHeadline || copy.introText || 'Creative'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        {copy.primaryText || copy.description || copy.description1 || ''}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onShowMockup} style={{
          padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)',
        }}>Preview</button>
        <button onClick={onToggle} style={{
          padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)',
        }}>{expanded ? 'Collapse' : 'Details'}</button>
        {creative.status === 'pending' && (
          <>
            <button onClick={onApprove} style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              border: '1px solid #059669', color: '#059669', background: 'transparent',
            }}>Approve</button>
            <button onClick={onReject} style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              border: '1px solid #dc2626', color: '#dc2626', background: 'transparent',
            }}>Reject</button>
          </>
        )}
        {(creative.status === 'approved' || creative.status === 'auto_approved') && !creative.used && (
          <button onClick={onMarkUsed} style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
            border: '1px solid #2563eb', color: '#2563eb', background: 'transparent',
          }}>Mark as Placed</button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {/* All copy fields */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Ad Copy</div>
            {Object.entries(copy).map(([field, text]) => (
              <div key={field} style={{ fontSize: 12, marginBottom: 3 }}>
                <span style={{ fontWeight: 600 }}>{field}:</span> {text}
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}> ({text.length} chars)</span>
              </div>
            ))}
          </div>

          {/* Image prompts */}
          {creative.imagePrompts?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Image Prompts</div>
              {creative.imagePrompts.map((ip, i) => (
                <div key={i} style={{
                  fontSize: 11, padding: 8, background: '#f9fafb', borderRadius: 4, marginBottom: 4,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{ip.spec} ({ip.width}x{ip.height})</div>
                  <div style={{ color: 'var(--text-muted)' }}>{ip.prompt}</div>
                </div>
              ))}
            </div>
          )}

          {/* Video concept */}
          {creative.videoConcept && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Video Concept</div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Hook:</span> {creative.videoConcept.hook}
              </div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Script:</span> {creative.videoConcept.script}
              </div>
              {creative.videoConcept.storyboard?.map((scene, i) => (
                <div key={i} style={{ fontSize: 11, padding: 6, background: '#f9fafb', borderRadius: 4, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>[{scene.seconds}]</span> {scene.scene}
                  {scene.text_overlay && <span style={{ color: '#7c3aed' }}> — "{scene.text_overlay}"</span>}
                </div>
              ))}
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>End CTA:</span> {creative.videoConcept.endCardCta}
              </div>
            </div>
          )}

          {/* Compliance */}
          {compliance.issues?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Compliance Issues</div>
              {compliance.issues.map((issue, i) => (
                <div key={i} style={{
                  fontSize: 11, padding: 6, background: '#fef2f2', borderRadius: 4, marginBottom: 3,
                  color: issue.severity === 'error' ? '#dc2626' : '#d97706',
                }}>
                  [{issue.severity}] {issue.message}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Created: {new Date(creative.created_at).toLocaleString()}
            {creative.targetUrl && <span> &bull; <a href={creative.targetUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Target URL</a></span>}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
