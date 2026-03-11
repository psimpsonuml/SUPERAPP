'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchMediaContacts,
  addMediaContact,
  updateMediaContact,
  deleteMediaContact,
  fetchPressReleases,
  createPressRelease,
  updatePressRelease,
  pitchPressRelease,
  fetchMediaMentions,
  addMediaMention,
  fetchMediaOpportunities,
  addMediaOpportunity,
  updateMediaOpportunity,
  draftOpportunityResponse,
  fetchPressKit,
  fetchPrStats
} from '../../../lib/api';

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    padding: '24px 32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#f59e0b',
    margin: 0
  },
  subtitle: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: '4px 0 0 0'
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a2a4a'
  },
  statLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px'
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#f59e0b'
  },
  statSub: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px'
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    borderBottom: '1px solid #2a2a4a',
    paddingBottom: '0'
  },
  tab: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#9ca3af',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tabActive: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#f59e0b',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid #f59e0b',
    cursor: 'pointer'
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a2a4a',
    marginBottom: '16px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #2a2a4a'
  },
  td: {
    padding: '12px',
    fontSize: '14px',
    borderBottom: '1px solid #1e1e3a',
    verticalAlign: 'top'
  },
  btnPrimary: {
    backgroundColor: '#f59e0b',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    color: '#f59e0b',
    border: '1px solid #f59e0b',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  btnSmall: {
    padding: '5px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500'
  },
  btnDanger: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    marginRight: '4px',
    marginBottom: '2px'
  },
  badgeAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b'
  },
  badgeGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: '#22c55e'
  },
  badgeGray: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    color: '#9ca3af'
  },
  badgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444'
  },
  badgeBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: '#3b82f6'
  },
  input: {
    backgroundColor: '#1a1a2e',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '14px',
    color: '#e0e0e0',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box'
  },
  select: {
    backgroundColor: '#1a1a2e',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '14px',
    color: '#e0e0e0',
    outline: 'none',
    cursor: 'pointer'
  },
  textarea: {
    backgroundColor: '#1a1a2e',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '14px',
    color: '#e0e0e0',
    width: '100%',
    minHeight: '100px',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  filterRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: '16px',
    padding: '28px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '85vh',
    overflowY: 'auto',
    border: '1px solid #2a2a4a'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: '20px'
  },
  formGroup: {
    marginBottom: '14px'
  },
  formLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  formActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '20px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 20px',
    color: '#6b7280'
  },
  feedItem: {
    display: 'flex',
    gap: '14px',
    padding: '14px 0',
    borderBottom: '1px solid #1e1e3a',
    alignItems: 'flex-start'
  },
  pressKitSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid #2a2a4a'
  },
  countdown: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#ef4444'
  }
};

const TABS = ['Media Contacts', 'Press Releases', 'Mentions', 'Opportunities', 'Press Kit'];

const STATUS_BADGE = {
  draft: { ...styles.badge, ...styles.badgeGray },
  approved: { ...styles.badge, ...styles.badgeBlue },
  published: { ...styles.badge, ...styles.badgeGreen },
  archived: { ...styles.badge, ...styles.badgeRed }
};

const SENTIMENT_BADGE = {
  positive: { ...styles.badge, ...styles.badgeGreen },
  neutral: { ...styles.badge, ...styles.badgeGray },
  negative: { ...styles.badge, ...styles.badgeRed }
};

const OPP_STATUS_BADGE = {
  new: { ...styles.badge, ...styles.badgeAmber },
  responded: { ...styles.badge, ...styles.badgeBlue },
  expired: { ...styles.badge, ...styles.badgeGray },
  won: { ...styles.badge, ...styles.badgeGreen }
};

function formatDeadlineCountdown(deadline) {
  if (!deadline) return 'No deadline';
  const diff = new Date(deadline) - new Date();
  if (diff < 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h left`;
  const mins = Math.floor(diff / (1000 * 60));
  return `${mins}m left`;
}

export default function PRPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Contacts state
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactBeatFilter, setContactBeatFilter] = useState('');
  const [contactOutletFilter, setContactOutletFilter] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', outlet: '', beat: '', email: '', social_url: '', reach_estimate: 0, product_relevance: '', notes: '' });

  // Releases state
  const [releases, setReleases] = useState([]);
  const [releaseProductFilter, setReleaseProductFilter] = useState('');
  const [releaseStatusFilter, setReleaseStatusFilter] = useState('');
  const [expandedRelease, setExpandedRelease] = useState(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseForm, setReleaseForm] = useState({ product: '', headline: '', body: '', generate: false });
  const [pitchResult, setPitchResult] = useState(null);

  // Mentions state
  const [mentions, setMentions] = useState([]);
  const [mentionProductFilter, setMentionProductFilter] = useState('');
  const [mentionSentimentFilter, setMentionSentimentFilter] = useState('');
  const [showMentionModal, setShowMentionModal] = useState(false);
  const [mentionForm, setMentionForm] = useState({ source: '', product: '', url: '', title: '', sentiment: 'neutral', reach_estimate: 0 });

  // Opportunities state
  const [opportunities, setOpportunities] = useState([]);
  const [oppStatusFilter, setOppStatusFilter] = useState('');
  const [showOppModal, setShowOppModal] = useState(false);
  const [oppForm, setOppForm] = useState({ source: '', query_text: '', deadline: '', relevance: '' });

  // Press Kit state
  const [pressKitProduct, setPressKitProduct] = useState('');
  const [pressKit, setPressKit] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchPrStats();
      setStats(data);
    } catch (e) { console.error('Failed to load PR stats:', e); }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const params = {};
      if (contactBeatFilter) params.beat = contactBeatFilter;
      if (contactOutletFilter) params.outlet = contactOutletFilter;
      const data = await fetchMediaContacts(params);
      setContacts(data.contacts || []);
    } catch (e) { console.error('Failed to load contacts:', e); }
  }, [contactBeatFilter, contactOutletFilter]);

  const loadReleases = useCallback(async () => {
    try {
      const params = {};
      if (releaseProductFilter) params.product = releaseProductFilter;
      if (releaseStatusFilter) params.status = releaseStatusFilter;
      const data = await fetchPressReleases(params);
      setReleases(data.releases || []);
    } catch (e) { console.error('Failed to load releases:', e); }
  }, [releaseProductFilter, releaseStatusFilter]);

  const loadMentions = useCallback(async () => {
    try {
      const params = {};
      if (mentionProductFilter) params.product = mentionProductFilter;
      if (mentionSentimentFilter) params.sentiment = mentionSentimentFilter;
      const data = await fetchMediaMentions(params);
      setMentions(data.mentions || []);
    } catch (e) { console.error('Failed to load mentions:', e); }
  }, [mentionProductFilter, mentionSentimentFilter]);

  const loadOpportunities = useCallback(async () => {
    try {
      const params = {};
      if (oppStatusFilter) params.status = oppStatusFilter;
      const data = await fetchMediaOpportunities(params);
      setOpportunities(data.opportunities || []);
    } catch (e) { console.error('Failed to load opportunities:', e); }
  }, [oppStatusFilter]);

  const loadPressKit = useCallback(async (product) => {
    if (!product) return;
    try {
      const data = await fetchPressKit(product);
      setPressKit(data);
    } catch (e) { console.error('Failed to load press kit:', e); }
  }, []);

  useEffect(() => {
    Promise.all([loadStats(), loadContacts(), loadReleases(), loadMentions(), loadOpportunities()])
      .finally(() => setLoading(false));
  }, [loadStats, loadContacts, loadReleases, loadMentions, loadOpportunities]);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => { loadReleases(); }, [loadReleases]);
  useEffect(() => { loadMentions(); }, [loadMentions]);
  useEffect(() => { loadOpportunities(); }, [loadOpportunities]);

  // ── Contact CRUD ────────────────────────────────────────────────────────

  const handleSaveContact = async () => {
    try {
      const payload = {
        ...contactForm,
        reach_estimate: parseInt(contactForm.reach_estimate) || 0,
        product_relevance: contactForm.product_relevance ? contactForm.product_relevance.split(',').map(s => s.trim()).filter(Boolean) : []
      };
      if (editingContact) {
        await updateMediaContact(editingContact.id, payload);
      } else {
        await addMediaContact(payload);
      }
      setShowContactModal(false);
      setEditingContact(null);
      setContactForm({ name: '', outlet: '', beat: '', email: '', social_url: '', reach_estimate: 0, product_relevance: '', notes: '' });
      loadContacts();
      loadStats();
    } catch (e) { console.error('Failed to save contact:', e); }
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name || '',
      outlet: contact.outlet || '',
      beat: contact.beat || '',
      email: contact.email || '',
      social_url: contact.social_url || '',
      reach_estimate: contact.reach_estimate || 0,
      product_relevance: (contact.product_relevance || []).join(', '),
      notes: contact.notes || ''
    });
    setShowContactModal(true);
  };

  const handleDeleteContact = async (id) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await deleteMediaContact(id);
      loadContacts();
      loadStats();
    } catch (e) { console.error('Failed to delete contact:', e); }
  };

  // ── Release CRUD ────────────────────────────────────────────────────────

  const handleSaveRelease = async () => {
    try {
      await createPressRelease(releaseForm);
      setShowReleaseModal(false);
      setReleaseForm({ product: '', headline: '', body: '', generate: false });
      loadReleases();
      loadStats();
    } catch (e) { console.error('Failed to save release:', e); }
  };

  const handleApproveRelease = async (id) => {
    try {
      await updatePressRelease(id, { status: 'approved' });
      loadReleases();
    } catch (e) { console.error('Failed to approve release:', e); }
  };

  const handlePublishRelease = async (id) => {
    try {
      await updatePressRelease(id, { status: 'published' });
      loadReleases();
      loadStats();
    } catch (e) { console.error('Failed to publish release:', e); }
  };

  const handlePitchRelease = async (id) => {
    try {
      const result = await pitchPressRelease(id);
      setPitchResult(result);
    } catch (e) { console.error('Failed to generate pitches:', e); }
  };

  // ── Mention CRUD ────────────────────────────────────────────────────────

  const handleSaveMention = async () => {
    try {
      await addMediaMention(mentionForm);
      setShowMentionModal(false);
      setMentionForm({ source: '', product: '', url: '', title: '', sentiment: 'neutral', reach_estimate: 0 });
      loadMentions();
      loadStats();
    } catch (e) { console.error('Failed to save mention:', e); }
  };

  // ── Opportunity CRUD ────────────────────────────────────────────────────

  const handleSaveOpportunity = async () => {
    try {
      await addMediaOpportunity(oppForm);
      setShowOppModal(false);
      setOppForm({ source: '', query_text: '', deadline: '', relevance: '' });
      loadOpportunities();
    } catch (e) { console.error('Failed to save opportunity:', e); }
  };

  const handleDraftResponse = async (id) => {
    try {
      const result = await draftOpportunityResponse(id);
      const updated = opportunities.map(o => o.id === id ? result : o);
      setOpportunities(updated);
    } catch (e) { console.error('Failed to draft response:', e); }
  };

  const handleUpdateOppStatus = async (id, status) => {
    try {
      await updateMediaOpportunity(id, { status });
      loadOpportunities();
    } catch (e) { console.error('Failed to update opportunity:', e); }
  };

  // ── Filtered contacts for search ────────────────────────────────────────

  const filteredContacts = contacts.filter(c => {
    if (!contactSearch) return true;
    const s = contactSearch.toLowerCase();
    return (c.name || '').toLowerCase().includes(s)
      || (c.outlet || '').toLowerCase().includes(s)
      || (c.beat || '').toLowerCase().includes(s)
      || (c.email || '').toLowerCase().includes(s);
  });

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: '80px' }}>Loading PR & Media Relations...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>PR & Media Relations</h1>
          <p style={styles.subtitle}>Manage media contacts, press releases, mentions, and opportunities</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Contacts</div>
            <div style={styles.statValue}>{stats.total_contacts || 0}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Releases Published</div>
            <div style={styles.statValue}>{stats.releases_published || 0}</div>
            <div style={styles.statSub}>{stats.releases_total || 0} total</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Mentions This Month</div>
            <div style={styles.statValue}>{stats.mentions_this_month || 0}</div>
            <div style={styles.statSub}>{stats.mentions_total || 0} all time</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Sentiment Ratio</div>
            <div style={styles.statValue}>
              {stats.positive_negative_ratio === Infinity ? 'All +' : `${stats.positive_negative_ratio || 0}:1`}
            </div>
            <div style={styles.statSub}>
              <span style={{ color: '#22c55e' }}>{stats.sentiment_breakdown?.positive || 0} +</span>
              {' / '}
              <span style={{ color: '#9ca3af' }}>{stats.sentiment_breakdown?.neutral || 0} ~</span>
              {' / '}
              <span style={{ color: '#ef4444' }}>{stats.sentiment_breakdown?.negative || 0} -</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            style={activeTab === i ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Media Contacts Tab ─────────────────────────────────────────── */}
      {activeTab === 0 && (
        <div>
          <div style={styles.filterRow}>
            <input
              style={{ ...styles.input, maxWidth: '240px' }}
              placeholder="Search contacts..."
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
            />
            <input
              style={{ ...styles.input, maxWidth: '160px' }}
              placeholder="Filter by beat..."
              value={contactBeatFilter}
              onChange={e => setContactBeatFilter(e.target.value)}
            />
            <input
              style={{ ...styles.input, maxWidth: '160px' }}
              placeholder="Filter by outlet..."
              value={contactOutletFilter}
              onChange={e => setContactOutletFilter(e.target.value)}
            />
            <button
              style={styles.btnPrimary}
              onClick={() => { setEditingContact(null); setContactForm({ name: '', outlet: '', beat: '', email: '', social_url: '', reach_estimate: 0, product_relevance: '', notes: '' }); setShowContactModal(true); }}
            >
              + Add Contact
            </button>
          </div>

          {filteredContacts.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No media contacts found</p>
              <p style={{ fontSize: '13px' }}>Add your first media contact to get started</p>
            </div>
          ) : (
            <div style={styles.card}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Outlet</th>
                    <th style={styles.th}>Beat</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Product Relevance</th>
                    <th style={styles.th}>Last Contacted</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(contact => (
                    <tr key={contact.id}>
                      <td style={styles.td}>
                        <span style={{ fontWeight: '600', color: '#e0e0e0' }}>{contact.name}</span>
                      </td>
                      <td style={styles.td}>{contact.outlet}</td>
                      <td style={styles.td}>{contact.beat}</td>
                      <td style={styles.td}>
                        <span style={{ color: '#60a5fa' }}>{contact.email}</span>
                      </td>
                      <td style={styles.td}>
                        {(contact.product_relevance || []).map(p => (
                          <span key={p} style={{ ...styles.badge, ...styles.badgeAmber }}>{p}</span>
                        ))}
                      </td>
                      <td style={styles.td}>
                        {contact.last_contacted
                          ? new Date(contact.last_contacted).toLocaleDateString()
                          : <span style={{ color: '#6b7280' }}>Never</span>}
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            style={{ ...styles.btnSmall, backgroundColor: '#f59e0b', color: '#1a1a2e' }}
                            onClick={() => handleEditContact(contact)}
                          >
                            Edit
                          </button>
                          <button
                            style={styles.btnDanger}
                            onClick={() => handleDeleteContact(contact.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Press Releases Tab ─────────────────────────────────────────── */}
      {activeTab === 1 && (
        <div>
          <div style={styles.filterRow}>
            <input
              style={{ ...styles.input, maxWidth: '180px' }}
              placeholder="Filter by product..."
              value={releaseProductFilter}
              onChange={e => setReleaseProductFilter(e.target.value)}
            />
            <select
              style={styles.select}
              value={releaseStatusFilter}
              onChange={e => setReleaseStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <button
              style={styles.btnPrimary}
              onClick={() => { setReleaseForm({ product: '', headline: '', body: '', generate: false }); setShowReleaseModal(true); }}
            >
              + New Release
            </button>
          </div>

          {releases.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No press releases yet</p>
              <p style={{ fontSize: '13px' }}>Create your first press release or generate one with AI</p>
            </div>
          ) : (
            releases.map(release => (
              <div key={release.id} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{ fontSize: '16px', fontWeight: '600', color: '#e0e0e0', margin: '0 0 8px 0', cursor: 'pointer' }}
                      onClick={() => setExpandedRelease(expandedRelease === release.id ? null : release.id)}
                    >
                      {release.headline}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ ...styles.badge, ...styles.badgeAmber }}>{release.product}</span>
                      <span style={STATUS_BADGE[release.status] || styles.badge}>{release.status}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {new Date(release.created_at).toLocaleDateString()}
                      </span>
                      {release.pitches_sent > 0 && (
                        <span style={{ fontSize: '12px', color: '#60a5fa' }}>
                          {release.pitches_sent} pitches sent
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                    {release.status === 'draft' && (
                      <button
                        style={{ ...styles.btnSmall, backgroundColor: '#3b82f6', color: '#fff' }}
                        onClick={() => handleApproveRelease(release.id)}
                      >
                        Approve
                      </button>
                    )}
                    {release.status === 'approved' && (
                      <button
                        style={{ ...styles.btnSmall, backgroundColor: '#22c55e', color: '#fff' }}
                        onClick={() => handlePublishRelease(release.id)}
                      >
                        Publish
                      </button>
                    )}
                    <button
                      style={{ ...styles.btnSmall, backgroundColor: '#f59e0b', color: '#1a1a2e' }}
                      onClick={() => handlePitchRelease(release.id)}
                    >
                      Pitch
                    </button>
                  </div>
                </div>
                {expandedRelease === release.id && (
                  <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#1a1a2e', borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.6' }}>
                    {release.body}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Pitch Result Modal */}
          {pitchResult && (
            <div style={styles.modal} onClick={() => setPitchResult(null)}>
              <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <h3 style={styles.modalTitle}>Generated Pitches ({pitchResult.pitches_generated})</h3>
                {(pitchResult.pitches || []).map((pitch, i) => (
                  <div key={i} style={{ ...styles.pressKitSection, marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', color: '#f59e0b', marginBottom: '4px' }}>
                      {pitch.contact_name} — {pitch.outlet}
                    </div>
                    <div style={{ fontSize: '12px', color: '#60a5fa', marginBottom: '8px' }}>{pitch.contact_email}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Subject: {pitch.subject}</div>
                    <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{pitch.body}</div>
                  </div>
                ))}
                <div style={styles.formActions}>
                  <button style={styles.btnSecondary} onClick={() => setPitchResult(null)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mentions Tab ───────────────────────────────────────────────── */}
      {activeTab === 2 && (
        <div>
          <div style={styles.filterRow}>
            <input
              style={{ ...styles.input, maxWidth: '180px' }}
              placeholder="Filter by product..."
              value={mentionProductFilter}
              onChange={e => setMentionProductFilter(e.target.value)}
            />
            <select
              style={styles.select}
              value={mentionSentimentFilter}
              onChange={e => setMentionSentimentFilter(e.target.value)}
            >
              <option value="">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
            <button
              style={styles.btnPrimary}
              onClick={() => { setMentionForm({ source: '', product: '', url: '', title: '', sentiment: 'neutral', reach_estimate: 0 }); setShowMentionModal(true); }}
            >
              + Add Mention
            </button>
          </div>

          {mentions.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No media mentions tracked yet</p>
              <p style={{ fontSize: '13px' }}>Add mentions manually or connect monitoring tools</p>
            </div>
          ) : (
            <div style={styles.card}>
              {mentions.map(mention => (
                <div key={mention.id} style={styles.feedItem}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', color: '#e0e0e0', fontSize: '14px' }}>
                        {mention.title || mention.source}
                      </span>
                      <span style={SENTIMENT_BADGE[mention.sentiment]}>{mention.sentiment}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
                      <span>{mention.source}</span>
                      {mention.product && <span style={{ ...styles.badge, ...styles.badgeAmber }}>{mention.product}</span>}
                      <span>Reach: ~{(mention.reach_estimate || 0).toLocaleString()}</span>
                      <span>{mention.date_found}</span>
                    </div>
                    {mention.url && (
                      <a
                        href={mention.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'none', marginTop: '4px', display: 'inline-block' }}
                      >
                        View article
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Opportunities Tab ──────────────────────────────────────────── */}
      {activeTab === 3 && (
        <div>
          <div style={styles.filterRow}>
            <select
              style={styles.select}
              value={oppStatusFilter}
              onChange={e => setOppStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="responded">Responded</option>
              <option value="expired">Expired</option>
              <option value="won">Won</option>
            </select>
            <button
              style={styles.btnPrimary}
              onClick={() => { setOppForm({ source: '', query_text: '', deadline: '', relevance: '' }); setShowOppModal(true); }}
            >
              + Add Opportunity
            </button>
          </div>

          {opportunities.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No media opportunities</p>
              <p style={{ fontSize: '13px' }}>Add HARO queries and journalist requests here</p>
            </div>
          ) : (
            opportunities.map(opp => (
              <div key={opp.id} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600', color: '#e0e0e0' }}>{opp.source}</span>
                      <span style={OPP_STATUS_BADGE[opp.status]}>{opp.status}</span>
                      <span style={styles.countdown}>{formatDeadlineCountdown(opp.deadline)}</span>
                    </div>
                    <p style={{ fontSize: '14px', margin: '0 0 8px 0', lineHeight: '1.5' }}>{opp.query_text}</p>
                    {opp.relevance && (
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>Relevance: {opp.relevance}</div>
                    )}
                    {opp.response_draft && (
                      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#1a1a2e', borderRadius: '8px', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.5', borderLeft: '3px solid #f59e0b' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#f59e0b', marginBottom: '6px', textTransform: 'uppercase' }}>Draft Response</div>
                        {opp.response_draft}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                    {opp.status === 'new' && (
                      <>
                        <button
                          style={{ ...styles.btnSmall, backgroundColor: '#f59e0b', color: '#1a1a2e' }}
                          onClick={() => handleDraftResponse(opp.id)}
                        >
                          Draft Response
                        </button>
                        <button
                          style={{ ...styles.btnSmall, backgroundColor: '#3b82f6', color: '#fff' }}
                          onClick={() => handleUpdateOppStatus(opp.id, 'responded')}
                        >
                          Mark Responded
                        </button>
                      </>
                    )}
                    {opp.status === 'responded' && (
                      <button
                        style={{ ...styles.btnSmall, backgroundColor: '#22c55e', color: '#fff' }}
                        onClick={() => handleUpdateOppStatus(opp.id, 'won')}
                      >
                        Mark Won
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Press Kit Tab ──────────────────────────────────────────────── */}
      {activeTab === 4 && (
        <div>
          <div style={styles.filterRow}>
            <input
              style={{ ...styles.input, maxWidth: '240px' }}
              placeholder="Enter product name..."
              value={pressKitProduct}
              onChange={e => setPressKitProduct(e.target.value)}
            />
            <button style={styles.btnPrimary} onClick={() => loadPressKit(pressKitProduct)}>
              Load Press Kit
            </button>
          </div>

          {!pressKit ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>Enter a product name to view its press kit</p>
              <p style={{ fontSize: '13px' }}>Press kits include company descriptions, founder bio, key metrics, and downloadable sections</p>
            </div>
          ) : (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b', marginBottom: '16px' }}>
                Press Kit: {pressKit.product}
              </h2>

              {/* Company Descriptions */}
              <div style={styles.card}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b', marginBottom: '14px' }}>Company Descriptions</h3>
                {['short', 'medium', 'full'].map(length => (
                  <div key={length} style={styles.pressKitSection}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>
                      {length} description
                    </div>
                    <p style={{ fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
                      {pressKit.company_descriptions?.[length] || ''}
                    </p>
                  </div>
                ))}
              </div>

              {/* Founder Bio */}
              <div style={styles.card}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b', marginBottom: '10px' }}>Founder Bio</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{pressKit.founder_bio || 'Not configured'}</p>
              </div>

              {/* Key Metrics */}
              <div style={styles.card}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b', marginBottom: '14px' }}>Key Metrics</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div style={styles.pressKitSection}>
                    <div style={styles.statLabel}>Press Mentions</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>{pressKit.key_metrics?.total_press_mentions || 0}</div>
                  </div>
                  <div style={styles.pressKitSection}>
                    <div style={styles.statLabel}>Positive Sentiment</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>{pressKit.key_metrics?.positive_sentiment_rate || 0}%</div>
                  </div>
                  <div style={styles.pressKitSection}>
                    <div style={styles.statLabel}>Published Releases</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>{pressKit.key_metrics?.published_releases || 0}</div>
                  </div>
                </div>
              </div>

              {/* Downloadable Sections */}
              <div style={styles.card}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b', marginBottom: '14px' }}>Press Kit Sections</h3>
                {(pressKit.sections || []).map((section, i) => (
                  <div key={i} style={{ ...styles.pressKitSection, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500' }}>{section.title}</span>
                    {section.downloadable && (
                      <button style={{ ...styles.btnSmall, backgroundColor: '#f59e0b', color: '#1a1a2e' }}>
                        Download
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Recent Coverage */}
              {(pressKit.recent_coverage || []).length > 0 && (
                <div style={styles.card}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b', marginBottom: '14px' }}>Recent Coverage</h3>
                  {pressKit.recent_coverage.map((item, i) => (
                    <div key={i} style={styles.feedItem}>
                      <div>
                        <span style={{ fontWeight: '600' }}>{item.title || item.source}</span>
                        <span style={{ ...SENTIMENT_BADGE[item.sentiment], marginLeft: '8px' }}>{item.sentiment}</span>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{item.source} — {item.date_found}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Contact Modal ──────────────────────────────────────────────── */}
      {showContactModal && (
        <div style={styles.modal} onClick={() => setShowContactModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{editingContact ? 'Edit Contact' : 'Add Media Contact'}</h3>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Name *</label>
              <input style={styles.input} value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Contact name" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Outlet</label>
                <input style={styles.input} value={contactForm.outlet} onChange={e => setContactForm({ ...contactForm, outlet: e.target.value })} placeholder="e.g. TechCrunch" />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Beat</label>
                <input style={styles.input} value={contactForm.beat} onChange={e => setContactForm({ ...contactForm, beat: e.target.value })} placeholder="e.g. SaaS, AI" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Email</label>
                <input style={styles.input} value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} placeholder="email@outlet.com" />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Social URL</label>
                <input style={styles.input} value={contactForm.social_url} onChange={e => setContactForm({ ...contactForm, social_url: e.target.value })} placeholder="https://twitter.com/..." />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reach Estimate</label>
                <input style={styles.input} type="number" value={contactForm.reach_estimate} onChange={e => setContactForm({ ...contactForm, reach_estimate: e.target.value })} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Product Relevance (comma-separated)</label>
                <input style={styles.input} value={contactForm.product_relevance} onChange={e => setContactForm({ ...contactForm, product_relevance: e.target.value })} placeholder="Product A, Product B" />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Notes</label>
              <textarea style={styles.textarea} value={contactForm.notes} onChange={e => setContactForm({ ...contactForm, notes: e.target.value })} placeholder="Additional notes..." />
            </div>
            <div style={styles.formActions}>
              <button style={styles.btnSecondary} onClick={() => setShowContactModal(false)}>Cancel</button>
              <button style={styles.btnPrimary} onClick={handleSaveContact} disabled={!contactForm.name}>
                {editingContact ? 'Update Contact' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Release Modal ──────────────────────────────────────────────── */}
      {showReleaseModal && (
        <div style={styles.modal} onClick={() => setShowReleaseModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Create Press Release</h3>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Product *</label>
              <input style={styles.input} value={releaseForm.product} onChange={e => setReleaseForm({ ...releaseForm, product: e.target.value })} placeholder="Product name" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Headline</label>
              <input style={styles.input} value={releaseForm.headline} onChange={e => setReleaseForm({ ...releaseForm, headline: e.target.value })} placeholder="Press release headline" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Body</label>
              <textarea style={{ ...styles.textarea, minHeight: '180px' }} value={releaseForm.body} onChange={e => setReleaseForm({ ...releaseForm, body: e.target.value })} placeholder="Press release body..." />
            </div>
            <div style={styles.formGroup}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={releaseForm.generate} onChange={e => setReleaseForm({ ...releaseForm, generate: e.target.checked })} />
                <span style={{ fontSize: '13px', color: '#9ca3af' }}>Generate with AI (Claude API stub)</span>
              </label>
            </div>
            <div style={styles.formActions}>
              <button style={styles.btnSecondary} onClick={() => setShowReleaseModal(false)}>Cancel</button>
              <button style={styles.btnPrimary} onClick={handleSaveRelease} disabled={!releaseForm.product}>
                {releaseForm.generate ? 'Generate Release' : 'Create Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mention Modal ──────────────────────────────────────────────── */}
      {showMentionModal && (
        <div style={styles.modal} onClick={() => setShowMentionModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Add Media Mention</h3>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Source *</label>
              <input style={styles.input} value={mentionForm.source} onChange={e => setMentionForm({ ...mentionForm, source: e.target.value })} placeholder="e.g. TechCrunch, Forbes" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Product</label>
                <input style={styles.input} value={mentionForm.product} onChange={e => setMentionForm({ ...mentionForm, product: e.target.value })} placeholder="Product name" />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Sentiment</label>
                <select style={styles.select} value={mentionForm.sentiment} onChange={e => setMentionForm({ ...mentionForm, sentiment: e.target.value })}>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Title</label>
              <input style={styles.input} value={mentionForm.title} onChange={e => setMentionForm({ ...mentionForm, title: e.target.value })} placeholder="Article title" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>URL</label>
                <input style={styles.input} value={mentionForm.url} onChange={e => setMentionForm({ ...mentionForm, url: e.target.value })} placeholder="https://..." />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reach Estimate</label>
                <input style={styles.input} type="number" value={mentionForm.reach_estimate} onChange={e => setMentionForm({ ...mentionForm, reach_estimate: e.target.value })} />
              </div>
            </div>
            <div style={styles.formActions}>
              <button style={styles.btnSecondary} onClick={() => setShowMentionModal(false)}>Cancel</button>
              <button style={styles.btnPrimary} onClick={handleSaveMention} disabled={!mentionForm.source}>Add Mention</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Opportunity Modal ──────────────────────────────────────────── */}
      {showOppModal && (
        <div style={styles.modal} onClick={() => setShowOppModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Add Media Opportunity</h3>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Source *</label>
              <input style={styles.input} value={oppForm.source} onChange={e => setOppForm({ ...oppForm, source: e.target.value })} placeholder="e.g. HARO, JournoRequests" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Query Text *</label>
              <textarea style={styles.textarea} value={oppForm.query_text} onChange={e => setOppForm({ ...oppForm, query_text: e.target.value })} placeholder="What is the journalist looking for?" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Deadline</label>
                <input style={styles.input} type="datetime-local" value={oppForm.deadline} onChange={e => setOppForm({ ...oppForm, deadline: e.target.value })} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Relevance</label>
                <input style={styles.input} value={oppForm.relevance} onChange={e => setOppForm({ ...oppForm, relevance: e.target.value })} placeholder="Why is this relevant?" />
              </div>
            </div>
            <div style={styles.formActions}>
              <button style={styles.btnSecondary} onClick={() => setShowOppModal(false)}>Cancel</button>
              <button style={styles.btnPrimary} onClick={handleSaveOpportunity} disabled={!oppForm.source || !oppForm.query_text}>Add Opportunity</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
