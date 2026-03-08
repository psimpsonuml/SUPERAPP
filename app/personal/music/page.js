'use client';
import { useState, useEffect } from 'react';
import { fetchMusic } from '../../../lib/api';

export default function MusicPage() {
  const [music, setMusic] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMusic().then((r) => setMusic(r.music || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Music Discovery</h1>
        <p>Spotify integration and artist cascade scoring</p>
      </div>
      <div className="card card-compact">
        {loading ? <div className="loading"><div className="spinner" /></div> : music.length === 0 ? (
          <div className="empty-state">
            <p>No music tracked yet.</p>
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>The Music Discovery agent will populate this when connected to Spotify.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Artist</th><th>Album</th><th>Score</th><th>Added</th></tr></thead>
              <tbody>
                {music.map((m, i) => (
                  <tr key={m.id || i}>
                    <td className="font-semibold text-sm">{m.title}</td>
                    <td className="text-sm">{m.artist || '—'}</td>
                    <td className="text-sm text-muted">{m.album || '—'}</td>
                    <td className="font-semibold" style={{ color: (m.music_ratings?.[0]?.score || 0) >= 8 ? 'var(--green)' : (m.music_ratings?.[0]?.score || 0) >= 5 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                      {m.music_ratings?.[0]?.score || '—'}
                    </td>
                    <td className="text-sm text-muted">{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
