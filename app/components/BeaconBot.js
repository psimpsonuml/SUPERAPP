'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchBotConversations,
  fetchBotConversation,
  createBotConversation,
  deleteBotConversation,
  sendBotMessage,
  updateBotConversation,
  fetchBotActions,
  executeBotAction,
  fetchBotModels,
  switchBotModel,
  fetchBotContext
} from '../../lib/api';

// ── Context Labels ───────────────────────────────────────────────────
const CONTEXT_LABELS = {
  dashboard: { label: 'Dashboard', short: 'Dashboard' },
  chronostates: { label: 'ChronoStates', short: 'CS' },
  payroll_beacon: { label: 'Payroll Beacon', short: 'PB' },
  budgeting_beacon: { label: 'Budgeting Beacon', short: 'BB' }
};

// ── Action Icons ─────────────────────────────────────────────────────
const ACTION_ICONS = {
  approve_item: '\u2713',
  trigger_agent: '\u26A1',
  add_reminder: '\uD83D\uDD14',
  generate_report: '\uD83D\uDCCA',
  send_notification: '\uD83D\uDCE8',
  default: '\u2699'
};

export default function BeaconBot() {
  // ── State ──────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [currentContext, setCurrentContext] = useState('dashboard');
  const [contextFilter, setContextFilter] = useState('');
  const [actions, setActions] = useState([]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── Load Models and Context on Mount ───────────────────────────────
  useEffect(() => {
    loadModels();
    loadContext();
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
      if (inputRef.current) inputRef.current.focus();
    }
  }, [isOpen, contextFilter]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Data Loading ───────────────────────────────────────────────────
  const loadModels = async () => {
    try {
      const res = await fetchBotModels();
      if (res.models) setModels(res.models);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const loadContext = async () => {
    try {
      await fetchBotContext();
    } catch (err) {
      console.error('Failed to load context:', err);
    }
  };

  const loadConversations = async () => {
    try {
      const params = contextFilter ? { context: contextFilter } : {};
      const res = await fetchBotConversations(params);
      if (res.conversations) setConversations(res.conversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadConversation = useCallback(async (id) => {
    try {
      const res = await fetchBotConversation(id);
      if (res.conversation) {
        setActiveConversation(res.conversation);
        setMessages(res.conversation.messages_json || []);
        setSelectedModel(res.conversation.model_used || 'auto');
        loadActions(id);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  }, []);

  const loadActions = async (conversationId) => {
    try {
      const res = await fetchBotActions(conversationId);
      if (res.actions) setActions(res.actions);
    } catch (err) {
      console.error('Failed to load actions:', err);
    }
  };

  // ── Conversation Management ────────────────────────────────────────
  const handleNewConversation = async () => {
    try {
      const res = await createBotConversation({
        context: currentContext,
        model_used: selectedModel
      });
      if (res.conversation) {
        setActiveConversation(res.conversation);
        setMessages([]);
        setActions([]);
        loadConversations();
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await deleteBotConversation(id);
      if (activeConversation?.id === id) {
        setActiveConversation(null);
        setMessages([]);
        setActions([]);
      }
      loadConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handlePinConversation = async (id, pinned, e) => {
    e.stopPropagation();
    try {
      await updateBotConversation(id, { pinned: !pinned });
      loadConversations();
    } catch (err) {
      console.error('Failed to pin conversation:', err);
    }
  };

  // ── Send Message ───────────────────────────────────────────────────
  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    let convo = activeConversation;
    if (!convo) {
      try {
        const res = await createBotConversation({
          context: currentContext,
          model_used: selectedModel
        });
        if (res.conversation) {
          convo = res.conversation;
          setActiveConversation(convo);
        }
      } catch (err) {
        console.error('Failed to create conversation:', err);
        return;
      }
    }

    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await sendBotMessage(convo.id, { message: text });
      if (res.response) {
        setMessages(prev => [...prev, res.response]);
      }
      if (res.conversation) {
        setActiveConversation(res.conversation);
      }
      loadConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
      const errMsg = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Model Switch ───────────────────────────────────────────────────
  const handleModelSwitch = async (model) => {
    setSelectedModel(model);
    if (activeConversation) {
      try {
        await switchBotModel(activeConversation.id, { model });
      } catch (err) {
        console.error('Failed to switch model:', err);
      }
    }
  };

  // ── Execute Action ─────────────────────────────────────────────────
  const handleExecuteAction = async (actionType, details) => {
    try {
      const res = await executeBotAction({
        conversation_id: activeConversation?.id,
        action_type: actionType,
        action_details: details
      });
      if (res.action) {
        setActions(prev => [res.action, ...prev]);
      }
      return res.result;
    } catch (err) {
      console.error('Failed to execute action:', err);
      return null;
    }
  };

  // ── Render Helpers ─────────────────────────────────────────────────
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // ── Floating Bubble ────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
          zIndex: 9999,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(245, 158, 11, 0.5)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.4)';
        }}
        aria-label="Open BeaconBot"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  // ── Chat Window ────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: showSidebar ? '640px' : '400px',
      height: '600px',
      backgroundColor: '#1a1a2e',
      borderRadius: '16px',
      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'row',
      overflow: 'hidden',
      animation: 'beaconbot-slide-up 0.3s ease-out',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        @keyframes beaconbot-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes beaconbot-typing {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
        .beaconbot-scrollbar::-webkit-scrollbar { width: 6px; }
        .beaconbot-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .beaconbot-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      {showSidebar && (
        <div style={{
          width: '240px',
          borderRight: '1px solid #2a2a4a',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#16162a'
        }}>
          {/* Sidebar Header */}
          <div style={{ padding: '12px', borderBottom: '1px solid #2a2a4a' }}>
            <button
              onClick={handleNewConversation}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#f59e0b',
                color: '#1a1a2e',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              + New Conversation
            </button>
            {/* Context Filter */}
            <select
              value={contextFilter}
              onChange={e => setContextFilter(e.target.value)}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '6px 8px',
                backgroundColor: '#1a1a2e',
                color: '#ccc',
                border: '1px solid #2a2a4a',
                borderRadius: '6px',
                fontSize: '12px',
                outline: 'none'
              }}
            >
              <option value="">All Contexts</option>
              {Object.entries(CONTEXT_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Conversation List */}
          <div className="beaconbot-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
            {conversations.map(c => (
              <div
                key={c.id}
                onClick={() => loadConversation(c.id)}
                style={{
                  padding: '10px',
                  margin: '2px 0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: activeConversation?.id === c.id ? '#2a2a4a' : 'transparent',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={e => { if (activeConversation?.id !== c.id) e.currentTarget.style.backgroundColor = '#222244'; }}
                onMouseLeave={e => { if (activeConversation?.id !== c.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '13px',
                    color: '#e0e0e0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {c.pinned && <span style={{ color: '#f59e0b', marginRight: '4px' }}>&#9733;</span>}
                    {c.title}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '4px', flexShrink: 0 }}>
                    <button
                      onClick={(e) => handlePinConversation(c.id, c.pinned, e)}
                      style={{ background: 'none', border: 'none', color: c.pinned ? '#f59e0b' : '#666', cursor: 'pointer', fontSize: '11px', padding: '2px' }}
                      title={c.pinned ? 'Unpin' : 'Pin'}
                    >&#9733;</button>
                    <button
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '11px', padding: '2px' }}
                      title="Delete"
                    >&times;</button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{
                    fontSize: '10px',
                    color: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}>
                    {CONTEXT_LABELS[c.context]?.short || c.context}
                  </span>
                  <span style={{ fontSize: '10px', color: '#666' }}>{formatDate(c.updated_at)}</span>
                </div>
              </div>
            ))}
            {conversations.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: '13px' }}>
                No conversations yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main Chat Area ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #2a2a4a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#16162a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0',
                lineHeight: 1
              }}
              title="Toggle conversations"
            >&#9776;</button>
            <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '15px' }}>BeaconBot</span>
            {/* Context Badge */}
            <span style={{
              fontSize: '10px',
              color: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: '600'
            }}>
              {CONTEXT_LABELS[currentContext]?.short || 'Dashboard'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Model Selector */}
            <select
              value={selectedModel}
              onChange={e => handleModelSwitch(e.target.value)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#1a1a2e',
                color: '#ccc',
                border: '1px solid #2a2a4a',
                borderRadius: '6px',
                fontSize: '11px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="auto">Auto</option>
              <option value="haiku">Haiku</option>
              <option value="sonnet">Sonnet</option>
              <option value="opus">Opus</option>
            </select>
            {/* Minimize */}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '0',
                lineHeight: 1
              }}
              title="Minimize"
            >&minus;</button>
            {/* Close */}
            <button
              onClick={() => { setIsOpen(false); setActiveConversation(null); setMessages([]); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '0',
                lineHeight: 1
              }}
              title="Close"
            >&times;</button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="beaconbot-scrollbar" style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {messages.length === 0 && !isTyping && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#555',
              textAlign: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div style={{ fontSize: '14px', color: '#888' }}>
                How can I help you today?
              </div>
              <div style={{ fontSize: '12px', color: '#555' }}>
                Ask me anything about your {CONTEXT_LABELS[currentContext]?.label || 'Dashboard'}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              width: '100%'
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                backgroundColor: msg.role === 'user' ? '#2a2a4a' : '#222244',
                color: '#e0e0e0',
                fontSize: '13px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {msg.content}
                <div style={{
                  fontSize: '10px',
                  color: '#666',
                  marginTop: '4px',
                  textAlign: msg.role === 'user' ? 'right' : 'left'
                }}>
                  {formatTime(msg.timestamp)}
                  {msg.model && msg.role === 'assistant' && (
                    <span style={{ marginLeft: '6px', color: '#f59e0b' }}>{msg.model}</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Action Cards */}
          {actions.map((action, i) => (
            <div key={`action-${i}`} style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '12px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0
              }}>
                {ACTION_ICONS[action.action_type] || ACTION_ICONS.default}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#f59e0b' }}>
                  {action.action_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                  {action.result_json?.message || 'Action completed'}
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#555', flexShrink: 0 }}>
                {formatTime(action.executed_at)}
              </span>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-start'
            }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 4px',
                backgroundColor: '#222244',
                display: 'flex',
                gap: '4px',
                alignItems: 'center'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', animation: 'beaconbot-typing 1.2s infinite', animationDelay: '0s' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', animation: 'beaconbot-typing 1.2s infinite', animationDelay: '0.2s' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', animation: 'beaconbot-typing 1.2s infinite', animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #2a2a4a',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
          backgroundColor: '#16162a'
        }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask BeaconBot anything..."
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: '#1a1a2e',
              color: '#e0e0e0',
              border: '1px solid #2a2a4a',
              borderRadius: '12px',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={e => e.target.style.borderColor = '#f59e0b'}
            onBlur={e => e.target.style.borderColor = '#2a2a4a'}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: inputValue.trim() && !isTyping ? '#f59e0b' : '#333',
              color: inputValue.trim() && !isTyping ? '#1a1a2e' : '#666',
              cursor: inputValue.trim() && !isTyping ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease',
              flexShrink: 0
            }}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
