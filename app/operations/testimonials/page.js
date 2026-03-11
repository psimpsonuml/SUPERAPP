'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchTestimonials,
  fetchTestimonialStats,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  approveTestimonial,
  generateTestimonialSocial,
  exportTestimonials
} from '../../../lib/api';

const CATEGORIES = [
  { value: 'text_review', label: 'Text Review' },
  { value: 'video_testimonial', label: 'Video Testimonial' },
  { value: 'social_media_post', label: 'Social Media Post' },
  { value: 'email_excerpt', label: 'Email Excerpt' },
  { value: 'case_study', label: 'Case Study' }
];

const SOURCES = ['G2', 'Capterra', 'Trustpilot', 'Google', 'Twitter', 'LinkedIn', 'Email', 'Website', 'Other'];

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
  headerActions: {
    display: 'flex',
    gap: '10px'
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
    padding: '6px 12px',
    fontSize: '12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500'
  },
  btnApprove: {
    backgroundColor: '#10b981',
    color: '#fff'
  },
  btnEdit: {
    backgroundColor: '#3b82f6',
    color: '#fff'
  },
  btnCopy: {
    backgroundColor: '#6b7280',
    color: '#fff'
  },
  btnSocial: {
    backgroundColor: '#8b5cf6',
    color: '#fff'
  },
  btnDanger: {
    backgroundColor: '#ef4444',
    color: '#fff'
  },
  btnExpand: {
    backgroundColor: 'transparent',
    color: '#f59e0b',
    border: '1px solid #f59e0b'
  },

  // Filter bar
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '16px 20px',
    marginBottom: '24px',
    border: '1px solid #2a2a4a'
  },
  filterSelect: {
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    minWidth: '140px',
    outline: 'none'
  },
  filterInput: {
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    width: '160px',
    outline: 'none'
  },
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#9ca3af'
  },
  toggle: {
    width: '40px',
    height: '22px',
    borderRadius: '11px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.2s'
  },

  // Stats section
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
    marginBottom: '8px'
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

  // Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },

  // Card
  card: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a2a4a',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'border-color 0.2s'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  quote: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#d1d5db',
    fontStyle: 'italic',
    flex: 1
  },
  authorSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  authorAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#f59e0b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
    color: '#1a1a2e',
    flexShrink: 0
  },
  authorName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e0e0e0'
  },
  authorTitle: {
    fontSize: '12px',
    color: '#6b7280'
  },
  badges: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap'
  },
  badge: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '12px',
    fontWeight: '500'
  },
  badgeSource: {
    backgroundColor: '#1e3a5f',
    color: '#60a5fa'
  },
  badgeVerified: {
    backgroundColor: '#064e3b',
    color: '#34d399'
  },
  badgeApproved: {
    backgroundColor: '#78350f',
    color: '#fbbf24'
  },
  badgeCategory: {
    backgroundColor: '#312e81',
    color: '#a78bfa'
  },
  cardActions: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: 'auto',
    paddingTop: '8px',
    borderTop: '1px solid #2a2a4a'
  },
  stars: {
    display: 'flex',
    gap: '2px'
  },

  // Modal overlay
  overlay: {
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
  modal: {
    backgroundColor: '#16213e',
    borderRadius: '16px',
    padding: '28px',
    width: '560px',
    maxWidth: '95vw',
    maxHeight: '90vh',
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
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    minHeight: '100px',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 0'
  },
  pageBtn: {
    backgroundColor: '#16213e',
    color: '#e0e0e0',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  expandedQuote: {
    fontSize: '15px',
    lineHeight: '1.8',
    color: '#d1d5db',
    fontStyle: 'italic',
    whiteSpace: 'pre-wrap'
  }
};

// ── Components ──────────────────────────────────────────────────────────────

function StarRating({ rating, size = 16, interactive = false, onChange }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span
        key={i}
        onClick={interactive ? () => onChange(i) : undefined}
        style={{
          color: i <= (rating || 0) ? '#f59e0b' : '#4b5563',
          fontSize: `${size}px`,
          cursor: interactive ? 'pointer' : 'default',
          userSelect: 'none'
        }}
      >
        ★
      </span>
    );
  }
  return <div style={styles.stars}>{stars}</div>;
}

function TestimonialCard({ testimonial, onApprove, onEdit, onCopy, onSocial, onDelete, onExpand }) {
  const truncated = testimonial.quote_text.length > 180
    ? testimonial.quote_text.substring(0, 180) + '...'
    : testimonial.quote_text;

  const initials = (testimonial.author_name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.badges}>
          {testimonial.source_platform && (
            <span style={{ ...styles.badge, ...styles.badgeSource }}>
              {testimonial.source_platform}
            </span>
          )}
          {testimonial.verified && (
            <span style={{ ...styles.badge, ...styles.badgeVerified }}>Verified</span>
          )}
          {testimonial.approved && (
            <span style={{ ...styles.badge, ...styles.badgeApproved }}>Approved</span>
          )}
          <span style={{ ...styles.badge, ...styles.badgeCategory }}>
            {CATEGORIES.find((c) => c.value === testimonial.category)?.label || testimonial.category}
          </span>
        </div>
        {testimonial.rating != null && (
          <StarRating rating={testimonial.rating} size={14} />
        )}
      </div>

      <div style={styles.quote}>"{truncated}"</div>

      <div style={styles.authorSection}>
        <div style={styles.authorAvatar}>{initials}</div>
        <div>
          <div style={styles.authorName}>{testimonial.author_name || 'Anonymous'}</div>
          <div style={styles.authorTitle}>
            {[testimonial.author_title, testimonial.author_company].filter(Boolean).join(' at ')}
          </div>
        </div>
      </div>

      {testimonial.tags && testimonial.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {testimonial.tags.map((tag, i) => (
            <span key={i} style={{ fontSize: '11px', color: '#9ca3af', backgroundColor: '#1a1a2e', padding: '2px 8px', borderRadius: '10px' }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div style={styles.cardActions}>
        {!testimonial.approved && (
          <button
            style={{ ...styles.btnSmall, ...styles.btnApprove }}
            onClick={() => onApprove(testimonial.id)}
          >
            Approve
          </button>
        )}
        <button
          style={{ ...styles.btnSmall, ...styles.btnEdit }}
          onClick={() => onEdit(testimonial)}
        >
          Edit
        </button>
        <button
          style={{ ...styles.btnSmall, ...styles.btnCopy }}
          onClick={() => onCopy(testimonial.quote_text)}
        >
          Copy
        </button>
        <button
          style={{ ...styles.btnSmall, ...styles.btnSocial }}
          onClick={() => onSocial(testimonial.id)}
        >
          Social Post
        </button>
        <button
          style={{ ...styles.btnSmall, ...styles.btnExpand }}
          onClick={() => onExpand(testimonial)}
        >
          Expand
        </button>
        <button
          style={{ ...styles.btnSmall, ...styles.btnDanger }}
          onClick={() => onDelete(testimonial.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [filterProduct, setFilterProduct] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterApproved, setFilterApproved] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState(null);
  const [expandedTestimonial, setExpandedTestimonial] = useState(null);
  const [socialResult, setSocialResult] = useState(null);

  // Form state
  const emptyForm = {
    quote_text: '', author_name: '', author_title: '', author_company: '',
    product: '', source_platform: '', source_url: '', rating: 5,
    category: 'text_review', tags: '', photo_url: ''
  };
  const [form, setForm] = useState(emptyForm);

  const loadTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filterProduct) params.product = filterProduct;
      if (filterSource) params.source = filterSource;
      if (filterTag) params.tag = filterTag;
      if (filterRating) params.rating = filterRating;
      if (filterApproved) params.approved = filterApproved;
      if (filterCategory) params.category = filterCategory;

      const res = await fetchTestimonials(params);
      setTestimonials(res.testimonials || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load testimonials:', err);
    }
    setLoading(false);
  }, [page, filterProduct, filterSource, filterTag, filterRating, filterApproved, filterCategory]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchTestimonialStats();
      setStats(res);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  useEffect(() => {
    loadTestimonials();
    loadStats();
  }, [loadTestimonials, loadStats]);

  // Products derived from stats
  const products = stats ? Object.keys(stats.byProduct || {}) : [];

  // Handlers
  const handleApprove = async (id) => {
    try {
      await approveTestimonial(id);
      loadTestimonials();
      loadStats();
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this testimonial?')) return;
    try {
      await deleteTestimonial(id);
      loadTestimonials();
      loadStats();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleSocial = async (id) => {
    try {
      const result = await generateTestimonialSocial(id, { platform: 'twitter' });
      setSocialResult(result);
    } catch (err) {
      console.error('Social generation failed:', err);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportTestimonials();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'testimonials_export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleAddSubmit = async () => {
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        rating: form.rating ? parseInt(form.rating) : null
      };
      await createTestimonial(payload);
      setShowAddModal(false);
      setForm(emptyForm);
      loadTestimonials();
      loadStats();
    } catch (err) {
      console.error('Create failed:', err);
    }
  };

  const handleEditSubmit = async () => {
    try {
      const payload = {
        ...form,
        tags: typeof form.tags === 'string'
          ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : form.tags,
        rating: form.rating ? parseInt(form.rating) : null
      };
      await updateTestimonial(editingTestimonial.id, payload);
      setEditingTestimonial(null);
      setForm(emptyForm);
      loadTestimonials();
      loadStats();
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const openEdit = (testimonial) => {
    setForm({
      quote_text: testimonial.quote_text || '',
      author_name: testimonial.author_name || '',
      author_title: testimonial.author_title || '',
      author_company: testimonial.author_company || '',
      product: testimonial.product || '',
      source_platform: testimonial.source_platform || '',
      source_url: testimonial.source_url || '',
      rating: testimonial.rating || 5,
      category: testimonial.category || 'text_review',
      tags: Array.isArray(testimonial.tags) ? testimonial.tags.join(', ') : '',
      photo_url: testimonial.photo_url || ''
    });
    setEditingTestimonial(testimonial);
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Testimonial Library</h1>
          <p style={styles.subtitle}>Collect, curate, and share customer testimonials across channels</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnSecondary} onClick={handleExport}>Export Approved</button>
          <button style={styles.btnPrimary} onClick={() => { setForm(emptyForm); setShowAddModal(true); }}>
            + Add Testimonial
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={styles.statsContainer}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Testimonials</div>
            <div style={styles.statValue}>{stats.total || 0}</div>
            <div style={styles.statSub}>{stats.approvedCount || 0} approved, {stats.verifiedCount || 0} verified</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Average Rating</div>
            <div style={styles.statValue}>{stats.averageRating || 0}</div>
            <div style={{ marginTop: '4px' }}>
              <StarRating rating={Math.round(stats.averageRating || 0)} size={18} />
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>By Product</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
              {Object.entries(stats.byProduct || {}).map(([product, count]) => (
                <div key={product} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#d1d5db' }}>{product}</span>
                  <span style={{ color: '#f59e0b', fontWeight: '600' }}>{count}</span>
                </div>
              ))}
              {Object.keys(stats.byProduct || {}).length === 0 && (
                <span style={{ color: '#6b7280', fontSize: '13px' }}>No data yet</span>
              )}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Top Praise Themes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {(stats.commonTags || []).slice(0, 6).map(({ tag, count }) => (
                <span key={tag} style={{
                  fontSize: '12px', backgroundColor: '#1a1a2e', color: '#f59e0b',
                  padding: '4px 10px', borderRadius: '12px', border: '1px solid #f59e0b33'
                }}>
                  {tag} ({count})
                </span>
              ))}
              {(stats.commonTags || []).length === 0 && (
                <span style={{ color: '#6b7280', fontSize: '13px' }}>No tags yet</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div style={styles.filterBar}>
        <select
          style={styles.filterSelect}
          value={filterProduct}
          onChange={(e) => { setFilterProduct(e.target.value); setPage(1); }}
        >
          <option value="">All Products</option>
          {products.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          style={styles.filterSelect}
          value={filterSource}
          onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}
        >
          <option value="">All Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          style={styles.filterInput}
          placeholder="Filter by tag..."
          value={filterTag}
          onChange={(e) => { setFilterTag(e.target.value); setPage(1); }}
        />

        <select
          style={styles.filterSelect}
          value={filterRating}
          onChange={(e) => { setFilterRating(e.target.value); setPage(1); }}
        >
          <option value="">Any Rating</option>
          {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} Stars</option>)}
        </select>

        <select
          style={styles.filterSelect}
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <div style={styles.toggleContainer}>
          <span>Approved Only</span>
          <button
            style={{
              ...styles.toggle,
              backgroundColor: filterApproved === 'true' ? '#f59e0b' : '#4b5563'
            }}
            onClick={() => {
              setFilterApproved(filterApproved === 'true' ? '' : 'true');
              setPage(1);
            }}
          >
            <span style={{
              display: 'block',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              position: 'absolute',
              top: '3px',
              left: filterApproved === 'true' ? '21px' : '3px',
              transition: 'left 0.2s'
            }} />
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>Loading testimonials...</div>
      ) : testimonials.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>No testimonials found</div>
          <p>Add your first testimonial or adjust filters</p>
        </div>
      ) : (
        <>
          <div style={styles.grid}>
            {testimonials.map((t) => (
              <TestimonialCard
                key={t.id}
                testimonial={t}
                onApprove={handleApprove}
                onEdit={openEdit}
                onCopy={handleCopy}
                onSocial={handleSocial}
                onDelete={handleDelete}
                onExpand={setExpandedTestimonial}
              />
            ))}
          </div>
          <div style={styles.pagination}>
            <button
              style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.4 : 1 }}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>
              Page {page} of {totalPages}
            </span>
            <button
              style={{ ...styles.pageBtn, opacity: page >= totalPages ? 0.4 : 1 }}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingTestimonial) && (
        <div style={styles.overlay} onClick={() => { setShowAddModal(false); setEditingTestimonial(null); }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>
              {editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}
            </h2>

            <div style={styles.formGroup}>
              <label style={styles.label}>Quote</label>
              <textarea
                style={styles.textarea}
                value={form.quote_text}
                onChange={(e) => updateForm('quote_text', e.target.value)}
                placeholder="Enter the customer testimonial..."
              />
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Author Name</label>
                <input
                  style={styles.input}
                  value={form.author_name}
                  onChange={(e) => updateForm('author_name', e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Author Title</label>
                <input
                  style={styles.input}
                  value={form.author_title}
                  onChange={(e) => updateForm('author_title', e.target.value)}
                  placeholder="VP of Engineering"
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Company</label>
                <input
                  style={styles.input}
                  value={form.author_company}
                  onChange={(e) => updateForm('author_company', e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Product</label>
                <input
                  style={styles.input}
                  value={form.product}
                  onChange={(e) => updateForm('product', e.target.value)}
                  placeholder="BeaconOps Pro"
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Source Platform</label>
                <select
                  style={styles.input}
                  value={form.source_platform}
                  onChange={(e) => updateForm('source_platform', e.target.value)}
                >
                  <option value="">Select source...</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Source URL</label>
                <input
                  style={styles.input}
                  value={form.source_url}
                  onChange={(e) => updateForm('source_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Rating</label>
                <StarRating
                  rating={form.rating}
                  size={24}
                  interactive
                  onChange={(val) => updateForm('rating', val)}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Category</label>
                <select
                  style={styles.input}
                  value={form.category}
                  onChange={(e) => updateForm('category', e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Tags (comma-separated)</label>
              <input
                style={styles.input}
                value={form.tags}
                onChange={(e) => updateForm('tags', e.target.value)}
                placeholder="reliability, support, ease-of-use"
              />
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.btnSecondary}
                onClick={() => { setShowAddModal(false); setEditingTestimonial(null); setForm(emptyForm); }}
              >
                Cancel
              </button>
              <button
                style={styles.btnPrimary}
                onClick={editingTestimonial ? handleEditSubmit : handleAddSubmit}
              >
                {editingTestimonial ? 'Save Changes' : 'Add Testimonial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded View Modal */}
      {expandedTestimonial && (
        <div style={styles.overlay} onClick={() => setExpandedTestimonial(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Testimonial Details</h2>

            {expandedTestimonial.rating != null && (
              <div style={{ marginBottom: '16px' }}>
                <StarRating rating={expandedTestimonial.rating} size={22} />
              </div>
            )}

            <div style={styles.expandedQuote}>"{expandedTestimonial.quote_text}"</div>

            <div style={{ ...styles.authorSection, marginTop: '20px' }}>
              <div style={styles.authorAvatar}>
                {(expandedTestimonial.author_name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 2)}
              </div>
              <div>
                <div style={styles.authorName}>{expandedTestimonial.author_name || 'Anonymous'}</div>
                <div style={styles.authorTitle}>
                  {[expandedTestimonial.author_title, expandedTestimonial.author_company].filter(Boolean).join(' at ')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
              {expandedTestimonial.source_platform && (
                <span style={{ ...styles.badge, ...styles.badgeSource }}>{expandedTestimonial.source_platform}</span>
              )}
              {expandedTestimonial.verified && (
                <span style={{ ...styles.badge, ...styles.badgeVerified }}>Verified</span>
              )}
              {expandedTestimonial.approved && (
                <span style={{ ...styles.badge, ...styles.badgeApproved }}>Approved</span>
              )}
              <span style={{ ...styles.badge, ...styles.badgeCategory }}>
                {CATEGORIES.find((c) => c.value === expandedTestimonial.category)?.label || expandedTestimonial.category}
              </span>
            </div>

            {expandedTestimonial.tags && expandedTestimonial.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                {expandedTestimonial.tags.map((tag, i) => (
                  <span key={i} style={{ fontSize: '12px', color: '#f59e0b', backgroundColor: '#1a1a2e', padding: '4px 10px', borderRadius: '12px', border: '1px solid #f59e0b33' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {expandedTestimonial.source_url && (
              <div style={{ marginTop: '12px', fontSize: '13px' }}>
                <span style={{ color: '#6b7280' }}>Source: </span>
                <a href={expandedTestimonial.source_url} target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>
                  {expandedTestimonial.source_url}
                </a>
              </div>
            )}

            <div style={{ ...styles.modalActions, marginTop: '24px' }}>
              <button style={styles.btnSecondary} onClick={() => setExpandedTestimonial(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Social Post Result Modal */}
      {socialResult && (
        <div style={styles.overlay} onClick={() => setSocialResult(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Generated Social Post</h2>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase' }}>
              Platform: {socialResult.platform}
            </div>
            <div style={{
              backgroundColor: '#1a1a2e',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#d1d5db',
              border: '1px solid #2a2a4a'
            }}>
              {socialResult.generated_post}
            </div>
            {socialResult.note && (
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                {socialResult.note}
              </div>
            )}
            <div style={styles.modalActions}>
              <button
                style={styles.btnSecondary}
                onClick={() => {
                  navigator.clipboard.writeText(socialResult.generated_post);
                }}
              >
                Copy Post
              </button>
              <button style={styles.btnPrimary} onClick={() => setSocialResult(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
