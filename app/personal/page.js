'use client';

import Link from 'next/link';
import { PERSONAL_MODULES } from '../../lib/constants';

function ModuleIcon({ d }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

      <div className="module-grid">
        {PERSONAL_MODULES.map((mod) => (
          <Link key={mod.id} href={mod.href} className="module-card">
            <div className="module-card-icon">
              <ModuleIcon d={mod.icon} />
            </div>
            <h3>{mod.name}</h3>
            <p>{mod.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
