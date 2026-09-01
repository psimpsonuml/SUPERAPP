'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchGrowthDashboard } from '../../lib/api';

function StatCard({ label, value, sub, href, tone }) {
  const body = (
    <div className="card" style={{
      borderLeft: tone ? `3px solid ${tone}` : undefined,
      height: '100%',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      <div className="text-sm" style={{ marginTop: 4 }}>{label}</div>
      {sub && <div className="text-xs text-muted" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link> : body;
}

function money(n) {
  const v = Number(n) || 0;
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;
}

export default function GrowthDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGrowthDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" />Loading growth dashboard...</div>;

  if (error) {
    return (
      <>
        <div className="page-header"><h1>Payroll Beacon Growth</h1></div>
        <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
          <strong>Could not load the dashboard.</strong>
          <div className="text-sm text-muted" style={{ marginTop: 4 }}>{error}</div>
        </div>
      </>
    );
  }

  const net = data.net_growth_system_cost;

  return (
    <>
      <div className="page-header">
        <h1>Payroll Beacon Growth</h1>
        <p>What needs approval, what is scheduled, who to contact, and what it costs.</p>
      </div>

      {/* Anything that failed to load is stated, not shown as a clean zero */}
      {data.degraded && (
        <div className="card" style={{ borderLeft: '3px solid var(--yellow)', marginBottom: 16 }}>
          <strong>Partial data.</strong>
          <div className="text-sm text-muted" style={{ marginTop: 4 }}>
            {data.degraded.length} section(s) failed to load — the numbers below are incomplete.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard
          label="Awaiting approval"
          value={data.content_awaiting_approval}
          sub={data.manual_posting_required > 0 ? `${data.manual_posting_required} need manual posting` : null}
          href="/growth/content"
          tone={data.content_awaiting_approval > 0 ? 'var(--accent)' : undefined}
        />
        <StatCard label="Scheduled this week" value={data.scheduled_this_week} href="/growth/calendar" />
        <StatCard label="Priority prospects" value={data.priority_prospects} href="/growth/prospects" />
        <StatCard
          label="Follow-ups due"
          value={data.followups_due}
          href="/growth/outreach"
          tone={data.followups_due > 0 ? 'var(--yellow)' : undefined}
        />
        <StatCard label="Positive replies" value={data.positive_replies_month} sub="this month" />
        <StatCard label="Registrations" value={data.registrations_from_growth} sub="attributed to growth" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, marginTop: 0 }}>Cost</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span className="text-sm text-muted">Today</span><span>{money(data.costs?.today)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span className="text-sm text-muted">This week</span><span>{money(data.costs?.week)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span className="text-sm text-muted">This month</span><span>{money(data.estimated_monthly_cost)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <span className="text-sm text-muted">Avoided cost</span>
            <span style={{ color: 'var(--green)' }}>−{money(data.estimated_monthly_savings)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 700 }}>
            <span>Net</span>
            <span style={{ color: net <= 0 ? 'var(--green)' : 'var(--text)' }}>{money(net)}</span>
          </div>
          <p className="text-xs text-muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Cost is a local estimate from token counts, not billing data.
          </p>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, marginTop: 0 }}>Prospect funnel</h3>
          {Object.keys(data.funnel?.byStatus || {}).length === 0 ? (
            <div className="text-sm text-muted">No prospects imported yet.</div>
          ) : Object.entries(data.funnel.byStatus)
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span className="text-sm text-muted" style={{ textTransform: 'capitalize' }}>
                  {status.replace(/_/g, ' ')}
                </span>
                <span className="text-sm">{count}</span>
              </div>
            ))}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, marginTop: 0 }}>Warnings</h3>
          {(data.warnings || []).length === 0 ? (
            <div className="text-sm text-muted">Nothing flagged.</div>
          ) : data.warnings.map((w, i) => (
            <div key={i} className="text-sm" style={{ padding: '4px 0' }}>{w.message}</div>
          ))}
        </div>
      </div>
    </>
  );
}
