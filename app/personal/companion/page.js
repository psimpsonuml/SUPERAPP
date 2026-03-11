'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchCompanionSettings, updateCompanionSettings,
  fetchCompanionConversations, createCompanionConversation,
  fetchCompanionConversation, sendCompanionMessage,
  deleteCompanionConversations, fetchCompanionCheckins, acknowledgeCheckin,
} from '../../../lib/api';
import { COMPANION_MODES } from '../../../lib/constants';

export default function CompanionPage() {
  const [settings, setSettings] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('chat');
  const [showSetup, setShowSetup] = useState(false);
  const [setupForm, setSetupForm] = useState({ mode: 'coach', companion_name: 'Beacon', personality_intensity: 'moderate', checkin_frequency: 'daily', checkin_time: '08:00' });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [settingsRes, convosRes, checkinsRes] = await Promise.allSettled([
        fetchCompanionSettings(),
        fetchCompanionConversations(20),
        fetchCompanionCheckins(5),
      ]);
      const s = settingsRes.status === 'fulfilled' ? settingsRes.value.settings : null;
      setSettings(s);
      if (s) {
        setSetupForm({ mode: s.mode, companion_name: s.companion_name, personality_intensity: s.personality_intensity, checkin_frequency: s.checkin_frequency, checkin_time: s.checkin_time });
      } else {
        setShowSetup(true);
      }
      setConversations(convosRes.status === 'fulfilled' ? convosRes.value.conversations || [] : []);
      setCheckins(checkinsRes.status === 'fulfilled' ? checkinsRes.value.checkins || [] : []);
    } catch {} finally { setLoading(false); }
  }

  async function handleSaveSettings() {
    try {
      const result = await updateCompanionSettings(setupForm);
      setSettings(result.settings);
      setShowSetup(false);
    } catch (err) { alert(err.message); }
  }

  async function startNewConvo() {
    try {
      const result = await createCompanionConversation();
      setActiveConvo(result.conversation);
      setMessages([]);
      setConversations(prev => [result.conversation, ...prev]);
    } catch (err) { alert(err.message); }
  }

  async function openConvo(id) {
    try {
      const result = await fetchCompanionConversation(id);
      setActiveConvo(result.conversation);
      setMessages(result.conversation?.messages_json || []);
    } catch (err) { alert(err.message); }
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isTyping || !activeConvo) return;

    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await sendCompanionMessage(activeConvo.id, text);
      if (result.response) {
        setMessages(prev => [...prev, result.response]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, timestamp: new Date().toISOString() }]);
    } finally {
      setIsTyping(false);
    }
  }

  async function handleAcknowledgeCheckin(id) {
    try {
      await acknowledgeCheckin(id);
      setCheckins(prev => prev.map(c => c.id === id ? { ...c, acknowledged: true } : c));
    } catch {}
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading companion...</div>;

  const name = settings?.companion_name || 'Beacon';
  const mode = settings?.mode || 'coach';
  const modeInfo = COMPANION_MODES.find(m => m.id === mode) || COMPANION_MODES[0];

  // Setup screen
  if (showSetup) {
    return (
      <>
        <div className="page-header">
          <h1>Set Up Your Companion</h1>
          <p>Configure your AI companion's personality and check-in schedule</p>
        </div>

        <div className="card" style={{ maxWidth: 560 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Companion Name</label>
            <input type="text" value={setupForm.companion_name} onChange={(e) => setSetupForm(f => ({ ...f, companion_name: e.target.value }))} placeholder="Beacon" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Mode</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {COMPANION_MODES.map((m) => (
                <button
                  key={m.id}
                  className={`card card-compact ${setupForm.mode === m.id ? '' : ''}`}
                  style={{
                    cursor: 'pointer', textAlign: 'left',
                    border: setupForm.mode === m.id ? '1px solid var(--accent)' : undefined,
                    background: setupForm.mode === m.id ? 'var(--accent-muted)' : undefined,
                  }}
                  onClick={() => setSetupForm(f => ({ ...f, mode: m.id }))}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {m.name}
                    {m.premium && <span className="badge badge-amber" style={{ marginLeft: 8, fontSize: 9 }}>Premium</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>"{m.style}"</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Check-in Frequency</label>
              <select value={setupForm.checkin_frequency} onChange={(e) => setSetupForm(f => ({ ...f, checkin_frequency: e.target.value }))}>
                <option value="daily">Daily</option>
                <option value="twice_daily">Twice Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Check-in Time</label>
              <input type="text" value={setupForm.checkin_time} onChange={(e) => setSetupForm(f => ({ ...f, checkin_time: e.target.value }))} placeholder="08:00" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Personality Intensity</label>
              <select value={setupForm.personality_intensity} onChange={(e) => setSetupForm(f => ({ ...f, personality_intensity: e.target.value }))}>
                <option value="subtle">Subtle</option>
                <option value="moderate">Moderate</option>
                <option value="expressive">Expressive</option>
              </select>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSaveSettings}>Save & Start</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1>{name}</h1>
          <span className="badge badge-amber">{modeInfo.name}</span>
        </div>
        <p>Your personal AI companion — powered by all your personal modules</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'chat' ? 'tab-active' : ''}`} onClick={() => setTab('chat')}>Chat</button>
        <button className={`tab ${tab === 'checkins' ? 'tab-active' : ''}`} onClick={() => setTab('checkins')}>Check-ins</button>
        <button className={`tab ${tab === 'settings' ? 'tab-active' : ''}`} onClick={() => setTab('settings')}>Settings</button>
      </div>

      {tab === 'chat' && (
        <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
          {/* Conversation sidebar */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <button className="btn btn-primary btn-sm" onClick={startNewConvo} style={{ width: '100%', marginBottom: 12 }}>
              New Conversation
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {conversations.map(c => (
                <button
                  key={c.id}
                  className="btn btn-sm btn-ghost"
                  style={{
                    textAlign: 'left', justifyContent: 'flex-start',
                    background: activeConvo?.id === c.id ? 'var(--accent-muted)' : undefined,
                  }}
                  onClick={() => openConvo(c.id)}
                >
                  <span className="truncate" style={{ fontSize: 12 }}>
                    {c.context_summary || new Date(c.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {activeConvo ? (
              <>
                <div className="card" style={{ flex: 1, overflow: 'auto', marginBottom: 12, maxHeight: 450 }}>
                  {messages.length === 0 ? (
                    <div className="empty-state" style={{ padding: 40 }}>
                      <div className="empty-state-message">Start a conversation with {name}</div>
                      <div className="empty-state-hint">{modeInfo.style}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {messages.map((msg, i) => (
                        <div key={i} style={{
                          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          padding: '10px 14px',
                          borderRadius: 12,
                          background: msg.role === 'user' ? 'var(--accent-muted)' : 'var(--bg-raised)',
                          border: `1px solid ${msg.role === 'user' ? 'var(--border-accent)' : 'var(--border)'}`,
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}>
                          {msg.content}
                        </div>
                      ))}
                      {isTyping && (
                        <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-raised)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)' }}>
                          {name} is typing...
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={`Message ${name}...`}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={handleSend} disabled={isTyping || !input.trim()}>
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">💬</div>
                <div className="empty-state-message">Select a conversation or start a new one</div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'checkins' && (
        <div>
          {checkins.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">☀️</div>
              <div className="empty-state-message">No check-ins yet</div>
              <div className="empty-state-hint">{name} will send daily check-ins at {settings?.checkin_time || '8:00 AM'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checkins.map(c => (
                <div key={c.id} className="card card-compact">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{c.checkin_message}</div>
                      <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                        {new Date(c.delivered_at).toLocaleString()}
                      </div>
                    </div>
                    {!c.acknowledged && (
                      <button className="btn btn-xs btn-approve" onClick={() => handleAcknowledgeCheckin(c.id)}>
                        Got it
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div style={{ maxWidth: 480 }}>
          <button className="btn btn-sm" onClick={() => setShowSetup(true)} style={{ marginBottom: 16 }}>
            Edit Companion Settings
          </button>
          <div className="card">
            <div className="info-row"><span className="info-label">Mode</span><span className="info-value">{modeInfo.name}</span></div>
            <div className="info-row"><span className="info-label">Name</span><span className="info-value">{name}</span></div>
            <div className="info-row"><span className="info-label">Intensity</span><span className="info-value">{settings?.personality_intensity}</span></div>
            <div className="info-row"><span className="info-label">Check-in</span><span className="info-value">{settings?.checkin_frequency} at {settings?.checkin_time}</span></div>
          </div>
          <button
            className="btn btn-reject btn-sm"
            onClick={async () => { if (confirm('Delete all companion conversations? This cannot be undone.')) { await deleteCompanionConversations(); load(); } }}
            style={{ marginTop: 16 }}
          >
            Delete Conversation History
          </button>
        </div>
      )}
    </>
  );
}
