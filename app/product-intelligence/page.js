'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchProductIntelligence,
  acceptRecommendation,
  rejectRecommendation,
  snoozeRecommendation,
} from '../../lib/api';

const PRODUCTS = {
  chronostates: { label: 'ChronoStates', color: '#7c3aed' },
  payroll_beacon: { label: 'Payroll Beacon', color: '#2563eb' },
  budgeting_beacon: { label: 'Budgeting Beacon', color: '#059669' },
};

const REC_TYPES = {
  add: { label: 'Feature Addition', color: '#059669', bg: '#ecfdf5' },
  change: { label: 'Feature Change', color: '#d97706', bg: '#fffbeb' },
  remove: { label: 'Feature Removal', color: '#dc2626', bg: '#fef2f2' },
  pricing: { label: 'Pricing', color: '#7c3aed', bg: '#f5f3ff' },
  ux: { label: 'UX', color: '#2563eb', bg: '#eff6ff' },
};

const IMPACT_COLORS = { high: '#dc2626', medium: '#d97706', low: '#6b7280' };
const EFFORT_LABELS = { small: '<1 week', medium: '1-4 weeks', large: '1+ months' };

const TABS = [
  { id: 'today', label: "Today's Recommendations" },
  { id: 'backlog', label: 'Backlog' },
  { id: 'history', label: 'History' },
];

export default function ProductIntelligencePage() {
  const [tab, setTab] = useState('today');
  const [recs, setRecs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('impact');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { tab };
      if (filterProduct) params.product = filterProduct;
      if (filterType) params.rec_type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (tab === 'history') params.days = 90;

      const data = await fetchProductIntelligence(params);
      setRecs(data.recommendations || []);
      setStats(data.stats || null);
    } catch {
      setRecs([]);
    }
    setLoading(false);
  }, [tab, filterProduct, filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id, action) => {
    try {
      if (action === 'accept') await acceptRecommendation(id);
      else if (action === 'reject') await rejectRecommendation(id);
      else if (action === 'snooze') await snoozeRecommendation(id);
      load();
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
    }
  };

  const sorted = [...recs].sort((a, b) => {
    if (sortBy === 'impact') {
      const order = { high: 3, medium: 2, low: 1 };
      return (order[b.impact_estimate] || 0) - (order[a.impact_estimate] || 0);
    }
    if (sortBy === 'effort') {
      const order = { small: 1, medium: 2, large: 3 };
      return (order[a.effort_estimate] || 0) - (order[b.effort_estimate] || 0);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Group by product for today tab
  const grouped = {};
  if (tab === 'today') {
    for (const rec of sorted) {
      if (!grouped[rec.product]) grouped[rec.product] = [];
      grouped[rec.product].push(rec);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Product Intelligence</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Feature, pricing, and UX recommendations from market signals
          </p>
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: 16 }}>
            <StatBadge label="New" value={stats.byStatus?.new || 0} color="#059669" />
            <StatBadge label="Backlog" value={stats.byStatus?.accepted || 0} color="#2563eb" />
            <StatBadge label="Snoozed" value={stats.snoozedCount || 0} color="#d97706" />
            {stats.snoozedExpiringThisWeek > 0 && (
              <StatBadge label="Expiring Soon" value={stats.snoozedExpiringThisWeek} color="#dc2626" />
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setExpandedId(null); }}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
            {t.id === 'today' && stats?.byStatus?.new > 0 && (
              <span style={{
                marginLeft: 6, background: 'var(--accent)', color: '#fff',
                borderRadius: 10, padding: '1px 7px', fontSize: 11,
              }}>
                {stats.byStatus.new}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}>
          <option value="">All Products</option>
          {Object.entries(PRODUCTS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
        </select>

        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}>
          <option value="">All Types</option>
          {Object.entries(REC_TYPES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
        </select>

        {tab === 'history' && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}>
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="snoozed">Snoozed</option>
          </select>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sort:</span>
          {['impact', 'effort', 'date'].map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{
              padding: '4px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: sortBy === s ? 'var(--accent)' : 'transparent',
              color: sortBy === s ? '#fff' : 'var(--text)',
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading recommendations...</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          {tab === 'today' ? 'No new recommendations today. Check back after the 9 AM analysis.' :
           tab === 'backlog' ? 'No accepted items in the backlog yet.' :
           'No recommendations found for the selected filters.'}
        </div>
      ) : tab === 'today' ? (
        // Grouped by product
        Object.entries(grouped).map(([productId, productRecs]) => (
          <div key={productId} style={{ marginBottom: 32 }}>
            <h3 style={{
              fontSize: 16, fontWeight: 600, marginBottom: 12,
              color: PRODUCTS[productId]?.color || '#333',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: PRODUCTS[productId]?.color, display: 'inline-block',
              }} />
              {PRODUCTS[productId]?.label || productId}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                ({productRecs.length} recommendation{productRecs.length !== 1 ? 's' : ''})
              </span>
            </h3>
            {productRecs.map(rec => (
              <RecCard
                key={rec.id}
                rec={rec}
                expanded={expandedId === rec.id}
                onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                onAction={handleAction}
                showActions={true}
              />
            ))}
          </div>
        ))
      ) : (
        // Flat list for backlog and history
        sorted.map(rec => (
          <RecCard
            key={rec.id}
            rec={rec}
            expanded={expandedId === rec.id}
            onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
            onAction={handleAction}
            showActions={tab !== 'history' || rec.status === 'new'}
          />
        ))
      )}
    </div>
  );
}

function RecCard({ rec, expanded, onToggle, onAction, showActions }) {
  const typeInfo = REC_TYPES[rec.rec_type] || { label: rec.rec_type, color: '#6b7280', bg: '#f3f4f6' };

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8, padding: 16,
      marginBottom: 10, background: 'var(--card-bg)',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
              color: typeInfo.color, background: typeInfo.bg,
            }}>
              {typeInfo.label}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11,
              color: PRODUCTS[rec.product]?.color || '#333',
              background: '#f3f4f6',
            }}>
              {PRODUCTS[rec.product]?.label || rec.product}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: IMPACT_COLORS[rec.impact_estimate] || '#6b7280',
            }}>
              {rec.impact_estimate?.toUpperCase()} impact
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {EFFORT_LABELS[rec.effort_estimate] || rec.effort_estimate}
            </span>
            {rec.status !== 'new' && (
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11,
                background: rec.status === 'accepted' ? '#ecfdf5' : rec.status === 'rejected' ? '#fef2f2' : rec.status === 'snoozed' ? '#fffbeb' : '#f3f4f6',
                color: rec.status === 'accepted' ? '#059669' : rec.status === 'rejected' ? '#dc2626' : rec.status === 'snoozed' ? '#d97706' : '#6b7280',
              }}>
                {rec.status}
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{rec.title}</div>
          {rec.description && !expanded && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {rec.description.slice(0, 120)}{rec.description.length > 120 ? '...' : ''}
            </div>
          )}
        </div>

        {showActions && rec.status === 'new' && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <ActionBtn label="Accept" color="#059669" onClick={() => onAction(rec.id, 'accept')} />
            <ActionBtn label="Snooze" color="#d97706" onClick={() => onAction(rec.id, 'snooze')} />
            <ActionBtn label="Reject" color="#dc2626" onClick={() => onAction(rec.id, 'reject')} />
          </div>
        )}

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0, marginTop: 4 }}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {rec.description && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 13 }}>{rec.description}</div>
            </div>
          )}
          {rec.rationale && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Rationale</div>
              <div style={{ fontSize: 13 }}>{rec.rationale}</div>
            </div>
          )}
          {rec.source_signals && rec.source_signals.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Source Signals</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {(Array.isArray(rec.source_signals) ? rec.source_signals : []).map((s, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Created: {new Date(rec.created_at).toLocaleDateString()}</span>
            {rec.snoozed_until && <span>Snoozed until: {new Date(rec.snoozed_until).toLocaleDateString()}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 500,
      border: `1px solid ${color}`, color, background: 'transparent',
      cursor: 'pointer',
    }}>
      {label}
    </button>
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
