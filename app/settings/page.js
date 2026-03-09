'use client';

import { useState, useEffect } from 'react';
import {
  fetchSlider, updateSlider, updateReducedOps,
  fetchSettings, fetchBrandProfiles, fetchSendingDomains,
  fetchConnectedAccounts, connectPlatform, disconnectPlatform, testPlatformConnection,
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
  const [domains, setDomains] = useState([]);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [connecting, setConnecting] = useState(null);
  const [testing, setTesting] = useState(null);
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
          fetchSendingDomains(),
          fetchConnectedAccounts(),
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
        if (results[3].status === 'fulfilled') {
          setDomains(results[3].value.domains || []);
        }
        if (results[4].status === 'fulfilled') {
          setConnectedAccounts(results[4].value.accounts || []);
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

  async function handleConnect(platformId) {
    setConnecting(platformId);
    try {
      await connectPlatform(platformId, {});
      const updated = await fetchConnectedAccounts();
      setConnectedAccounts(updated.accounts || []);
    } catch (err) {
      alert(`Failed to connect ${platformId}: ${err.message}`);
    } finally {
      setConnecting(null);
    }
  }

  async function handleDisconnect(platformId) {
    if (!confirm(`Disconnect ${platformId}?`)) return;
    try {
      await disconnectPlatform(platformId);
      const updated = await fetchConnectedAccounts();
      setConnectedAccounts(updated.accounts || []);
    } catch (err) {
      alert(`Failed to disconnect: ${err.message}`);
    }
  }

  async function handleTestConnection(platformId) {
    setTesting(platformId);
    try {
      const result = await testPlatformConnection(platformId);
      alert(`${platformId}: ${result.message || result.status}`);
    } catch (err) {
      alert(`Test failed: ${err.message}`);
    } finally {
      setTesting(null);
    }
  }

  const TABS = [
    { id: 'automation', label: 'Automation' },
    { id: 'connected', label: 'Connected Accounts' },
    { id: 'brand', label: 'Brand Voice' },
    { id: 'domains', label: 'Sending Domains' },
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

      {/* ── Connected Accounts Tab ────────────────────── */}
      {tab === 'connected' && (
        <>
          <div className="card">
            <div className="card-header">
              <h2>Connected Accounts</h2>
              <span className="text-sm text-muted">Platform connections for Social Distributor</span>
            </div>
            <p className="text-sm text-muted" style={{ marginBottom: 20 }}>
              Connect your social media accounts to enable automated posting. Each platform requires API credentials configured via environment variables.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {connectedAccounts.map((account) => {
                const conn = account.connections[0] || {};
                const isConnected = conn.status === 'connected';
                const isExpired = conn.status === 'expired' || (conn.expires_at && new Date(conn.expires_at) < new Date());
                const isReady = conn.status === 'ready_to_connect';

                const statusBadge = isConnected ? 'badge-green'
                  : isExpired ? 'badge-yellow'
                  : isReady ? 'badge-blue'
                  : 'badge-red';
                const statusText = isConnected ? 'Connected'
                  : isExpired ? 'Expired'
                  : isReady ? 'Ready'
                  : 'Disconnected';

                return (
                  <div key={account.platform} className="info-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      {/* Status indicator */}
                      <span style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                        background: isConnected ? 'var(--green)' : isExpired ? 'var(--yellow)' : isReady ? 'var(--accent-hover)' : 'var(--red)',
                        flexShrink: 0,
                      }} />
                      <div>
                        <div className="font-semibold text-sm">{account.name}</div>
                        <div className="text-xs text-muted">
                          {conn.platform_user_name ? `@${conn.platform_user_name}` : account.authType === 'bot_token' ? 'Bot token' : 'OAuth2'}
                          {account.requiresBusiness && !isConnected && (
                            <span style={{ color: 'var(--yellow)', marginLeft: 8 }}>Business account required</span>
                          )}
                        </div>
                        {conn.connected_at && isConnected && (
                          <div className="text-xs text-muted">
                            Connected {new Date(conn.connected_at).toLocaleDateString()}
                          </div>
                        )}
                        {conn.last_error && !isConnected && (
                          <div className="text-xs" style={{ color: 'var(--red)', marginTop: 2 }}>
                            {conn.last_error}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${statusBadge}`}>{statusText}</span>

                      {isConnected ? (
                        <>
                          <button
                            className="btn btn-xs"
                            onClick={() => handleTestConnection(account.platform)}
                            disabled={testing === account.platform}
                          >
                            {testing === account.platform ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            className="btn btn-xs"
                            onClick={() => handleDisconnect(account.platform)}
                            style={{ color: 'var(--red)' }}
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-xs btn-primary"
                          onClick={() => handleConnect(account.platform)}
                          disabled={connecting === account.platform || (!account.envConfigured && !isReady)}
                        >
                          {connecting === account.platform ? 'Connecting...' : isExpired ? 'Reconnect' : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {connectedAccounts.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">S</div>
                <p>No platform data available.</p>
                <p className="text-sm text-muted mt-2">
                  Configure social platform API credentials in your environment variables to get started.
                </p>
              </div>
            )}
          </div>

          {/* Env Var Reference */}
          <div className="card">
            <div className="card-header">
              <h2>Environment Variables</h2>
            </div>
            <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
              Add these to your .env file to enable each platform.
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 2, color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>Reddit</div>
              <div>REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>Facebook & Instagram</div>
              <div>FB_PAGE_ACCESS_TOKEN (per product page)</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>LinkedIn</div>
              <div>LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>Discord</div>
              <div>DISCORD_BOT_TOKEN</div>
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

      {/* ── Sending Domains Tab ─────────────────────────── */}
      {tab === 'domains' && (
        <>
          {domains.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">@</div>
                <p>No sending domains configured yet.</p>
                <p className="text-sm text-muted mt-2">
                  Add 5 outreach domains via the API or Supabase to enable email infrastructure.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-value">{domains.length}</div>
                  <div className="stat-label">Total Domains</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--green)' }}>
                    {domains.filter(d => d.warmup_status === 'ready' || d.warmup_status === 'completed').length}
                  </div>
                  <div className="stat-label">Ready</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--yellow)' }}>
                    {domains.filter(d => d.warmup_status === 'warming').length}
                  </div>
                  <div className="stat-label">Warming Up</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--red)' }}>
                    {domains.filter(d => d.blacklisted).length}
                  </div>
                  <div className="stat-label">Blacklisted</div>
                </div>
              </div>

              {domains.map((domain) => {
                const repScore = domain.reputation_score || 0;
                const repColor = repScore >= 80 ? 'var(--green)' : repScore >= 50 ? 'var(--yellow)' : 'var(--red)';
                const statusBadge = domain.blacklisted ? 'badge-red'
                  : domain.warmup_status === 'ready' || domain.warmup_status === 'completed' ? 'badge-green'
                  : domain.warmup_status === 'warming' ? 'badge-yellow'
                  : 'badge-muted';

                return (
                  <div key={domain.id} className="card card-compact" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div className="font-semibold">{domain.domain}</div>
                        <div className="text-xs text-muted mt-1">
                          {domain.mailbox_count || 1} mailbox{(domain.mailbox_count || 1) !== 1 ? 'es' : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {domain.blacklisted && <span className="badge badge-red">Blacklisted</span>}
                        <span className={`badge ${statusBadge}`}>{domain.warmup_status || 'pending'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                      <div>
                        <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Reputation</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="domain-bar-track" style={{ flex: 1 }}>
                            <div className="domain-bar-fill" style={{ width: `${repScore}%`, background: repColor }} />
                          </div>
                          <span className="text-sm font-semibold" style={{ color: repColor }}>{repScore}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Daily Volume</div>
                        <div className="text-sm font-medium mt-1">
                          {domain.daily_volume || 0} / {domain.max_daily_volume || 10}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Warmup Started</div>
                        <div className="text-sm mt-1">
                          {domain.warmup_started_at ? new Date(domain.warmup_started_at).toLocaleDateString() : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Last Checked</div>
                        <div className="text-sm mt-1">
                          {domain.last_checked ? new Date(domain.last_checked).toLocaleDateString() : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
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
