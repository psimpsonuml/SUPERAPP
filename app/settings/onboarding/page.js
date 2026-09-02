'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchOnboarding, generateOnboardingAssets, generateAllOnboardingAssets,
  regenerateOnboardingAsset, updateOnboardingStatus, generateSatelliteAssets,
  generateEmailDomainSetup,
} from '../../../lib/api';

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#fef3c7' },
  connected: { label: 'Connected', color: '#22c55e', bg: '#dcfce7' },
};

const ASSET_LABELS = {
  account_names: 'Account Names',
  bio: 'Bio / Description',
  profile_image_prompt: 'Profile Image Prompt',
  banner_image_prompt: 'Banner Image Prompt',
  initial_content: 'Initial Content',
  settings_checklist: 'Settings Checklist',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-sm"
      style={{ fontSize: 11, padding: '2px 8px', minWidth: 50 }}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function AssetCard({ assetType, content, product, platform, onRegenerate, regenerating }) {
  const label = ASSET_LABELS[assetType] || assetType.replace(/_/g, ' ');

  const renderContent = () => {
    if (!content) return <span className="text-muted text-sm">Not generated yet</span>;

    if (assetType === 'account_names') {
      const items = content.items || content;
      if (!Array.isArray(items)) return <span className="text-sm">{JSON.stringify(content)}</span>;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((name, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ flex: 1, padding: '4px 8px', background: 'var(--bg)', borderRadius: 4, fontSize: 13 }}>{name}</code>
              <CopyButton text={name} />
            </div>
          ))}
        </div>
      );
    }

    if (assetType === 'settings_checklist') {
      const items = content.items || content;
      if (!Array.isArray(items)) return <span className="text-sm">{JSON.stringify(content)}</span>;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
              <span style={{ marginTop: 1, color: 'var(--text-muted)' }}>{i + 1}.</span>
              <span>{typeof item === 'string' ? item : item.step || item.description || JSON.stringify(item)}</span>
            </div>
          ))}
        </div>
      );
    }

    // Text-based assets
    const text = content.text || (typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          padding: '10px 12px', background: 'var(--bg)', borderRadius: 6,
          fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200,
          overflow: 'auto',
        }}>
          {text}
        </div>
        <CopyButton text={text} />
      </div>
    );
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
          {label}
        </span>
        {content && (
          <button
            className="btn btn-sm"
            style={{ fontSize: 10, padding: '2px 6px' }}
            onClick={() => onRegenerate(assetType)}
            disabled={regenerating === assetType}
          >
            {regenerating === assetType ? '...' : 'Regenerate'}
          </button>
        )}
      </div>
      {renderContent()}
    </div>
  );
}

function PlatformCard({ platformData, product, onGenerate, onRegenerate, onStatusChange, generating, regenerating }) {
  const { platform, assets, status } = platformData;
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const hasAssets = Object.keys(assets).length > 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', cursor: 'pointer', borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{platform.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            color: statusCfg.color, background: statusCfg.bg,
          }}>
            {statusCfg.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!hasAssets && (
            <button
              className="btn btn-sm btn-primary"
              style={{ fontSize: 11 }}
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Assets'}
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
            ▼
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: 16 }}>
          {hasAssets ? (
            <>
              {Object.entries(ASSET_LABELS).map(([type]) => (
                <AssetCard
                  key={type}
                  assetType={type}
                  content={assets[type]}
                  product={product}
                  platform={platform.id}
                  onRegenerate={onRegenerate}
                  regenerating={regenerating}
                />
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {platform.signupUrl && (
                  <a href={platform.signupUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                    Open {platform.name}
                  </a>
                )}
                {status !== 'connected' && (
                  <button
                    className="btn btn-sm"
                    style={{ color: '#22c55e', borderColor: '#22c55e' }}
                    onClick={() => onStatusChange('connected')}
                  >
                    Mark Connected
                  </button>
                )}
                {status === 'connected' && (
                  <button
                    className="btn btn-sm"
                    style={{ color: '#6b7280' }}
                    onClick={() => onStatusChange('in_progress')}
                  >
                    Unmark Connected
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted">
              Click &quot;Generate Assets&quot; to create account names, bio, image prompts, initial content, and settings checklist for {platform.name}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeProduct, setActiveProduct] = useState('chronostates');
  const [generating, setGenerating] = useState(null); // platformId or 'all'
  const [regenerating, setRegenerating] = useState(null); // assetType
  const [tab, setTab] = useState('platforms');
  const [satellites, setSatellites] = useState(null);
  const [emailDomains, setEmailDomains] = useState(null);
  const [genSatellites, setGenSatellites] = useState(false);
  const [genDomains, setGenDomains] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchOnboarding();
      setData(result);
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = async (platformId) => {
    setGenerating(platformId);
    try {
      await generateOnboardingAssets({ product: activeProduct, platform: platformId });
      await loadData();
    } catch { /* noop */ }
    setGenerating(null);
  };

  const handleGenerateAll = async () => {
    setGenerating('all');
    try {
      await generateAllOnboardingAssets({ product: activeProduct });
      await loadData();
    } catch { /* noop */ }
    setGenerating(null);
  };

  const handleRegenerate = async (platformId, assetType) => {
    setRegenerating(assetType);
    try {
      await regenerateOnboardingAsset({ product: activeProduct, platform: platformId, assetType });
      await loadData();
    } catch { /* noop */ }
    setRegenerating(null);
  };

  const handleStatusChange = async (platformId, status) => {
    try {
      await updateOnboardingStatus({ product: activeProduct, platform: platformId, status });
      await loadData();
    } catch { /* noop */ }
  };

  const handleSatellites = async () => {
    setGenSatellites(true);
    try {
      const r = await generateSatelliteAssets();
      setSatellites(r.satellites);
    } catch { /* noop */ }
    setGenSatellites(false);
  };

  const handleEmailDomains = async () => {
    setGenDomains(true);
    try {
      const r = await generateEmailDomainSetup();
      setEmailDomains(r.domains);
    } catch { /* noop */ }
    setGenDomains(false);
  };

  if (loading) return <div className="loading"><div className="spinner" />Loading onboarding data...</div>;

  const products = data?.products || [];
  const platforms = data?.platforms || [];
  const progress = data?.progress || { total: 0, connected: 0, pct: 0 };
  const productData = data?.structured?.[activeProduct];

  const TABS = [
    { id: 'platforms', label: 'Platform Setup' },
    { id: 'satellites', label: 'Satellites & Tools' },
    { id: 'email', label: 'Email Domains' },
  ];

  return (
    <>
      <div className="page-header">
        <h1>Onboarding &amp; Setup</h1>
        <p>Generate platform assets and setup checklists for all products</p>
      </div>

      {/* ── Progress bar ─────────────────────────────────── */}
      <div style={{
        background: 'var(--card-bg)', borderRadius: 10, padding: 16,
        border: '1px solid var(--border)', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Onboarding Progress</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {progress.connected} of {progress.total} platform accounts connected
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress.pct}%`, borderRadius: 4, transition: 'width 0.3s',
            background: progress.pct >= 80 ? '#22c55e' : progress.pct >= 40 ? '#f59e0b' : '#6b7280',
          }} />
        </div>
        <div className="text-xs text-muted" style={{ marginTop: 4 }}>
          You&apos;re {progress.pct}% set up{progress.hasAssets > 0 ? ` — ${progress.hasAssets} platforms have assets generated` : ''}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${tab === t.id ? 'btn-primary' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'platforms' && (
        <>
          {/* ── Product selector ──────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {products.map(p => (
              <button
                key={p.id}
                className={`btn btn-sm ${activeProduct === p.id ? 'btn-primary' : ''}`}
                onClick={() => setActiveProduct(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* ── Generate All button ──────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleGenerateAll}
              disabled={generating === 'all'}
            >
              {generating === 'all' ? 'Generating all platforms...' : 'Generate All Platforms'}
            </button>
          </div>

          {/* ── Platform cards ───────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {platforms.map(pl => {
              const platData = productData?.platforms?.[pl.id] || { platform: pl, assets: {}, status: 'not_started' };
              return (
                <PlatformCard
                  key={pl.id}
                  platformData={platData}
                  product={activeProduct}
                  onGenerate={() => handleGenerate(pl.id)}
                  onRegenerate={(assetType) => handleRegenerate(pl.id, assetType)}
                  onStatusChange={(status) => handleStatusChange(pl.id, status)}
                  generating={generating === pl.id}
                  regenerating={regenerating}
                />
              );
            })}
          </div>
        </>
      )}

      {tab === 'satellites' && (
        <div style={{
          background: 'var(--card-bg)', borderRadius: 10, padding: 20,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Satellite Blogs &amp; Vertical Tools</h3>
              <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>Domain suggestions, site titles, taglines, initial content, and deployment checklists.</p>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleSatellites}
              disabled={genSatellites}
            >
              {genSatellites ? 'Generating...' : satellites ? 'Regenerate' : 'Generate'}
            </button>
          </div>

          {satellites ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.entries(satellites).map(([productId, assets]) => {
                const product = products.find(p => p.id === productId);
                return (
                  <div key={productId}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>
                      {product?.name || productId}
                    </h4>

                    {assets.blogs?.map((blog, i) => (
                      <div key={i} style={{
                        padding: 12, border: '1px solid var(--border)', borderRadius: 8,
                        marginBottom: 8, background: 'var(--bg)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="font-semibold text-sm">{blog.title || blog.domain || `Blog ${i + 1}`}</span>
                          {blog.domain && <CopyButton text={blog.domain} />}
                        </div>
                        {blog.tagline && <p className="text-sm text-muted" style={{ margin: '4px 0' }}>{blog.tagline}</p>}
                        {blog.content_outlines && (
                          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12 }}>
                            {(Array.isArray(blog.content_outlines) ? blog.content_outlines : []).map((outline, j) => (
                              <li key={j} className="text-muted">{typeof outline === 'string' ? outline : outline.title || JSON.stringify(outline)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}

                    {assets.tools?.map((tool, i) => (
                      <div key={i} style={{
                        padding: 12, border: '1px solid var(--accent)', borderRadius: 8,
                        marginBottom: 8, background: 'var(--bg)', borderLeftWidth: 3,
                      }}>
                        <span className="font-semibold text-sm">{tool.title || tool.domain || `Tool ${i + 1}`}</span>
                        {tool.description && <p className="text-sm text-muted" style={{ margin: '4px 0' }}>{tool.description}</p>}
                        {tool.deployment_checklist && (
                          <div style={{ marginTop: 8 }}>
                            {(Array.isArray(tool.deployment_checklist) ? tool.deployment_checklist : []).map((step, j) => (
                              <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-muted)' }}>{j + 1}.</span>
                                <span>{typeof step === 'string' ? step : step.step || JSON.stringify(step)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted">Click Generate to create satellite blog and vertical tool suggestions for all products.</div>
          )}
        </div>
      )}

      {tab === 'email' && (
        <div style={{
          background: 'var(--card-bg)', borderRadius: 10, padding: 20,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Outreach Email Domain Setup</h3>
              <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>5 secondary email domains with DNS, mailbox, and warmup configuration.</p>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleEmailDomains}
              disabled={genDomains}
            >
              {genDomains ? 'Generating...' : emailDomains ? 'Regenerate' : 'Generate'}
            </button>
          </div>

          {emailDomains && Array.isArray(emailDomains) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {emailDomains.map((domain, i) => (
                <div key={i} style={{
                  padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span className="font-semibold">{domain.domain || domain.name || `Domain ${i + 1}`}</span>
                    <span className="text-xs text-muted">{domain.purpose}</span>
                  </div>

                  {/* DNS Records */}
                  {(domain.dns_setup || domain.dns || domain.records) && (
                    <div style={{ marginBottom: 8 }}>
                      <div className="text-xs font-semibold text-muted" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>DNS Records</div>
                      {Object.entries(domain.dns_setup || domain.dns || domain.records || {}).map(([type, value]) => (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <code style={{ fontSize: 11, padding: '2px 6px', background: 'var(--card-bg)', borderRadius: 3, fontWeight: 600 }}>{type}</code>
                          <code style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </code>
                          <CopyButton text={typeof value === 'string' ? value : JSON.stringify(value)} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mailbox steps */}
                  {(domain.mailbox_steps || domain.mailbox_creation) && (
                    <div style={{ marginBottom: 8 }}>
                      <div className="text-xs font-semibold text-muted" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mailbox Setup</div>
                      {(Array.isArray(domain.mailbox_steps || domain.mailbox_creation) ? (domain.mailbox_steps || domain.mailbox_creation) : [domain.mailbox_steps || domain.mailbox_creation]).map((step, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{j + 1}.</span>
                          <span>{typeof step === 'string' ? step : step.step || JSON.stringify(step)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warmup */}
                  {(domain.warmup || domain.warmup_configuration) && (
                    <div>
                      <div className="text-xs font-semibold text-muted" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Warmup Config</div>
                      <div className="text-sm" style={{ padding: '6px 10px', background: 'var(--card-bg)', borderRadius: 4 }}>
                        {typeof (domain.warmup || domain.warmup_configuration) === 'string'
                          ? (domain.warmup || domain.warmup_configuration)
                          : JSON.stringify(domain.warmup || domain.warmup_configuration, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted">Click Generate to create email domain setup checklists with DNS records, mailbox creation, and warmup configuration.</div>
          )}
        </div>
      )}
    </>
  );
}
