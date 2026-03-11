'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchKbArticles,
  fetchKbArticle,
  createKbArticle,
  updateKbArticle,
  markKbHelpful,
  markKbNotHelpful,
  fetchKbQuestions,
  logKbQuestion,
  fetchKbGaps,
  exportKb,
  generateKbArticle,
  fetchKbAnalytics
} from '../../../lib/api';

const PRODUCTS = ['All', 'ChronoStates', 'Payroll Beacon', 'Budgeting Beacon'];
const SUB_TABS = ['Published', 'Drafts', 'Analytics'];

const styles = {
  page: {
    backgroundColor: '#1a1a2e',
    minHeight: '100vh',
    color: '#e0e0e0',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#f59e0b',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  searchBar: {
    backgroundColor: '#16213e',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 16px',
    color: '#e0e0e0',
    fontSize: '14px',
    width: '280px',
    outline: 'none',
  },
  btn: {
    backgroundColor: '#f59e0b',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  btnSecondary: {
    backgroundColor: '#2a2a4a',
    color: '#e0e0e0',
    border: '1px solid #3a3a5a',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  btnSmall: {
    backgroundColor: '#f59e0b',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnSmallSecondary: {
    backgroundColor: 'transparent',
    color: '#f59e0b',
    border: '1px solid #f59e0b',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  btnDanger: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '16px',
    backgroundColor: '#16213e',
    borderRadius: '10px',
    padding: '4px',
  },
  tab: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'transparent',
    color: '#888',
  },
  tabActive: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    backgroundColor: '#f59e0b',
    color: '#1a1a2e',
  },
  subTabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '20px',
    backgroundColor: '#0f1729',
    borderRadius: '8px',
    padding: '3px',
  },
  subTab: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: '#888',
  },
  subTabActive: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    backgroundColor: '#2a2a4a',
    color: '#f59e0b',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a2a4a',
    transition: 'border-color 0.2s',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px',
    lineHeight: '1.4',
  },
  cardMeta: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '12px',
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  tag: {
    display: 'inline-block',
    backgroundColor: '#2a2a4a',
    color: '#f59e0b',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: '500',
    marginRight: '4px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a2a4a',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '13px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
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
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: '16px',
    padding: '32px',
    width: '90%',
    maxWidth: '720px',
    maxHeight: '85vh',
    overflowY: 'auto',
    border: '1px solid #2a2a4a',
  },
  modalTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: '24px',
  },
  formGroup: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#ccc',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    backgroundColor: '#16213e',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e0e0e0',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    backgroundColor: '#16213e',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e0e0e0',
    fontSize: '14px',
    outline: 'none',
    minHeight: '200px',
    fontFamily: "'Fira Code', monospace",
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  select: {
    backgroundColor: '#16213e',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e0e0e0',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#555',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  listItem: {
    backgroundColor: '#16213e',
    borderRadius: '10px',
    padding: '16px 20px',
    border: '1px solid #2a2a4a',
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listItemText: {
    fontSize: '14px',
    color: '#e0e0e0',
    flex: 1,
  },
  badge: {
    backgroundColor: '#f59e0b',
    color: '#1a1a2e',
    borderRadius: '12px',
    padding: '2px 10px',
    fontSize: '12px',
    fontWeight: '700',
    marginLeft: '12px',
    whiteSpace: 'nowrap',
  },
  helpfulBar: {
    height: '4px',
    backgroundColor: '#2a2a4a',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '4px',
  },
  helpfulFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: '2px',
  },
  section: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '16px',
  },
};

export default function KnowledgeBasePage() {
  const [activeProduct, setActiveProduct] = useState('All');
  const [activeSubTab, setActiveSubTab] = useState('Published');
  const [articles, setArticles] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [editorForm, setEditorForm] = useState({
    title: '',
    body_markdown: '',
    tags: '',
    status: 'draft',
    question_normalized: '',
    product: 'ChronoStates',
  });

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeProduct !== 'All') params.product = activeProduct;
      if (activeSubTab === 'Published') params.status = 'published';
      else if (activeSubTab === 'Drafts') params.status = 'draft';
      if (search) params.search = search;
      const res = await fetchKbArticles(params);
      setArticles(res.articles || []);
    } catch (err) {
      console.error('Failed to load articles:', err);
    }
    setLoading(false);
  }, [activeProduct, activeSubTab, search]);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetchKbAnalytics();
      setAnalytics(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  const loadGaps = useCallback(async () => {
    try {
      const params = {};
      if (activeProduct !== 'All') params.product = activeProduct;
      const res = await fetchKbGaps(params);
      setGaps(res.gaps || []);
    } catch (err) {
      console.error('Failed to load gaps:', err);
    }
  }, [activeProduct]);

  useEffect(() => {
    if (activeSubTab === 'Analytics') {
      loadAnalytics();
      loadGaps();
    } else {
      loadArticles();
    }
  }, [activeProduct, activeSubTab, search, loadArticles, loadAnalytics, loadGaps]);

  const openEditor = (article = null) => {
    if (article) {
      setEditingArticle(article);
      setEditorForm({
        title: article.title || '',
        body_markdown: article.body_markdown || '',
        tags: Array.isArray(article.tags) ? article.tags.join(', ') : '',
        status: article.status || 'draft',
        question_normalized: article.question_normalized || '',
        product: article.product || 'ChronoStates',
      });
    } else {
      setEditingArticle(null);
      setEditorForm({
        title: '',
        body_markdown: '',
        tags: '',
        status: 'draft',
        question_normalized: '',
        product: activeProduct !== 'All' ? activeProduct : 'ChronoStates',
      });
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingArticle(null);
  };

  const saveArticle = async () => {
    const payload = {
      title: editorForm.title,
      body_markdown: editorForm.body_markdown,
      tags: editorForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      status: editorForm.status,
      question_normalized: editorForm.question_normalized,
      product: editorForm.product,
    };

    try {
      if (editingArticle) {
        await updateKbArticle(editingArticle.id, payload);
      } else {
        payload.account_id = 'default';
        await createKbArticle(payload);
      }
      closeEditor();
      loadArticles();
    } catch (err) {
      console.error('Failed to save article:', err);
    }
  };

  const handleApprove = async (article) => {
    try {
      await updateKbArticle(article.id, { status: 'published' });
      loadArticles();
    } catch (err) {
      console.error('Failed to approve article:', err);
    }
  };

  const handleCopy = (article) => {
    const text = `# ${article.title}\n\n${article.body_markdown || ''}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleExport = async (format) => {
    try {
      const params = { format };
      if (activeProduct !== 'All') params.product = activeProduct;
      await exportKb(params);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const handleGenerateFromGap = async (question) => {
    try {
      await generateKbArticle({
        account_id: 'default',
        product: activeProduct !== 'All' ? activeProduct : 'ChronoStates',
        question,
      });
      loadArticles();
      setActiveSubTab('Drafts');
    } catch (err) {
      console.error('Failed to generate article:', err);
    }
  };

  const getHelpfulPercent = (article) => {
    const total = (article.helpful_count || 0) + (article.not_helpful_count || 0);
    if (total === 0) return 0;
    return Math.round((article.helpful_count / total) * 100);
  };

  const renderPublished = () => {
    if (loading) return <div style={styles.emptyState}>Loading articles...</div>;
    if (articles.length === 0) {
      return (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>KB</div>
          <p>No published articles found.</p>
          <button style={styles.btn} onClick={() => openEditor()}>Create First Article</button>
        </div>
      );
    }
    return (
      <div style={styles.grid}>
        {articles.map(article => {
          const helpfulPct = getHelpfulPercent(article);
          return (
            <div key={article.id} style={styles.card}>
              <div style={styles.cardTitle}>{article.title}</div>
              <div style={styles.cardMeta}>
                <span>Views: {article.view_count || 0}</span>
                <span>Helpful: {helpfulPct}%</span>
                <span>Asked {article.frequency || 1}x</span>
              </div>
              <div style={styles.helpfulBar}>
                <div style={{ ...styles.helpfulFill, width: `${helpfulPct}%` }} />
              </div>
              <div style={{ marginTop: '8px' }}>
                {Array.isArray(article.tags) && article.tags.map(tag => (
                  <span key={tag} style={styles.tag}>{tag}</span>
                ))}
              </div>
              <div style={styles.cardActions}>
                <button style={styles.btnSmall} onClick={() => openEditor(article)}>Edit</button>
                <button style={styles.btnSmallSecondary} onClick={() => handleCopy(article)}>Copy</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDrafts = () => {
    if (loading) return <div style={styles.emptyState}>Loading drafts...</div>;
    if (articles.length === 0) {
      return (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>Drafts</div>
          <p>No draft articles awaiting review.</p>
        </div>
      );
    }
    return (
      <div style={styles.grid}>
        {articles.map(article => (
          <div key={article.id} style={styles.card}>
            <div style={styles.cardTitle}>{article.title}</div>
            <div style={styles.cardMeta}>
              <span>Product: {article.product}</span>
              <span>Created: {new Date(article.created_at).toLocaleDateString()}</span>
            </div>
            {Array.isArray(article.tags) && article.tags.includes('auto-generated') && (
              <span style={{ ...styles.tag, backgroundColor: '#7c3aed', color: '#fff' }}>Auto-Generated</span>
            )}
            <div style={styles.cardActions}>
              <button style={styles.btnSmall} onClick={() => handleApprove(article)}>Approve</button>
              <button style={styles.btnSmallSecondary} onClick={() => openEditor(article)}>Edit</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAnalytics = () => {
    if (!analytics) return <div style={styles.emptyState}>Loading analytics...</div>;

    return (
      <div>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{analytics.totalArticles || 0}</div>
            <div style={styles.statLabel}>Total Articles</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{analytics.totalViews || 0}</div>
            <div style={styles.statLabel}>Total Views</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{analytics.helpfulPercent || 0}%</div>
            <div style={styles.statLabel}>Helpful Rate</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{analytics.gapsCount || 0}</div>
            <div style={styles.statLabel}>Knowledge Gaps</div>
          </div>
        </div>

        {analytics.articlesPerProduct && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Articles per Product</h3>
            <div style={styles.statsGrid}>
              {Object.entries(analytics.articlesPerProduct).map(([product, count]) => (
                <div key={product} style={styles.statCard}>
                  <div style={styles.statValue}>{count}</div>
                  <div style={styles.statLabel}>{product}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Most Viewed Articles</h3>
          {(analytics.mostViewed || []).slice(0, 5).map(article => (
            <div key={article.id} style={styles.listItem}>
              <span style={styles.listItemText}>{article.title}</span>
              <span style={styles.badge}>{article.view_count} views</span>
            </div>
          ))}
          {(!analytics.mostViewed || analytics.mostViewed.length === 0) && (
            <div style={styles.emptyState}>No article view data yet.</div>
          )}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Knowledge Gaps (Questions Without Articles)</h3>
          {gaps.length > 0 ? (
            gaps.slice(0, 10).map((gap, idx) => (
              <div key={idx} style={styles.listItem}>
                <span style={styles.listItemText}>{gap.question}</span>
                <span style={styles.badge}>{gap.frequency}x asked</span>
                <button
                  style={{ ...styles.btnSmall, marginLeft: '12px' }}
                  onClick={() => handleGenerateFromGap(gap.question)}
                >
                  Generate Article
                </button>
              </div>
            ))
          ) : (
            <div style={styles.emptyState}>No knowledge gaps detected.</div>
          )}
        </div>
      </div>
    );
  };

  const renderEditorModal = () => {
    if (!showEditor) return null;
    return (
      <div style={styles.modal} onClick={closeEditor}>
        <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
          <h2 style={styles.modalTitle}>{editingArticle ? 'Edit Article' : 'New Article'}</h2>

          <div style={styles.formGroup}>
            <label style={styles.label}>Title</label>
            <input
              style={styles.input}
              value={editorForm.title}
              onChange={e => setEditorForm({ ...editorForm, title: e.target.value })}
              placeholder="Article title..."
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Normalized Question</label>
            <input
              style={styles.input}
              value={editorForm.question_normalized}
              onChange={e => setEditorForm({ ...editorForm, question_normalized: e.target.value })}
              placeholder="The question this article answers..."
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Product</label>
            <select
              style={styles.select}
              value={editorForm.product}
              onChange={e => setEditorForm({ ...editorForm, product: e.target.value })}
            >
              <option value="ChronoStates">ChronoStates</option>
              <option value="Payroll Beacon">Payroll Beacon</option>
              <option value="Budgeting Beacon">Budgeting Beacon</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Body (Markdown)</label>
            <textarea
              style={styles.textarea}
              value={editorForm.body_markdown}
              onChange={e => setEditorForm({ ...editorForm, body_markdown: e.target.value })}
              placeholder="Write your article content in markdown..."
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Tags (comma-separated)</label>
            <input
              style={styles.input}
              value={editorForm.tags}
              onChange={e => setEditorForm({ ...editorForm, tags: e.target.value })}
              placeholder="setup, billing, troubleshooting..."
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Status</label>
            <select
              style={styles.select}
              value={editorForm.status}
              onChange={e => setEditorForm({ ...editorForm, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div style={styles.modalActions}>
            <button style={styles.btnSecondary} onClick={closeEditor}>Cancel</button>
            <button style={styles.btn} onClick={saveArticle}>
              {editingArticle ? 'Update Article' : 'Create Article'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Knowledge Base Builder</h1>
        <div style={styles.headerActions}>
          <input
            style={styles.searchBar}
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button style={styles.btnSecondary} onClick={() => handleExport('md')}>Export MD</button>
          <button style={styles.btnSecondary} onClick={() => handleExport('html')}>Export HTML</button>
          <button style={styles.btn} onClick={() => openEditor()}>+ New Article</button>
        </div>
      </div>

      <div style={styles.tabs}>
        {PRODUCTS.map(product => (
          <button
            key={product}
            style={activeProduct === product ? styles.tabActive : styles.tab}
            onClick={() => setActiveProduct(product)}
          >
            {product}
          </button>
        ))}
      </div>

      <div style={styles.subTabs}>
        {SUB_TABS.map(tab => (
          <button
            key={tab}
            style={activeSubTab === tab ? styles.subTabActive : styles.subTab}
            onClick={() => setActiveSubTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeSubTab === 'Published' && renderPublished()}
      {activeSubTab === 'Drafts' && renderDrafts()}
      {activeSubTab === 'Analytics' && renderAnalytics()}

      {renderEditorModal()}
    </div>
  );
}
