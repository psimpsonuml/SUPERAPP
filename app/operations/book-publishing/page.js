'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchAuthBooks,
  fetchAuthBookDetail,
  createAuthBook,
  updateAuthBook,
  deleteAuthBook,
  fetchBookChapters,
  addBookChapter,
  updateBookChapter,
  editAssistChapter,
  fetchBookPublishingPlatforms,
  addBookPublishing,
  updateBookPublishing,
  fetchBookQueries,
  createBookQuery,
  updateBookQuery,
  fetchBookArcs,
  addBookArc,
  updateBookArc,
  fetchBookMarketing,
  addBookMarketingItem,
  updateBookMarketingItem,
  generateBookLaunchCalendar,
  fetchBookSalesData,
  fetchBookSalesSummary,
  fetchBookReviewsList,
  addBookReview,
  fetchBookSalesDashboard,
  fetchBookPubStats,
} from '../../../lib/api';

// ── Status Colors ──────────────────────────────────────────
const STATUS_COLORS = {
  drafting: '#6b7280',
  first_draft: '#f59e0b',
  editing: '#3b82f6',
  final_draft: '#8b5cf6',
  ready_to_publish: '#10b981',
  published: '#059669',
};

const CHAPTER_STATUS_COLORS = {
  drafting: '#6b7280',
  written: '#f59e0b',
  edited: '#3b82f6',
  final: '#10b981',
};

const PUB_STATUS_COLORS = {
  pending: '#6b7280',
  submitted: '#f59e0b',
  live: '#10b981',
  paused: '#f59e0b',
  removed: '#ef4444',
};

const QUERY_STATUS_COLORS = {
  queued: '#6b7280',
  sent: '#3b82f6',
  requested_materials: '#f59e0b',
  rejected: '#ef4444',
  offer: '#10b981',
  withdrawn: '#6b7280',
};

const MARKETING_STATUS_COLORS = {
  pending: '#6b7280',
  in_progress: '#3b82f6',
  completed: '#10b981',
  skipped: '#f59e0b',
};

const SENTIMENT_COLORS = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444',
};

const PLATFORMS = ['Amazon KDP', 'IngramSpark', 'B&N Press', 'Apple Books', 'Kobo', 'Google Play', 'Draft2Digital', 'ACX/Audible'];
const TABS = ['Manuscript', 'Publishing', 'Queries', 'ARCs', 'Marketing', 'Sales', 'Reviews'];

// ── Styles ──────────────────────────────────────────────────
const s = {
  page: { padding: 24, maxWidth: 1400, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#f5f5f5' },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: '#f5f5f5', margin: 0 },
  subtitle: { color: '#888', fontSize: 14, marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  statCard: { background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a4a' },
  statLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  statValue: { fontSize: 26, fontWeight: 700, color: '#f5f5f5' },
  bookGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 24 },
  bookCard: (selected) => ({
    background: selected ? '#1e1e3a' : '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    border: selected ? '2px solid #8b5cf6' : '1px solid #2a2a4a',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }),
  bookCover: { width: 60, height: 84, borderRadius: 6, background: '#2a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginRight: 14, flexShrink: 0, objectFit: 'cover' },
  bookInfo: { flex: 1, minWidth: 0 },
  bookTitle: { fontSize: 16, fontWeight: 600, color: '#f5f5f5', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  bookSeries: { fontSize: 12, color: '#888', marginTop: 2 },
  bookMeta: { fontSize: 12, color: '#aaa', marginTop: 6 },
  badge: (color) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 600,
    background: color + '22',
    color: color,
    border: `1px solid ${color}44`,
  }),
  statusBar: (status) => ({
    height: 4,
    borderRadius: 2,
    background: '#2a2a4a',
    marginTop: 8,
    position: 'relative',
    overflow: 'hidden',
  }),
  statusBarFill: (pct, color) => ({
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: `${pct}%`,
    background: color,
    borderRadius: 2,
    transition: 'width 0.3s',
  }),
  tabBar: { display: 'flex', gap: 0, borderBottom: '1px solid #2a2a4a', marginBottom: 20 },
  tab: (active) => ({
    padding: '10px 18px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? '#f5f5f5' : '#888',
    borderBottom: active ? '2px solid #8b5cf6' : '2px solid transparent',
    transition: 'all 0.2s',
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: active ? '#8b5cf6' : 'transparent',
  }),
  section: { background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a4a', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: '#f5f5f5', marginTop: 0, marginBottom: 14 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 12, color: '#888', textTransform: 'uppercase', borderBottom: '1px solid #2a2a4a', letterSpacing: '0.05em' },
  td: { padding: '10px 12px', fontSize: 13, color: '#ddd', borderBottom: '1px solid #1e1e36' },
  btn: (color = '#8b5cf6') => ({
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: color,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  }),
  btnSmall: (color = '#8b5cf6') => ({
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    background: color + '33',
    color: color,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  }),
  btnOutline: { padding: '8px 16px', borderRadius: 8, border: '1px solid #2a2a4a', background: 'transparent', color: '#ddd', fontSize: 13, cursor: 'pointer' },
  modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#1a1a2e', borderRadius: 16, padding: 28, border: '1px solid #2a2a4a', width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto' },
  modalTitle: { fontSize: 20, fontWeight: 700, color: '#f5f5f5', marginTop: 0, marginBottom: 18 },
  inputGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2a4a', background: '#12121f', color: '#f5f5f5', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2a4a', background: '#12121f', color: '#f5f5f5', fontSize: 14, outline: 'none', minHeight: 80, resize: 'vertical', boxSizing: 'border-box' },
  select: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2a4a', background: '#12121f', color: '#f5f5f5', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 },
  progressBar: { height: 8, borderRadius: 4, background: '#2a2a4a', overflow: 'hidden', marginTop: 8, marginBottom: 8 },
  progressFill: (pct, color) => ({ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }),
  platformCard: { background: '#12121f', borderRadius: 10, padding: 16, border: '1px solid #2a2a4a' },
  platformGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  timelineContainer: { position: 'relative', paddingLeft: 30 },
  timelineLine: { position: 'absolute', left: 12, top: 0, bottom: 0, width: 2, background: '#2a2a4a' },
  timelineItem: { position: 'relative', marginBottom: 16, paddingLeft: 20 },
  timelineDot: (color) => ({ position: 'absolute', left: -24, top: 6, width: 12, height: 12, borderRadius: '50%', background: color, border: '2px solid #1a1a2e' }),
  revenueCard: (color) => ({ background: '#1a1a2e', borderRadius: 12, padding: 20, border: '1px solid #2a2a4a', borderTop: `3px solid ${color}` }),
  revenueGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 },
  star: (filled) => ({ color: filled ? '#f59e0b' : '#2a2a4a', fontSize: 16 }),
  reviewCard: { background: '#12121f', borderRadius: 10, padding: 16, border: '1px solid #2a2a4a', marginBottom: 12 },
  flex: { display: 'flex', alignItems: 'center' },
  flexBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  mb8: { marginBottom: 8 },
  mb16: { marginBottom: 16 },
  mt8: { marginTop: 8 },
};

// ── Helpers ──────────────────────────────────────────────────
function formatCurrency(n) { return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatNumber(n) { return (n || 0).toLocaleString(); }
function statusLabel(st) { return (st || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function daysFromNow(d) { return daysBetween(new Date().toISOString().slice(0, 10), d); }

function Stars({ rating, size = 16 }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} style={{ color: i <= Math.round(rating || 0) ? '#f59e0b' : '#2a2a4a', fontSize: size }}>
        ★
      </span>
    );
  }
  return <span>{stars}</span>;
}

// ── Main Component ──────────────────────────────────────────
export default function BookPublishingPage() {
  const [accountId] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('account_id') || '';
    return '';
  });
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [activeTab, setActiveTab] = useState('Manuscript');
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Sub-data states
  const [chapters, setChapters] = useState([]);
  const [publishing, setPublishing] = useState([]);
  const [queries, setQueries] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [marketing, setMarketing] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [salesSummary, setSalesSummary] = useState({});
  const [reviews, setReviews] = useState([]);

  // Modals
  const [showAddBook, setShowAddBook] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [showAddQuery, setShowAddQuery] = useState(false);
  const [showAddArc, setShowAddArc] = useState(false);
  const [showAddMarketing, setShowAddMarketing] = useState(false);
  const [showAddReview, setShowAddReview] = useState(false);

  // Forms
  const [bookForm, setBookForm] = useState({ title: '', series_name: '', genre: '', synopsis: '', word_count: 0, target_date: '' });
  const [chapterForm, setChapterForm] = useState({ chapter_number: 1, title: '', word_count: 0 });
  const [platformForm, setPlatformForm] = useState({ platform: 'Amazon KDP', format: 'ebook', isbn: '', price: '', listing_url: '' });
  const [queryForm, setQueryForm] = useState({ agent_name: '', agency: '', email: '', materials_sent: '', response_deadline: '' });
  const [arcForm, setArcForm] = useState({ reader_name: '', reader_email: '', platform: '' });
  const [marketingForm, setMarketingForm] = useState({ date: '', action_type: '', description: '' });
  const [reviewForm, setReviewForm] = useState({ platform: '', reviewer: '', rating: 5, review_text: '', review_url: '', sentiment: 'neutral' });
  const [launchDate, setLaunchDate] = useState('');

  const selectedBook = books.find(b => b.id === selectedBookId) || null;

  // ── Data Loading ──────────────────────────────────────────
  const loadBooks = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetchAuthBooks(accountId);
      setBooks(res.books || []);
      if (!selectedBookId && res.books?.length) setSelectedBookId(res.books[0].id);
    } catch (e) { console.error('loadBooks error:', e); }
  }, [accountId, selectedBookId]);

  const loadStats = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetchBookPubStats(accountId);
      setStats(res || {});
    } catch (e) { console.error('loadStats error:', e); }
  }, [accountId]);

  const loadTabData = useCallback(async () => {
    if (!accountId || !selectedBookId) return;
    try {
      switch (activeTab) {
        case 'Manuscript': {
          const res = await fetchBookChapters(selectedBookId, accountId);
          setChapters(res.chapters || []);
          break;
        }
        case 'Publishing': {
          const res = await fetchBookPublishingPlatforms(selectedBookId, accountId);
          setPublishing(res.publishing || []);
          break;
        }
        case 'Queries': {
          const res = await fetchBookQueries(selectedBookId, accountId);
          setQueries(res.queries || []);
          break;
        }
        case 'ARCs': {
          const res = await fetchBookArcs(selectedBookId, accountId);
          setArcs(res.arcs || []);
          break;
        }
        case 'Marketing': {
          const res = await fetchBookMarketing(selectedBookId, accountId);
          setMarketing(res.marketing || []);
          break;
        }
        case 'Sales': {
          const [salesRes, summaryRes] = await Promise.all([
            fetchBookSalesData(selectedBookId, accountId),
            fetchBookSalesSummary(selectedBookId, accountId),
          ]);
          setSalesData(salesRes.sales || []);
          setSalesSummary(summaryRes || {});
          break;
        }
        case 'Reviews': {
          const res = await fetchBookReviewsList(selectedBookId, accountId);
          setReviews(res.reviews || []);
          break;
        }
        default: break;
      }
    } catch (e) { console.error('loadTabData error:', e); }
  }, [accountId, selectedBookId, activeTab]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadBooks(), loadStats()]);
      setLoading(false);
    })();
  }, [loadBooks, loadStats]);

  useEffect(() => { loadTabData(); }, [loadTabData]);

  // ── Handlers ──────────────────────────────────────────────
  const handleAddBook = async () => {
    if (!bookForm.title.trim()) return;
    await createAuthBook({ account_id: accountId, ...bookForm, word_count: parseInt(bookForm.word_count) || 0 });
    setShowAddBook(false);
    setBookForm({ title: '', series_name: '', genre: '', synopsis: '', word_count: 0, target_date: '' });
    await loadBooks();
    await loadStats();
  };

  const handleDeleteBook = async (bookId) => {
    if (!confirm('Delete this book and all related data?')) return;
    await deleteAuthBook(bookId, accountId);
    if (selectedBookId === bookId) setSelectedBookId(null);
    await loadBooks();
    await loadStats();
  };

  const handleUpdateBookStatus = async (bookId, newStatus) => {
    await updateAuthBook(bookId, { account_id: accountId, draft_status: newStatus });
    await loadBooks();
  };

  const handleAddChapter = async () => {
    await addBookChapter(selectedBookId, { account_id: accountId, ...chapterForm, word_count: parseInt(chapterForm.word_count) || 0, chapter_number: parseInt(chapterForm.chapter_number) || 1 });
    setShowAddChapter(false);
    setChapterForm({ chapter_number: (chapters.length || 0) + 1, title: '', word_count: 0 });
    await loadTabData();
  };

  const handleUpdateChapter = async (chapId, updates) => {
    await updateBookChapter(chapId, { account_id: accountId, ...updates });
    await loadTabData();
  };

  const handleEditAssist = async (chapId) => {
    try {
      const res = await editAssistChapter(chapId, accountId);
      alert(`Edit Score: ${res.edit_assist?.overall_score || 'N/A'}/100\n\nSuggestions:\n${(res.edit_assist?.suggestions || []).map(sg => `- [${sg.type}] ${sg.note}`).join('\n')}`);
      await loadTabData();
    } catch (e) { alert('Edit assist failed: ' + e.message); }
  };

  const handleAddPlatform = async () => {
    if (!platformForm.platform) return;
    await addBookPublishing(selectedBookId, { account_id: accountId, ...platformForm, price: parseFloat(platformForm.price) || null });
    setShowAddPlatform(false);
    setPlatformForm({ platform: 'Amazon KDP', format: 'ebook', isbn: '', price: '', listing_url: '' });
    await loadTabData();
  };

  const handleUpdatePublishing = async (pubId, updates) => {
    await updateBookPublishing(pubId, { account_id: accountId, ...updates });
    await loadTabData();
  };

  const handleAddQuery = async () => {
    if (!queryForm.agent_name) return;
    await createBookQuery(selectedBookId, { account_id: accountId, ...queryForm, book_title: selectedBook?.title, genre: selectedBook?.genre });
    setShowAddQuery(false);
    setQueryForm({ agent_name: '', agency: '', email: '', materials_sent: '', response_deadline: '' });
    await loadTabData();
  };

  const handleUpdateQuery = async (qId, updates) => {
    await updateBookQuery(qId, { account_id: accountId, ...updates });
    await loadTabData();
  };

  const handleAddArc = async () => {
    if (!arcForm.reader_name) return;
    await addBookArc(selectedBookId, { account_id: accountId, ...arcForm });
    setShowAddArc(false);
    setArcForm({ reader_name: '', reader_email: '', platform: '' });
    await loadTabData();
  };

  const handleUpdateArc = async (arcId, updates) => {
    await updateBookArc(arcId, { account_id: accountId, ...updates });
    await loadTabData();
  };

  const handleAddMarketingItem = async () => {
    if (!marketingForm.date || !marketingForm.action_type) return;
    await addBookMarketingItem(selectedBookId, { account_id: accountId, ...marketingForm });
    setShowAddMarketing(false);
    setMarketingForm({ date: '', action_type: '', description: '' });
    await loadTabData();
  };

  const handleUpdateMarketingItem = async (mId, updates) => {
    await updateBookMarketingItem(mId, { account_id: accountId, ...updates });
    await loadTabData();
  };

  const handleGenerateCalendar = async () => {
    if (!launchDate) { alert('Please enter a launch date'); return; }
    await generateBookLaunchCalendar(selectedBookId, { account_id: accountId, launch_date: launchDate });
    setLaunchDate('');
    await loadTabData();
  };

  const handleAddReview = async () => {
    if (!reviewForm.platform) return;
    await addBookReview(selectedBookId, { account_id: accountId, ...reviewForm, rating: parseFloat(reviewForm.rating) || null });
    setShowAddReview(false);
    setReviewForm({ platform: '', reviewer: '', rating: 5, review_text: '', review_url: '', sentiment: 'neutral' });
    await loadTabData();
  };

  // ── Draft progress percentage ──────────────────────────────
  const draftProgress = (status) => {
    const order = ['drafting', 'first_draft', 'editing', 'final_draft', 'ready_to_publish', 'published'];
    return ((order.indexOf(status) + 1) / order.length) * 100;
  };

  // ── Sales SVG Chart ────────────────────────────────────────
  const renderSalesChart = () => {
    if (!salesData.length) return <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>No sales data yet</div>;

    const byDate = {};
    salesData.forEach(sd => {
      const d = sd.date;
      if (!byDate[d]) byDate[d] = 0;
      byDate[d] += parseFloat(sd.revenue) || 0;
    });
    const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
    if (!sorted.length) return null;

    const maxVal = Math.max(...sorted.map(e => e[1]), 1);
    const w = 700, h = 200, pad = 40;
    const xStep = sorted.length > 1 ? (w - pad * 2) / (sorted.length - 1) : 0;

    const points = sorted.map((e, i) => ({
      x: pad + i * xStep,
      y: h - pad - ((e[1] / maxVal) * (h - pad * 2)),
    }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaD = pathD + ` L${points[points.length - 1].x},${h - pad} L${points[0].x},${h - pad} Z`;

    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 220 }}>
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#salesGrad)" />
        <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#8b5cf6" />
        ))}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#2a2a4a" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#2a2a4a" strokeWidth="1" />
        <text x={pad} y={pad - 8} fill="#888" fontSize="10">{formatCurrency(maxVal)}</text>
        <text x={pad} y={h - pad + 16} fill="#888" fontSize="10">{sorted[0][0]}</text>
        {sorted.length > 1 && <text x={w - pad} y={h - pad + 16} fill="#888" fontSize="10" textAnchor="end">{sorted[sorted.length - 1][0]}</text>}
      </svg>
    );
  };

  // ── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Loading Book Publishing...</div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Book Publishing & Marketing</h1>
        <p style={s.subtitle}>Manage manuscripts, publishing, queries, ARCs, marketing, sales, and reviews</p>
      </div>

      {/* Stats Row */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statLabel}>Total Books</div>
          <div style={s.statValue}>{stats.books_count || 0}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Total Sales</div>
          <div style={s.statValue}>{formatNumber(stats.total_sales_units)}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Total Revenue</div>
          <div style={s.statValue}>{formatCurrency(stats.total_revenue)}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Active Queries</div>
          <div style={s.statValue}>{stats.queries_active || 0}</div>
        </div>
      </div>

      {/* Book Selector */}
      <div style={{ ...s.flexBetween, ...s.mb16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#f5f5f5', margin: 0 }}>Your Books</h2>
        <button style={s.btn()} onClick={() => setShowAddBook(true)}>+ Add Book</button>
      </div>
      <div style={s.bookGrid}>
        {books.map(book => (
          <div key={book.id} style={s.bookCard(selectedBookId === book.id)} onClick={() => { setSelectedBookId(book.id); setActiveTab('Manuscript'); }}>
            <div style={{ ...s.flex, ...s.gap12 }}>
              {book.cover_url ? (
                <img src={book.cover_url} alt="" style={s.bookCover} />
              ) : (
                <div style={s.bookCover}>B</div>
              )}
              <div style={s.bookInfo}>
                <h3 style={s.bookTitle}>{book.title}</h3>
                {book.series_name && <div style={s.bookSeries}>{book.series_name}{book.series_order ? ` #${book.series_order}` : ''}</div>}
                <div style={s.bookMeta}>
                  <span style={s.badge(STATUS_COLORS[book.draft_status] || '#6b7280')}>{statusLabel(book.draft_status)}</span>
                  <span style={{ marginLeft: 8 }}>{formatNumber(book.word_count)} words</span>
                </div>
                <div style={s.statusBar(book.draft_status)}>
                  <div style={s.statusBarFill(draftProgress(book.draft_status), STATUS_COLORS[book.draft_status] || '#6b7280')} />
                </div>
              </div>
            </div>
            <div style={{ ...s.flex, ...s.gap8, marginTop: 10, fontSize: 11, color: '#888' }}>
              <span>{book.chapter_count || 0} chapters</span>
              <span>|</span>
              <span>{book.publishing_count || 0} platforms</span>
            </div>
          </div>
        ))}
      </div>

      {/* Book Detail Tabs */}
      {selectedBook && (
        <>
          <div style={{ ...s.flexBetween, ...s.mb8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#f5f5f5', margin: 0 }}>{selectedBook.title}</h2>
            <div style={{ ...s.flex, ...s.gap8 }}>
              <select
                style={{ ...s.select, width: 'auto' }}
                value={selectedBook.draft_status}
                onChange={(e) => handleUpdateBookStatus(selectedBook.id, e.target.value)}
              >
                {Object.keys(STATUS_COLORS).map(st => (
                  <option key={st} value={st}>{statusLabel(st)}</option>
                ))}
              </select>
              <button style={s.btnSmall('#ef4444')} onClick={() => handleDeleteBook(selectedBook.id)}>Delete</button>
            </div>
          </div>

          <div style={s.tabBar}>
            {TABS.map(tab => (
              <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>

          {/* ── Manuscript Tab ── */}
          {activeTab === 'Manuscript' && (
            <div>
              <div style={s.section}>
                <div style={s.flexBetween}>
                  <h3 style={s.sectionTitle}>Chapters</h3>
                  <button style={s.btn()} onClick={() => { setChapterForm({ chapter_number: (chapters.length || 0) + 1, title: '', word_count: 0 }); setShowAddChapter(true); }}>+ Add Chapter</button>
                </div>
                {/* Progress */}
                <div style={s.mb16}>
                  <div style={{ ...s.flex, ...s.gap8, fontSize: 12, color: '#888', marginBottom: 4 }}>
                    <span>{chapters.filter(c => c.status === 'final').length}/{chapters.length} chapters final</span>
                    <span>|</span>
                    <span>{formatNumber(chapters.reduce((sum, c) => sum + (c.word_count || 0), 0))} words</span>
                  </div>
                  <div style={s.progressBar}>
                    <div style={s.progressFill(chapters.length ? (chapters.filter(c => c.status === 'final').length / chapters.length) * 100 : 0, '#10b981')} />
                  </div>
                </div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>#</th>
                      <th style={s.th}>Title</th>
                      <th style={s.th}>Words</th>
                      <th style={s.th}>Status</th>
                      <th style={s.th}>Edit Score</th>
                      <th style={s.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chapters.map(ch => (
                      <tr key={ch.id}>
                        <td style={s.td}>{ch.chapter_number}</td>
                        <td style={s.td}>{ch.title || 'Untitled'}</td>
                        <td style={s.td}>{formatNumber(ch.word_count)}</td>
                        <td style={s.td}>
                          <select
                            style={{ ...s.select, width: 'auto', padding: '2px 6px', fontSize: 11 }}
                            value={ch.status}
                            onChange={(e) => handleUpdateChapter(ch.id, { status: e.target.value })}
                          >
                            {['drafting', 'written', 'edited', 'final'].map(st => (
                              <option key={st} value={st}>{statusLabel(st)}</option>
                            ))}
                          </select>
                        </td>
                        <td style={s.td}>
                          {ch.edit_score_json?.overall_score != null ? (
                            <span style={s.badge(ch.edit_score_json.overall_score >= 70 ? '#10b981' : '#f59e0b')}>
                              {ch.edit_score_json.overall_score}/100
                            </span>
                          ) : <span style={{ color: '#555' }}>--</span>}
                        </td>
                        <td style={s.td}>
                          <button style={s.btnSmall('#3b82f6')} onClick={() => handleEditAssist(ch.id)}>Edit Assist</button>
                        </td>
                      </tr>
                    ))}
                    {!chapters.length && (
                      <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#666' }}>No chapters yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Publishing Tab ── */}
          {activeTab === 'Publishing' && (
            <div>
              <div style={s.section}>
                <div style={s.flexBetween}>
                  <h3 style={s.sectionTitle}>Publishing Platforms</h3>
                  <button style={s.btn()} onClick={() => setShowAddPlatform(true)}>+ Add Platform</button>
                </div>
                <div style={s.platformGrid}>
                  {publishing.map(pub => (
                    <div key={pub.id} style={s.platformCard}>
                      <div style={{ ...s.flexBetween, ...s.mb8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: '#f5f5f5' }}>{pub.platform}</span>
                        <span style={s.badge(PUB_STATUS_COLORS[pub.status] || '#6b7280')}>{statusLabel(pub.status)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Format: {pub.format}</div>
                      {pub.isbn && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>ISBN: {pub.isbn}</div>}
                      {pub.price && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Price: {formatCurrency(pub.price)}</div>}
                      {pub.listing_url && (
                        <a href={pub.listing_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#8b5cf6' }}>View Listing</a>
                      )}
                      <div style={{ ...s.flex, ...s.gap8, marginTop: 10 }}>
                        <select
                          style={{ ...s.select, width: 'auto', padding: '2px 6px', fontSize: 11 }}
                          value={pub.status}
                          onChange={(e) => handleUpdatePublishing(pub.id, { status: e.target.value })}
                        >
                          {['pending', 'submitted', 'live', 'paused', 'removed'].map(st => (
                            <option key={st} value={st}>{statusLabel(st)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {PLATFORMS.filter(p => !publishing.find(pub => pub.platform === p)).map(p => (
                    <div key={p} style={{ ...s.platformCard, opacity: 0.5 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#888' }}>{p}</div>
                      <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Not listed</div>
                      <button
                        style={{ ...s.btnSmall('#8b5cf6'), marginTop: 10 }}
                        onClick={() => { setPlatformForm({ ...platformForm, platform: p }); setShowAddPlatform(true); }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Queries Tab ── */}
          {activeTab === 'Queries' && (
            <div>
              <div style={s.section}>
                <div style={s.flexBetween}>
                  <h3 style={s.sectionTitle}>Query Pipeline</h3>
                  <button style={s.btn()} onClick={() => setShowAddQuery(true)}>+ Add Query</button>
                </div>
                {/* Pipeline summary */}
                <div style={{ ...s.flex, ...s.gap12, ...s.mb16 }}>
                  {['sent', 'requested_materials', 'offer', 'rejected', 'withdrawn'].map(st => {
                    const count = queries.filter(q => q.status === st).length;
                    return (
                      <div key={st} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: QUERY_STATUS_COLORS[st] }}>{count}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{statusLabel(st)}</div>
                      </div>
                    );
                  })}
                </div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Agent</th>
                      <th style={s.th}>Agency</th>
                      <th style={s.th}>Date Sent</th>
                      <th style={s.th}>Deadline</th>
                      <th style={s.th}>Status</th>
                      <th style={s.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queries.map(q => {
                      const overdue = q.response_deadline && daysFromNow(q.response_deadline) < 0 && !['rejected', 'offer', 'withdrawn'].includes(q.status);
                      return (
                        <tr key={q.id}>
                          <td style={s.td}>{q.agent_name}</td>
                          <td style={s.td}>{q.agency || '--'}</td>
                          <td style={s.td}>{q.date_sent}</td>
                          <td style={{ ...s.td, color: overdue ? '#ef4444' : '#ddd' }}>
                            {q.response_deadline || '--'}
                            {overdue && <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 4 }}>OVERDUE</span>}
                          </td>
                          <td style={s.td}>
                            <select
                              style={{ ...s.select, width: 'auto', padding: '2px 6px', fontSize: 11 }}
                              value={q.status}
                              onChange={(e) => handleUpdateQuery(q.id, { status: e.target.value })}
                            >
                              {['queued', 'sent', 'requested_materials', 'rejected', 'offer', 'withdrawn'].map(st => (
                                <option key={st} value={st}>{statusLabel(st)}</option>
                              ))}
                            </select>
                          </td>
                          <td style={s.td}>
                            {q.email && <a href={`mailto:${q.email}`} style={{ ...s.btnSmall('#3b82f6'), textDecoration: 'none' }}>Email</a>}
                          </td>
                        </tr>
                      );
                    })}
                    {!queries.length && (
                      <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#666' }}>No queries yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ARCs Tab ── */}
          {activeTab === 'ARCs' && (
            <div>
              <div style={s.section}>
                <div style={s.flexBetween}>
                  <h3 style={s.sectionTitle}>ARC Readers</h3>
                  <button style={s.btn()} onClick={() => setShowAddArc(true)}>+ Add Reader</button>
                </div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Reader</th>
                      <th style={s.th}>Email</th>
                      <th style={s.th}>Date Sent</th>
                      <th style={s.th}>Review</th>
                      <th style={s.th}>Score</th>
                      <th style={s.th}>Platform</th>
                      <th style={s.th}>Follow-up</th>
                      <th style={s.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arcs.map(arc => {
                      const daysSinceSent = daysFromNow(arc.date_sent) * -1;
                      const needsFollowUp = !arc.review_received && daysSinceSent > 14;
                      return (
                        <tr key={arc.id}>
                          <td style={s.td}>{arc.reader_name}</td>
                          <td style={s.td}>{arc.reader_email || '--'}</td>
                          <td style={s.td}>{arc.date_sent}</td>
                          <td style={s.td}>
                            <span style={s.badge(arc.review_received ? '#10b981' : '#6b7280')}>
                              {arc.review_received ? 'Received' : 'Pending'}
                            </span>
                          </td>
                          <td style={s.td}>{arc.review_score != null ? <Stars rating={arc.review_score} size={14} /> : '--'}</td>
                          <td style={s.td}>{arc.platform || '--'}</td>
                          <td style={s.td}>
                            {needsFollowUp && <span style={s.badge('#f59e0b')}>Needs Follow-up</span>}
                          </td>
                          <td style={s.td}>
                            {!arc.review_received && (
                              <button style={s.btnSmall('#10b981')} onClick={() => handleUpdateArc(arc.id, { review_received: true })}>
                                Mark Received
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!arcs.length && (
                      <tr><td colSpan={8} style={{ ...s.td, textAlign: 'center', color: '#666' }}>No ARC readers yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Marketing Tab ── */}
          {activeTab === 'Marketing' && (
            <div>
              <div style={s.section}>
                <div style={s.flexBetween}>
                  <h3 style={s.sectionTitle}>Marketing Calendar</h3>
                  <div style={{ ...s.flex, ...s.gap8 }}>
                    <input type="date" style={{ ...s.input, width: 160 }} value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} placeholder="Launch date" />
                    <button style={s.btn('#059669')} onClick={handleGenerateCalendar}>Auto-Generate</button>
                    <button style={s.btn()} onClick={() => setShowAddMarketing(true)}>+ Add Item</button>
                  </div>
                </div>
                {/* Day markers */}
                <div style={{ ...s.flex, ...s.gap8, ...s.mb16, flexWrap: 'wrap' }}>
                  {['-90', '-60', '-30', '-14', '-7', '0', '+7', '+30'].map(d => (
                    <span key={d} style={{ ...s.badge('#8b5cf6'), fontSize: 10 }}>Day {d}</span>
                  ))}
                </div>
                {/* Timeline */}
                <div style={s.timelineContainer}>
                  <div style={s.timelineLine} />
                  {marketing.map(item => (
                    <div key={item.id} style={s.timelineItem}>
                      <div style={s.timelineDot(MARKETING_STATUS_COLORS[item.status] || '#6b7280')} />
                      <div style={{ ...s.flexBetween }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#888' }}>{item.date}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f5', marginTop: 2 }}>{item.action_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
                          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{item.description}</div>
                        </div>
                        <select
                          style={{ ...s.select, width: 'auto', padding: '2px 6px', fontSize: 11 }}
                          value={item.status}
                          onChange={(e) => handleUpdateMarketingItem(item.id, { status: e.target.value })}
                        >
                          {['pending', 'in_progress', 'completed', 'skipped'].map(st => (
                            <option key={st} value={st}>{statusLabel(st)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {!marketing.length && (
                    <div style={{ textAlign: 'center', color: '#666', padding: 30 }}>No marketing items. Use Auto-Generate to create a launch calendar.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Sales Tab ── */}
          {activeTab === 'Sales' && (
            <div>
              <div style={s.revenueGrid}>
                <div style={s.revenueCard('#8b5cf6')}>
                  <div style={s.statLabel}>Total Units Sold</div>
                  <div style={s.statValue}>{formatNumber(salesSummary.total_units)}</div>
                </div>
                <div style={s.revenueCard('#3b82f6')}>
                  <div style={s.statLabel}>Total Revenue</div>
                  <div style={s.statValue}>{formatCurrency(salesSummary.total_revenue)}</div>
                </div>
                <div style={s.revenueCard('#10b981')}>
                  <div style={s.statLabel}>Total Royalties</div>
                  <div style={s.statValue}>{formatCurrency(salesSummary.total_royalty)}</div>
                </div>
              </div>

              <div style={s.section}>
                <h3 style={s.sectionTitle}>Sales Over Time</h3>
                {renderSalesChart()}
              </div>

              <div style={s.section}>
                <h3 style={s.sectionTitle}>Per-Platform Breakdown</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Platform</th>
                      <th style={s.th}>Units</th>
                      <th style={s.th}>Revenue</th>
                      <th style={s.th}>Royalties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesSummary.by_platform || []).map(p => (
                      <tr key={p.platform}>
                        <td style={s.td}>{p.platform}</td>
                        <td style={s.td}>{formatNumber(p.units)}</td>
                        <td style={s.td}>{formatCurrency(p.revenue)}</td>
                        <td style={s.td}>{formatCurrency(p.royalty)}</td>
                      </tr>
                    ))}
                    {!(salesSummary.by_platform || []).length && (
                      <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: '#666' }}>No sales data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Reviews Tab ── */}
          {activeTab === 'Reviews' && (
            <div>
              <div style={s.section}>
                <div style={s.flexBetween}>
                  <h3 style={s.sectionTitle}>Reviews</h3>
                  <div style={{ ...s.flex, ...s.gap8 }}>
                    <span style={s.badge('#3b82f6')}>Monitoring Active</span>
                    <button style={s.btn()} onClick={() => setShowAddReview(true)}>+ Add Review</button>
                  </div>
                </div>
                {reviews.map(rev => (
                  <div key={rev.id} style={s.reviewCard}>
                    <div style={{ ...s.flexBetween, ...s.mb8 }}>
                      <div style={{ ...s.flex, ...s.gap8 }}>
                        <span style={s.badge('#3b82f6')}>{rev.platform}</span>
                        <Stars rating={rev.rating} size={14} />
                        <span style={s.badge(SENTIMENT_COLORS[rev.sentiment] || '#6b7280')}>{rev.sentiment}</span>
                      </div>
                      <span style={{ fontSize: 12, color: '#888' }}>{rev.date_found}</span>
                    </div>
                    {rev.reviewer && <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd', marginBottom: 4 }}>{rev.reviewer}</div>}
                    {rev.review_text && <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>{rev.review_text}</div>}
                    {rev.review_url && <a href={rev.review_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#8b5cf6', marginTop: 6, display: 'inline-block' }}>View Review</a>}
                  </div>
                ))}
                {!reviews.length && (
                  <div style={{ textAlign: 'center', color: '#666', padding: 30 }}>No reviews yet</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Add Book Modal ── */}
      {showAddBook && (
        <div style={s.modal} onClick={() => setShowAddBook(false)}>
          <div style={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add Book</h3>
            <div style={s.inputGroup}>
              <label style={s.label}>Title *</label>
              <input style={s.input} value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Series Name</label>
              <input style={s.input} value={bookForm.series_name} onChange={(e) => setBookForm({ ...bookForm, series_name: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Genre</label>
              <input style={s.input} value={bookForm.genre} onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Synopsis</label>
              <textarea style={s.textarea} value={bookForm.synopsis} onChange={(e) => setBookForm({ ...bookForm, synopsis: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Word Count</label>
              <input style={s.input} type="number" value={bookForm.word_count} onChange={(e) => setBookForm({ ...bookForm, word_count: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Target Date</label>
              <input style={s.input} type="date" value={bookForm.target_date} onChange={(e) => setBookForm({ ...bookForm, target_date: e.target.value })} />
            </div>
            <div style={s.actions}>
              <button style={s.btnOutline} onClick={() => setShowAddBook(false)}>Cancel</button>
              <button style={s.btn()} onClick={handleAddBook}>Add Book</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Chapter Modal ── */}
      {showAddChapter && (
        <div style={s.modal} onClick={() => setShowAddChapter(false)}>
          <div style={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add Chapter</h3>
            <div style={s.inputGroup}>
              <label style={s.label}>Chapter Number</label>
              <input style={s.input} type="number" value={chapterForm.chapter_number} onChange={(e) => setChapterForm({ ...chapterForm, chapter_number: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Title</label>
              <input style={s.input} value={chapterForm.title} onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Word Count</label>
              <input style={s.input} type="number" value={chapterForm.word_count} onChange={(e) => setChapterForm({ ...chapterForm, word_count: e.target.value })} />
            </div>
            <div style={s.actions}>
              <button style={s.btnOutline} onClick={() => setShowAddChapter(false)}>Cancel</button>
              <button style={s.btn()} onClick={handleAddChapter}>Add Chapter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Platform Modal ── */}
      {showAddPlatform && (
        <div style={s.modal} onClick={() => setShowAddPlatform(false)}>
          <div style={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add Publishing Platform</h3>
            <div style={s.inputGroup}>
              <label style={s.label}>Platform</label>
              <select style={s.select} value={platformForm.platform} onChange={(e) => setPlatformForm({ ...platformForm, platform: e.target.value })}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Format</label>
              <select style={s.select} value={platformForm.format} onChange={(e) => setPlatformForm({ ...platformForm, format: e.target.value })}>
                {['ebook', 'paperback', 'hardcover', 'audiobook'].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>ISBN</label>
              <input style={s.input} value={platformForm.isbn} onChange={(e) => setPlatformForm({ ...platformForm, isbn: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Price</label>
              <input style={s.input} type="number" step="0.01" value={platformForm.price} onChange={(e) => setPlatformForm({ ...platformForm, price: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Listing URL</label>
              <input style={s.input} value={platformForm.listing_url} onChange={(e) => setPlatformForm({ ...platformForm, listing_url: e.target.value })} />
            </div>
            <div style={s.actions}>
              <button style={s.btnOutline} onClick={() => setShowAddPlatform(false)}>Cancel</button>
              <button style={s.btn()} onClick={handleAddPlatform}>Add Platform</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Query Modal ── */}
      {showAddQuery && (
        <div style={s.modal} onClick={() => setShowAddQuery(false)}>
          <div style={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add Query</h3>
            <div style={s.inputGroup}>
              <label style={s.label}>Agent Name *</label>
              <input style={s.input} value={queryForm.agent_name} onChange={(e) => setQueryForm({ ...queryForm, agent_name: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Agency</label>
              <input style={s.input} value={queryForm.agency} onChange={(e) => setQueryForm({ ...queryForm, agency: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" value={queryForm.email} onChange={(e) => setQueryForm({ ...queryForm, email: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Materials Sent</label>
              <input style={s.input} value={queryForm.materials_sent} onChange={(e) => setQueryForm({ ...queryForm, materials_sent: e.target.value })} placeholder="e.g., Query + 10 pages" />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Response Deadline</label>
              <input style={s.input} type="date" value={queryForm.response_deadline} onChange={(e) => setQueryForm({ ...queryForm, response_deadline: e.target.value })} />
            </div>
            <div style={s.actions}>
              <button style={s.btnOutline} onClick={() => setShowAddQuery(false)}>Cancel</button>
              <button style={s.btn()} onClick={handleAddQuery}>Send Query</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add ARC Reader Modal ── */}
      {showAddArc && (
        <div style={s.modal} onClick={() => setShowAddArc(false)}>
          <div style={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add ARC Reader</h3>
            <div style={s.inputGroup}>
              <label style={s.label}>Reader Name *</label>
              <input style={s.input} value={arcForm.reader_name} onChange={(e) => setArcForm({ ...arcForm, reader_name: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" value={arcForm.reader_email} onChange={(e) => setArcForm({ ...arcForm, reader_email: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Platform</label>
              <input style={s.input} value={arcForm.platform} onChange={(e) => setArcForm({ ...arcForm, platform: e.target.value })} placeholder="e.g., BookSirens, NetGalley" />
            </div>
            <div style={s.actions}>
              <button style={s.btnOutline} onClick={() => setShowAddArc(false)}>Cancel</button>
              <button style={s.btn()} onClick={handleAddArc}>Add Reader</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Marketing Item Modal ── */}
      {showAddMarketing && (
        <div style={s.modal} onClick={() => setShowAddMarketing(false)}>
          <div style={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add Marketing Item</h3>
            <div style={s.inputGroup}>
              <label style={s.label}>Date *</label>
              <input style={s.input} type="date" value={marketingForm.date} onChange={(e) => setMarketingForm({ ...marketingForm, date: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Action Type *</label>
              <input style={s.input} value={marketingForm.action_type} onChange={(e) => setMarketingForm({ ...marketingForm, action_type: e.target.value })} placeholder="e.g., social_post, newsletter, blog_tour" />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} value={marketingForm.description} onChange={(e) => setMarketingForm({ ...marketingForm, description: e.target.value })} />
            </div>
            <div style={s.actions}>
              <button style={s.btnOutline} onClick={() => setShowAddMarketing(false)}>Cancel</button>
              <button style={s.btn()} onClick={handleAddMarketingItem}>Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Review Modal ── */}
      {showAddReview && (
        <div style={s.modal} onClick={() => setShowAddReview(false)}>
          <div style={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add Review</h3>
            <div style={s.inputGroup}>
              <label style={s.label}>Platform *</label>
              <select style={s.select} value={reviewForm.platform} onChange={(e) => setReviewForm({ ...reviewForm, platform: e.target.value })}>
                <option value="">Select Platform</option>
                {['Amazon', 'Goodreads', 'BookBub', 'Barnes & Noble', 'Apple Books', 'Kobo', 'Blog', 'Other'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Reviewer</label>
              <input style={s.input} value={reviewForm.reviewer} onChange={(e) => setReviewForm({ ...reviewForm, reviewer: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Rating</label>
              <select style={s.select} value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}>
                {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} stars</option>)}
              </select>
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Review Text</label>
              <textarea style={s.textarea} value={reviewForm.review_text} onChange={(e) => setReviewForm({ ...reviewForm, review_text: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Review URL</label>
              <input style={s.input} value={reviewForm.review_url} onChange={(e) => setReviewForm({ ...reviewForm, review_url: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Sentiment</label>
              <select style={s.select} value={reviewForm.sentiment} onChange={(e) => setReviewForm({ ...reviewForm, sentiment: e.target.value })}>
                {['positive', 'neutral', 'negative'].map(se => <option key={se} value={se}>{se}</option>)}
              </select>
            </div>
            <div style={s.actions}>
              <button style={s.btnOutline} onClick={() => setShowAddReview(false)}>Cancel</button>
              <button style={s.btn()} onClick={handleAddReview}>Add Review</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
