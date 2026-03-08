'use client';

import Link from 'next/link';
import { PERSONAL_MODULES } from '../../lib/constants';

function NavIcon({ d }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function PersonalDashboard() {
  return (
    <>
      <div className="page-header">
        <h1>Personal Intelligence</h1>
        <p>Entertainment tracking, life management, self-knowledge, and personal analytics</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {PERSONAL_MODULES.map((mod) => (
          <Link key={mod.id} href={mod.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card card-compact" style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--accent-muted)', color: 'var(--accent-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <NavIcon d={mod.icon} />
                </div>
                <div>
                  <div className="font-semibold text-sm">{mod.name}</div>
                  <div className="text-xs text-muted mt-1">{mod.desc}</div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
