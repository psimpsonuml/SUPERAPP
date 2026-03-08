'use client';
import { useState, useEffect } from 'react';
import { fetchBooks, rateBook } from '../../../lib/api';

export default function BooksPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [score, setScore] = useState(7);
  const [status, setStatus] = useState('finished');

  useEffect(() => {
    fetchBooks().then((r) => setBooks(r.books || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleRate(e) {
    e.preventDefault();
    if (!title) return;
    try {
      await rateBook({ title, author, score, status });
      setTitle(''); setAuthor('');
      const { books: b } = await fetchBooks();
      setBooks(b || []);
    } catch (err) { alert(err.message); }
  }

  return (
    <>
      <div className="page-header">
        <h1>Book Ranker</h1>
        <p>Rate books and build cascade scores for your favorite authors</p>
      </div>
      <div className="card">
        <div className="card-header"><h2>Rate a Book</h2></div>
        <form onSubmit={handleRate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="text" placeholder="Book title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <input type="text" placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} style={{ width: 180 }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="finished">Finished</option>
            <option value="reading">Reading</option>
            <option value="want_to_read">Want to Read</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="range" min="1" max="10" value={score} onChange={(e) => setScore(Number(e.target.value))} style={{ width: 100 }} className="slider-input" />
            <span className="font-semibold">{score}</span>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Save</button>
        </form>
      </div>
      <div className="card card-compact">
        {loading ? <div className="loading"><div className="spinner" /></div> : books.length === 0 ? (
          <div className="empty-state">No books rated yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Author</th><th>Status</th><th>Score</th></tr></thead>
              <tbody>
                {books.map((b, i) => (
                  <tr key={b.id || i}>
                    <td className="font-semibold text-sm">{b.title}</td>
                    <td className="text-sm">{b.author || '—'}</td>
                    <td><span className="badge badge-muted">{(b.status || '').replace(/_/g, ' ')}</span></td>
                    <td className="font-semibold" style={{ color: b.score >= 8 ? 'var(--green)' : b.score >= 5 ? 'var(--yellow)' : 'var(--red)' }}>{b.score || '—'}</td>
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
