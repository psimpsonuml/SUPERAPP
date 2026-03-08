'use client';
import { useState, useEffect } from 'react';
import { fetchFinanceSnapshot } from '../../../lib/api';

export default function FinancePage() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinanceSnapshot().then((r) => setSnapshot(r.snapshot)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Finance Snapshot</h1>
        <p>Read-only Budgeting Beacon integration</p>
      </div>
      {loading ? <div className="loading"><div className="spinner" /></div> : !snapshot ? (
        <div className="card"><div className="empty-state">
          <p>No finance data available.</p>
          <p className="text-muted text-sm" style={{ marginTop: 8 }}>Connect Budgeting Beacon to see your finance snapshot here.</p>
        </div></div>
      ) : (
        <>
          <div className="stats-row">
            {snapshot.income != null && (
              <div className="stat-card">
                <div className="stat-label">Income</div>
                <div className="stat-value" style={{ color: 'var(--green)' }}>${Number(snapshot.income).toLocaleString()}</div>
              </div>
            )}
            {snapshot.expenses != null && (
              <div className="stat-card">
                <div className="stat-label">Expenses</div>
                <div className="stat-value" style={{ color: 'var(--red)' }}>${Number(snapshot.expenses).toLocaleString()}</div>
              </div>
            )}
            {snapshot.savings != null && (
              <div className="stat-card">
                <div className="stat-label">Savings</div>
                <div className="stat-value" style={{ color: 'var(--accent)' }}>${Number(snapshot.savings).toLocaleString()}</div>
              </div>
            )}
            {snapshot.net_worth != null && (
              <div className="stat-card">
                <div className="stat-label">Net Worth</div>
                <div className="stat-value">${Number(snapshot.net_worth).toLocaleString()}</div>
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-header"><h2>Snapshot Details</h2></div>
            <div style={{ padding: 16 }}>
              <p className="text-sm text-muted">Snapshot date: {snapshot.snapshot_date ? new Date(snapshot.snapshot_date).toLocaleDateString() : '—'}</p>
              {snapshot.categories && typeof snapshot.categories === 'object' && (
                <div style={{ marginTop: 16 }}>
                  <h3 className="text-sm font-semibold" style={{ marginBottom: 8 }}>Spending by Category</h3>
                  {Object.entries(snapshot.categories).map(([cat, amount]) => (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span className="text-sm">{cat}</span>
                      <span className="text-sm font-semibold">${Number(amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
