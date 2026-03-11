'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchPartners,
  fetchPartnerDetail,
  createPartner,
  updatePartner,
  deletePartner,
  fetchPartnerReferrals,
  addPartnerReferral,
  fetchPartnerPayments,
  addPartnerPayment,
  updateReferralStatus,
  fetchCommissionSummary,
  draftPartnerUpdate,
  exportPartnerCommissions,
} from '../../../lib/api';

const TYPE_OPTIONS = [
  { value: 'affiliate', label: 'Affiliate' },
  { value: 'integration_partner', label: 'Integration Partner' },
  { value: 'reseller', label: 'Reseller' },
  { value: 'white_label', label: 'White Label' },
];

const STATUS_OPTIONS = ['active', 'paused', 'ended'];
const COMMISSION_STATUS_OPTIONS = ['owed', 'invoiced', 'paid'];

const TABS = [
  { key: 'all', label: 'All Partners' },
  { key: 'affiliate', label: 'Affiliates' },
  { key: 'integration_partner', label: 'Integration Partners' },
  { key: 'reseller', label: 'Resellers' },
];

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    padding: '24px 32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f59e0b',
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  headerActions: {
    display: 'flex',
    gap: 12,
  },
  btn: {
    padding: '8px 18px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    transition: 'opacity 0.2s',
  },
  btnPrimary: {
    backgroundColor: '#f59e0b',
    color: '#1a1a2e',
  },
  btnSecondary: {
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
  },
  btnDanger: {
    backgroundColor: '#ef4444',
    color: '#fff',
  },
  btnSmall: {
    padding: '4px 12px',
    fontSize: 12,
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: '20px 24px',
    border: '1px solid #2a2a4a',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f59e0b',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    borderBottom: '1px solid #2a2a4a',
    paddingBottom: 0,
  },
  tab: {
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    color: '#888',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#f59e0b',
    borderBottom: '2px solid #f59e0b',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#16213e',
    borderRadius: 10,
    overflow: 'hidden',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 11,
    fontWeight: 700,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1px solid #2a2a4a',
    backgroundColor: '#0f1629',
  },
  td: {
    padding: '12px 16px',
    fontSize: 13,
    borderBottom: '1px solid #1e1e3a',
    verticalAlign: 'middle',
  },
  row: {
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  badgeAffiliate: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  badgeIntegration: { backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  badgeReseller: { backgroundColor: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
  badgeWhiteLabel: { backgroundColor: 'rgba(236,72,153,0.15)', color: '#ec4899' },
  badgeActive: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  badgePaused: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  badgeEnded: { backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  badgeOwed: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  badgeInvoiced: { backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  badgePaid: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  expandedRow: {
    backgroundColor: '#0f1629',
    padding: 24,
    borderBottom: '1px solid #2a2a4a',
  },
  detailSection: {
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#f59e0b',
    marginBottom: 12,
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 32,
    width: 560,
    maxHeight: '80vh',
    overflowY: 'auto',
    border: '1px solid #2a2a4a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#f59e0b',
    marginBottom: 20,
    margin: 0,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#aaa',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 6,
    border: '1px solid #3a3a5a',
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 6,
    border: '1px solid #3a3a5a',
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 6,
    border: '1px solid #3a3a5a',
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
    minHeight: 80,
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  money: {
    fontFamily: '"SF Mono", Monaco, monospace',
    fontWeight: 600,
  },
  empty: {
    textAlign: 'center',
    padding: 40,
    color: '#666',
    fontSize: 14,
  },
};

function typeBadgeStyle(type) {
  switch (type) {
    case 'affiliate': return styles.badgeAffiliate;
    case 'integration_partner': return styles.badgeIntegration;
    case 'reseller': return styles.badgeReseller;
    case 'white_label': return styles.badgeWhiteLabel;
    default: return styles.badgeAffiliate;
  }
}

function statusBadgeStyle(status) {
  switch (status) {
    case 'active': return styles.badgeActive;
    case 'paused': return styles.badgePaused;
    case 'ended': return styles.badgeEnded;
    default: return styles.badgeActive;
  }
}

function commissionBadgeStyle(status) {
  switch (status) {
    case 'owed': return styles.badgeOwed;
    case 'invoiced': return styles.badgeInvoiced;
    case 'paid': return styles.badgePaid;
    default: return styles.badgeOwed;
  }
}

function formatTypeLabel(type) {
  return (TYPE_OPTIONS.find((t) => t.value === type) || {}).label || type;
}

function formatCurrency(val) {
  return '$' + (parseFloat(val) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PartnersPage() {
  const [partners, setPartners] = useState([]);
  const [summary, setSummary] = useState({ total_owed: 0, total_invoiced: 0, total_paid: 0 });
  const [activeTab, setActiveTab] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);

  // Add Partner form
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    partner_type: 'affiliate',
    products: '',
    commission_structure: '',
    payment_terms: '',
  });

  // Add referral form
  const [refForm, setRefForm] = useState({
    referred_email: '',
    product: '',
    subscription_value: '',
    commission_amount: '',
  });
  const [showRefModal, setShowRefModal] = useState(false);
  const [refPartnerId, setRefPartnerId] = useState(null);

  // Add payment form
  const [payForm, setPayForm] = useState({ amount: '', period: '' });
  const [showPayModal, setShowPayModal] = useState(false);
  const [payPartnerId, setPayPartnerId] = useState(null);

  const loadPartners = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (activeTab !== 'all') filters.type = activeTab;
      const data = await fetchPartners(filters);
      setPartners(data);
    } catch (err) {
      console.error('Failed to load partners:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchCommissionSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    try {
      const data = await fetchPartnerDetail(id);
      setDetail(data);
    } catch (err) {
      console.error('Failed to load partner detail:', err);
    }
  };

  const handleAddPartner = async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    try {
      let products = [];
      if (form.products.trim()) {
        products = form.products.split(',').map((p) => p.trim()).filter(Boolean);
      }
      let commission_structure_json = {};
      if (form.commission_structure.trim()) {
        try { commission_structure_json = JSON.parse(form.commission_structure); } catch { /* ignore parse errors */ }
      }
      await createPartner({
        company_name: form.company_name,
        contact_name: form.contact_name,
        contact_email: form.contact_email,
        partner_type: form.partner_type,
        products,
        commission_structure_json,
        payment_terms: form.payment_terms,
        agreement_date: new Date().toISOString().split('T')[0],
      });
      setShowAddModal(false);
      setForm({ company_name: '', contact_name: '', contact_email: '', partner_type: 'affiliate', products: '', commission_structure: '', payment_terms: '' });
      loadPartners();
      loadSummary();
    } catch (err) {
      console.error('Failed to create partner:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePartner = async (id, updates) => {
    try {
      await updatePartner(id, updates);
      loadPartners();
      if (expandedId === id) {
        const data = await fetchPartnerDetail(id);
        setDetail(data);
      }
    } catch (err) {
      console.error('Failed to update partner:', err);
    }
  };

  const handleDeletePartner = async (id) => {
    if (!confirm('Deactivate this partner?')) return;
    try {
      await deletePartner(id);
      loadPartners();
      loadSummary();
      if (expandedId === id) {
        setExpandedId(null);
        setDetail(null);
      }
    } catch (err) {
      console.error('Failed to deactivate partner:', err);
    }
  };

  const handleAddReferral = async () => {
    if (!refForm.product.trim()) return;
    setSaving(true);
    try {
      await addPartnerReferral(refPartnerId, {
        referred_email: refForm.referred_email,
        product: refForm.product,
        subscription_value: parseFloat(refForm.subscription_value) || 0,
        commission_amount: parseFloat(refForm.commission_amount) || 0,
      });
      setShowRefModal(false);
      setRefForm({ referred_email: '', product: '', subscription_value: '', commission_amount: '' });
      loadPartners();
      loadSummary();
      if (expandedId === refPartnerId) {
        const data = await fetchPartnerDetail(refPartnerId);
        setDetail(data);
      }
    } catch (err) {
      console.error('Failed to add referral:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount) return;
    setSaving(true);
    try {
      await addPartnerPayment(payPartnerId, {
        amount: parseFloat(payForm.amount),
        period: payForm.period,
        status: 'paid',
      });
      setShowPayModal(false);
      setPayForm({ amount: '', period: '' });
      loadPartners();
      loadSummary();
      if (expandedId === payPartnerId) {
        const data = await fetchPartnerDetail(payPartnerId);
        setDetail(data);
      }
    } catch (err) {
      console.error('Failed to add payment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateReferralStatus = async (refId, newStatus) => {
    try {
      await updateReferralStatus(refId, { commission_status: newStatus });
      loadSummary();
      if (expandedId && detail) {
        const data = await fetchPartnerDetail(expandedId);
        setDetail(data);
      }
    } catch (err) {
      console.error('Failed to update referral status:', err);
    }
  };

  const handleDraftEmail = async (id) => {
    try {
      const result = await draftPartnerUpdate(id);
      alert(`Draft Email:\n\nSubject: ${result.subject}\n\n${result.body}`);
    } catch (err) {
      console.error('Failed to draft email:', err);
    }
  };

  const handleExport = async () => {
    try {
      await exportPartnerCommissions();
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Affiliate & Partner Manager</h1>
          <div style={styles.subtitle}>Manage partners, track referrals, and monitor commissions</div>
        </div>
        <div style={styles.headerActions}>
          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={handleExport}>Export CSV</button>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowAddModal(true)}>+ Add Partner</button>
        </div>
      </div>

      {/* Commission Summary Cards */}
      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Commission Owed</div>
          <div style={styles.summaryValue}>{formatCurrency(summary.total_owed)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Commission Invoiced</div>
          <div style={styles.summaryValue}>{formatCurrency(summary.total_invoiced)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Commission Paid</div>
          <div style={{ ...styles.summaryValue, color: '#22c55e' }}>{formatCurrency(summary.total_paid)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={{ ...styles.tab, ...(activeTab === tab.key ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Partner Table */}
      {loading ? (
        <div style={styles.empty}>Loading partners...</div>
      ) : partners.length === 0 ? (
        <div style={styles.empty}>No partners found. Click "+ Add Partner" to get started.</div>
      ) : (
        <div style={{ borderRadius: 10, overflow: 'hidden' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Company</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Products</th>
                <th style={styles.th}>Referrals</th>
                <th style={styles.th}>Revenue</th>
                <th style={styles.th}>Owed</th>
                <th style={styles.th}>Paid</th>
                <th style={styles.th}>Last Referral</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <React.Fragment key={p.id}>
                  <tr
                    style={{ ...styles.row, backgroundColor: expandedId === p.id ? '#0f1629' : 'transparent' }}
                    onClick={() => handleExpand(p.id)}
                    onMouseEnter={(e) => { if (expandedId !== p.id) e.currentTarget.style.backgroundColor = '#1e1e3a'; }}
                    onMouseLeave={(e) => { if (expandedId !== p.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{p.company_name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{p.contact_email}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...typeBadgeStyle(p.partner_type) }}>
                        {formatTypeLabel(p.partner_type)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {Array.isArray(p.products) ? p.products.join(', ') : '--'}
                    </td>
                    <td style={{ ...styles.td, ...styles.money }}>{p.total_referrals || 0}</td>
                    <td style={{ ...styles.td, ...styles.money }}>{formatCurrency(p.total_revenue)}</td>
                    <td style={{ ...styles.td, ...styles.money, color: '#f59e0b' }}>{formatCurrency(p.commission_owed)}</td>
                    <td style={{ ...styles.td, ...styles.money, color: '#22c55e' }}>{formatCurrency(p.commission_paid)}</td>
                    <td style={styles.td}>{formatDate(p.last_referral)}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...statusBadgeStyle(p.status) }}>{p.status}</span>
                    </td>
                  </tr>

                  {/* Expanded Detail */}
                  {expandedId === p.id && detail && (
                    <tr>
                      <td colSpan={9} style={styles.expandedRow}>
                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                          <button
                            style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnPrimary }}
                            onClick={(e) => { e.stopPropagation(); setRefPartnerId(p.id); setShowRefModal(true); }}
                          >
                            + Add Referral
                          </button>
                          <button
                            style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary }}
                            onClick={(e) => { e.stopPropagation(); setPayPartnerId(p.id); setShowPayModal(true); }}
                          >
                            Record Payment
                          </button>
                          <button
                            style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary }}
                            onClick={(e) => { e.stopPropagation(); handleDraftEmail(p.id); }}
                          >
                            Draft Update Email
                          </button>
                          <button
                            style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnSecondary }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPartner(p.id);
                            }}
                          >
                            Edit Partner
                          </button>
                          <button
                            style={{ ...styles.btn, ...styles.btnSmall, ...styles.btnDanger }}
                            onClick={(e) => { e.stopPropagation(); handleDeletePartner(p.id); }}
                          >
                            Deactivate
                          </button>
                        </div>

                        {/* Partner Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#888' }}>Contact</div>
                            <div style={{ color: '#fff', fontSize: 13 }}>{detail.contact_name || '--'}</div>
                            <div style={{ color: '#aaa', fontSize: 12 }}>{detail.contact_email || '--'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#888' }}>Tracking Code</div>
                            <div style={{ color: '#f59e0b', fontSize: 13, fontFamily: 'monospace' }}>{detail.tracking_code || '--'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#888' }}>Payment Terms</div>
                            <div style={{ color: '#fff', fontSize: 13 }}>{detail.payment_terms || '--'}</div>
                          </div>
                        </div>

                        {/* Referral History */}
                        <div style={styles.detailSection}>
                          <div style={styles.detailTitle}>Referral History</div>
                          {detail.referrals && detail.referrals.length > 0 ? (
                            <table style={{ ...styles.table, fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th style={styles.th}>Email</th>
                                  <th style={styles.th}>Product</th>
                                  <th style={styles.th}>Signup Date</th>
                                  <th style={styles.th}>Value</th>
                                  <th style={styles.th}>Commission</th>
                                  <th style={styles.th}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.referrals.map((ref) => (
                                  <tr key={ref.id}>
                                    <td style={styles.td}>{ref.referred_email || '--'}</td>
                                    <td style={styles.td}>{ref.product}</td>
                                    <td style={styles.td}>{formatDate(ref.signup_date)}</td>
                                    <td style={{ ...styles.td, ...styles.money }}>{formatCurrency(ref.subscription_value)}</td>
                                    <td style={{ ...styles.td, ...styles.money }}>{formatCurrency(ref.commission_amount)}</td>
                                    <td style={styles.td}>
                                      <select
                                        value={ref.commission_status}
                                        onChange={(e) => handleUpdateReferralStatus(ref.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          ...styles.select,
                                          width: 'auto',
                                          padding: '3px 8px',
                                          fontSize: 11,
                                          ...commissionBadgeStyle(ref.commission_status),
                                          border: 'none',
                                          borderRadius: 12,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {COMMISSION_STATUS_OPTIONS.map((s) => (
                                          <option key={s} value={s}>{s}</option>
                                        ))}
                                      </select>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ color: '#666', fontSize: 13 }}>No referrals yet</div>
                          )}
                        </div>

                        {/* Payment Log */}
                        <div style={styles.detailSection}>
                          <div style={styles.detailTitle}>Payment Log</div>
                          {detail.payments && detail.payments.length > 0 ? (
                            <table style={{ ...styles.table, fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th style={styles.th}>Amount</th>
                                  <th style={styles.th}>Period</th>
                                  <th style={styles.th}>Status</th>
                                  <th style={styles.th}>Paid At</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.payments.map((pay) => (
                                  <tr key={pay.id}>
                                    <td style={{ ...styles.td, ...styles.money }}>{formatCurrency(pay.amount)}</td>
                                    <td style={styles.td}>{pay.period || '--'}</td>
                                    <td style={styles.td}>
                                      <span style={{ ...styles.badge, ...(pay.status === 'paid' ? styles.badgePaid : styles.badgeOwed) }}>
                                        {pay.status}
                                      </span>
                                    </td>
                                    <td style={styles.td}>{formatDate(pay.paid_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ color: '#666', fontSize: 13 }}>No payments recorded</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Partner Modal */}
      {showAddModal && (
        <div style={styles.modal} onClick={() => setShowAddModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Add Partner</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>Company Name *</label>
              <input
                style={styles.input}
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Acme Corp"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Contact Name</label>
                <input
                  style={styles.input}
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="Jane Smith"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Contact Email</label>
                <input
                  style={styles.input}
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="jane@acme.com"
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Partner Type</label>
              <select
                style={styles.select}
                value={form.partner_type}
                onChange={(e) => setForm({ ...form, partner_type: e.target.value })}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Products (comma-separated)</label>
              <input
                style={styles.input}
                value={form.products}
                onChange={(e) => setForm({ ...form, products: e.target.value })}
                placeholder="Product A, Product B"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Commission Structure (JSON)</label>
              <textarea
                style={styles.textarea}
                value={form.commission_structure}
                onChange={(e) => setForm({ ...form, commission_structure: e.target.value })}
                placeholder='{"rate": 0.15, "type": "percentage"}'
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Payment Terms</label>
              <input
                style={styles.input}
                value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                placeholder="Net 30"
              />
            </div>
            <div style={styles.formActions}>
              <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleAddPartner} disabled={saving}>
                {saving ? 'Creating...' : 'Create Partner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Referral Modal */}
      {showRefModal && (
        <div style={styles.modal} onClick={() => setShowRefModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Add Referral</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>Referred Email</label>
              <input
                style={styles.input}
                value={refForm.referred_email}
                onChange={(e) => setRefForm({ ...refForm, referred_email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Product *</label>
              <input
                style={styles.input}
                value={refForm.product}
                onChange={(e) => setRefForm({ ...refForm, product: e.target.value })}
                placeholder="Product name"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Subscription Value ($)</label>
                <input
                  style={styles.input}
                  type="number"
                  value={refForm.subscription_value}
                  onChange={(e) => setRefForm({ ...refForm, subscription_value: e.target.value })}
                  placeholder="99.00"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Commission Amount ($)</label>
                <input
                  style={styles.input}
                  type="number"
                  value={refForm.commission_amount}
                  onChange={(e) => setRefForm({ ...refForm, commission_amount: e.target.value })}
                  placeholder="14.85"
                />
              </div>
            </div>
            <div style={styles.formActions}>
              <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowRefModal(false)}>Cancel</button>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleAddReferral} disabled={saving}>
                {saving ? 'Adding...' : 'Add Referral'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayModal && (
        <div style={styles.modal} onClick={() => setShowPayModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Record Payment</h2>
            <div style={styles.formGroup}>
              <label style={styles.label}>Amount ($) *</label>
              <input
                style={styles.input}
                type="number"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                placeholder="500.00"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Period</label>
              <input
                style={styles.input}
                value={payForm.period}
                onChange={(e) => setPayForm({ ...payForm, period: e.target.value })}
                placeholder="March 2026"
              />
            </div>
            <div style={styles.formActions}>
              <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowPayModal(false)}>Cancel</button>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleAddPayment} disabled={saving}>
                {saving ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
