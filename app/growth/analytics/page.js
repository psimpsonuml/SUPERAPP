'use client';

import { useState, useEffect } from 'react';
import { fetchGrowthAnalytics } from '../../../lib/api';

// A null ratio means "no denominator", which is not the same as 0%.
function Ratio({ label, value, suffix = '%', note }) {
  const missing = value === null || value === undefined;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0' }}>
      <span className="text-sm text-muted">{label}</span>
      <span style={{ fontWeight: missing ? 400 : 700, color: missing ? 'var(--text-muted)' : 'inherit' }}>
        {missing ? (note || 'no data yet') : `${value}${suffix}`}
      </span>
    </div>
  );
}

function FunnelRow({ label, value, of, dim }) {
  const pct = of && of > 0 ? Math.round((value / of) * 100) : null;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: dim ? 'var(--text-muted)' : 'inherit' }}>{label}</span>
        <span>
          <strong>{value === null ? '—' : value}</strong>
          {pct !== null && <span className="text-xs text-muted"> ({pct}%)</span>}
        </span>
      </div>
      {of > 0 && value !== null && (
        <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, marginTop: 3 }}>
          <div style={{ width: `${Math.min((value / of) * 100, 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}

const VERDICT_TONE = {
  likely_targeting_or_message_problem: 'var(--red)',
  potentially_viable: 'var(--yellow)',
  strong_enough_to_scale: 'var(--green)',
};

export default function GrowthAnalyticsPage() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchGrowthAnalytics(days)
      .then(d => { setData(d); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="loading"><div className="spinner" />Loading analytics...</div>;

  if (error) {
    return (
      <>
        <div className="page-header"><h1>Growth Analytics</h1></div>
        <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
          <strong>Could not load analytics.</strong>
          <div className="text-sm text-muted" style={{ marginTop: 4 }}>{error}</div>
        </div>
      </>
    );
  }

  const c = data?.content;
  const o = data?.outbound;
  const r = data?.ratios;
  const d = data?.diagnostic;

  return (
    <>
      <div className="page-header">
        <h1>Growth Analytics</h1>
        <p>Funnel, ratios, and the campaign read. Empty denominators show as “no data yet”, not zero.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[7, 30, 90].map(n => (
          <button key={n} className={`btn${days === n ? ' btn-primary' : ''}`} onClick={() => setDays(n)}>
            {n} days
          </button>
        ))}
      </div>

      {data?.degraded && (
        <div className="card" style={{ borderLeft: '3px solid var(--yellow)', marginBottom: 16 }}>
          <strong>Partial data.</strong>
          <div className="text-sm text-muted" style={{ marginTop: 4 }}>
            {data.degraded.length} section(s) failed to load — figures below are incomplete.
          </div>
        </div>
      )}

      {/* §16 campaign diagnostic */}
      {d && (
        <div className="card" style={{
          marginBottom: 16,
          borderLeft: `3px solid ${d.verdict ? VERDICT_TONE[d.verdict] : 'var(--text-muted)'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>{d.verdict_label}</h3>
              <div className="text-sm text-muted" style={{ marginTop: 4 }}>{d.guidance}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                {d.reply_rate_pct === null ? '—' : `${d.reply_rate_pct}%`}
              </div>
              <div className="text-xs text-muted">reply rate</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
            <span className="text-sm"><strong>{d.contacted}</strong> contacted</span>
            <span className="text-sm"><strong>{d.emails_sent}</strong> emails sent</span>
            <span className="text-sm"><strong>{d.replies}</strong> replies</span>
            <span className="text-sm text-muted">
              {d.until_next_review} until the next {d.cohort_size}-prospect review
            </span>
          </div>

          <p className="text-xs text-muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {d.disclaimer}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Content funnel */}
        <div className="card">
          <h3 style={{ fontSize: 14, marginTop: 0 }}>Content funnel</h3>
          {c ? (
            <>
              <FunnelRow label="Generated" value={c.generated} of={c.generated} />
              <FunnelRow label="Approved" value={c.approved} of={c.generated} />
              <FunnelRow label="Published" value={c.published} of={c.generated} />
              <FunnelRow label="Impressions" value={null} dim />
              <div className="text-xs text-muted" style={{ marginTop: -2, marginBottom: 6 }}>
                {c.impressions_note}
              </div>
              <FunnelRow label="Clicks" value={c.clicks} of={c.published} />
              <FunnelRow label="Registrations" value={c.registrations} of={c.clicks} />
              <FunnelRow label="Conversions" value={c.conversions} of={c.registrations} />
              {(c.rejected > 0 || c.failed > 0) && (
                <div className="text-sm" style={{ marginTop: 8, color: 'var(--yellow)' }}>
                  {c.rejected} rejected · {c.failed} failed
                </div>
              )}
            </>
          ) : <div className="text-sm text-muted">Unavailable.</div>}
        </div>

        {/* Outbound funnel */}
        <div className="card">
          <h3 style={{ fontSize: 14, marginTop: 0 }}>Outbound funnel</h3>
          {o ? (
            <>
              <FunnelRow label="Prospects found" value={o.prospects_found} of={o.prospects_total} />
              <FunnelRow label="Qualified" value={o.qualified} of={o.prospects_total} />
              <FunnelRow label="Priority" value={o.priority} of={o.prospects_total} />
              <FunnelRow label="Emails sent" value={o.emails_sent} of={o.priority} />
              <FunnelRow label="Replies" value={o.replies} of={o.emails_sent} />
              <FunnelRow label="Positive replies" value={o.positive_replies} of={o.emails_sent} />
              <FunnelRow label="Meetings" value={o.meetings} of={o.positive_replies} />
              <FunnelRow label="Customers" value={o.customers} of={o.meetings} />

              {o.priority_without_email > 0 && (
                <div className="text-sm" style={{ marginTop: 10, color: 'var(--yellow)' }}>
                  {o.priority_without_email} priority prospect(s) have no email address and
                  cannot be contacted.
                </div>
              )}
            </>
          ) : <div className="text-sm text-muted">Unavailable.</div>}
        </div>

        {/* Ratios */}
        <div className="card">
          <h3 style={{ fontSize: 14, marginTop: 0 }}>Key ratios</h3>
          {r ? (
            <>
              <Ratio label="Qualification rate" value={r.qualification_rate} />
              <Ratio label="Reply rate" value={r.reply_rate} />
              <Ratio label="Positive reply rate" value={r.positive_reply_rate} />
              <Ratio label="Registration rate" value={r.registration_rate} />
              <Ratio label="Lead to customer" value={r.lead_to_customer_rate} />
              <Ratio label="Cost per registration" value={r.cost_per_registration} suffix="" note="no registrations yet" />
              <Ratio label="CAC" value={r.cac} suffix="" note="no customers yet" />
              <p className="text-xs text-muted" style={{ marginTop: 10, marginBottom: 0 }}>
                {r.basis_note}
              </p>
            </>
          ) : <div className="text-sm text-muted">Unavailable.</div>}
        </div>
      </div>

      {/* Segments */}
      {(data?.segments || []).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, marginTop: 0 }}>Segment performance</h3>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>
                <th style={{ padding: '4px 0' }}>Dimension</th>
                <th>Segment</th>
                <th style={{ textAlign: 'right' }}>Contacted</th>
                <th style={{ textAlign: 'right' }}>Positive</th>
                <th style={{ textAlign: 'right' }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.segments.slice(0, 15).map((s, i) => (
                <tr key={i} style={{ opacity: s.sufficient_sample ? 1 : 0.5 }}>
                  <td style={{ padding: '4px 0' }} className="text-muted">{s.dimension}</td>
                  <td>{s.segment}</td>
                  <td style={{ textAlign: 'right' }}>{s.contacted}</td>
                  <td style={{ textAlign: 'right' }}>{s.positive}</td>
                  <td style={{ textAlign: 'right' }}>
                    {s.positive_rate === null ? '—' : `${s.positive_rate}%`}
                    {!s.sufficient_sample && (
                      <span className="text-xs text-muted" title="Fewer than 5 contacted — not a finding"> ⚠</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Dimmed rows have fewer than 5 contacted prospects — those rates are noise.
          </p>
        </div>
      )}
    </>
  );
}
