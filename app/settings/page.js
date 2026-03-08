'use client';

import { useState, useEffect } from 'react';
import {
  fetchSlider, updateSlider, updateReducedOps,
  fetchSettings, fetchBrandProfiles,
} from '../../lib/api';
import { PRODUCTS } from '../../lib/constants';

function getSliderLabel(p) {
  if (p <= 25) return 'Maximum Oversight';
  if (p <= 50) return 'Cautious';
  if (p <= 75) return 'Balanced';
  return 'Aggressive';
}

function getSliderColor(p) {
  if (p <= 25) return 'var(--green)';
  if (p <= 50) return 'var(--yellow)';
  if (p <= 75) return 'var(--orange)';
  return 'var(--red)';
}

const TIER_EXPLANATIONS = {
  oversight: [
    'All content requires manual approval before publishing',
    'Agents suggest actions but never execute autonomously',
    'Every email, social post, and outreach gets human review',
    'Maximum control — nothing goes out without your click',
  ],
  cautious: [
    'Tier 3 items (low-risk social posts) may auto-publish',
    'Tier 1 & 2 items (emails, blogs, outreach) require approval',
    'Agents draft content but wait for review on most items',
    'Good starting point while building trust with the system',
  ],
  balanced: [
    'Tier 2 & 3 content auto-publishes (social, routine emails)',
    'Only Tier 1 items (financial, legal, partnerships) need approval',
    'Agents operate with moderate independence on daily tasks',
    'You review 20-30% of output, focus on high-impact decisions',
  ],
  aggressive: [
    'Most content auto-publishes without manual review',
    'Only critical financial, legal, or partnership items flagged',
    'Agents run fully autonomously on routine operations',
    'Maximum throughput — review only what truly matters',
  ],
};

function getTierKey(p) {
  if (p <= 25) return 'oversight';
  if (p <= 50) return 'cautious';
  if (p <= 75) return 'balanced';
  return 'aggressive';
}

export default function SettingsPage() {
  const [tab, setTab] = useState('automation');
  const [sliderPos, setSliderPos] = useState(60);
  const [savedPos, setSavedPos] = useState(60);
  const [reducedOps, setReducedOps] = useState(false);
  const [settings, setSettings] = useState(null);
  const [brandProfiles, setBrandProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const results = await Promise.allSettled([
          fetchSlider(),
          fetchSettings(),
          fetchBrandProfiles(),
        ]);
        if (results[0].status === 'fulfilled') {
          const pos = results[0].value.sliderPosition ?? 60;
          setSliderPos(pos);
          setSavedPos(pos);
        }
        if (results[1].status === 'fulfilled') {
          const s = results[1].value;
          setSettings(s);
          if (s.reduced_ops != null) setReducedOps(s.reduced_ops);
        }
        if (results[2].status === 'fulfilled') {
          setBrandProfiles(results[2].value.profiles || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSliderSave() {
    setSaving(true);
    try {
      const result = await updateSlider(sliderPos);
      setSavedPos(result.sliderPosition ?? sliderPos);
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReducedOps(enabled) {
    try {
      await updateReducedOps(enabled);
      setReducedOps(enabled);
    } catch (err) {
      alert(`Failed to update: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading settings...
      </div>
    );
  }

  if (error) return <div className="error-state">Error: {error}</div>;

  const changed = sliderPos !== savedPos;
  const tierKey = getTierKey(sliderPos);

  const TABS = [
    { id: 'automation', label: 'Automation' },
    { id: 'brand', label: 'Brand Voice' },
    { id: 'account', label: 'Account' },
  ];

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Control automation levels, brand voice, and account configuration</p>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Automation Tab ────────────────────────────── */}
      {tab === 'automation' && (
        <>
          {/* Slider Card */}
          <div className="card">
            <div className="card-header">
              <h2>Automation Level</h2>
              <div className="btn-group">
                {changed && (
                  <button className="btn btn-primary btn-sm" onClick={handleSliderSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>

            <p className="text-sm text-muted" style={{ marginBottom: 24 }}>
              Controls how much autonomy agents have. Slide left for maximum human oversight,
              right for full autonomy.
            </p>

            <div className="slider-container">
              <input
                type="range"
                className="slider-input"
                min="0"
                max="100"
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
              />
              <div className="slider-labels">
                <span>Manual</span>
                <span>Cautious</span>
                <span>Balanced</span>
                <span>Autonomous</span>
              </div>
            </div>

            <div className="slider-value">
              <div className="position" style={{ color: getSliderColor(sliderPos) }}>
                {sliderPos}
              </div>
              <div className="label">{getSliderLabel(sliderPos)}</div>
            </div>

            {/* Tier zones visualization */}
            <div style={{ display: 'flex', gap: 4, marginTop: 20, height: 4, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ flex: 25, background: sliderPos <= 25 ? 'var(--green)' : 'var(--border)', borderRadius: 2, transition: 'background 0.3s' }} />
              <div style={{ flex: 25, background: sliderPos > 25 && sliderPos <= 50 ? 'var(--yellow)' : 'var(--border)', borderRadius: 2, transition: 'background 0.3s' }} />
              <div style={{ flex: 25, background: sliderPos > 50 && sliderPos <= 75 ? 'var(--orange)' : 'var(--border)', borderRadius: 2, transition: 'background 0.3s' }} />
              <div style={{ flex: 25, background: sliderPos > 75 ? 'var(--red)' : 'var(--border)', borderRadius: 2, transition: 'background 0.3s' }} />
            </div>

            <div className="info-block" style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                What this means at position {sliderPos}:
              </div>
              <ul style={{ paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
                {TIER_EXPLANATIONS[tierKey].map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </div>

            {/* Tier breakdown */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Approval Tiers</div>
              <div className="grid-3" style={{ gap: 10 }}>
                {[
                  { tier: 1, label: 'Tier 1 — Critical', desc: 'Financial, legal, partnerships', color: 'var(--red)', behavior: sliderPos > 75 ? 'Auto-approve' : 'Requires approval' },
                  { tier: 2, label: 'Tier 2 — Standard', desc: 'Blog posts, emails, outreach', color: 'var(--orange)', behavior: sliderPos > 50 ? 'Auto-approve' : 'Requires approval' },
                  { tier: 3, label: 'Tier 3 — Routine', desc: 'Social posts, routine updates', color: 'var(--accent-hover)', behavior: sliderPos > 25 ? 'Auto-approve' : 'Requires approval' },
                ].map((t) => (
                  <div key={t.tier} className="info-block" style={{ borderLeft: `3px solid ${t.color}` }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{t.label}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>{t.desc}</div>
                    <div style={{ marginTop: 8 }}>
                      <span className={`badge ${t.behavior === 'Auto-approve' ? 'badge-green' : 'badge-yellow'}`}>
                        {t.behavior}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Operational Preferences */}
          <div className="card">
            <div className="card-header">
              <h2>Operational Preferences</h2>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h3>Reduced Operations Mode</h3>
                <p>Limit agent activity to essential tasks only (inbox monitoring, infrastructure alerts). Useful for holidays, maintenance windows, or when you need a break.</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={reducedOps}
                  onChange={(e) => handleReducedOps(e.target.checked)}
                />
                <span className="toggle-track" />
              </label>
            </div>

            {reducedOps && (
              <div className="info-block" style={{ marginTop: 12, borderLeft: '3px solid var(--yellow)' }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--yellow)', marginBottom: 4 }}>
                  Reduced Ops Active
                </div>
                <div className="text-xs text-muted">
                  Only essential agents (Inbox Monitor, Infrastructure Monitor, User Lifecycle) will run.
                  All content generation, outreach, and marketing agents are paused.
                </div>
              </div>
            )}
          </div>

          {/* Escalation & Notifications */}
          <div className="card">
            <div className="card-header">
              <h2>Notifications & Escalation</h2>
            </div>

            <div className="info-row">
              <span className="info-label">Notification Email</span>
              <span className="info-value">{settings?.notification_email || 'Not configured'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Escalation Window</span>
              <span className="info-value">{settings?.escalation_window_minutes || 120} minutes</span>
            </div>
            <div className="info-row">
              <span className="info-label">Push Notifications</span>
              <span className="info-value">
                <span className={`badge ${settings?.notification_push_endpoint ? 'badge-green' : 'badge-muted'}`}>
                  {settings?.notification_push_endpoint ? 'Configured' : 'Not set'}
                </span>
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── Brand Voice Tab ───────────────────────────── */}
      {tab === 'brand' && (
        <>
          {brandProfiles.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">B</div>
                <p>No brand profiles configured yet.</p>
                <p className="text-sm text-muted mt-2">
                  Run the seed script or create profiles via the API to get started.
                </p>
              </div>
            </div>
          ) : (
            brandProfiles.map((profile) => {
              const productInfo = PRODUCTS.find((p) => p.id === profile.product);
              const voice = profile.voice_config || {};
              const languages = Array.isArray(profile.language_settings) ? profile.language_settings : [];
              const hashtags = Array.isArray(profile.hashtag_sets) ? profile.hashtag_sets : [];
              const prohibited = Array.isArray(profile.prohibited_phrases) ? profile.prohibited_phrases : [];

              return (
                <div key={profile.product} className="brand-card">
                  <div className="brand-card-header">
                    <h3>{productInfo?.name || profile.product}</h3>
                    <span className={`badge badge-purple`}>{profile.emoji_policy || 'minimal'} emoji</span>
                  </div>

                  {/* Voice Config */}
                  {Object.keys(voice).length > 0 && (
                    <div className="section">
                      <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                        Voice Configuration
                      </div>
                      <div className="grid-2" style={{ gap: 8 }}>
                        {Object.entries(voice).map(([key, val]) => (
                          <div key={key} className="info-row" style={{ padding: '6px 0' }}>
                            <span className="info-label" style={{ textTransform: 'capitalize' }}>
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span className="info-value text-sm">
                              {typeof val === 'string' ? val : JSON.stringify(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {languages.length > 0 && (
                    <div className="section" style={{ marginBottom: 14 }}>
                      <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                        Languages
                      </div>
                      <div className="tag-list">
                        {languages.map((lang) => (
                          <span key={lang} className="tag">{lang}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hashtag Sets */}
                  {hashtags.length > 0 && (
                    <div className="section" style={{ marginBottom: 14 }}>
                      <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                        Hashtags
                      </div>
                      <div className="tag-list">
                        {hashtags.flat().map((tag, i) => (
                          <span key={i} className="tag">#{typeof tag === 'string' ? tag : JSON.stringify(tag)}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prohibited Phrases */}
                  {prohibited.length > 0 && (
                    <div className="section" style={{ marginBottom: 0 }}>
                      <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                        Prohibited Phrases
                      </div>
                      <div className="tag-list">
                        {prohibited.map((phrase, i) => (
                          <span key={i} className="tag" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--red)' }}>
                            {phrase}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Updated timestamp */}
                  {profile.updated_at && (
                    <div className="text-xs text-muted mt-3" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                      Last updated: {new Date(profile.updated_at).toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {/* ── Account Tab ───────────────────────────────── */}
      {tab === 'account' && (
        <>
          <div className="card">
            <div className="card-header">
              <h2>Account Details</h2>
              <span className={`badge badge-blue`}>{settings?.plan || 'personal'}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Account Name</span>
              <span className="info-value">{settings?.name || '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Account ID</span>
              <span className="info-value font-mono text-sm">{settings?.id || '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Plan</span>
              <span className="info-value" style={{ textTransform: 'capitalize' }}>{settings?.plan || 'personal'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Created</span>
              <span className="info-value">
                {settings?.created_at ? new Date(settings.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Connected Products</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PRODUCTS.map((product) => {
                const hasProfile = brandProfiles.some((p) => p.product === product.id);
                return (
                  <div key={product.id} className="info-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div className="font-semibold text-sm">{product.name}</div>
                      <div className="text-xs text-muted font-mono">{product.id}</div>
                    </div>
                    <span className={`badge ${hasProfile ? 'badge-green' : 'badge-muted'}`}>
                      {hasProfile ? 'Profile configured' : 'No profile'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Environment</h2>
            </div>

            <div className="info-row">
              <span className="info-label">Timezone</span>
              <span className="info-value">America/New_York (ET)</span>
            </div>
            <div className="info-row">
              <span className="info-label">Daily Report</span>
              <span className="info-value">10:00 AM ET</span>
            </div>
            <div className="info-row">
              <span className="info-label">Agent Retry Policy</span>
              <span className="info-value">3 attempts (1s, 2s, 4s backoff)</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
