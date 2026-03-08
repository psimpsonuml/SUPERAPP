'use client';
import { useState, useEffect } from 'react';
import { fetchLearningQueue, addLearningItem } from '../../../lib/api';

export default function LearningPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [url, setUrl] = useState('');
  const [priority, setPriority] = useState('medium');

  useEffect(() => {
    fetchLearningQueue().then((r) => setItems(r.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title) return;
    try {
      await addLearningItem({ title, topic, url: url || undefined, priority });
      setTitle(''); setTopic(''); setUrl('');
      const { items: fresh } = await fetchLearningQueue();
      setItems(fresh || []);
    } catch (err) { alert(err.message); }
  }

  const priorityColor = { high: 'var(--red)', medium: 'var(--yellow)', low: 'var(--text-muted)' };

  return (
    <>
      <div className="page-header">
        <h1>Learning Queue</h1>
        <p>Knowledge backlog with weekly surfacing</p>
      </div>
      <div className="card">
        <div className="card-header"><h2>Add Item</h2></div>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 16px 16px' }}>
          <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <input type="text" placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ width: 150 }} />
          <input type="url" placeholder="URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} style={{ width: 200 }} />
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button className="btn btn-primary btn-sm" type="submit">Add</button>
        </form>
      </div>
      <div className="card card-compact">
        {loading ? <div className="loading"><div className="spinner" /></div> : items.length === 0 ? (
          <div className="empty-state">No items in your learning queue.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Topic</th><th>Priority</th><th>Status</th><th>Link</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id || i}>
                    <td className="font-semibold text-sm">{item.title}</td>
                    <td className="text-sm text-muted">{item.topic || '—'}</td>
                    <td><span className="font-semibold text-sm" style={{ color: priorityColor[item.priority] || 'var(--text-muted)' }}>{item.priority}</span></td>
                    <td><span className="badge badge-muted">{item.status || 'queued'}</span></td>
                    <td>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: 'var(--accent)' }}>Open</a> : '—'}</td>
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
