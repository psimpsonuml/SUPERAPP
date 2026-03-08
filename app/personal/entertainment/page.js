'use client';

import { useState, useEffect } from 'react';
import { fetchEntertainmentRatings, rateEntertainment, fetchCascadeScores } from '../../../lib/api';
import { CASCADE_WEIGHTS } from '../../../lib/constants';

export default function EntertainmentPage() {
  const [tab, setTab] = useState('rate');
  const [ratings, setRatings] = useState([]);
  const [cascade, setCascade] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [itemType, setItemType] = useState('movie');
  const [score, setScore] = useState(7);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        fetchEntertainmentRatings(),
        fetchCascadeScores(),
      ]);
      if (results[0].status === 'fulfilled') setRatings(results[0].value.ratings || []);
      if (results[1].status === 'fulfilled') setCascade(results[1].value.scores || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleRate(e) {
    e.preventDefault();
    if (!title) return;
    setSubmitting(true);
    try {
      await rateEntertainment({ title, year: year ? parseInt(year) : undefined, item_type: itemType, score });
      setTitle(''); setYear('');
      const { ratings: r } = await fetchEntertainmentRatings();
      setRatings(r || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const weights = CASCADE_WEIGHTS[itemType === 'wrestling_match' ? 'wrestling' : itemType] || CASCADE_WEIGHTS.movie;

  return (
    <>
      <div className="page-header">
        <h1>Entertainment Ranker</h1>
        <p>Rate movies, TV, and wrestling. Cascade scoring reveals your true favorites.</p>
      </div>

      <div className="tabs">
        {['rate', 'ratings', 'cascade', 'weights'].map((t) => (
          <button key={t} className={`tab${tab === t ? ' tab-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'rate' ? 'Rate' : t === 'ratings' ? 'My Ratings' : t === 'cascade' ? 'Cascade Scores' : 'Weights'}
          </button>
        ))}
      </div>

      {tab === 'rate' && (
        <div className="card">
          <div className="card-header"><h2>Rate Something</h2></div>
          <form onSubmit={handleRate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px', gap: 10, marginBottom: 16 }}>
              <input type="text" placeholder="Title (e.g. The Dark Knight)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input type="text" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
              <select value={itemType} onChange={(e) => setItemType(e.target.value)}>
                <option value="movie">Movie</option>
                <option value="tv">TV Show</option>
                <option value="wrestling_match">Wrestling</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <input type="range" min="1" max="10" value={score} onChange={(e) => setScore(Number(e.target.value))} style={{ flex: 1 }} className="slider-input" />
              <div style={{ fontSize: 28, fontWeight: 800, minWidth: 40, textAlign: 'center', color: score >= 8 ? 'var(--green)' : score >= 5 ? 'var(--yellow)' : 'var(--red)' }}>
                {score}
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting || !title}>
              {submitting ? 'Saving...' : 'Save Rating'}
            </button>
          </form>
        </div>
      )}

      {tab === 'ratings' && (
        <div className="card card-compact">
          {loading ? <div className="loading"><div className="spinner" />Loading...</div> : ratings.length === 0 ? (
            <div className="empty-state">No ratings yet. Start rating to build your profile.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Title</th><th>Type</th><th>Year</th><th>Score</th><th>Rated</th></tr></thead>
                <tbody>
                  {ratings.map((r, i) => {
                    const item = r.entertainment_items || {};
                    return (
                      <tr key={r.id || i}>
                        <td className="font-semibold text-sm">{item.title || '—'}</td>
                        <td><span className="badge badge-purple">{item.item_type}</span></td>
                        <td className="text-sm text-muted">{item.year || '—'}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: r.score >= 8 ? 'var(--green)' : r.score >= 5 ? 'var(--yellow)' : 'var(--red)' }}>
                            {r.score}/10
                          </span>
                        </td>
                        <td className="text-sm text-muted">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'cascade' && (
        <div className="card card-compact">
          {cascade.length === 0 ? (
            <div className="empty-state">
              <p>No cascade scores yet.</p>
              <p className="text-xs text-muted mt-2">Rate movies and TV to generate cascade scores for directors, actors, writers, and more.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Person</th><th>Role</th><th>Composite Score</th><th>Ratings Count</th></tr></thead>
                <tbody>
                  {cascade.map((c, i) => (
                    <tr key={c.id || i}>
                      <td className="font-semibold text-sm">{c.person_name}</td>
                      <td><span className="badge badge-blue">{c.primary_role}</span></td>
                      <td>
                        <span style={{ fontWeight: 700, color: c.composite_score >= 7 ? 'var(--green)' : c.composite_score >= 4 ? 'var(--yellow)' : 'var(--red)' }}>
                          {c.composite_score?.toFixed(1)}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{c.ratings_count || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'weights' && (
        <div className="grid-2">
          {Object.entries(CASCADE_WEIGHTS).map(([type, roles]) => (
            <div key={type} className="card card-compact">
              <div className="card-header"><h2 style={{ textTransform: 'capitalize' }}>{type}</h2></div>
              {Object.entries(roles).map(([role, { weight, label }]) => (
                <div key={role} className="info-row">
                  <span className="info-label">{label}</span>
                  <span className="info-value">
                    {(weight * 100).toFixed(0)}%
                    <div className="progress-track" style={{ width: 80, display: 'inline-block', marginLeft: 8, verticalAlign: 'middle' }}>
                      <div className="progress-fill" style={{ width: `${weight * 100}%`, background: 'var(--accent)' }} />
                    </div>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
