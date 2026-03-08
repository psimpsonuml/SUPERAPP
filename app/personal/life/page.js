'use client';

import { useState, useEffect } from 'react';
import { fetchReminders, createReminder, completeReminder, fetchFamilyLog, addFamilyEntry } from '../../../lib/api';

export default function LifeManagerPage() {
  const [tab, setTab] = useState('reminders');
  const [reminders, setReminders] = useState([]);
  const [familyLog, setFamilyLog] = useState([]);
  const [loading, setLoading] = useState(true);
  // Reminder form
  const [newTitle, setNewTitle] = useState('');
  const [newFreq, setNewFreq] = useState('daily');
  const [newTime, setNewTime] = useState('09:00');
  // Family log form
  const [logText, setLogText] = useState('');
  const [logChild, setLogChild] = useState('');
  const [logCategory, setLogCategory] = useState('memory');

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([fetchReminders(), fetchFamilyLog()]);
      if (results[0].status === 'fulfilled') setReminders(results[0].value.reminders || []);
      if (results[1].status === 'fulfilled') setFamilyLog(results[1].value.entries || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleAddReminder(e) {
    e.preventDefault();
    if (!newTitle) return;
    try {
      await createReminder({ title: newTitle, frequency: newFreq, time: newTime });
      setNewTitle('');
      const { reminders: r } = await fetchReminders();
      setReminders(r || []);
    } catch (err) { alert(err.message); }
  }

  async function handleComplete(id) {
    try {
      await completeReminder(id);
      const { reminders: r } = await fetchReminders();
      setReminders(r || []);
    } catch (err) { alert(err.message); }
  }

  async function handleAddEntry(e) {
    e.preventDefault();
    if (!logText) return;
    try {
      await addFamilyEntry({ text: logText, child: logChild || undefined, category: logCategory });
      setLogText(''); setLogChild('');
      const { entries } = await fetchFamilyLog();
      setFamilyLog(entries || []);
    } catch (err) { alert(err.message); }
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading...</div>;

  return (
    <>
      <div className="page-header">
        <h1>Life Manager</h1>
        <p>Reminders, routines, streak tracking, and family memories</p>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'reminders' ? ' tab-active' : ''}`} onClick={() => setTab('reminders')}>Reminders</button>
        <button className={`tab${tab === 'family' ? ' tab-active' : ''}`} onClick={() => setTab('family')}>Family Log</button>
      </div>

      {tab === 'reminders' && (
        <>
          <div className="card">
            <div className="card-header"><h2>Add Reminder</h2></div>
            <form onSubmit={handleAddReminder} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="text" placeholder="Reminder title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
              <select value={newFreq} onChange={(e) => setNewFreq(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ width: 120, padding: '7px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13 }} />
              <button className="btn btn-primary btn-sm" type="submit">Add</button>
            </form>
          </div>

          {reminders.length === 0 ? (
            <div className="empty-state">No reminders yet. Add one above to get started.</div>
          ) : (
            reminders.map((rem) => (
              <div key={rem.id} className="card card-compact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="font-semibold text-sm">{rem.title}</div>
                  <div className="text-xs text-muted mt-1" style={{ display: 'flex', gap: 12 }}>
                    <span>{rem.frequency}</span>
                    <span>{rem.time}</span>
                    {rem.streak > 0 && <span style={{ color: 'var(--orange)' }}>{rem.streak} streak</span>}
                    {rem.last_completed && <span>Last: {new Date(rem.last_completed).toLocaleDateString()}</span>}
                  </div>
                </div>
                <button className="btn btn-approve btn-sm" onClick={() => handleComplete(rem.id)}>Done</button>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'family' && (
        <>
          <div className="card">
            <div className="card-header"><h2>Anything worth remembering today?</h2></div>
            <form onSubmit={handleAddEntry}>
              <textarea rows={3} placeholder="A funny thing happened today..." value={logText} onChange={(e) => setLogText(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="Child name (optional)" value={logChild} onChange={(e) => setLogChild(e.target.value)} style={{ width: 180 }} />
                <select value={logCategory} onChange={(e) => setLogCategory(e.target.value)}>
                  <option value="memory">Memory</option>
                  <option value="funny_quote">Funny Quote</option>
                  <option value="milestone">Milestone</option>
                  <option value="first_time">First Time</option>
                  <option value="medical">Medical</option>
                </select>
                <button className="btn btn-primary btn-sm" type="submit">Save</button>
              </div>
            </form>
          </div>

          {familyLog.length === 0 ? (
            <div className="empty-state">No entries yet. Start capturing memories above.</div>
          ) : (
            familyLog.map((entry, i) => (
              <div key={entry.id || i} className="card card-compact" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${entry.category === 'milestone' ? 'badge-green' : entry.category === 'funny_quote' ? 'badge-yellow' : entry.category === 'medical' ? 'badge-red' : 'badge-muted'}`}>
                      {(entry.category || 'memory').replace(/_/g, ' ')}
                    </span>
                    {entry.child && <span className="badge badge-purple">{entry.child}</span>}
                  </div>
                  <span className="text-xs text-muted">
                    {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '—'}
                  </span>
                </div>
                <p className="text-sm">{entry.text}</p>
              </div>
            ))
          )}
        </>
      )}
    </>
  );
}
