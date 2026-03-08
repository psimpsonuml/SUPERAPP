'use client';

import { useState, useEffect } from 'react';
import { fetchSlider, updateSlider, updateReducedOps, fetchSettings } from '../../lib/api';

function getSliderLabel(pos) {
  if (pos <= 25) return 'Maximum oversight';
  if (pos <= 50) return 'Cautious';
  if (pos <= 75) return 'Balanced';
  return 'Aggressive';
}

function getSliderColor(pos) {
  if (pos <= 25) return 'var(--green)';
  if (pos <= 50) return 'var(--yellow)';
  if (pos <= 75) return 'var(--orange)';
  return 'var(--red)';
}

export default function SettingsPage() {
  const [sliderPos, setSliderPos] = useState(60);
  const [savedPos, setSavedPos] = useState(60);
  const [reducedOps, setReducedOps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [slider, settings] = await Promise.all([
          fetchSlider(),
          fetchSettings().catch(() => null),
        ]);
        const pos = slider.sliderPosition ?? 60;
        setSliderPos(pos);
        setSavedPos(pos);
        if (settings?.reduced_ops != null) setReducedOps(settings.reduced_ops);
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

  if (loading) return <div className="loading">Loading settings...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const label = getSliderLabel(sliderPos);
  const changed = sliderPos !== savedPos;

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure automation levels and operational preferences</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Automation Level</h2>
          {changed && (
            <button className="btn btn-primary" onClick={handleSliderSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
          Control how much autonomy the agents have. Lower values require more manual approvals.
          Higher values allow agents to act independently.
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
          <div className="label">{label}</div>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          <strong>What this means:</strong>
          <ul style={{ marginTop: 8, paddingLeft: 20, color: 'var(--text-muted)' }}>
            {sliderPos <= 25 && (
              <>
                <li>All content requires manual approval before publishing</li>
                <li>Agents suggest but never execute actions</li>
                <li>Maximum control over all outputs</li>
              </>
            )}
            {sliderPos > 25 && sliderPos <= 50 && (
              <>
                <li>Low-risk content (Tier 3) may auto-publish</li>
                <li>Medium and high-risk items require approval</li>
                <li>Good balance for getting started</li>
              </>
            )}
            {sliderPos > 50 && sliderPos <= 75 && (
              <>
                <li>Tier 2 and 3 content auto-publishes</li>
                <li>Only high-impact items (Tier 1) need approval</li>
                <li>Agents operate with moderate independence</li>
              </>
            )}
            {sliderPos > 75 && (
              <>
                <li>Most content auto-publishes without review</li>
                <li>Only critical financial or legal items flagged</li>
                <li>Maximum throughput, minimum oversight</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Operational Preferences</h2>
        </div>

        <div className="toggle-row">
          <div className="toggle-info">
            <h3>Reduced Operations Mode</h3>
            <p>Limit agent activity to essential tasks only. Useful for holidays or maintenance.</p>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={reducedOps}
              onChange={(e) => handleReducedOps(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>
    </>
  );
}
