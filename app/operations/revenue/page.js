'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchRevenue,
  fetchRevenueChart,
  fetchRevenueSubscriptions,
  fetchRevenueNew,
  fetchRevenueChurn,
  fetchRevenueFailed,
  fetchRevenueBySource,
  fetchRevenueForecast,
  refreshRevenue,
} from '../../../lib/api';

// ── Styles ──────────────────────────────────────────────────
const styles = {
  page: {
    padding: 24,
    maxWidth: 1280,
    margin: '0 auto',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f5f5f5',
    margin: 0,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  metricCard: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #2a2a4a',
  },
  metricLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: 700,
    color: '#f5f5f5',
  },
  deltaUp: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  deltaDown: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  deltaNeutral: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 24,
    borderBottom: '1px solid #2a2a4a',
    paddingBottom: 0,
    overflowX: 'auto',
  },
  tab: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 500,
    color: '#888',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'color 0.2s, border-color 0.2s',
  },
  tabActive: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    color: '#f59e0b',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid #f59e0b',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  section: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: 24,
    border: '1px solid #2a2a4a',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#f5f5f5',
    marginBottom: 16,
    margin: 0,
  },
  chartToggle: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  },
  toggleBtn: {
    padding: '6px 14px',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid #2a2a4a',
    background: 'transparent',
    color: '#888',
    cursor: 'pointer',
  },
  toggleBtnActive: {
    padding: '6px 14px',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid #f59e0b',
    background: 'rgba(245,158,11,0.1)',
    color: '#f59e0b',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#888',
    borderBottom: '1px solid #2a2a4a',
    cursor: 'pointer',
    userSelect: 'none',
  },
  td: {
    padding: '10px 12px',
    fontSize: 13,
    color: '#ccc',
    borderBottom: '1px solid #1e1e3a',
  },
  feedItem: {
    padding: '12px 0',
    borderBottom: '1px solid #1e1e3a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  feedDate: {
    fontSize: 11,
    color: '#666',
    whiteSpace: 'nowrap',
  },
  feedProduct: {
    fontSize: 13,
    fontWeight: 600,
    color: '#f59e0b',
  },
  feedCount: {
    fontSize: 13,
    color: '#ccc',
  },
  feedDetail: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  forecastCard: {
    background: '#12122a',
    borderRadius: 10,
    padding: 20,
    border: '1px solid #2a2a4a',
    flex: 1,
    minWidth: 220,
  },
  forecastRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  forecastLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f5f5f5',
    marginBottom: 8,
  },
  forecastGrowth: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  forecastMrr: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f59e0b',
  },
  forecastSub: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  refreshBtn: {
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 8,
    border: '1px solid #f59e0b',
    background: 'rgba(245,158,11,0.1)',
    color: '#f59e0b',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  loading: {
    textAlign: 'center',
    padding: 60,
    color: '#888',
    fontSize: 14,
  },
  legend: {
    display: 'flex',
    gap: 16,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#aaa',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    display: 'inline-block',
  },
  sourceBar: {
    height: 8,
    borderRadius: 4,
    background: '#f59e0b',
    transition: 'width 0.3s',
  },
  sourceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sourceLabel: {
    width: 80,
    fontSize: 13,
    color: '#ccc',
    textTransform: 'capitalize',
  },
  sourceBarWrap: {
    flex: 1,
    background: '#12122a',
    borderRadius: 4,
    height: 8,
  },
  sourceValue: {
    width: 80,
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
};

const LINE_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#a855f7'];

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'new', label: 'New Signups' },
  { id: 'churn', label: 'Churn' },
  { id: 'failed', label: 'Failed Payments' },
  { id: 'forecast', label: 'Forecast' },
];

// ── Helpers ─────────────────────────────────────────────────
function fmt(n, prefix = '') {
  if (n == null) return '--';
  if (n >= 1000000) return `${prefix}${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}K`;
  return `${prefix}${Number(n).toFixed(n % 1 !== 0 ? 2 : 0)}`;
}

function DeltaArrow({ delta, invert }) {
  if (delta == null) return null;
  const d = Number(delta);
  const isUp = d > 0;
  const isGood = invert ? !isUp : isUp;
  const style = d === 0 ? styles.deltaNeutral : isGood ? styles.deltaUp : styles.deltaDown;
  const arrow = d > 0 ? '\u25B2' : d < 0 ? '\u25BC' : '\u2014';
  return (
    <div style={style}>
      <span>{arrow}</span>
      <span>{Math.abs(d).toFixed(1)}% vs last month</span>
    </div>
  );
}

// ── SVG Line Chart ──────────────────────────────────────────
function MrrChart({ series, products }) {
  if (!series || series.length === 0) {
    return <div style={{ color: '#666', fontSize: 13, padding: 20, textAlign: 'center' }}>No chart data available</div>;
  }

  const W = 800;
  const H = 300;
  const PAD = { top: 20, right: 20, bottom: 40, left: 70 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allLines = ['total', ...(products || [])];
  const allValues = series.flatMap(s => allLines.map(k => s[k] || 0));
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  function x(i) { return PAD.left + (i / Math.max(series.length - 1, 1)) * chartW; }
  function y(v) { return PAD.top + chartH - ((v - minVal) / range) * chartH; }

  function pathD(key) {
    return series
      .map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s[key] || 0).toFixed(1)}`)
      .join(' ');
  }

  // Y-axis ticks
  const yTicks = 5;
  const yTickVals = Array.from({ length: yTicks }, (_, i) => minVal + (range * i) / (yTicks - 1));

  // X-axis labels (show every Nth)
  const step = Math.max(1, Math.floor(series.length / 6));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid */}
        {yTickVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#2a2a4a" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fill="#666" fontSize={10}>
              ${fmt(v)}
            </text>
          </g>
        ))}

        {/* Lines */}
        {allLines.map((key, li) => (
          <path
            key={key}
            d={pathD(key)}
            fill="none"
            stroke={LINE_COLORS[li % LINE_COLORS.length]}
            strokeWidth={key === 'total' ? 2.5 : 1.5}
            strokeLinejoin="round"
            opacity={key === 'total' ? 1 : 0.7}
          />
        ))}

        {/* Dots on total line */}
        {series.map((s, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(s.total || 0)}
            r={3}
            fill={LINE_COLORS[0]}
          />
        ))}

        {/* X labels */}
        {series.map((s, i) => (
          i % step === 0 && (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fill="#666" fontSize={10}>
              {s.date?.slice(5) || ''}
            </text>
          )
        ))}
      </svg>
      <div style={styles.legend}>
        {allLines.map((key, i) => (
          <div key={key} style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: LINE_COLORS[i % LINE_COLORS.length] }} />
            <span>{key === 'total' ? 'Total' : key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function RevenueDashboard() {
  const [overview, setOverview] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [subscriptions, setSubscriptions] = useState(null);
  const [newFeed, setNewFeed] = useState(null);
  const [churnFeed, setChurnFeed] = useState(null);
  const [failedFeed, setFailedFeed] = useState(null);
  const [sources, setSources] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [tab, setTab] = useState('overview');
  const [chartMonths, setChartMonths] = useState(6);
  const [forecastMonths, setForecastMonths] = useState(6);
  const [sortCol, setSortCol] = useState('mrr');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOverview = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchRevenue(),
      fetchRevenueBySource(),
    ]);
    const val = (i) => results[i]?.status === 'fulfilled' ? results[i].value : null;
    setOverview(val(0));
    setSources(val(1)?.sources || []);
    setLoading(false);
  }, []);

  const loadChart = useCallback(async () => {
    const data = await fetchRevenueChart(chartMonths).catch(() => null);
    setChartData(data);
  }, [chartMonths]);

  const loadTabData = useCallback(async () => {
    if (tab === 'subscriptions' && !subscriptions) {
      const data = await fetchRevenueSubscriptions().catch(() => null);
      setSubscriptions(data);
    } else if (tab === 'new' && !newFeed) {
      const data = await fetchRevenueNew().catch(() => null);
      setNewFeed(data?.feed || []);
    } else if (tab === 'churn' && !churnFeed) {
      const data = await fetchRevenueChurn().catch(() => null);
      setChurnFeed(data?.feed || []);
    } else if (tab === 'failed' && !failedFeed) {
      const data = await fetchRevenueFailed().catch(() => null);
      setFailedFeed(data?.feed || []);
    } else if (tab === 'forecast' && !forecast) {
      const data = await fetchRevenueForecast(forecastMonths).catch(() => null);
      setForecast(data);
    }
  }, [tab, subscriptions, newFeed, churnFeed, failedFeed, forecast, forecastMonths]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadChart(); }, [loadChart]);
  useEffect(() => { loadTabData(); }, [loadTabData]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshRevenue();
      // Reset all data
      setOverview(null);
      setChartData(null);
      setSubscriptions(null);
      setNewFeed(null);
      setChurnFeed(null);
      setFailedFeed(null);
      setSources(null);
      setForecast(null);
      setLoading(true);
      await loadOverview();
      await loadChart();
    } catch (err) {
      console.error('Refresh failed:', err);
    }
    setRefreshing(false);
  }

  // Sort handler for subscriptions table
  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function sortedSubs() {
    const subs = subscriptions?.subscriptions || [];
    return [...subs].sort((a, b) => {
      const va = a[sortCol] ?? 0;
      const vb = b[sortCol] ?? 0;
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }

  if (loading) {
    return <div style={styles.loading}>Loading revenue data...</div>;
  }

  const metrics = [
    { key: 'mrr', label: 'Monthly Recurring Revenue', value: fmt(overview?.mrr?.value, '$'), delta: overview?.mrr?.delta },
    { key: 'activeSubs', label: 'Active Subscriptions', value: fmt(overview?.activeSubs?.value), delta: overview?.activeSubs?.delta },
    { key: 'churnRate', label: 'Churn Rate', value: overview?.churnRate?.value != null ? `${overview.churnRate.value.toFixed(1)}%` : '--', delta: overview?.churnRate?.delta, invert: true },
    { key: 'avgLtv', label: 'Avg LTV', value: fmt(overview?.avgLtv?.value, '$'), delta: overview?.avgLtv?.delta },
    { key: 'newSubs', label: 'New Subscriptions', value: fmt(overview?.newSubs?.value), delta: overview?.newSubs?.delta },
    { key: 'failedPayments', label: 'Failed Payments', value: fmt(overview?.failedPayments?.value), delta: overview?.failedPayments?.delta, invert: true },
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.headerRow}>
        <div style={styles.header}>
          <h1 style={styles.title}>Revenue</h1>
          <p style={styles.subtitle}>Subscription revenue metrics and analytics</p>
        </div>
        <button
          style={styles.refreshBtn}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Metric Cards */}
      <div style={styles.metricsRow}>
        {metrics.map(m => (
          <div key={m.key} style={styles.metricCard}>
            <div style={styles.metricLabel}>{m.label}</div>
            <div style={styles.metricValue}>{m.value}</div>
            <DeltaArrow delta={m.delta} invert={m.invert} />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={tab === t.id ? styles.tabActive : styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <div style={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={styles.sectionTitle}>MRR Over Time</h3>
              <div style={styles.chartToggle}>
                {[3, 6, 12].map(m => (
                  <button
                    key={m}
                    style={chartMonths === m ? styles.toggleBtnActive : styles.toggleBtn}
                    onClick={() => setChartMonths(m)}
                  >
                    {m}mo
                  </button>
                ))}
              </div>
            </div>
            {chartData ? (
              <MrrChart series={chartData.series} products={chartData.products} />
            ) : (
              <div style={{ color: '#666', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading chart...</div>
            )}
          </div>

          {/* Revenue by Source */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Revenue by Source</h3>
            {(sources || []).length > 0 ? (
              sources.map((s, i) => {
                const maxMrr = sources[0]?.mrr || 1;
                return (
                  <div key={i} style={styles.sourceRow}>
                    <div style={styles.sourceLabel}>{s.source}</div>
                    <div style={styles.sourceBarWrap}>
                      <div style={{ ...styles.sourceBar, width: `${(s.mrr / maxMrr) * 100}%` }} />
                    </div>
                    <div style={styles.sourceValue}>{fmt(s.mrr, '$')} ({s.subs} subs)</div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>No source data available</div>
            )}
          </div>
        </>
      )}

      {/* ── Subscriptions Tab ────────────────────────── */}
      {tab === 'subscriptions' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Subscription Breakdown</h3>
          {subscriptions ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  {[
                    { col: 'product', label: 'Product' },
                    { col: 'activeSubs', label: 'Active Subs' },
                    { col: 'mrr', label: 'MRR' },
                    { col: 'percentage', label: '% of Total' },
                  ].map(h => (
                    <th
                      key={h.col}
                      style={styles.th}
                      onClick={() => handleSort(h.col)}
                    >
                      {h.label} {sortCol === h.col ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSubs().map((sub, i) => (
                  <tr key={i}>
                    <td style={styles.td}>
                      <span style={{ fontWeight: 600, color: '#f59e0b' }}>{sub.product}</span>
                      {sub.plans && sub.plans.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {sub.plans.map((p, pi) => (
                            <div key={pi} style={{ fontSize: 11, color: '#666' }}>
                              {p.name}: {fmt(p.price, '$')}/mo x {p.count}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={styles.td}>{fmt(sub.activeSubs)}</td>
                    <td style={styles.td}>{fmt(sub.mrr, '$')}</td>
                    <td style={styles.td}>{sub.percentage?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#666', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading subscriptions...</div>
          )}
        </div>
      )}

      {/* ── New Signups Tab ──────────────────────────── */}
      {tab === 'new' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>New Signups (Last 30 Days)</h3>
          {newFeed ? (
            newFeed.length > 0 ? (
              newFeed.map((item, i) => (
                <div key={i} style={styles.feedItem}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.feedProduct}>{item.product}</div>
                    <div style={styles.feedCount}>{item.count} new subscription{item.count !== 1 ? 's' : ''}</div>
                    {item.details && item.details.slice(0, 3).map((d, di) => (
                      <div key={di} style={styles.feedDetail}>
                        {d.email} - {d.plan}
                      </div>
                    ))}
                    {item.details && item.details.length > 3 && (
                      <div style={styles.feedDetail}>+{item.details.length - 3} more</div>
                    )}
                  </div>
                  <div style={styles.feedDate}>{item.date}</div>
                </div>
              ))
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>No new signups in the last 30 days</div>
            )
          ) : (
            <div style={{ color: '#666', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading...</div>
          )}
        </div>
      )}

      {/* ── Churn Tab ────────────────────────────────── */}
      {tab === 'churn' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Cancellations (Last 30 Days)</h3>
          {churnFeed ? (
            churnFeed.length > 0 ? (
              churnFeed.map((item, i) => (
                <div key={i} style={styles.feedItem}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.feedProduct}>{item.product}</div>
                    <div style={styles.feedCount}>{item.count} cancellation{item.count !== 1 ? 's' : ''}</div>
                    {item.details && item.details.slice(0, 3).map((d, di) => (
                      <div key={di} style={styles.feedDetail}>
                        {d.email} - {d.reason}
                      </div>
                    ))}
                    {item.details && item.details.length > 3 && (
                      <div style={styles.feedDetail}>+{item.details.length - 3} more</div>
                    )}
                  </div>
                  <div style={styles.feedDate}>{item.date}</div>
                </div>
              ))
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>No cancellations in the last 30 days</div>
            )
          ) : (
            <div style={{ color: '#666', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading...</div>
          )}
        </div>
      )}

      {/* ── Failed Payments Tab ──────────────────────── */}
      {tab === 'failed' && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Failed Payments</h3>
          {failedFeed ? (
            failedFeed.length > 0 ? (
              failedFeed.map((item, i) => (
                <div key={i} style={styles.feedItem}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.feedProduct}>{item.product}</div>
                    <div style={styles.feedCount}>{item.count} failed payment{item.count !== 1 ? 's' : ''}</div>
                    {item.details && item.details.slice(0, 5).map((d, di) => (
                      <div key={di} style={styles.feedDetail}>
                        {d.email} - {fmt(d.amount, '$')} - <span style={{ color: '#ef4444' }}>{d.reason}</span>
                      </div>
                    ))}
                    {item.details && item.details.length > 5 && (
                      <div style={styles.feedDetail}>+{item.details.length - 5} more</div>
                    )}
                  </div>
                  <div style={styles.feedDate}>{item.date}</div>
                </div>
              ))
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>No failed payments</div>
            )
          ) : (
            <div style={{ color: '#666', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading...</div>
          )}
        </div>
      )}

      {/* ── Forecast Tab ─────────────────────────────── */}
      {tab === 'forecast' && (
        <>
          <div style={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={styles.sectionTitle}>MRR Forecast</h3>
              <div style={styles.chartToggle}>
                {[3, 6, 12].map(m => (
                  <button
                    key={m}
                    style={forecastMonths === m ? styles.toggleBtnActive : styles.toggleBtn}
                    onClick={() => { setForecastMonths(m); setForecast(null); }}
                  >
                    {m}mo
                  </button>
                ))}
              </div>
            </div>

            {forecast ? (
              <>
                <div style={{ marginBottom: 16, fontSize: 13, color: '#888' }}>
                  Current MRR: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{fmt(forecast.currentMrr, '$')}</span>
                  {' '} | Monthly growth rate: <span style={{ color: '#f5f5f5' }}>{forecast.growthRate}%</span>
                </div>
                <div style={styles.forecastRow}>
                  {['optimistic', 'baseline', 'pessimistic'].map(key => {
                    const p = forecast.projections?.[key];
                    if (!p) return null;
                    const borderColor = key === 'optimistic' ? '#22c55e' : key === 'baseline' ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={key} style={{ ...styles.forecastCard, borderColor }}>
                        <div style={styles.forecastLabel}>{p.label}</div>
                        <div style={styles.forecastGrowth}>{p.monthlyGrowth}% monthly growth</div>
                        <div style={styles.forecastMrr}>{fmt(p.endMrr, '$')}</div>
                        <div style={styles.forecastSub}>
                          Projected MRR in {forecastMonths} months
                        </div>
                        {p.points && p.points.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            {p.points.map((pt, pi) => (
                              <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', padding: '2px 0' }}>
                                <span>{pt.month}</span>
                                <span>{fmt(pt.mrr, '$')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ color: '#666', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading forecast...</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
