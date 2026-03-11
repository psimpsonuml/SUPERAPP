'use client';

import { useState, useEffect } from 'react';
import { fetchLegalDocument, generateLegalDocument, publishLegalDocument, updateLegalDocument, fetchLegalVersions } from '../../lib/api';

export default function PrivacyPolicyPage() {
  const [doc, setDoc] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [docRes, versRes] = await Promise.all([
        fetchLegalDocument('privacy_policy'),
        fetchLegalVersions('privacy_policy'),
      ]);
      setDoc(docRes.document);
      setVersions(versRes.versions || []);
      if (docRes.document) setEditContent(docRes.document.content_markdown);
    } catch {} finally { setLoading(false); }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateLegalDocument('privacy_policy');
      setDoc(result.document);
      setEditContent(result.document.content_markdown);
      load();
    } catch (err) { alert(err.message); }
    finally { setGenerating(false); }
  }

  async function handlePublish() {
    if (!doc) return;
    try {
      await publishLegalDocument(doc.id);
      load();
    } catch (err) { alert(err.message); }
  }

  async function handleSave() {
    if (!doc) return;
    try {
      await updateLegalDocument(doc.id, editContent);
      setEditing(false);
      load();
    } catch (err) { alert(err.message); }
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading privacy policy...</div>;

  return (
    <>
      <div className="page-header">
        <h1>Privacy Policy</h1>
        <p>Data handling, storage, and user rights documentation</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating...' : doc ? 'Generate New Version' : 'Generate Draft'}
        </button>
        {doc && !doc.published_at && (
          <button className="btn btn-approve" onClick={handlePublish}>Publish</button>
        )}
        {doc && (
          <button className="btn" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancel Edit' : 'Edit'}
          </button>
        )}
        {editing && <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>}
      </div>

      {doc && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <span className="font-mono text-sm">Version {doc.version}</span>
            <span className={`badge ${doc.published_at ? 'badge-green' : 'badge-yellow'}`}>
              {doc.published_at ? 'Published' : 'Draft'}
            </span>
            {doc.published_at && (
              <span className="text-xs text-muted">
                Published {new Date(doc.published_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {editing ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          style={{ minHeight: 600, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7 }}
        />
      ) : doc ? (
        <div className="card" style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>{doc.content_markdown}</div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-message">No privacy policy yet</div>
          <div className="empty-state-hint">Click "Generate Draft" to create one from your system architecture</div>
        </div>
      )}

      {versions.length > 1 && (
        <div className="section" style={{ marginTop: 24 }}>
          <div className="section-header"><h2>Version History</h2></div>
          {versions.map((v) => (
            <div key={v.id} className="info-row">
              <span className="info-label">Version {v.version}</span>
              <span className="info-value">
                {v.published_at ? `Published ${new Date(v.published_at).toLocaleDateString()}` : 'Draft'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
