'use client';

import { useState, useEffect } from 'react';
import {
  fetchDailyReport, fetchPainPoints, fetchPainPointsToday, fetchPipeline,
  fetchAgents, fetchHealthReport, fetchContentPerformance,
  fetchProductIntelligence, fetchApprovalStats, fetchInfraStatus,
  fetchCommunityReport, fetchSeoPostsToday,
  fetchOutreachReport, fetchSocialReport, fetchAdCreatives,
  fetchSatelliteBlogs, fetchVerticalTools,
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
  const [infraStatus, setInfraStatus] = useState(null);
  const [communityReport, setCommunityReport] = useState(null);
  const [seoPosts, setSeoPosts] = useState(null);
  const [outreachReport, setOutreachReport] = useState(null);
  const [socialReport, setSocialReport] = useState(null);
  const [adCreativeStats, setAdCreativeStats] = useState(null);
  const [satelliteBlogData, setSatelliteBlogData] = useState(null);
  const [verticalToolData, setVerticalToolData] = useState(null);
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
        fetchInfraStatus(),
        fetchCommunityReport(7),
        fetchSeoPostsToday(),
        fetchOutreachReport(),
        fetchSocialReport(),
        fetchAdCreatives({ days: 7 }),
        fetchSatelliteBlogs(),
        fetchVerticalTools(),
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
      setInfraStatus(val(9));
      setCommunityReport(val(10));
      setSeoPosts(val(11));
      setOutreachReport(val(12));
      setSocialReport(val(13));
      setAdCreativeStats(val(14)?.stats || null);
      setSatelliteBlogData(val(15));
      setVerticalToolData(val(16));

      const perfMap = {};
      PRODUCTS.forEach((p, i) => {
        const r = results[17 + i];
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const summaryParts = [];
  if (approvalStats?.pending > 0) summaryParts.push(`${approvalStats.pending} item${approvalStats.pending !== 1 ? 's' : ''} awaiting approval`);
  if (content.total > 0) summaryParts.push(`${content.total} pieces of content produced`);
  const failedCount = agentRuns.failed ?? agents.filter(a => a.lastRun?.status === 'failed').length;
  if (failedCount > 0) summaryParts.push(`${failedCount} agent${failedCount !== 1 ? 's' : ''} need attention`);

  return (
    <>
      <div className="page-header">
        <div className="briefing-greeting">{greeting}.</div>
        <div className="briefing-date">
          {report.date || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} &mdash; Generated{' '}
          {report.generatedAt ? new Date(report.generatedAt).toLocaleTimeString() : 'now'}
        </div>
        {summaryParts.length > 0 && (
          <div className="briefing-summary">{summaryParts.join(', ')}.</div>
        )}
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

      {/* ── 3b. Content Generation (SEO/AEO) ────────── */}
      <div className="section">
        <div className="section-header">
          <h2>Content Generation</h2>
          <span className="text-sm text-muted">
            {seoPosts ? `${seoPosts.total || 0} posts today` : 'Loading...'}
          </span>
        </div>
        {(!seoPosts || seoPosts.total === 0) ? (
          <div className="card card-compact"><div className="text-sm text-muted">No blog posts generated today. SEO/AEO Writer runs at 6:15 AM ET.</div></div>
        ) : (
          <>
            <div className="stats-row" style={{ marginBottom: 16 }}>
              <StatBlock value={seoPosts.total} label="Posts Generated" color="var(--accent)" />
              {PRODUCTS.map(p => (
                <StatBlock key={p.id} value={seoPosts.byProduct?.[p.id] || 0} label={p.name} />
              ))}
            </div>
            <div className="card card-compact">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Product</th>
                      <th>Keyword</th>
                      <th>Words</th>
                      <th>FAQ</th>
                      <th>Approval</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seoPosts.posts.map((post, i) => {
                      const statusBadge = post.status === 'approved' ? 'badge-green'
                        : post.status === 'pending' ? 'badge-yellow'
                        : post.status === 'rejected' ? 'badge-red'
                        : 'badge-muted';
                      const tierBadge = post.approvalTier === 1 ? 'badge-green' : 'badge-yellow';
                      return (
                        <tr key={post.id || i}>
                          <td className="text-sm font-semibold" style={{ maxWidth: 280 }}>
                            {post.title || '—'}
                            {post.metaTitle && post.metaTitle !== post.title && (
                              <div className="text-xs text-muted" style={{ marginTop: 2 }}>Meta: {post.metaTitle}</div>
                            )}
                          </td>
                          <td className="text-sm">{PRODUCTS.find(p => p.id === post.product)?.name || post.product}</td>
                          <td><span className="badge badge-purple" style={{ fontSize: 10 }}>{post.keyword || '—'}</span></td>
                          <td className="text-sm">{post.wordCount ? post.wordCount.toLocaleString() : '—'}</td>
                          <td className="text-sm">{post.hasFaqSchema ? '✓' : '—'}</td>
                          <td><span className={`badge ${tierBadge}`} style={{ fontSize: 10 }}>Tier {post.approvalTier || '?'}</span></td>
                          <td><span className={`badge ${statusBadge}`}>{post.status || 'unknown'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
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

      {/* ── 5b. Outreach ─────────────────────────────── */}
      <div className="section">
        <div className="section-header">
          <h2>Outreach</h2>
          <span className="text-sm text-muted">
            {outreachReport ? `${outreachReport.today?.total || 0} prospects today · ${outreachReport.totalProspects || 0} total` : 'Loading...'}
          </span>
        </div>
        {(!outreachReport || outreachReport.today?.total === 0) ? (
          <div className="card card-compact"><div className="text-sm text-muted">No outreach activity today. Agent runs at 8:30 AM ET.</div></div>
        ) : (
          <>
            <div className="stats-row" style={{ marginBottom: 16 }}>
              <StatBlock value={outreachReport.today?.total || 0} label="Prospects Found" color="var(--accent)" />
              <StatBlock value={outreachReport.today?.emailsDrafted || 0} label="Emails Drafted" />
              <StatBlock value={outreachReport.today?.userTrack || 0} label="End-User" />
              <StatBlock value={outreachReport.today?.partnerTrack || 0} label="Partnership" />
            </div>

            {/* Per-product breakdown */}
            <div className="grid-3" style={{ marginBottom: 16 }}>
              {PRODUCTS.map(product => {
                const stats = outreachReport.today?.byProduct?.[product.id];
                return (
                  <div key={product.id} className="card card-compact" style={{ margin: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{product.name}</div>
                    <div className="info-row">
                      <span className="info-label">Found</span>
                      <span className="info-value">{stats?.found || 0}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Drafted</span>
                      <span className="info-value">{stats?.drafted || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pipeline status breakdown */}
            {outreachReport.pipeline && Object.keys(outreachReport.pipeline).length > 0 && (
              <div className="card card-compact" style={{ marginBottom: 16 }}>
                <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Pipeline Status
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(outreachReport.pipeline).map(([stage, count]) => {
                    const badge = stage === 'replied' || stage === 'engaged' || stage === 'converted' || stage === 'partnership_active' ? 'badge-green'
                      : stage === 'contacted' || stage === 'pitched' || stage === 'in_discussion' ? 'badge-yellow'
                      : stage === 'closed_lost' || stage === 'declined' ? 'badge-red'
                      : 'badge-muted';
                    return (
                      <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className={`badge ${badge}`} style={{ fontSize: 10 }}>{stage.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-semibold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Response rates */}
            {(outreachReport.responseRate7d || outreachReport.responseRate30d) && (
              <div className="stats-row" style={{ marginBottom: 16 }}>
                {outreachReport.responseRate7d && (
                  <StatBlock
                    value={`${outreachReport.responseRate7d.rate}%`}
                    label="7-Day Response Rate"
                    sub={`${outreachReport.responseRate7d.replied}/${outreachReport.responseRate7d.sent} replied`}
                    color="var(--green)"
                  />
                )}
                {outreachReport.responseRate30d && (
                  <StatBlock
                    value={`${outreachReport.responseRate30d.rate}%`}
                    label="30-Day Response Rate"
                    sub={`${outreachReport.responseRate30d.replied}/${outreachReport.responseRate30d.sent} replied`}
                  />
                )}
              </div>
            )}

            {/* Top prospects */}
            {outreachReport.topProspects?.length > 0 && (
              <div className="card card-compact">
                <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Top Prospects Today (ICP 7+)
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Product</th>
                        <th>Track</th>
                        <th>ICP</th>
                        <th>Platform</th>
                        <th>Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outreachReport.topProspects.map((p, i) => {
                        const scoreBadge = p.icp_score >= 8 ? 'badge-green' : 'badge-yellow';
                        const stageBadge = p.stage === 'email_drafted' || p.stage === 'pitch_drafted' ? 'badge-yellow'
                          : p.stage === 'contacted' || p.stage === 'pitched' ? 'badge-blue'
                          : p.stage === 'replied' ? 'badge-green'
                          : 'badge-muted';
                        return (
                          <tr key={p.id || i}>
                            <td className="text-sm">
                              <div className="font-semibold">{p.name}</div>
                              {p.company && <div className="text-xs text-muted">{p.title ? `${p.title} @ ` : ''}{p.company}</div>}
                            </td>
                            <td className="text-sm">{PRODUCTS.find(pr => pr.id === p.product)?.name || p.product}</td>
                            <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{p.track}</span></td>
                            <td><span className={`badge ${scoreBadge}`}>{p.icp_score}/10</span></td>
                            <td className="text-sm text-muted">{p.platform}</td>
                            <td><span className={`badge ${stageBadge}`} style={{ fontSize: 10 }}>{(p.stage || '').replace(/_/g, ' ')}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Social Distributor ──────────────────────── */}
      <div className="section">
        <div className="section-header">
          <h2>Social Distribution</h2>
          <span className="text-sm text-muted">
            {socialReport ? `${socialReport.today?.totalScheduled || 0} scheduled · ${socialReport.today?.totalPublished || 0} published · ${socialReport.today?.totalPending || 0} pending` : 'Loading...'}
          </span>
        </div>
        {!socialReport || (socialReport.today?.totalScheduled === 0 && socialReport.today?.totalPublished === 0) ? (
          <div className="text-sm text-muted" style={{ padding: 20 }}>No social posts scheduled or published today</div>
        ) : (
          <>
            <div className="stats-row">
              <StatBlock value={socialReport.today?.totalScheduled || 0} label="Scheduled Today" color="var(--accent)" />
              <StatBlock value={socialReport.today?.totalPublished || 0} label="Published" color="var(--green)" />
              <StatBlock value={socialReport.today?.totalPending || 0} label="Pending Approval" color="var(--yellow)" />
              <StatBlock
                value={
                  socialReport.yesterdayEngagement
                    ? `${socialReport.yesterdayEngagement.totalLikes + socialReport.yesterdayEngagement.totalComments + socialReport.yesterdayEngagement.totalShares}`
                    : '0'
                }
                label="Yesterday Engagement"
              />
            </div>

            {/* Platform breakdown */}
            {socialReport.today?.byPlatform && Object.keys(socialReport.today.byPlatform).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  By Platform
                </div>
                <div className="grid-3" style={{ gap: 8 }}>
                  {Object.entries(socialReport.today.byPlatform).map(([platform, counts]) => {
                    const platformLabel = { reddit: 'Reddit', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', discord: 'Discord' }[platform] || platform;
                    return (
                      <div key={platform} className="info-block">
                        <div className="font-semibold text-sm">{platformLabel}</div>
                        <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                          {counts.scheduled > 0 && <span style={{ marginRight: 8 }}>{counts.scheduled} scheduled</span>}
                          {counts.published > 0 && <span style={{ color: 'var(--green)', marginRight: 8 }}>{counts.published} published</span>}
                          {counts.pending > 0 && <span style={{ color: 'var(--yellow)', marginRight: 8 }}>{counts.pending} pending</span>}
                          {counts.failed > 0 && <span style={{ color: 'var(--red)' }}>{counts.failed} failed</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Yesterday engagement by platform */}
            {socialReport.yesterdayEngagement && Object.keys(socialReport.yesterdayEngagement.byPlatform || {}).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  Yesterday&apos;s Engagement
                </div>
                <div className="grid-3" style={{ gap: 8 }}>
                  {Object.entries(socialReport.yesterdayEngagement.byPlatform).map(([platform, metrics]) => {
                    const platformLabel = { reddit: 'Reddit', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', discord: 'Discord' }[platform] || platform;
                    return (
                      <div key={platform} className="info-block">
                        <div className="font-semibold text-sm">{platformLabel}</div>
                        <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                          {metrics.posts} post{metrics.posts !== 1 ? 's' : ''} &middot;
                          {' '}{metrics.likes} likes &middot; {metrics.comments} comments &middot; {metrics.shares} shares
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shadowban warnings */}
            {socialReport.shadowbanWarnings?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="text-xs font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, color: 'var(--red)' }}>
                  Account Health Warnings
                </div>
                {socialReport.shadowbanWarnings.map((warning, i) => (
                  <div key={i} className="info-block" style={{ borderLeft: '3px solid var(--red)', marginBottom: 8 }}>
                    <div className="font-semibold text-sm" style={{ color: 'var(--red)' }}>
                      {(warning.platform || '').charAt(0).toUpperCase() + (warning.platform || '').slice(1)} — Possible Shadowban
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                      {warning.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
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

      {/* ── 10. Community Discovery ────────────────────── */}
      <div className="section">
        <div className="section-header">
          <h2>Community Discovery</h2>
          <span className="text-sm text-muted">
            {communityReport ? `${communityReport.newCount || 0} new this week · ${communityReport.totalTracked || 0} total` : 'Loading...'}
          </span>
        </div>
        {(!communityReport || communityReport.newCount === 0) ? (
          <div className="card card-compact"><div className="text-sm text-muted">No new communities discovered this week. Full scan runs Monday 6 AM ET, Reddit daily at 5:45 AM ET.</div></div>
        ) : (
          <>
            <div className="stats-row" style={{ marginBottom: 16 }}>
              <StatBlock value={communityReport.newCount} label="New This Week" color="var(--accent)" />
              <StatBlock value={communityReport.totalTracked} label="Total Tracked" />
              {communityReport.byPlatformCount && Object.entries(communityReport.byPlatformCount).map(([platform, count]) => (
                <StatBlock key={platform} value={count} label={platform.charAt(0).toUpperCase() + platform.slice(1)} />
              ))}
            </div>

            {Object.entries(communityReport.byProduct || {}).map(([productId, platforms]) => (
              <div key={productId} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {PRODUCTS.find(p => p.id === productId)?.name || productId}
                </h3>
                {Object.entries(platforms).map(([platform, communities]) => (
                  <div key={platform} style={{ marginBottom: 12 }}>
                    <div className="text-xs font-semibold" style={{ marginBottom: 6, textTransform: 'capitalize' }}>
                      {platform} ({communities.length})
                    </div>
                    <div className="card card-compact" style={{ margin: 0 }}>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Community</th>
                              <th>Members</th>
                              <th>Score</th>
                              <th>Rules</th>
                            </tr>
                          </thead>
                          <tbody>
                            {communities.slice(0, 10).map((c, i) => {
                              const scoreBadge = c.overall_score >= 7 ? 'badge-green' : c.overall_score >= 4 ? 'badge-yellow' : 'badge-muted';
                              const ruleBadge = c.rule_friendliness === 'promotion_friendly' ? 'badge-green'
                                : c.rule_friendliness === 'limited_promotion' ? 'badge-yellow'
                                : c.rule_friendliness === 'no_marketing' ? 'badge-red'
                                : 'badge-muted';
                              return (
                                <tr key={c.id || i}>
                                  <td className="text-sm">
                                    {c.url ? (
                                      <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                                        {c.name}
                                      </a>
                                    ) : c.name}
                                  </td>
                                  <td className="text-sm">{c.subscriber_count?.toLocaleString() ?? '—'}</td>
                                  <td><span className={`badge ${scoreBadge}`}>{c.overall_score}/10</span></td>
                                  <td><span className={`badge ${ruleBadge}`} style={{ fontSize: 10 }}>{(c.rule_friendliness || 'unknown').replace(/_/g, ' ')}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── 12. QA Playtest ───────────────────────────── */}
      {report.qa && (
        <div className="section">
          <div className="section-header">
            <h2>QA Playtest</h2>
            <a href="/qa-playtest" className="btn btn-sm" style={{ textDecoration: 'none', fontSize: 11 }}>View Details</a>
          </div>
          <div className="stats-row">
            <StatBlock
              value={report.qa.passRate != null ? `${(report.qa.passRate * 100).toFixed(0)}%` : '—'}
              label="7-Day Pass Rate"
              color={report.qa.passRate >= 0.9 ? 'var(--green)' : report.qa.passRate >= 0.7 ? 'var(--yellow)' : 'var(--red)'}
            />
            <StatBlock
              value={report.qa.lastNight?.passFail?.toUpperCase() || '—'}
              label="Last Night"
              color={report.qa.lastNight?.passFail === 'pass' ? 'var(--green)' : 'var(--red)'}
            />
            <StatBlock
              value={report.qa.lastNight?.latencyStats ? `${Math.round(report.qa.lastNight.latencyStats.avg)}ms` : '—'}
              label="Avg Latency"
              sub={report.qa.lastNight?.latencyStats ? `max: ${Math.round(report.qa.lastNight.latencyStats.max)}ms` : ''}
            />
            <StatBlock
              value={report.qa.lastNight?.narrativeQuality ?? '—'}
              label="Narrative Quality"
              color={report.qa.lastNight?.narrativeQuality >= 7 ? 'var(--green)' : 'var(--yellow)'}
              sub="/10"
            />
          </div>
          {report.qa.lastNight?.bugs?.length > 0 && (
            <div className="card card-compact" style={{ marginTop: 12 }}>
              <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Bugs Found Last Night
              </div>
              {report.qa.lastNight.bugs.map((bug, i) => (
                <div key={i} className="info-row" style={{ fontSize: 12 }}>
                  <span className={`badge ${bug.severity === 'critical' ? 'badge-red' : bug.severity === 'performance' ? 'badge-blue' : 'badge-yellow'}`} style={{ marginRight: 8 }}>{bug.severity}</span>
                  <span className="info-label">{bug.check}</span>
                  <span className="info-value text-sm">{bug.actual}</span>
                </div>
              ))}
            </div>
          )}
          {report.qa.weekTrend?.length > 0 && (
            <div className="card card-compact" style={{ marginTop: 12 }}>
              <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                7-Day Trend
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {report.qa.weekTrend.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 4, margin: '0 auto 4px',
                      background: d.passFail === 'pass' ? '#059669' : '#dc2626',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 10, fontWeight: 600,
                    }}>
                      {d.passFail === 'pass' ? '✓' : '✗'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{d.date?.slice(5)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 12b. Content Library (Monday only) ──────── */}
      {report.contentLibrary && (
        <div className="section">
          <div className="section-header">
            <h2>Content Library</h2>
            <span className="badge badge-purple" style={{ fontSize: 10 }}>Monday Report</span>
          </div>
          <div className="stats-row">
            <StatBlock value={report.contentLibrary.generatedThisWeek} label="Generated This Week" />
            <StatBlock value={report.contentLibrary.pendingApproval} label="Pending Approval" color="var(--yellow)" />
            <StatBlock value={report.contentLibrary.injected} label="Injected to CS" color="var(--green)" />
            <StatBlock value={report.contentLibrary.totalInLibrary} label="Total in Library" />
          </div>
          {report.contentLibrary.varietyCheck && (
            <div className="card card-compact" style={{ marginTop: 12 }}>
              <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                Variety Check: {report.contentLibrary.varietyCheck.passed ? 'PASSED' : 'NEEDS ATTENTION'}
              </div>
              <div className="text-xs">
                Eras: {report.contentLibrary.varietyCheck.erasUsed?.join(', ') || '—'} |
                Regions: {report.contentLibrary.varietyCheck.regionsUsed?.join(', ') || '—'} |
                Difficulties: {report.contentLibrary.varietyCheck.difficultiesUsed?.join(', ') || '—'}
              </div>
            </div>
          )}
          {report.contentLibrary.scenarios?.length > 0 && (
            <div className="card card-compact" style={{ marginTop: 12 }}>
              <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                This Week&apos;s Scenarios
              </div>
              {report.contentLibrary.scenarios.map((s, i) => (
                <div key={i} className="info-row" style={{ fontSize: 12 }}>
                  <span className={`badge ${s.difficulty === 'easy' ? 'badge-green' : s.difficulty === 'medium' ? 'badge-yellow' : 'badge-red'}`} style={{ marginRight: 6, fontSize: 10 }}>{s.difficulty}</span>
                  <span className="info-label" style={{ flex: 1 }}>{s.title}</span>
                  <span className="text-xs text-muted">{s.era} / {s.region}</span>
                  <span className={`badge ${s.status === 'injected' ? 'badge-green' : s.status === 'pending' ? 'badge-yellow' : 'badge-blue'}`} style={{ marginLeft: 8, fontSize: 10 }}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 13. Infrastructure Health ─────────────────── */}
      <div className="section">
        <div className="section-header">
          <h2>Infrastructure Health</h2>
          <a href="/infrastructure" className="btn btn-sm" style={{ textDecoration: 'none', fontSize: 11 }}>View Details</a>
        </div>

        {(() => {
          const infraServices = infraStatus?.services || [];
          const infraAlerts = infraStatus?.unresolvedAlerts ?? (health?.unresolvedAlerts?.length ?? infraHealth.unresolvedAlerts ?? 0);
          const infraOverall = infraStatus?.overall || 'unknown';
          const overallColor = infraOverall === 'healthy' ? 'var(--green)' : infraOverall === 'warning' ? 'var(--yellow)' : infraOverall === 'critical' ? 'var(--red)' : 'var(--text-muted)';

          return (
            <>
              <div className="stats-row">
                <StatBlock
                  value={infraOverall.charAt(0).toUpperCase() + infraOverall.slice(1)}
                  label="Overall Status"
                  color={overallColor}
                />
                <StatBlock value={infraServices.length || '—'} label="Services" />
                <StatBlock
                  value={infraAlerts}
                  label="Active Alerts"
                  color={infraAlerts > 0 ? 'var(--red)' : 'var(--green)'}
                />
                <StatBlock
                  value={health?.criticalAlerts ?? infraHealth.criticalAlerts ?? 0}
                  label="Critical"
                  color="var(--red)"
                />
              </div>

              {infraServices.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 12 }}>
                  {infraServices.map(svc => {
                    const dotColor = svc.status === 'healthy' ? 'var(--green)'
                      : svc.status === 'warning' ? 'var(--yellow)'
                      : svc.status === 'critical' || svc.status === 'error' ? 'var(--red)'
                      : 'var(--text-muted)';
                    return (
                      <div key={svc.service} className="card card-compact" style={{ margin: 0, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                          background: dotColor, flexShrink: 0,
                          boxShadow: svc.status === 'critical' ? `0 0 6px ${dotColor}` : undefined,
                        }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="text-sm font-semibold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{svc.service}</div>
                          <div className="text-xs text-muted">{svc.response_time_ms != null ? `${svc.response_time_ms}ms` : svc.status}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {health?.unresolvedAlerts?.length > 0 && (
                <div className="card card-compact" style={{ marginTop: 12 }}>
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
            </>
          );
        })()}
      </div>

      {/* ── 14. Lifecycle & Inbox ─────────────────────── */}
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
      {/* ── Growth: Satellite Blogs & Vertical Tools ── */}
      <div className="section">
        <div className="section-header"><h2>Growth Engine</h2></div>
        <div className="grid-2">
          {/* Satellite Blogs */}
          <div className="card card-compact">
            <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Satellite Blog Network
            </div>
            {(() => {
              const sat = report.growth?.satelliteBlogs || satelliteBlogData?.stats;
              if (!sat) return <div className="text-sm text-muted">No satellite blog data</div>;
              return (
                <>
                  <div className="stats-row" style={{ marginBottom: 12 }}>
                    <StatBlock value={sat.activeCount ?? sat.activeBlogs ?? 0} label="Active Blogs" color="var(--accent)" />
                    <StatBlock value={sat.todayPosts ?? 0} label="Posts Today" />
                    <StatBlock value={sat.totalPosts ?? 0} label="Total Posts" />
                    <StatBlock value={sat.totalBacklinks ?? 0} label="Total Backlinks" color="var(--green)" />
                  </div>
                  {sat.linkTypeDistribution && Object.keys(sat.linkTypeDistribution).length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {Object.entries(sat.linkTypeDistribution).map(([type, count]) => (
                        <span key={type} className="badge badge-muted" style={{ fontSize: 10 }}>
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                  {satelliteBlogData?.blogs?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      {satelliteBlogData.blogs.map(blog => (
                        <div key={blog.id} className="info-row">
                          <span className="info-label" style={{ fontSize: 12 }}>
                            {blog.name} <span className="text-xs text-muted">({blog.domain})</span>
                          </span>
                          <span className="info-value" style={{ fontSize: 12 }}>
                            {blog.posts_generated || 0} posts / {blog.backlinks_created || 0} links
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Vertical Tools */}
          <div className="card card-compact">
            <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Vertical Tools
            </div>
            {(() => {
              const vt = report.growth?.verticalTools || verticalToolData?.stats;
              if (!vt) return <div className="text-sm text-muted">No vertical tool data</div>;
              return (
                <>
                  <div className="stats-row" style={{ marginBottom: 12 }}>
                    <StatBlock value={vt.activeCount ?? vt.activeTools ?? 0} label="Active Tools" color="var(--accent)" />
                    <StatBlock value={vt.totalVisits ?? 0} label="Total Visits" />
                    <StatBlock value={vt.totalConversions ?? 0} label="Conversions" color="var(--green)" />
                    <StatBlock value={vt.conversionRate != null ? `${vt.conversionRate}%` : (vt.overallConversionRate != null ? `${vt.overallConversionRate}%` : '—')} label="Conv. Rate" />
                  </div>
                  <div className="info-row">
                    <span className="info-label">Discount Codes Generated</span>
                    <span className="info-value">{vt.totalDiscountCodes ?? 0}</span>
                  </div>
                  {verticalToolData?.tools?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {verticalToolData.tools.map(tool => (
                        <div key={tool.id} className="info-row">
                          <span className="info-label" style={{ fontSize: 12 }}>
                            {tool.name} <span className="text-xs text-muted">({tool.tool_type})</span>
                          </span>
                          <span className="info-value" style={{ fontSize: 12 }}>
                            {tool.visits || 0} visits / {tool.conversions || 0} conv.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Ad Creatives ─────────────────────────── */}
      <div className="section">
        <div className="section-header"><h2>Ad Creatives</h2></div>
        <div className="stat-row">
          <StatBlock label="This Week" value={report.adCreatives?.thisWeek ?? adCreativeStats?.total ?? 0} />
          <StatBlock label="Pending Approval" value={report.adCreatives?.pendingApproval ?? adCreativeStats?.byStatus?.pending ?? 0} color="#d97706" />
          <StatBlock label="Compliance Flags" value={report.adCreatives?.complianceFlags ?? adCreativeStats?.complianceFlags ?? 0} color={report.adCreatives?.complianceFlags > 0 || (adCreativeStats?.complianceFlags || 0) > 0 ? '#dc2626' : undefined} />
        </div>
        {(() => {
          const byProduct = report.adCreatives?.byProduct || adCreativeStats?.byProduct || {};
          const byPlatform = report.adCreatives?.byPlatform || adCreativeStats?.byPlatform || {};
          return (Object.keys(byProduct).length > 0 || Object.keys(byPlatform).length > 0) ? (
            <div className="grid-2" style={{ marginTop: 12 }}>
              {Object.keys(byProduct).length > 0 && (
                <div className="card card-compact">
                  <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                    By Product
                  </div>
                  {Object.entries(byProduct).map(([p, count]) => (
                    <div key={p} className="info-row">
                      <span className="info-label">{p}</span>
                      <span className="info-value">{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {Object.keys(byPlatform).length > 0 && (
                <div className="card card-compact">
                  <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                    By Platform
                  </div>
                  {Object.entries(byPlatform).map(([p, count]) => (
                    <div key={p} className="info-row">
                      <span className="info-label">{p}</span>
                      <span className="info-value">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null;
        })()}
      </div>
    </>
  );
}
