'use client';
import { useState } from 'react';

export default function DnaPage() {
  const [tab, setTab] = useState('overview');

  return (
    <>
      <div className="page-header">
        <h1>DNA Analyst</h1>
        <p>23andMe integration and public genetics atlas</p>
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {['overview', 'traits', 'ancestry', 'health'].map((t) => (
          <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card">
          <div className="empty-state">
            <p>DNA analysis not yet configured.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>Upload your 23andMe raw data export to begin analysis. The DNA Analyst agent will cross-reference your genetics with the public atlas for trait predictions, ancestry composition, and health risk markers.</p>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" disabled>Upload Raw Data (Coming Soon)</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'traits' && (
        <div className="card">
          <div className="card-header"><h2>Genetic Traits</h2></div>
          <div className="empty-state">
            <p>No trait data available.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>Trait analysis will appear here after raw data upload.</p>
          </div>
        </div>
      )}

      {tab === 'ancestry' && (
        <div className="card">
          <div className="card-header"><h2>Ancestry Composition</h2></div>
          <div className="empty-state">
            <p>No ancestry data available.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>Ancestry breakdown will appear here after raw data upload.</p>
          </div>
        </div>
      )}

      {tab === 'health' && (
        <div className="card">
          <div className="card-header"><h2>Health Markers</h2></div>
          <div className="empty-state">
            <p>No health marker data available.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>Health risk analysis will appear here after raw data upload.</p>
          </div>
        </div>
      )}
    </>
  );
}
