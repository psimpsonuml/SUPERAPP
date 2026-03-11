'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchDesignAssets,
  fetchDesignAsset,
  createDesignAsset,
  updateDesignAsset,
  deleteDesignAsset,
  generateDesignAsset,
  fetchDesignTemplates,
  createDesignTemplate,
  updateDesignTemplate,
  deleteDesignTemplate,
  fetchDesignBrand,
  fetchDesignGallery,
  regenerateDesignAsset,
  fetchDesignStats
} from '../../../lib/api';

// ── Config ────────────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: 'social_graphic', label: 'Social Graphic' },
  { value: 'email_template', label: 'Email Template' },
  { value: 'pitch_slide', label: 'Pitch Slide' },
  { value: 'one_pager', label: 'One-Pager' },
  { value: 'blog_image', label: 'Blog Image' },
  { value: 'landing_hero', label: 'Landing Hero' },
  { value: 'ad_visual', label: 'Ad Visual' },
  { value: 'logo', label: 'Logo' },
  { value: 'icon', label: 'Icon' }
];

const PLATFORM_SIZES = [
  { label: 'Instagram Square', value: '1080x1080' },
  { label: 'Instagram Story', value: '1080x1920' },
  { label: 'Facebook', value: '1200x630' },
  { label: 'LinkedIn', value: '1200x627' },
  { label: 'X (Twitter)', value: '1600x900' },
  { label: 'YouTube Thumbnail', value: '1280x720' },
  { label: 'Custom', value: 'custom' }
];

const SEND_TO_OPTIONS = ['Social Distributor', 'Ad Creative', 'Email Campaign', 'Landing Page', 'Pitch Deck'];

const TABS = ['Gallery', 'Generate', 'Templates', 'Brand Assets'];

// ── Styles ────────────────────────────────────────────────────────────────────

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
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap'
  },
  statCard: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '16px 24px',
    minWidth: '140px',
    border: '1px solid #2a2a4a'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f59e0b',
    margin: 0
  },
  statLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: '4px 0 0 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    borderBottom: '1px solid #2a2a4a',
    paddingBottom: '0'
  },
  tab: {
    padding: '10px 20px',
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: 'all 0.2s'
  },
  tabActive: {
    padding: '10px 20px',
    border: 'none',
    background: 'transparent',
    color: '#f59e0b',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    borderBottom: '2px solid #f59e0b',
    marginBottom: '-1px'
  },
  filterRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  select: {
    backgroundColor: '#16213e',
    color: '#e0e0e0',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer'
  },
  input: {
    backgroundColor: '#16213e',
    color: '#e0e0e0',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    width: '100%'
  },
  textarea: {
    backgroundColor: '#16213e',
    color: '#e0e0e0',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    minHeight: '80px',
    resize: 'vertical',
    fontFamily: 'inherit'
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
  btnDanger: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px'
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: '14px',
    overflow: 'hidden',
    border: '1px solid #2a2a4a',
    transition: 'border-color 0.2s, transform 0.2s',
    cursor: 'default'
  },
  cardPreview: {
    width: '100%',
    height: '180px',
    backgroundColor: '#0f0f23',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative'
  },
  cardPreviewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  cardPreviewPlaceholder: {
    color: '#4a4a6a',
    fontSize: '40px'
  },
  cardBody: {
    padding: '14px 16px'
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#e0e0e0',
    margin: '0 0 8px 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  cardMeta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: '12px'
  },
  badge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  badgeType: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b'
  },
  badgeFormat: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8'
  },
  badgeDims: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981'
  },
  cardActions: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  },
  previewArea: {
    backgroundColor: '#0f0f23',
    borderRadius: '12px',
    padding: '24px',
    minHeight: '300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #2a2a4a',
    marginTop: '20px'
  },
  gallerySection: {
    marginBottom: '32px'
  },
  gallerySectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#e0e0e0',
    marginBottom: '8px'
  },
  gallerySectionSub: {
    fontSize: '14px',
    color: '#f59e0b',
    fontWeight: '600',
    marginBottom: '16px',
    textTransform: 'capitalize'
  },
  brandSection: {
    backgroundColor: '#16213e',
    borderRadius: '14px',
    padding: '24px',
    border: '1px solid #2a2a4a',
    marginBottom: '20px'
  },
  colorSwatch: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    display: 'inline-block',
    marginRight: '10px',
    border: '2px solid #2a2a4a',
    cursor: 'pointer',
    position: 'relative'
  },
  colorLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: '4px'
  },
  modal: {
    position: 'fixed',
    inset: 0,
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
    width: '480px',
    maxWidth: '90vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    border: '1px solid #2a2a4a'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#f59e0b',
    margin: '0 0 20px 0'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280'
  },
  sendToSelect: {
    backgroundColor: '#16213e',
    color: '#e0e0e0',
    border: '1px solid #2a2a4a',
    borderRadius: '6px',
    padding: '5px 8px',
    fontSize: '11px',
    outline: 'none',
    cursor: 'pointer'
  }
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DesignStudioPage() {
  const [activeTab, setActiveTab] = useState('Gallery');
  const [assets, setAssets] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [gallery, setGallery] = useState({});
  const [stats, setStats] = useState({});
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterProduct, setFilterProduct] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFormat, setFilterFormat] = useState('');
  const [brandProduct, setBrandProduct] = useState('');

  // Generate form
  const [genForm, setGenForm] = useState({
    product: '',
    asset_type: 'social_graphic',
    platform: '1080x1080',
    customWidth: '',
    customHeight: '',
    headline: '',
    subtext: '',
    title: '',
    bgColor: '#1a1a2e',
    accentColor: '#f59e0b',
    fontFamily: 'Inter, sans-serif'
  });
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', asset_type: 'social_graphic', template_config_json: {} });

  // ── Data Loading ──────────────────────────────────────────────────────────

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterProduct) params.product = filterProduct;
      if (filterType) params.type = filterType;
      if (filterFormat) params.format = filterFormat;
      const res = await fetchDesignAssets(params);
      setAssets(res.assets || []);
    } catch (e) {
      console.error('Failed to load assets:', e);
    }
    setLoading(false);
  }, [filterProduct, filterType, filterFormat]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetchDesignTemplates();
      setTemplates(res.templates || []);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  }, []);

  const loadGallery = useCallback(async () => {
    try {
      const res = await fetchDesignGallery();
      setGallery(res.gallery || {});
    } catch (e) {
      console.error('Failed to load gallery:', e);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchDesignStats();
      setStats(res || {});
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  }, []);

  const loadBrand = useCallback(async (product) => {
    if (!product) { setBrand(null); return; }
    try {
      const res = await fetchDesignBrand(product);
      setBrand(res.brand || null);
    } catch (e) {
      console.error('Failed to load brand:', e);
    }
  }, []);

  useEffect(() => {
    loadAssets();
    loadStats();
  }, [loadAssets, loadStats]);

  useEffect(() => {
    if (activeTab === 'Gallery') loadGallery();
    if (activeTab === 'Templates') loadTemplates();
  }, [activeTab, loadGallery, loadTemplates]);

  useEffect(() => {
    if (activeTab === 'Brand Assets' && brandProduct) loadBrand(brandProduct);
  }, [activeTab, brandProduct, loadBrand]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDeleteAsset = async (id) => {
    if (!confirm('Delete this asset?')) return;
    try {
      await deleteDesignAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      loadGallery();
      loadStats();
    } catch (e) {
      console.error('Failed to delete asset:', e);
    }
  };

  const handleRegenerate = async (id) => {
    try {
      const res = await regenerateDesignAsset(id);
      if (res.asset) {
        setAssets((prev) => prev.map((a) => a.id === id ? res.asset : a));
      }
    } catch (e) {
      console.error('Failed to regenerate:', e);
    }
  };

  const handleGenerate = async () => {
    if (!genForm.product || !genForm.title) return;
    setGenerating(true);
    try {
      const dims = genForm.platform === 'custom'
        ? `${genForm.customWidth || 1080}x${genForm.customHeight || 1080}`
        : genForm.platform;

      const res = await generateDesignAsset({
        product: genForm.product,
        asset_type: genForm.asset_type,
        title: genForm.title,
        headline: genForm.headline,
        subtext: genForm.subtext,
        dimensions: dims,
        style: {
          backgroundColor: genForm.bgColor,
          accentColor: genForm.accentColor,
          fontFamily: genForm.fontFamily
        }
      });
      setPreview(res.html_preview || null);
      if (res.asset) {
        loadAssets();
        loadStats();
      }
    } catch (e) {
      console.error('Failed to generate:', e);
    }
    setGenerating(false);
  };

  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await updateDesignTemplate(editingTemplate.id, templateForm);
      } else {
        await createDesignTemplate(templateForm);
      }
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateForm({ name: '', asset_type: 'social_graphic', template_config_json: {} });
      loadTemplates();
    } catch (e) {
      console.error('Failed to save template:', e);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await deleteDesignTemplate(id);
      loadTemplates();
    } catch (e) {
      console.error('Failed to delete template:', e);
    }
  };

  const openEditTemplate = (tpl) => {
    setEditingTemplate(tpl);
    setTemplateForm({ name: tpl.name, asset_type: tpl.asset_type, template_config_json: tpl.template_config_json || {} });
    setShowTemplateModal(true);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getTypeLabel = (val) => ASSET_TYPES.find((t) => t.value === val)?.label || val;

  const products = [...new Set(assets.map((a) => a.product).filter(Boolean))];

  // ── Asset Card ────────────────────────────────────────────────────────────

  const AssetCard = ({ asset }) => {
    const [sendTo, setSendTo] = useState('');
    const htmlPreview = asset.metadata_json?.html_preview;

    return (
      <div style={styles.card}>
        <div style={styles.cardPreview}>
          {asset.image_url ? (
            <img src={asset.image_url} alt={asset.title} style={styles.cardPreviewImg} />
          ) : htmlPreview ? (
            <div
              style={{ transform: 'scale(0.2)', transformOrigin: 'center center' }}
              dangerouslySetInnerHTML={{ __html: htmlPreview }}
            />
          ) : (
            <span style={styles.cardPreviewPlaceholder}>&#9881;</span>
          )}
        </div>
        <div style={styles.cardBody}>
          <p style={styles.cardTitle}>{asset.title}</p>
          <div style={styles.cardMeta}>
            <span style={{ ...styles.badge, ...styles.badgeType }}>{getTypeLabel(asset.asset_type)}</span>
            {asset.dimensions && (
              <span style={{ ...styles.badge, ...styles.badgeDims }}>{asset.dimensions}</span>
            )}
            <span style={{ ...styles.badge, ...styles.badgeFormat }}>{asset.format || 'png'}</span>
          </div>
          <div style={styles.cardActions}>
            {asset.image_url && (
              <a href={asset.image_url} download style={{ textDecoration: 'none' }}>
                <button style={{ ...styles.btnSmall, backgroundColor: '#10b981', color: '#fff' }}>Download</button>
              </a>
            )}
            <button
              style={{ ...styles.btnSmall, backgroundColor: '#6366f1', color: '#fff' }}
              onClick={() => handleRegenerate(asset.id)}
            >
              Regenerate
            </button>
            <button style={styles.btnDanger} onClick={() => handleDeleteAsset(asset.id)}>Delete</button>
            <select
              style={styles.sendToSelect}
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
            >
              <option value="">Send to...</option>
              {SEND_TO_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  // ── Gallery Tab ───────────────────────────────────────────────────────────

  const renderGalleryTab = () => (
    <div>
      <div style={styles.filterRow}>
        <select style={styles.select} value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
          <option value="">All Products</option>
          {products.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={styles.select} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select style={styles.select} value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)}>
          <option value="">All Formats</option>
          {['png', 'jpg', 'svg', 'html', 'pdf'].map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>
      </div>

      {Object.keys(gallery).length === 0 && !loading ? (
        <div style={styles.emptyState}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>No assets yet</p>
          <p>Switch to the Generate tab to create your first design asset.</p>
        </div>
      ) : (
        Object.entries(gallery).map(([product, types]) => (
          <div key={product} style={styles.gallerySection}>
            <h2 style={styles.gallerySectionTitle}>{product}</h2>
            {Object.entries(types).map(([assetType, items]) => {
              const filteredItems = items.filter((item) => {
                if (filterType && item.asset_type !== filterType) return false;
                if (filterFormat && item.format !== filterFormat) return false;
                if (filterProduct && item.product !== filterProduct) return false;
                return true;
              });
              if (filteredItems.length === 0) return null;
              return (
                <div key={assetType} style={{ marginBottom: '24px' }}>
                  <p style={styles.gallerySectionSub}>{getTypeLabel(assetType)} ({filteredItems.length})</p>
                  <div style={styles.grid}>
                    {filteredItems.map((asset) => <AssetCard key={asset.id} asset={asset} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );

  // ── Generate Tab ──────────────────────────────────────────────────────────

  const renderGenerateTab = () => (
    <div>
      <div style={{ ...styles.formRow, marginBottom: '16px' }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Product</label>
          <input
            style={styles.input}
            placeholder="e.g. BeaconOps, Acme SaaS"
            value={genForm.product}
            onChange={(e) => setGenForm({ ...genForm, product: e.target.value })}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Asset Type</label>
          <select
            style={{ ...styles.select, width: '100%', padding: '10px 14px' }}
            value={genForm.asset_type}
            onChange={(e) => setGenForm({ ...genForm, asset_type: e.target.value })}
          >
            {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ ...styles.formRow, marginBottom: '16px' }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Platform / Size</label>
          <select
            style={{ ...styles.select, width: '100%', padding: '10px 14px' }}
            value={genForm.platform}
            onChange={(e) => setGenForm({ ...genForm, platform: e.target.value })}
          >
            {PLATFORM_SIZES.map((p) => (
              <option key={p.value} value={p.value}>{p.label} {p.value !== 'custom' ? `(${p.value})` : ''}</option>
            ))}
          </select>
        </div>
        {genForm.platform === 'custom' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Width</label>
              <input
                style={styles.input}
                type="number"
                placeholder="1080"
                value={genForm.customWidth}
                onChange={(e) => setGenForm({ ...genForm, customWidth: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Height</label>
              <input
                style={styles.input}
                type="number"
                placeholder="1080"
                value={genForm.customHeight}
                onChange={(e) => setGenForm({ ...genForm, customHeight: e.target.value })}
              />
            </div>
          </div>
        )}
        {genForm.platform !== 'custom' && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Title</label>
            <input
              style={styles.input}
              placeholder="Asset title"
              value={genForm.title}
              onChange={(e) => setGenForm({ ...genForm, title: e.target.value })}
            />
          </div>
        )}
      </div>

      {genForm.platform === 'custom' && (
        <div style={styles.formGroup}>
          <label style={styles.label}>Title</label>
          <input
            style={styles.input}
            placeholder="Asset title"
            value={genForm.title}
            onChange={(e) => setGenForm({ ...genForm, title: e.target.value })}
          />
        </div>
      )}

      <div style={styles.formGroup}>
        <label style={styles.label}>Headline</label>
        <input
          style={styles.input}
          placeholder="Main headline text for the graphic"
          value={genForm.headline}
          onChange={(e) => setGenForm({ ...genForm, headline: e.target.value })}
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Subtext</label>
        <textarea
          style={styles.textarea}
          placeholder="Supporting text or description"
          value={genForm.subtext}
          onChange={(e) => setGenForm({ ...genForm, subtext: e.target.value })}
        />
      </div>

      <div style={{ ...styles.formRow, marginBottom: '16px' }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Background Color</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={genForm.bgColor}
              onChange={(e) => setGenForm({ ...genForm, bgColor: e.target.value })}
              style={{ width: '40px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '6px' }}
            />
            <input
              style={{ ...styles.input, flex: 1 }}
              value={genForm.bgColor}
              onChange={(e) => setGenForm({ ...genForm, bgColor: e.target.value })}
            />
          </div>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Accent Color</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={genForm.accentColor}
              onChange={(e) => setGenForm({ ...genForm, accentColor: e.target.value })}
              style={{ width: '40px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '6px' }}
            />
            <input
              style={{ ...styles.input, flex: 1 }}
              value={genForm.accentColor}
              onChange={(e) => setGenForm({ ...genForm, accentColor: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Font Family</label>
        <select
          style={{ ...styles.select, width: '100%', padding: '10px 14px' }}
          value={genForm.fontFamily}
          onChange={(e) => setGenForm({ ...genForm, fontFamily: e.target.value })}
        >
          <option value="Inter, sans-serif">Inter</option>
          <option value="'Playfair Display', serif">Playfair Display</option>
          <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
          <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
          <option value="system-ui, sans-serif">System UI</option>
        </select>
      </div>

      <button
        style={{ ...styles.btnPrimary, width: '100%', padding: '14px', fontSize: '16px', opacity: generating ? 0.6 : 1 }}
        onClick={handleGenerate}
        disabled={generating || !genForm.product || !genForm.title}
      >
        {generating ? 'Generating...' : 'Generate Asset'}
      </button>

      {preview && (
        <div style={styles.previewArea}>
          <div dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      )}
    </div>
  );

  // ── Templates Tab ─────────────────────────────────────────────────────────

  const renderTemplatesTab = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button
          style={styles.btnPrimary}
          onClick={() => {
            setEditingTemplate(null);
            setTemplateForm({ name: '', asset_type: 'social_graphic', template_config_json: {} });
            setShowTemplateModal(true);
          }}
        >
          + New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>No templates yet</p>
          <p>Create a template to reuse design configurations.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {templates.map((tpl) => (
            <div key={tpl.id} style={styles.card}>
              <div style={styles.cardPreview}>
                {tpl.thumbnail_url ? (
                  <img src={tpl.thumbnail_url} alt={tpl.name} style={styles.cardPreviewImg} />
                ) : (
                  <span style={styles.cardPreviewPlaceholder}>&#9998;</span>
                )}
              </div>
              <div style={styles.cardBody}>
                <p style={styles.cardTitle}>{tpl.name}</p>
                <div style={styles.cardMeta}>
                  <span style={{ ...styles.badge, ...styles.badgeType }}>{getTypeLabel(tpl.asset_type)}</span>
                </div>
                <div style={styles.cardActions}>
                  <button
                    style={{ ...styles.btnSmall, backgroundColor: '#6366f1', color: '#fff' }}
                    onClick={() => openEditTemplate(tpl)}
                  >
                    Edit
                  </button>
                  <button style={styles.btnDanger} onClick={() => handleDeleteTemplate(tpl.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showTemplateModal && (
        <div style={styles.modal} onClick={() => setShowTemplateModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                placeholder="Template name"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Asset Type</label>
              <select
                style={{ ...styles.select, width: '100%', padding: '10px 14px' }}
                value={templateForm.asset_type}
                onChange={(e) => setTemplateForm({ ...templateForm, asset_type: e.target.value })}
              >
                {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button style={styles.btnSecondary} onClick={() => setShowTemplateModal(false)}>Cancel</button>
              <button style={styles.btnPrimary} onClick={handleSaveTemplate} disabled={!templateForm.name}>
                {editingTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Brand Assets Tab ──────────────────────────────────────────────────────

  const renderBrandAssetsTab = () => (
    <div>
      <div style={styles.filterRow}>
        <select
          style={{ ...styles.select, minWidth: '200px' }}
          value={brandProduct}
          onChange={(e) => setBrandProduct(e.target.value)}
        >
          <option value="">Select a product...</option>
          {products.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {!brandProduct ? (
        <div style={styles.emptyState}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>Select a product</p>
          <p>Choose a product above to view its brand assets.</p>
        </div>
      ) : !brand ? (
        <div style={styles.emptyState}>
          <p>Loading brand data...</p>
        </div>
      ) : (
        <div>
          {/* Color Palette */}
          <div style={styles.brandSection}>
            <h3 style={{ color: '#f59e0b', marginTop: 0, marginBottom: '16px', fontSize: '16px', fontWeight: '700' }}>
              Color Palette
            </h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {brand.colors && typeof brand.colors === 'object' && Object.entries(brand.colors).map(([name, color]) => (
                <div key={name} style={{ textAlign: 'center' }}>
                  <div style={{ ...styles.colorSwatch, backgroundColor: color }} title={`${name}: ${color}`} />
                  <p style={styles.colorLabel}>{name}</p>
                  <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>{color}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Fonts */}
          <div style={styles.brandSection}>
            <h3 style={{ color: '#f59e0b', marginTop: 0, marginBottom: '16px', fontSize: '16px', fontWeight: '700' }}>
              Font Selections
            </h3>
            {brand.fonts && typeof brand.fonts === 'object' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {Object.entries(brand.fonts).map(([role, font]) => (
                  <div key={role} style={{ backgroundColor: '#0f0f23', borderRadius: '8px', padding: '16px' }}>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 6px 0', textTransform: 'uppercase' }}>{role}</p>
                    <p style={{ fontSize: '18px', color: '#e0e0e0', margin: 0, fontFamily: font }}>{font}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280' }}>No fonts configured.</p>
            )}
          </div>

          {/* Logos */}
          <div style={styles.brandSection}>
            <h3 style={{ color: '#f59e0b', marginTop: 0, marginBottom: '16px', fontSize: '16px', fontWeight: '700' }}>
              Uploaded Logos
            </h3>
            {brand.logos && Array.isArray(brand.logos) && brand.logos.length > 0 ? (
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {brand.logos.map((logo, i) => (
                  <div key={i} style={{ backgroundColor: '#0f0f23', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                    <img
                      src={typeof logo === 'string' ? logo : logo.url}
                      alt={`Logo ${i + 1}`}
                      style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain' }}
                    />
                    {logo.label && <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>{logo.label}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280' }}>No logos uploaded yet.</p>
            )}
          </div>

          {/* Style Notes */}
          <div style={styles.brandSection}>
            <h3 style={{ color: '#f59e0b', marginTop: 0, marginBottom: '16px', fontSize: '16px', fontWeight: '700' }}>
              Style Guide Notes
            </h3>
            <p style={{ color: '#d1d5db', lineHeight: '1.6', margin: 0 }}>
              {brand.style_notes || 'No style guide notes configured for this product.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Design Studio</h1>
          <p style={styles.subtitle}>Graphic Design Asset Generator for BeaconOps</p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{stats.total || 0}</p>
          <p style={styles.statLabel}>Total Assets</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{stats.recentCount || 0}</p>
          <p style={styles.statLabel}>Last 30 Days</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{Object.keys(stats.byProduct || {}).length}</p>
          <p style={styles.statLabel}>Products</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{Object.keys(stats.byType || {}).length}</p>
          <p style={styles.statLabel}>Asset Types</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab}
            style={activeTab === tab ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading && activeTab === 'Gallery' && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading assets...</div>
      )}
      {activeTab === 'Gallery' && renderGalleryTab()}
      {activeTab === 'Generate' && renderGenerateTab()}
      {activeTab === 'Templates' && renderTemplatesTab()}
      {activeTab === 'Brand Assets' && renderBrandAssetsTab()}
    </div>
  );
}
