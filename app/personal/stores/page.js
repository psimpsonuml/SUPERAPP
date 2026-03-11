'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchStores, connectStore, updateStore, disconnectStore,
  fetchStoreSales, fetchStoreListings, fetchStoreDashboard, fetchRecentSales,
  fetchTrackedStores, addTrackedStore, removeTrackedStore, fetchTrackedStoreChanges,
  fetchWishlist, addWishlistItem, updateWishlistItem, removeWishlistItem, fetchWishlistPriceHistory
} from '../../../lib/api';

// ── Platform Config ─────────────────────────────────────────
const PLATFORMS = {
  Shopify:   { color: '#96bf48', icon: '🛒' },
  Etsy:      { color: '#f1641e', icon: '🧶' },
  eBay:      { color: '#e53238', icon: '📦' },
  Poshmark:  { color: '#7f0353', icon: '👗' },
  Amazon:    { color: '#ff9900', icon: '📫' },
  Mercari:   { color: '#4dc4ff', icon: '🏷️' },
};

const PLATFORM_LIST = Object.keys(PLATFORMS);

// ── Styles ──────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#1a1a2e', color: '#e0e0e0', padding: '24px 32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', color: '#fff' },
  modeToggle: { display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #333' },
  modeBtn: (active) => ({ padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? '#6c5ce7' : '#16213e', color: active ? '#fff' : '#888', transition: 'all 0.2s' }),
  tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #2a2a4a', paddingBottom: 0 },
  tab: (active) => ({ padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none', color: active ? '#6c5ce7' : '#888', borderBottom: active ? '2px solid #6c5ce7' : '2px solid transparent', transition: 'all 0.2s' }),
  card: { background: '#16213e', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid #2a2a4a' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 },
  badge: (color) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: color + '22', color: color, marginRight: 6 }),
  btn: (bg = '#6c5ce7') => ({ padding: '8px 16px', borderRadius: 8, border: 'none', background: bg, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }),
  btnSm: (bg = '#6c5ce7') => ({ padding: '5px 12px', borderRadius: 6, border: 'none', background: bg, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }),
  btnDanger: { padding: '5px 12px', borderRadius: 6, border: 'none', background: '#e53238', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #333', background: '#0f0f23', color: '#e0e0e0', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  select: { padding: '10px 14px', borderRadius: 8, border: '1px solid #333', background: '#0f0f23', color: '#e0e0e0', fontSize: 13, outline: 'none' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#16213e', borderRadius: 16, padding: 28, width: 440, maxWidth: '90vw', border: '1px solid #2a2a4a' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #2a2a4a', color: '#888', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' },
  td: { padding: '10px 12px', borderBottom: '1px solid #1a1a2e' },
  statCard: (color = '#6c5ce7') => ({ background: '#16213e', borderRadius: 12, padding: 20, border: '1px solid #2a2a4a', borderLeft: `4px solid ${color}` }),
  muted: { color: '#666', fontSize: 12 },
  label: { fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' },
};

function fmtCurrency(v) {
  return '$' + (parseFloat(v) || 0).toFixed(2);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function platformBadge(platform) {
  const p = PLATFORMS[platform] || { color: '#888', icon: '🏪' };
  return <span style={S.badge(p.color)}>{p.icon} {platform}</span>;
}

// ── Mini SVG Price Chart ────────────────────────────────────
function PriceChart({ history, threshold, width = 160, height = 48 }) {
  if (!history || history.length < 2) {
    return <div style={{ ...S.muted, width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No data</div>;
  }
  const prices = history.map(h => parseFloat(h.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * innerW;
    const y = pad + innerH - ((p - min) / range) * innerH;
    return `${x},${y}`;
  }).join(' ');

  const thresholdY = threshold ? pad + innerH - ((parseFloat(threshold) - min) / range) * innerH : null;
  const lastPrice = prices[prices.length - 1];
  const firstPrice = prices[0];
  const strokeColor = lastPrice <= firstPrice ? '#00b894' : '#e53238';

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {thresholdY !== null && thresholdY >= 0 && thresholdY <= height && (
        <line x1={pad} y1={thresholdY} x2={width - pad} y2={thresholdY} stroke="#f1641e" strokeWidth="1" strokeDasharray="3,3" />
      )}
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pad + innerW} cy={pad + innerH - ((lastPrice - min) / range) * innerH} r="3" fill={strokeColor} />
    </svg>
  );
}

// ── Connect Store Modal ─────────────────────────────────────
function ConnectModal({ onClose, onConnect }) {
  const [platform, setPlatform] = useState('Shopify');
  const [storeName, setStoreName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!storeName.trim()) return;
    setLoading(true);
    try {
      await onConnect({ platform, store_name: storeName, store_url: storeUrl, api_key: apiKey });
      onClose();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Connect Store</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Platform</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PLATFORM_LIST.map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: platform === p ? `2px solid ${PLATFORMS[p].color}` : '2px solid #333',
                  background: platform === p ? PLATFORMS[p].color + '22' : '#0f0f23', color: platform === p ? PLATFORMS[p].color : '#888',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >{PLATFORMS[p].icon} {p}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Store Name</label>
          <input style={S.input} placeholder="My Awesome Store" value={storeName} onChange={e => setStoreName(e.target.value)} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Store URL</label>
          <input style={S.input} placeholder="https://mystore.myshopify.com" value={storeUrl} onChange={e => setStoreUrl(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>API Key / Access Token</label>
          <input style={S.input} type="password" placeholder="shpat_xxxxx..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button style={S.btn('#333')} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btn(PLATFORMS[platform]?.color || '#6c5ce7'), opacity: loading ? 0.6 : 1 }} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Seller Dashboard Tab ────────────────────────────────────
function SellerDashboard({ dashboard, stores }) {
  if (!dashboard) return <div style={S.muted}>Loading dashboard...</div>;

  const { revenue, activeListings, ordersToFulfill, bestSellers, recentSales, lowInventory } = dashboard;

  return (
    <div>
      {/* Revenue Cards */}
      <div style={{ ...S.grid4, marginBottom: 24 }}>
        <div style={S.statCard('#00b894')}>
          <div style={S.label}>Today</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#00b894' }}>{fmtCurrency(revenue?.today)}</div>
        </div>
        <div style={S.statCard('#6c5ce7')}>
          <div style={S.label}>This Week</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#6c5ce7' }}>{fmtCurrency(revenue?.week)}</div>
        </div>
        <div style={S.statCard('#f1641e')}>
          <div style={S.label}>This Month</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f1641e' }}>{fmtCurrency(revenue?.month)}</div>
        </div>
        <div style={S.statCard('#4dc4ff')}>
          <div style={S.label}>Active Listings</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4dc4ff' }}>{activeListings || 0}</div>
        </div>
      </div>

      {/* Per-Store Revenue */}
      {stores && stores.length > 0 && revenue?.byStore && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Revenue by Store</h4>
          <div style={S.grid3}>
            {stores.map(store => {
              const sr = revenue.byStore[store.id] || { today: 0, week: 0, month: 0 };
              const pColor = PLATFORMS[store.platform]?.color || '#888';
              return (
                <div key={store.id} style={{ background: '#0f0f23', borderRadius: 10, padding: 14, border: `1px solid ${pColor}33` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    {platformBadge(store.platform)}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{store.store_name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <div><span style={{ color: '#666' }}>D: </span><span style={{ color: '#00b894' }}>{fmtCurrency(sr.today)}</span></div>
                    <div><span style={{ color: '#666' }}>W: </span><span style={{ color: '#6c5ce7' }}>{fmtCurrency(sr.week)}</span></div>
                    <div><span style={{ color: '#666' }}>M: </span><span style={{ color: '#f1641e' }}>{fmtCurrency(sr.month)}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent Sales Feed */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Recent Sales</h4>
            {ordersToFulfill > 0 && <span style={S.badge('#f1641e')}>{ordersToFulfill} to fulfill</span>}
          </div>
          {(recentSales || []).length === 0 ? (
            <div style={S.muted}>No recent sales</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentSales.slice(0, 8).map((sale, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a2e' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e0' }}>{sale.item_name}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>{sale.buyer_name || 'Buyer'} &middot; {fmtDate(sale.order_date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#00b894' }}>{fmtCurrency(sale.price)}</div>
                    {platformBadge(sale.platform)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Best Sellers + Inventory Alerts */}
        <div>
          <div style={S.card}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Best Sellers</h4>
            {(bestSellers || []).length === 0 ? (
              <div style={S.muted}>No data yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bestSellers.slice(0, 5).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6c5ce7', width: 18 }}>#{i + 1}</span>
                      <span style={{ fontSize: 13 }}>{item.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>{item.count} sold &middot; {fmtCurrency(item.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lowInventory && lowInventory.length > 0 && (
            <div style={{ ...S.card, borderColor: '#e53238' }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#e53238', marginBottom: 10 }}>Low Inventory Alert</h4>
              {lowInventory.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                  <span>{item.title}</span>
                  <span style={S.badge('#e53238')}>{item.quantity} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sales Tab ───────────────────────────────────────────────
function SalesTab({ stores }) {
  const [sales, setSales] = useState([]);
  const [filterStore, setFilterStore] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStore) params.store_id = filterStore;
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo;
      const res = await fetchRecentSales(params);
      setSales(res.sales || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterStore, filterFrom, filterTo]);

  useEffect(() => { loadSales(); }, [loadSales]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={S.select} value={filterStore} onChange={e => setFilterStore(e.target.value)}>
          <option value="">All Stores</option>
          {(stores || []).map(s => <option key={s.id} value={s.id}>{s.store_name}</option>)}
        </select>
        <input type="date" style={{ ...S.input, width: 160 }} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        <span style={{ color: '#666' }}>to</span>
        <input type="date" style={{ ...S.input, width: 160 }} value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        <button style={S.btnSm()} onClick={loadSales}>Filter</button>
      </div>

      <div style={S.card}>
        {loading ? <div style={S.muted}>Loading...</div> : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>Item</th>
                <th style={S.th}>Platform</th>
                <th style={S.th}>Buyer</th>
                <th style={S.th}>Price</th>
                <th style={S.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={6} style={{ ...S.td, color: '#666', textAlign: 'center' }}>No sales found</td></tr>
              ) : sales.map((sale, i) => (
                <tr key={i}>
                  <td style={S.td}>{fmtDate(sale.order_date)}</td>
                  <td style={S.td}>{sale.item_name}</td>
                  <td style={S.td}>{platformBadge(sale.platform)}</td>
                  <td style={S.td}>{sale.buyer_name || '—'}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: '#00b894' }}>{fmtCurrency(sale.price)}</td>
                  <td style={S.td}>
                    <span style={S.badge(sale.status === 'completed' ? '#00b894' : sale.status === 'pending' ? '#f1641e' : '#888')}>
                      {sale.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Listings Tab ────────────────────────────────────────────
function ListingsTab({ stores }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const all = [];
        for (const store of (stores || [])) {
          const res = await fetchStoreListings(store.id);
          (res.listings || []).forEach(l => all.push({ ...l, store_name: store.store_name, platform: store.platform }));
        }
        setListings(all);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [stores]);

  if (loading) return <div style={S.muted}>Loading listings...</div>;

  return (
    <div style={S.grid3}>
      {listings.length === 0 ? (
        <div style={{ ...S.card, gridColumn: '1 / -1', textAlign: 'center', color: '#666' }}>No active listings</div>
      ) : listings.map((listing, i) => {
        const pColor = PLATFORMS[listing.platform]?.color || '#888';
        return (
          <div key={i} style={{ ...S.card, borderLeft: `3px solid ${pColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              {platformBadge(listing.platform)}
              <span style={S.badge(listing.status === 'active' ? '#00b894' : '#888')}>{listing.status}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{listing.title}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#00b894' }}>{fmtCurrency(listing.price)}</span>
              <span style={{ fontSize: 12, color: '#888' }}>Qty: {listing.quantity}</span>
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>{listing.store_name}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Stores Tab (Connected Stores) ───────────────────────────
function StoresTab({ stores, onDisconnect, onShowConnect }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#888' }}>{stores.length} connected store{stores.length !== 1 ? 's' : ''}</div>
        <button style={S.btn()} onClick={onShowConnect}>+ Connect Store</button>
      </div>

      <div style={S.grid2}>
        {stores.length === 0 ? (
          <div style={{ ...S.card, gridColumn: '1 / -1', textAlign: 'center' }}>
            <div style={{ color: '#666', marginBottom: 12 }}>No stores connected yet</div>
            <button style={S.btn()} onClick={onShowConnect}>Connect Your First Store</button>
          </div>
        ) : stores.map(store => {
          const pColor = PLATFORMS[store.platform]?.color || '#888';
          return (
            <div key={store.id} style={{ ...S.card, borderLeft: `4px solid ${pColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  {platformBadge(store.platform)}
                  <span style={S.badge(store.status === 'active' ? '#00b894' : '#e53238')}>{store.status}</span>
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{store.store_name}</div>
              {store.store_url && (
                <div style={{ fontSize: 12, color: '#4dc4ff', marginBottom: 12, wordBreak: 'break-all' }}>{store.store_url}</div>
              )}
              <div style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>Connected {fmtDate(store.created_at)}</div>
              <button style={S.btnDanger} onClick={() => onDisconnect(store.id)}>Disconnect</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tracked Stores Tab ──────────────────────────────────────
function TrackedStoresTab({ tracked, onRemove, onAdd }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('Shopify');
  const [adding, setAdding] = useState(false);
  const [changes, setChanges] = useState({});

  const handleAdd = async () => {
    if (!url.trim()) return;
    setAdding(true);
    try {
      await onAdd({ platform, store_url: url, store_name: name });
      setUrl('');
      setName('');
    } catch (e) { console.error(e); }
    setAdding(false);
  };

  const loadChanges = async (id) => {
    try {
      const res = await fetchTrackedStoreChanges(id);
      setChanges(prev => ({ ...prev, [id]: res.changes || [] }));
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      {/* Add Store Form */}
      <div style={{ ...S.card, marginBottom: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Track a Store</h4>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 0 }}>
            <label style={S.label}>Platform</label>
            <select style={S.select} value={platform} onChange={e => setPlatform(e.target.value)}>
              {PLATFORM_LIST.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={S.label}>Store URL</label>
            <input style={S.input} placeholder="Paste store URL..." value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div style={{ flex: 0, minWidth: 140 }}>
            <label style={S.label}>Name (optional)</label>
            <input style={S.input} placeholder="Store name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <button style={{ ...S.btn(), opacity: adding ? 0.6 : 1 }} onClick={handleAdd} disabled={adding}>
            {adding ? 'Adding...' : 'Track'}
          </button>
        </div>
      </div>

      {/* Tracked Stores List */}
      <div style={S.grid2}>
        {(tracked || []).length === 0 ? (
          <div style={{ ...S.card, gridColumn: '1 / -1', textAlign: 'center', color: '#666' }}>No tracked stores yet. Paste a store URL above to start tracking.</div>
        ) : tracked.map(store => {
          const pColor = PLATFORMS[store.platform]?.color || '#888';
          const storeChanges = changes[store.id];
          return (
            <div key={store.id} style={{ ...S.card, borderLeft: `4px solid ${pColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                {platformBadge(store.platform)}
                {storeChanges && storeChanges.length > 0 && (
                  <span style={S.badge('#00b894')}>{storeChanges.length} new</span>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{store.store_name || 'Unnamed Store'}</div>
              <div style={{ fontSize: 12, color: '#4dc4ff', marginBottom: 8, wordBreak: 'break-all' }}>{store.store_url}</div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>
                Last checked: {store.last_checked ? fmtDateTime(store.last_checked) : 'Never'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.btnSm('#4dc4ff')} onClick={() => loadChanges(store.id)}>Check Changes</button>
                <button style={S.btnDanger} onClick={() => onRemove(store.id)}>Untrack</button>
              </div>

              {storeChanges && storeChanges.length > 0 && (
                <div style={{ marginTop: 12, borderTop: '1px solid #2a2a4a', paddingTop: 10 }}>
                  {storeChanges.slice(0, 5).map((c, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{c.title}</span>
                      <span style={{ color: '#00b894' }}>{fmtCurrency(c.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Wishlist Tab ────────────────────────────────────────────
function WishlistTab({ wishlist, onAdd, onUpdate, onRemove }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newThreshold, setNewThreshold] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editThreshold, setEditThreshold] = useState('');
  const [priceHistories, setPriceHistories] = useState({});

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await onAdd({
      title: newTitle,
      listing_url: newUrl,
      current_price: newPrice ? parseFloat(newPrice) : null,
      alert_threshold: newThreshold ? parseFloat(newThreshold) : null
    });
    setNewTitle('');
    setNewUrl('');
    setNewPrice('');
    setNewThreshold('');
    setShowAdd(false);
  };

  const handleUpdateThreshold = async (id) => {
    await onUpdate(id, { alert_threshold: parseFloat(editThreshold) || null });
    setEditingId(null);
  };

  const loadHistory = async (id) => {
    try {
      const res = await fetchWishlistPriceHistory(id);
      setPriceHistories(prev => ({ ...prev, [id]: res.history || [] }));
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#888' }}>{(wishlist || []).length} item{(wishlist || []).length !== 1 ? 's' : ''} on wishlist</div>
        <button style={S.btn()} onClick={() => setShowAdd(!showAdd)}>+ Add Item</button>
      </div>

      {showAdd && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={S.label}>Title</label>
              <input style={S.input} placeholder="Item title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Listing URL</label>
              <input style={S.input} placeholder="https://..." value={newUrl} onChange={e => setNewUrl(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Current Price</label>
              <input style={S.input} type="number" step="0.01" placeholder="0.00" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
            </div>
            <div>
              <label style={S.label}>Alert Threshold</label>
              <input style={S.input} type="number" step="0.01" placeholder="Alert when below..." value={newThreshold} onChange={e => setNewThreshold(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={S.btn('#333')} onClick={() => setShowAdd(false)}>Cancel</button>
            <button style={S.btn()} onClick={handleAdd}>Add to Wishlist</button>
          </div>
        </div>
      )}

      <div style={S.grid2}>
        {(wishlist || []).length === 0 ? (
          <div style={{ ...S.card, gridColumn: '1 / -1', textAlign: 'center', color: '#666' }}>Your wishlist is empty</div>
        ) : wishlist.map(item => {
          const hasDrop = item.alert_threshold && item.current_price && parseFloat(item.current_price) <= parseFloat(item.alert_threshold);
          const history = priceHistories[item.id] || item.price_history_json || [];

          return (
            <div key={item.id} style={{ ...S.card, borderLeft: hasDrop ? '4px solid #00b894' : '4px solid #2a2a4a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', flex: 1, marginRight: 8 }}>{item.title}</div>
                {hasDrop && <span style={S.badge('#00b894')}>PRICE DROP</span>}
              </div>

              {item.listing_url && (
                <div style={{ fontSize: 11, color: '#4dc4ff', marginBottom: 8, wordBreak: 'break-all' }}>{item.listing_url}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 22, fontWeight: 700, color: hasDrop ? '#00b894' : '#e0e0e0' }}>{fmtCurrency(item.current_price)}</span>
                </div>
                {item.alert_threshold && (
                  <div style={{ fontSize: 11, color: '#f1641e' }}>Alert below {fmtCurrency(item.alert_threshold)}</div>
                )}
              </div>

              {/* Price History Mini Chart */}
              <div style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => loadHistory(item.id)}>
                <PriceChart history={history} threshold={item.alert_threshold} width={240} height={48} />
              </div>

              {editingId === item.id ? (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input style={{ ...S.input, width: 120 }} type="number" step="0.01" placeholder="Threshold" value={editThreshold} onChange={e => setEditThreshold(e.target.value)} />
                  <button style={S.btnSm()} onClick={() => handleUpdateThreshold(item.id)}>Save</button>
                  <button style={S.btnSm('#333')} onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={S.btnSm('#333')} onClick={() => { setEditingId(item.id); setEditThreshold(item.alert_threshold || ''); }}>Set Alert</button>
                  <button style={S.btnDanger} onClick={() => onRemove(item.id)}>Remove</button>
                </div>
              )}

              {item.tracked_stores && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>From: {item.tracked_stores.store_name || item.tracked_stores.store_url}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function StoresPage() {
  const [mode, setMode] = useState('seller');
  const [sellerTab, setSellerTab] = useState('dashboard');
  const [trackerTab, setTrackerTab] = useState('tracked');
  const [stores, setStores] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [tracked, setTracked] = useState([]);
  const [wishlist, setWishlistData] = useState([]);
  const [showConnect, setShowConnect] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStores = useCallback(async () => {
    try {
      const res = await fetchStores();
      setStores(res.stores || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetchStoreDashboard();
      setDashboard(res);
    } catch (e) { console.error(e); }
  }, []);

  const loadTracked = useCallback(async () => {
    try {
      const res = await fetchTrackedStores();
      setTracked(res.tracked || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadWishlist = useCallback(async () => {
    try {
      const res = await fetchWishlist();
      setWishlistData(res.wishlist || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStores(), loadDashboard(), loadTracked(), loadWishlist()]);
      setLoading(false);
    })();
  }, [loadStores, loadDashboard, loadTracked, loadWishlist]);

  const handleConnect = async (data) => {
    await connectStore(data);
    await loadStores();
    await loadDashboard();
  };

  const handleDisconnect = async (id) => {
    if (!confirm('Disconnect this store? Sales data will be preserved.')) return;
    await disconnectStore(id);
    await loadStores();
    await loadDashboard();
  };

  const handleAddTracked = async (data) => {
    await addTrackedStore(data);
    await loadTracked();
  };

  const handleRemoveTracked = async (id) => {
    await removeTrackedStore(id);
    await loadTracked();
  };

  const handleAddWishlist = async (data) => {
    await addWishlistItem(data);
    await loadWishlist();
  };

  const handleUpdateWishlist = async (id, data) => {
    await updateWishlistItem(id, data);
    await loadWishlist();
  };

  const handleRemoveWishlist = async (id) => {
    await removeWishlistItem(id);
    await loadWishlist();
  };

  if (loading) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>Loading stores...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>Stores</h1>
        <div style={S.modeToggle}>
          <button style={S.modeBtn(mode === 'seller')} onClick={() => setMode('seller')}>My Stores</button>
          <button style={S.modeBtn(mode === 'tracker')} onClick={() => setMode('tracker')}>Store Tracker</button>
        </div>
      </div>

      {/* Seller Mode */}
      {mode === 'seller' && (
        <>
          <div style={S.tabs}>
            {['dashboard', 'sales', 'listings', 'stores'].map(t => (
              <button key={t} style={S.tab(sellerTab === t)} onClick={() => setSellerTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {sellerTab === 'dashboard' && <SellerDashboard dashboard={dashboard} stores={stores} />}
          {sellerTab === 'sales' && <SalesTab stores={stores} />}
          {sellerTab === 'listings' && <ListingsTab stores={stores} />}
          {sellerTab === 'stores' && <StoresTab stores={stores} onDisconnect={handleDisconnect} onShowConnect={() => setShowConnect(true)} />}
        </>
      )}

      {/* Tracker Mode */}
      {mode === 'tracker' && (
        <>
          <div style={S.tabs}>
            {['tracked', 'wishlist'].map(t => (
              <button key={t} style={S.tab(trackerTab === t)} onClick={() => setTrackerTab(t)}>
                {t === 'tracked' ? 'Tracked Stores' : 'Wishlist'}
              </button>
            ))}
          </div>

          {trackerTab === 'tracked' && <TrackedStoresTab tracked={tracked} onRemove={handleRemoveTracked} onAdd={handleAddTracked} />}
          {trackerTab === 'wishlist' && <WishlistTab wishlist={wishlist} onAdd={handleAddWishlist} onUpdate={handleUpdateWishlist} onRemove={handleRemoveWishlist} />}
        </>
      )}

      {/* Connect Store Modal */}
      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} onConnect={handleConnect} />}
    </div>
  );
}
