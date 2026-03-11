'use client';

export default function AboutPage() {
  return (
    <>
      <div className="page-header">
        <h1>About BeaconOps</h1>
        <p>The autonomous operating system for founders</p>
      </div>

      {/* Origin Story */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--accent-hover)' }}>
          The Origin Story
        </h2>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p style={{ marginBottom: 12 }}>
            A solo founder running three products needed a marketing team but couldn't afford one.
            So he built an AI agent system that does it all — content creation, outreach, community marketing,
            QA testing, and personal life management — all from a single dashboard.
          </p>
          <p style={{ marginBottom: 12 }}>
            He ran it on his own products for months. ChronoStates.io, Payroll Beacon, and Budgeting Beacon
            all grew with zero manual marketing effort. Every feature was battle-tested on real businesses
            before being shared with anyone else.
          </p>
          <p>
            That system became BeaconOps.
          </p>
        </div>
      </div>

      {/* What Makes It Different */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
          What Makes BeaconOps Different
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { title: 'Not another AI writing tool', desc: 'A full autonomous operating system. 29 agents handle content, outreach, community, QA, intelligence, and personal life.' },
            { title: 'Business + Personal in one platform', desc: 'Nobody else combines business operations with personal intelligence — entertainment ranking, health tracking, life management, and more.' },
            { title: 'Built for personal use first', desc: 'Every feature proven on real products before sold. This isn\'t vaporware — it\'s a system that runs live businesses right now.' },
            { title: 'You control your costs', desc: 'Bring your own API keys. Choose your AI providers. No markup on model costs. Your data stays yours. Period.' },
          ].map((item) => (
            <div key={item.title} className="info-block">
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Philosophy */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>The Philosophy</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Build for yourself, architect for everyone.',
            'AI should run the machine so you can focus on the craft.',
            'Your data is yours. Period.',
          ].map((line) => (
            <div key={line} style={{
              padding: '10px 14px',
              background: 'var(--accent-muted)',
              border: '1px solid var(--border-accent)',
              borderRadius: 'var(--radius)',
              fontSize: 14,
              fontWeight: 500,
              fontStyle: 'italic',
            }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Founder */}
      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>About the Founder</h2>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 8 }}>
            <strong style={{ color: 'var(--text)' }}>Patrick Simpson</strong> — 15+ years payroll compliance expertise,
            investigative journalism background, and author of the Chronoverse series.
          </p>
          <div className="tag-list" style={{ marginTop: 12 }}>
            {['ChronoStates.io', 'Payroll Beacon', 'Budgeting Beacon', 'Author', 'AI Power User', 'Solo Founder'].map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Internal note */}
      <div style={{ marginTop: 32, padding: 14, borderRadius: 'var(--radius)', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
        Built by Patrick Simpson as a personal operating system for running multiple businesses and organizing life.
        Started as a tool to manage ChronoStates.io, Payroll Beacon, and Budgeting Beacon — grew into something much bigger.
      </div>
    </>
  );
}
