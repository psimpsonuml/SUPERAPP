'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchGrowthOutreach, rewriteGrowthOutreach, markGrowthOutreachSent,
  skipGrowthOutreach, recordProspectOutcome, snoozeProspect,
} from '../../../lib/api';

const OUTCOMES = [
  { key: 'positive', label: 'Positive', tone: 'var(--green)' },
  { key: 'replied', label: 'Replied', tone: 'var(--accent)' },
  { key: 'meeting', label: 'Meeting', tone: 'var(--green)' },
  { key: 'negative', label: 'Negative', tone: 'var(--red)' },
  { key: 'disqualified', label: 'Disqualify', tone: 'var(--text-muted)' },
  { key: 'do_not_contact', label: 'Do Not Contact', tone: 'var(--red)' },
];

function bandChip(band) {
  const tone = band === 'priority' ? 'var(--green)'
    : band === 'good' ? 'var(--accent)'
    : band === 'maybe' ? 'var(--yellow)' : 'var(--text-muted)';
  return (
    <span style={{
      background: `${tone}22`, color: tone, padding: '1px 6px',
      borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    }}>{band}</span>
  );
}

function CapacityBar({ label, cap }) {
  if (!cap) return null;
  const pct = cap.cap > 0 ? Math.min((cap.used / cap.cap) * 100, 100) : 0;
  const full = cap.remaining === 0;
  return (
    <div style={{ flex: 1, minWidth: 180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span className="text-muted">{label}</span>
        <span style={{ color: full ? 'var(--yellow)' : 'inherit' }}>
          {cap.used} / {cap.cap}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: full ? 'var(--yellow)' : 'var(--accent)',
        }} />
      </div>
    </div>
  );
}

export default function GrowthOutreachPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchGrowthOutreach());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(id, fn, ...args) {
    setBusy(id);
    setError(null);
    try {
      await fn(...args);
      await load();
    } catch (err) {
      setError(err.message);
    }
    setBusy(null);
  }

  function copy(text, key) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    }).catch(() => setError('Could not copy to clipboard'));
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading outreach queue...</div>;

  const queue = data?.queue || [];

  return (
    <>
      <div className="page-header">
        <h1>Outreach Queue</h1>
        <p>Draft, review, send. LinkedIn messages are prepared for you to send by hand.</p>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '3px solid var(--red)', marginBottom: 16 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Daily capacity — spec §10 */}
      <div className="card" style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <CapacityBar label="Cold emails today" cap={data?.email_capacity} />
        <CapacityBar label="LinkedIn suggestions today" cap={data?.linkedin_capacity} />
        {data?.email_capacity?.remaining === 0 && (
          <div className="text-sm" style={{ color: 'var(--yellow)', alignSelf: 'center' }}>
            Daily cap reached — raise it in settings if that is deliberate.
          </div>
        )}
      </div>

      {data?.blocked_no_email > 0 && (
        <div className="card" style={{ borderLeft: '3px solid var(--yellow)', marginBottom: 16 }}>
          <strong>{data.blocked_no_email} queued item(s) have no email address.</strong>
          <div className="text-sm text-muted" style={{ marginTop: 4 }}>
            These cannot send. Run enrichment to reveal addresses, or contact them on LinkedIn.
          </div>
        </div>
      )}

      {queue.length === 0 ? (
        <div className="card">
          <div className="text-sm text-muted">
            Nothing queued. The outreach assistant drafts on weekday mornings, or you can draft
            manually from a prospect.
          </div>
        </div>
      ) : queue.map(item => {
        const p = item.prospect;
        const isOpen = expanded === item.id;
        const noEmail = item.channel === 'email' && !p.email;

        return (
          <div key={item.id} className="card" style={{
            marginBottom: 12,
            borderLeft: `3px solid ${noEmail ? 'var(--yellow)' : item.requires_manual_send ? 'var(--purple)' : 'var(--accent)'}`,
          }}>
            {/* Row header */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{p.full_name}</strong>
                  {bandChip(p.fit_band)}
                  <span className="text-sm text-muted">{p.payroll_fit_score}/100</span>
                  {item.requires_manual_send && (
                    <span className="badge badge-purple">LinkedIn — manual</span>
                  )}
                  {noEmail && <span className="badge badge-yellow">No email</span>}
                </div>
                <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                  {p.title} · {p.company_name}
                </div>
                {p.fit_reason && (
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>{p.fit_reason}</div>
                )}
              </div>

              <div style={{ textAlign: 'right', minWidth: 140 }}>
                <div className="text-xs text-muted">Next action</div>
                <div className="text-sm">{item.next_action}</div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                  {item.sequence} · touch {item.step_number}
                </div>
              </div>
            </div>

            {/* Message */}
            {item.subject && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <strong>Subject:</strong> {item.subject}
              </div>
            )}
            <div style={{
              marginTop: 8, padding: 10, background: 'var(--bg)', borderRadius: 6,
              fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              maxHeight: isOpen ? 'none' : 120, overflow: 'hidden', position: 'relative',
            }}>
              {item.metadata?.connectionNote && (
                <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div className="text-xs text-muted">Connection note</div>
                  {item.metadata.connectionNote}
                </div>
              )}
              {item.body}
            </div>

            {item.body?.length > 300 && (
              <button className="btn" style={{ marginTop: 6, fontSize: 11, padding: '2px 8px' }}
                onClick={() => setExpanded(isOpen ? null : item.id)}>
                {isOpen ? 'Collapse' : 'Expand'}
              </button>
            )}

            {(item.why_fit.length > 0 || item.risks.length > 0) && isOpen && (
              <div style={{ marginTop: 10, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {item.why_fit.length > 0 && (
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="text-xs text-muted">Why they fit</div>
                    {item.why_fit.map((r, i) => (
                      <div key={i} className="text-sm">· {r}</div>
                    ))}
                  </div>
                )}
                {item.risks.length > 0 && (
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="text-xs text-muted">Risks</div>
                    {item.risks.map((r, i) => (
                      <div key={i} className="text-sm" style={{ color: 'var(--yellow)' }}>· {r}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn" disabled={busy === item.id}
                onClick={() => copy(
                  item.subject ? `${item.subject}\n\n${item.body}` : item.body,
                  `${item.id}-body`
                )}>
                {copied === `${item.id}-body` ? 'Copied' : 'Copy'}
              </button>

              {item.metadata?.connectionNote && (
                <button className="btn" onClick={() => copy(item.metadata.connectionNote, `${item.id}-note`)}>
                  {copied === `${item.id}-note` ? 'Copied' : 'Copy note'}
                </button>
              )}

              {p.email && !item.requires_manual_send && (
                <a className="btn" href={`mailto:${p.email}?subject=${encodeURIComponent(item.subject || '')}&body=${encodeURIComponent(item.body || '')}`}>
                  Open mail
                </a>
              )}

              {p.linkedin_url && (
                <a className="btn" href={p.linkedin_url} target="_blank" rel="noopener noreferrer">
                  Open LinkedIn
                </a>
              )}

              <button className="btn" disabled={busy === item.id}
                onClick={() => act(item.id, rewriteGrowthOutreach, item.id)}>
                Rewrite
              </button>

              <button className="btn btn-approve" disabled={busy === item.id}
                onClick={() => act(item.id, markGrowthOutreachSent, item.id)}>
                Mark sent
              </button>

              <button className="btn" disabled={busy === item.id}
                onClick={() => act(item.id, snoozeProspect, p.id, 30)}>
                Snooze 30d
              </button>

              <button className="btn" disabled={busy === item.id}
                onClick={() => act(item.id, skipGrowthOutreach, item.id, 'Skipped from queue')}>
                Skip
              </button>
            </div>

            {/* Outcome recording */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="text-xs text-muted">Record outcome:</span>
              {OUTCOMES.map(o => (
                <button key={o.key} className="btn" disabled={busy === item.id}
                  style={{ fontSize: 11, padding: '2px 8px', color: o.tone }}
                  onClick={() => act(item.id, recordProspectOutcome, p.id, o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
