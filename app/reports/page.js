'use client';

import { useState, useEffect } from 'react';
import {
  fetchDailyReport, fetchPainPoints, fetchPainPointsToday, fetchPipeline,
  fetchAgents, fetchHealthReport, fetchContentPerformance,
  fetchProductIntelligence, fetchApprovalStats,
} from '../../lib/api';
import { PRODUCTS } from '../../lib/constants';

const PIPE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#14b8a6', '#a855f7', '#3b82f6', '#84cc16', '#f43f5e', '#0ea5e9'];

function StatBlock({ value, label, color, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : undefined}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function ReportsPage() {
  const [daily, setDaily] = useState(null);
  const [agents, setAgents] = useState([]);
  const [userPipeline, setUserPipeline] = useState(null);
  const [partnerPipeline, setPartnerPipeline] = useState(null);
  const [painPoints, setPainPoints] = useState([]);
  const [health, setHealth] = useState(null);
  const [approvalStats, setApprovalStats] = useState(null);
  const [contentPerf, setContentPerf] = useState({});
  const [intel, setIntel] = useState([]);
  const [todayPainPoints, setTodayPainPoints] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        fetchDailyReport(),
        fetchAgents(),
        fetchPipeline('user'),
        fetchPipeline('partner'),
        fetchPainPoints(30),
        fetchHealthReport(),
        fetchApprovalStats(),
        fetchProductIntelligence(),
        fetchPainPointsToday(),
        ...PRODUCTS.map((p) => fetchContentPerformance(p.id, 30)),
      ]);

      const val = (i) => results[i]?.status === 'fulfilled' ? results[i].value : null;
      setDaily(val(0));
      setAgents(val(1)?.agents || []);
      setUserPipeline(val(2));
      setPartnerPipeline(val(3));
      setPainPoints(val(4)?.painPoints || []);
      setHealth(val(5));
      setApprovalStats(val(6)?.stats || val(6));
      setIntel(val(7)?.recommendations || []);
      setTodayPainPoints(val(8));

      const perfMap = {};
      PRODUCTS.forEach((p, i) => {
        const r = results[9 + i];
        if (r?.status === 'fulfilled') perfMap[p.id] = r.value;
      });
      setContentPerf(perfMap);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="loading"><div className="spinner" />Compiling daily report...</div>;

  const report = daily || {};
  const content = report.content || {};
  const agentRuns = report.agentRuns || {};
  const infraHealth = report.infrastructure || {};

  return (
    <>
      <div className="page-header">
        <h1>Daily Report</h1>
        <p>
          {report.date || new Date().toLocaleDateString()} &mdash; Generated{' '}
          {report.generatedAt ? new Date(report.generatedAt).toLocaleTimeString() : 'now'}
        </p>
      </div>

      {/* ── 1. Executive Summary ──────────────────────── */}
      <div className="section">
        <div className="section-header"><h2>Executive Summary</h2></div>
        <div className="stats-row">
          <StatBlock value={content.total ?? '—'} label="Content Produced" color="var(--accent-hover)" />
          <StatBlock value={agentRuns.completed ?? agents.filter(a => a.lastRun?.status === 'completed').length} label="Agents Completed" color="var(--green)" />
          <StatBlock value={agentRuns.failed ?? agents.filter(a => a.lastRun?.status === 'failed').length} label="Agents Failed" color="var(--red)" />
          <StatBlock value={approvalStats?.pending ?? '—'} label="Pending Approvals" color="var(--yellow)" />
          <StatBlock value={infraHealth.unresolvedAlerts ?? '—'} label="Active Alerts" />
        </div>
      </div>

      {/* ── 2. Content Production ─────────────────────── */}
      <div className="section">
        <div className="section-header"><h2>Content Production</h2></div>
        <div className="stats-row">
          <StatBlock value={content.blogPosts ?? 0} label="Blog Posts" />
          <StatBlock value={content.newsletters ?? 0} label="Newsletters" />
          <StatBlock value={content.socialPosts ?? 0} label="Social Posts" />
          <StatBlock value={content.videos ?? 0} label="Videos" />
        </div>
      </div>

      {/* ── 3. Content Performance by Product ─────────── */}
      <div className="section">
        <div className="section-header"><h2>Content Performance (30 days)</h2></div>
        <div className="grid-3">
          {PRODUCTS.map((product) => {
            const perf = contentPerf[product.id];
            const items = perf?.content || [];
            return (
              <div key={product.id} className="card card-compact">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{product.name}</div>
                {items.length === 0 ? (
                  <div className="text-xs text-muted">No performance data</div>
                ) : (
                  <div>
                    <div className="text-xs text-muted">{items.length} piece{items.length !== 1 ? 's' : ''} tracked</div>
                    <div className="progress-track mt-2">
                      <div className="progress-fill" style={{
                        width: `${Math.min(100, items.length * 10)}%`,
                        background: 'var(--accent)',
                      }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Agent Activity ─────────────────────────── */}
      <div className="section">
        <div className="section-header"><h2>Agent Activity</h2></div>
        {agents.length === 0 ? (
          <div className="empty-state">No agent data available</div>
        ) : (
          <div className="card card-compact">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => {
                    const run = agent.lastRun;
                    const statusBadge = run?.status === 'completed' ? 'badge-green'
                      : run?.status === 'failed' ? 'badge-red'
                      : run?.status === 'running' ? 'badge-yellow'
                      : 'badge-muted';
                    return (
                      <tr key={agent.id}>
                        <td className="font-semibold text-sm">{agent.id}</td>
                        <td><span className={`badge ${statusBadge}`}>{run?.status || 'idle'}</span></td>
                        <td className="text-sm text-muted">
                          {run?.run_started_at ? new Date(run.run_started_at).toLocaleTimeString() : '—'}
                        </td>
                        <td className="text-sm">
                          {run?.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                        </td>
                        <td className="text-sm">{run?.items_produced ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Approval Queue Summary ─────────────────── */}
      <div className="section">
        <div className="section-header"><h2>Approval Queue</h2></div>
        <div className="stats-row">
          <StatBlock value={approvalStats?.pending ?? 0} label="Pending" color="var(--yellow)" />
          <StatBlock value={approvalStats?.approved_today ?? 0} label="Approved Today" color="var(--green)" />
          <StatBlock value={approvalStats?.rejected_today ?? 0} label="Rejected Today" color="var(--red)" />
          <StatBlock value={approvalStats?.auto_approved_today ?? 0} label="Auto-Approved" color="var(--cyan)" />
        </div>
      </div>

      {/* ── 6 & 7. Pipeline (User + Partner) ──────────── */}
      {[
        { data: userPipeline, title: 'User Pipeline', track: 'user' },
        { data: partnerPipeline, title: 'Partner Pipeline', track: 'partner' },
      ].map(({ data, title }) => {
        const stages = data?.stages || {};
        const total = data?.total || 0;
        if (total === 0) return null;
        return (
          <div key={title} className="section">
            <div className="section-header">
              <h2>{title}</h2>
              <span className="text-sm text-muted">{total} total</span>
            </div>
            <div className="pipeline-bar">
              {Object.entries(stages).map(([stage, count], i) => (
                <div
                  key={stage}
                  className="pipeline-segment"
                  style={{ flex: count || 0.5, background: PIPE_COLORS[i % PIPE_COLORS.length] }}
                  title={`${stage}: ${count}`}
                >
                  {count > 0 && count}
                </div>
              ))}
            </div>
            <div className="pipeline-legend">
              {Object.entries(stages).map(([stage, count], i) => (
                <div key={stage} className="pipeline-legend-item">
                  <div className="pipeline-legend-dot" style={{ background: PIPE_COLORS[i % PIPE_COLORS.length] }} />
                  {stage}: {count}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* ── 8. Today's Pain Points ──────────────────── */}
      <div className="section">
        <div className="section-header">
          <h2>Today&apos;s Pain Points</h2>
          <span className="text-sm text-muted">
            {todayPainPoints ? `${todayPainPoints.total || 0} found · ${todayPainPoints.highScore || 0} high-score` : 'Loading...'}
          </span>
        </div>
        {(!todayPainPoints || todayPainPoints.total === 0) ? (
          <div className="card card-compact"><div className="text-sm text-muted">No pain points detected today. Agent runs at 5:30 AM ET.</div></div>
        ) : (
          <>
            <div className="stats-row" style={{ marginBottom: 16 }}>
              <StatBlock value={todayPainPoints.total} label="Total Found" />
              <StatBlock value={todayPainPoints.highScore} label="Score 7+" color="var(--accent)" />
              <StatBlock value={Object.keys(todayPainPoints.byProduct || {}).length} label="Products" />
            </div>

            {Object.entries(todayPainPoints.byProduct || {}).map(([productId, items]) => (
              <div key={productId} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {PRODUCTS.find(p => p.id === productId)?.name || productId} ({items.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((pp, i) => {
                    const scoreBadge = pp.score >= 8 ? 'badge-green' : pp.score >= 6 ? 'badge-yellow' : 'badge-muted';
                    const urgencyBadge = pp.urgency === 'critical' ? 'badge-red'
                      : pp.urgency === 'high' ? 'badge-orange'
                      : pp.urgency === 'medium' ? 'badge-yellow'
                      : 'badge-muted';
                    return (
                      <div key={pp.id || i} className="card card-compact" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="font-semibold text-sm" style={{ marginBottom: 2 }}>
                              {pp.title || (pp.text || '').slice(0, 100)}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span className={`badge ${scoreBadge}`} style={{ fontSize: 10 }}>
                                Score: {pp.score}/10
                              </span>
                              <span className={`badge ${urgencyBadge}`} style={{ fontSize: 10 }}>
                                {pp.urgency || 'low'}
                              </span>
                              {pp.classification && (
                                <span className="badge badge-purple" style={{ fontSize: 10 }}>
                                  {(pp.classification || '').replace(/_/g, ' ')}
                                </span>
                              )}
                              {pp.subreddit && (
                                <span className="text-xs text-muted">{pp.subreddit}</span>
                              )}
                            </div>
                          </div>
                          {pp.source_url && (
                            <a
                              href={pp.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm"
                              style={{ fontSize: 10, padding: '3px 8px', flexShrink: 0, marginLeft: 8, textDecoration: 'none' }}
                            >
                              View Post
                            </a>
                          )}
                        </div>

                        {pp.text && pp.text !== pp.title && (
                          <p className="text-xs text-secondary" style={{ lineHeight: 1.5, maxHeight: 48, overflow: 'hidden', marginBottom: 6 }}>
                            {pp.text.slice(0, 250)}{pp.text.length > 250 ? '...' : ''}
                          </p>
                        )}

                        {pp.drafted_response && (
                          <div style={{
                            marginTop: 4, padding: '8px 12px',
                            background: 'var(--bg)', borderRadius: 6,
                            borderLeft: '3px solid var(--accent)',
                          }}>
                            <div className="text-xs text-muted font-semibold" style={{ marginBottom: 4 }}>
                              Drafted Response {pp.response_mentions_product ? '(mentions product)' : ''}
                            </div>
                            <p className="text-xs text-secondary" style={{ lineHeight: 1.5, maxHeight: 60, overflow: 'hidden' }}>
                              {pp.drafted_response.slice(0, 300)}{pp.drafted_response.length > 300 ? '...' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── 8b. Pain Points (30-day history) ───────────── */}
      <div className="section">
        <div className="section-header">
          <h2>Pain Point History</h2>
          <span className="text-sm text-muted">Last 30 days</span>
        </div>
        {painPoints.length === 0 ? (
          <div className="card card-compact"><div className="text-sm text-muted">No pain points detected</div></div>
        ) : (
          <div className="card card-compact">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th>Product</th>
                    <th>Score</th>
                    <th>Urgency</th>
                    <th>Source</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {painPoints.slice(0, 20).map((pp, i) => {
                    const urgencyBadge = pp.urgency === 'critical' ? 'badge-red'
                      : pp.urgency === 'high' ? 'badge-orange'
                      : pp.urgency === 'medium' ? 'badge-yellow'
                      : 'badge-muted';
                    const scoreBadge = pp.score >= 8 ? 'badge-green' : pp.score >= 6 ? 'badge-yellow' : 'badge-muted';
                    return (
                      <tr key={pp.id || i}>
                        <td className="text-sm">{pp.title || (pp.text || '').slice(0, 80) || '—'}</td>
                        <td className="text-sm">{pp.product || pp.product_relevance || '—'}</td>
                        <td><span className={`badge ${scoreBadge}`}>{pp.score || '—'}/10</span></td>
                        <td><span className={`badge ${urgencyBadge}`}>{pp.urgency || 'low'}</span></td>
                        <td className="text-sm text-muted">
                          {pp.source_url ? (
                            <a href={pp.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                              {pp.subreddit || pp.source || 'link'}
                            </a>
                          ) : (pp.source || '—')}
                        </td>
                        <td className="text-sm text-muted">
                          {pp.date_found ? new Date(pp.date_found).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 9. Product Intelligence ───────────────────── */}
      <div className="section">
        <div className="section-header"><h2>Product Intelligence</h2></div>
        {intel.length === 0 ? (
          <div className="card card-compact"><div className="text-sm text-muted">No recommendations</div></div>
        ) : (
          <div className="card card-compact">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Recommendation</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Impact</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.slice(0, 10).map((item, i) => (
                    <tr key={item.id || i}>
                      <td className="text-sm font-medium">{item.title}</td>
                      <td className="text-sm">{item.product}</td>
                      <td><span className="badge badge-purple">{item.rec_type?.replace(/_/g, ' ')}</span></td>
                      <td className="text-sm">{item.expected_impact || '—'}</td>
                      <td><span className={`badge ${item.status === 'accepted' ? 'badge-green' : item.status === 'rejected' ? 'badge-red' : 'badge-muted'}`}>{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 10. QA Results ────────────────────────────── */}
      {report.qa && (
        <div className="section">
          <div className="section-header"><h2>QA Results</h2></div>
          <div className="stats-row">
            <StatBlock
              value={report.qa.passRate != null ? `${(report.qa.passRate * 100).toFixed(0)}%` : '—'}
              label="Pass Rate"
              color={report.qa.passRate >= 0.9 ? 'var(--green)' : report.qa.passRate >= 0.7 ? 'var(--yellow)' : 'var(--red)'}
            />
            <StatBlock value={report.qa.results?.length ?? 0} label="Tests Run" />
          </div>
        </div>
      )}

      {/* ── 11. Infrastructure Health ─────────────────── */}
      {health && (
        <div className="section">
          <div className="section-header"><h2>Infrastructure Health</h2></div>
          <div className="stats-row">
            <StatBlock
              value={health.unresolvedAlerts?.length ?? infraHealth.unresolvedAlerts ?? 0}
              label="Unresolved Alerts"
              color={health.criticalAlerts > 0 ? 'var(--red)' : 'var(--green)'}
            />
            <StatBlock
              value={health.criticalAlerts ?? infraHealth.criticalAlerts ?? 0}
              label="Critical Alerts"
              color="var(--red)"
            />
          </div>

          {health.unresolvedAlerts?.length > 0 && (
            <div className="card card-compact">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Alert</th>
                      <th>Severity</th>
                      <th>Service</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health.unresolvedAlerts.map((alert, i) => (
                      <tr key={alert.id || i}>
                        <td className="text-sm">{alert.message}</td>
                        <td><span className={`badge ${alert.severity === 'critical' ? 'badge-red' : alert.severity === 'warning' ? 'badge-yellow' : 'badge-muted'}`}>{alert.severity}</span></td>
                        <td className="text-sm">{alert.service}</td>
                        <td className="text-sm text-muted">{alert.created_at ? new Date(alert.created_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 12. Lifecycle & Inbox ─────────────────────── */}
      <div className="section">
        <div className="section-header"><h2>Operations Summary</h2></div>
        <div className="grid-2">
          <div className="card card-compact">
            <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Inbox
            </div>
            <div className="info-row">
              <span className="info-label">Emails Processed</span>
              <span className="info-value">{report.inbox?.emailsProcessed ?? 0}</span>
            </div>
          </div>
          <div className="card card-compact">
            <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              User Lifecycle
            </div>
            <div className="info-row">
              <span className="info-label">Updates Today</span>
              <span className="info-value">{report.lifecycle?.updates ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
