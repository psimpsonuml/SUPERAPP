'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchProducedPodcasts,
  fetchPodcastSeries,
  fetchProducedEpisode,
  createProducedEpisode,
  updateProducedEpisode,
  deleteProducedEpisode,
  generatePodcastScript,
  generatePodcastAudio,
  producePodcastEpisode,
  approvePodcastEpisode,
  publishPodcastEpisode,
  fetchNextEpisodeNumber,
  fetchPodcastTopics,
  fetchPodcastProducerStats
} from '../../../lib/api';

// ── Series Config ────────────────────────────────────────────────────────────

const SERIES_CONFIG = {
  what_if: { name: 'What If?', product: 'ChronoStates', color: '#8b5cf6', description: 'Weekly alternate history deep dives', voice: 'dramatic_narrator', duration: '10-15 min' },
  compliance_corner: { name: 'Compliance Corner', product: 'Payroll Beacon', color: '#3b82f6', description: 'Weekly payroll compliance updates', voice: 'professional', duration: '5-10 min' },
  money_clarity: { name: 'Money Clarity', product: 'Budgeting Beacon', color: '#10b981', description: 'Weekly personal finance tips', voice: 'warm_encouraging', duration: '5-10 min' }
};

const STATUS_PIPELINE = ['draft', 'scripted', 'recorded', 'produced', 'approved', 'published'];

const STATUS_COLORS = {
  draft: '#6b7280',
  scripted: '#f59e0b',
  recorded: '#3b82f6',
  produced: '#8b5cf6',
  approved: '#10b981',
  published: '#22d3ee'
};

// ── Styles ───────────────────────────────────────────────────────────────────

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
    color: '#8b5cf6',
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
    backgroundColor: '#8b5cf6',
    color: '#fff',
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
    color: '#8b5cf6',
    border: '1px solid #8b5cf6',
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
    fontWeight: '600'
  },
  btnDanger: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid #2a2a4a'
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    backgroundColor: '#16213e',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2a2a4a',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    margin: '0 0 4px 0'
  },
  statLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: 0
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    backgroundColor: '#0f0f23',
    borderRadius: '10px',
    padding: '4px'
  },
  tab: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    backgroundColor: 'transparent',
    color: '#9ca3af'
  },
  tabActive: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    borderBottom: '1px solid #2a2a4a',
    color: '#9ca3af',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid #1e1e3a',
    fontSize: '14px',
    verticalAlign: 'middle'
  },
  tr: {
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  input: {
    backgroundColor: '#0f0f23',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e0e0e0',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box'
  },
  select: {
    backgroundColor: '#0f0f23',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e0e0e0',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box'
  },
  textarea: {
    backgroundColor: '#0f0f23',
    border: '1px solid #2a2a4a',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e0e0e0',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '120px',
    resize: 'vertical',
    fontFamily: 'inherit'
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
    padding: '32px',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '85vh',
    overflowY: 'auto',
    border: '1px solid #2a2a4a'
  },
  pipeline: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px'
  },
  pipelineStep: {
    flex: 1,
    textAlign: 'center',
    padding: '8px 4px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    position: 'relative'
  },
  pipelineArrow: {
    color: '#4a4a6a',
    fontSize: '16px',
    flexShrink: 0
  },
  topicCard: {
    backgroundColor: '#0f0f23',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '8px',
    cursor: 'pointer',
    border: '1px solid #2a2a4a',
    transition: 'border-color 0.2s'
  },
  scriptViewer: {
    backgroundColor: '#0f0f23',
    borderRadius: '8px',
    padding: '20px',
    fontFamily: '"Courier New", monospace',
    fontSize: '13px',
    lineHeight: '1.7',
    whiteSpace: 'pre-wrap',
    maxHeight: '400px',
    overflowY: 'auto',
    border: '1px solid #2a2a4a'
  },
  audioPlayer: {
    backgroundColor: '#0f0f23',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #2a2a4a',
    textAlign: 'center',
    color: '#9ca3af'
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
  flexRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#e0e0e0',
    margin: '0 0 16px 0'
  }
};

// ── Helper Functions ─────────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#6b7280';
  return (
    <span style={{ ...styles.badge, backgroundColor: color + '22', color }}>
      {status}
    </span>
  );
}

function SeriesBadge({ seriesName }) {
  const config = SERIES_CONFIG[seriesName];
  if (!config) return null;
  return (
    <span style={{ ...styles.badge, backgroundColor: config.color + '22', color: config.color }}>
      {config.name}
    </span>
  );
}

// ── Pipeline Visualization ───────────────────────────────────────────────────

function PipelineVisualization({ currentStatus }) {
  const currentIdx = STATUS_PIPELINE.indexOf(currentStatus);
  return (
    <div style={styles.pipeline}>
      {STATUS_PIPELINE.map((step, idx) => {
        let bg, color;
        if (idx < currentIdx) {
          bg = '#10b981'; color = '#fff';
        } else if (idx === currentIdx) {
          bg = STATUS_COLORS[step]; color = '#fff';
        } else {
          bg = '#2a2a4a'; color = '#6b7280';
        }
        return (
          <React.Fragment key={step}>
            {idx > 0 && <span style={styles.pipelineArrow}>{idx <= currentIdx ? '\u2714' : '\u2192'}</span>}
            <div style={{ ...styles.pipelineStep, backgroundColor: bg, color }}>
              {step}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Stats Cards ──────────────────────────────────────────────────────────────

function StatsCards({ stats }) {
  if (!stats) return null;
  const bySeries = stats.by_series || {};
  return (
    <div style={styles.grid4}>
      {Object.entries(SERIES_CONFIG).map(([key, conf]) => (
        <div key={key} style={{ ...styles.statCard, borderTop: `3px solid ${conf.color}` }}>
          <p style={{ ...styles.statValue, color: conf.color }}>{bySeries[key] || 0}</p>
          <p style={styles.statLabel}>{conf.name} Episodes</p>
        </div>
      ))}
      <div style={{ ...styles.statCard, borderTop: '3px solid #22d3ee' }}>
        <p style={{ ...styles.statValue, color: '#22d3ee' }}>{stats.published_count || 0}</p>
        <p style={styles.statLabel}>Published</p>
      </div>
    </div>
  );
}

// ── Topic Suggestion Panel ───────────────────────────────────────────────────

function TopicPanel({ topics, seriesFilter, onSelectTopic }) {
  const allTopics = topics || {};
  const seriesToShow = seriesFilter && seriesFilter !== 'all' ? [seriesFilter] : Object.keys(SERIES_CONFIG);

  return (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>AI-Suggested Topics</h3>
      {seriesToShow.map((series) => {
        const conf = SERIES_CONFIG[series];
        const seriesTopics = allTopics[series] || [];
        if (seriesTopics.length === 0) return null;
        return (
          <div key={series} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: conf?.color || '#e0e0e0', marginBottom: '8px' }}>
              {conf?.name || series}
            </div>
            {seriesTopics.map((t, idx) => (
              <div
                key={idx}
                style={styles.topicCard}
                onClick={() => onSelectTopic(series, t.topic)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = conf?.color || '#8b5cf6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a4a'; }}
              >
                <div style={{ fontSize: '13px', color: '#e0e0e0' }}>{t.topic}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{t.category}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Episode Detail Modal ─────────────────────────────────────────────────────

function EpisodeDetailModal({ episode, onClose, onAction, loading }) {
  if (!episode) return null;

  const seriesConf = SERIES_CONFIG[episode.series_name] || {};
  const canGenerateScript = episode.status === 'draft';
  const canGenerateAudio = episode.status === 'scripted';
  const canProduce = episode.status === 'recorded';
  const canApprove = episode.status === 'produced';
  const canPublish = episode.status === 'approved';

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <SeriesBadge seriesName={episode.series_name} />
              <StatusBadge status={episode.status} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0', color: '#e0e0e0' }}>
              Ep. {episode.episode_number}: {episode.title}
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              {seriesConf.product} &middot; {formatDate(episode.created_at)} &middot; {formatDuration(episode.duration_seconds)}
            </p>
          </div>
          <button style={{ ...styles.btnSmall, backgroundColor: '#2a2a4a', color: '#9ca3af' }} onClick={onClose}>
            Close
          </button>
        </div>

        <PipelineVisualization currentStatus={episode.status} />

        {/* Action Buttons */}
        <div style={{ ...styles.flexRow, marginBottom: '20px', flexWrap: 'wrap' }}>
          {canGenerateScript && (
            <button
              style={{ ...styles.btnSmall, backgroundColor: '#f59e0b', color: '#1a1a2e' }}
              onClick={() => onAction('generate-script', episode.id)}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Script'}
            </button>
          )}
          {canGenerateAudio && (
            <button
              style={{ ...styles.btnSmall, backgroundColor: '#3b82f6', color: '#fff' }}
              onClick={() => onAction('generate-audio', episode.id)}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Audio'}
            </button>
          )}
          {canProduce && (
            <button
              style={{ ...styles.btnSmall, backgroundColor: '#8b5cf6', color: '#fff' }}
              onClick={() => onAction('produce', episode.id)}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Post-Produce'}
            </button>
          )}
          {canApprove && (
            <button
              style={{ ...styles.btnSmall, backgroundColor: '#10b981', color: '#fff' }}
              onClick={() => onAction('approve', episode.id)}
              disabled={loading}
            >
              {loading ? 'Approving...' : 'Approve'}
            </button>
          )}
          {canPublish && (
            <button
              style={{ ...styles.btnSmall, backgroundColor: '#22d3ee', color: '#1a1a2e' }}
              onClick={() => onAction('publish', episode.id)}
              disabled={loading}
            >
              {loading ? 'Publishing...' : 'Publish'}
            </button>
          )}
          <button style={styles.btnDanger} onClick={() => onAction('delete', episode.id)} disabled={loading}>
            Delete
          </button>
        </div>

        {/* Script Viewer */}
        {episode.script && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Script
            </h3>
            <div style={styles.scriptViewer}>{episode.script}</div>
          </div>
        )}

        {/* Audio Player Placeholder */}
        {episode.audio_url && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Audio
            </h3>
            <div style={styles.audioPlayer}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>&#9654;</div>
              <div style={{ fontSize: '13px' }}>Audio Player Placeholder</div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: '#4a4a6a' }}>{episode.audio_url}</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#6b7280' }}>Duration: {formatDuration(episode.duration_seconds)}</div>
            </div>
          </div>
        )}

        {/* Show Notes */}
        {episode.show_notes && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Show Notes
            </h3>
            <div style={{ ...styles.scriptViewer, fontFamily: 'inherit', fontSize: '14px' }}>{episode.show_notes}</div>
          </div>
        )}

        {/* Metadata */}
        {episode.metadata_json && Object.keys(episode.metadata_json).length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Metadata
            </h3>
            <div style={{ ...styles.scriptViewer, fontSize: '12px' }}>
              {JSON.stringify(episode.metadata_json, null, 2)}
            </div>
          </div>
        )}

        {/* Cover Art Prompt */}
        {episode.cover_art_prompt && (
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Cover Art Prompt
            </h3>
            <div style={{ backgroundColor: '#0f0f23', borderRadius: '8px', padding: '12px 16px', border: '1px solid #2a2a4a', fontSize: '13px', color: '#e0e0e0', fontStyle: 'italic' }}>
              {episode.cover_art_prompt}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Episode Modal ─────────────────────────────────────────────────────

function CreateEpisodeModal({ onClose, onCreate, defaultSeries, defaultTopic }) {
  const [seriesName, setSeriesName] = useState(defaultSeries || 'what_if');
  const [title, setTitle] = useState(defaultTopic || '');
  const [topic, setTopic] = useState(defaultTopic || '');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await onCreate({ series_name: seriesName, title: title.trim(), topic: topic.trim() || title.trim() });
      onClose();
    } catch (err) {
      console.error('Create episode error:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={{ ...styles.modalContent, maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 20px 0', color: '#e0e0e0' }}>
          Create New Episode
        </h2>

        <div style={styles.formGroup}>
          <label style={styles.label}>Series</label>
          <select style={styles.select} value={seriesName} onChange={(e) => setSeriesName(e.target.value)}>
            {Object.entries(SERIES_CONFIG).map(([key, conf]) => (
              <option key={key} value={key}>{conf.name} ({conf.product})</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Episode Title</label>
          <input
            style={styles.input}
            placeholder="Enter episode title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Topic / Description</label>
          <textarea
            style={styles.textarea}
            placeholder="Enter topic or description for script generation..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={styles.btnPrimary} onClick={handleCreate} disabled={creating || !title.trim()}>
            {creating ? 'Creating...' : 'Create Episode'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function PodcastProducerPage() {
  const [episodes, setEpisodes] = useState([]);
  const [stats, setStats] = useState(null);
  const [topics, setTopics] = useState({});
  const [activeSeries, setActiveSeries] = useState('all');
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDefaults, setCreateDefaults] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Load Data ────────────────────────────────────────────────────────────

  const loadEpisodes = useCallback(async () => {
    try {
      setLoading(true);
      const filters = {};
      if (activeSeries !== 'all') filters.series = activeSeries;
      const result = await fetchProducedPodcasts(filters);
      setEpisodes(result.episodes || []);
    } catch (err) {
      console.error('Load episodes error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeSeries]);

  const loadStats = useCallback(async () => {
    try {
      const result = await fetchPodcastProducerStats();
      setStats(result);
    } catch (err) {
      console.error('Load stats error:', err);
    }
  }, []);

  const loadTopics = useCallback(async () => {
    try {
      const result = await fetchPodcastTopics();
      setTopics(result.topics || {});
    } catch (err) {
      console.error('Load topics error:', err);
    }
  }, []);

  useEffect(() => {
    loadEpisodes();
  }, [loadEpisodes]);

  useEffect(() => {
    loadStats();
    loadTopics();
  }, [loadStats, loadTopics]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCreateEpisode = async (data) => {
    await createProducedEpisode(data);
    loadEpisodes();
    loadStats();
  };

  const handleEpisodeAction = async (action, episodeId) => {
    setActionLoading(true);
    try {
      if (action === 'delete') {
        await deleteProducedEpisode(episodeId);
        setSelectedEpisode(null);
      } else if (action === 'generate-script') {
        const result = await generatePodcastScript(episodeId);
        setSelectedEpisode(result.episode);
      } else if (action === 'generate-audio') {
        const result = await generatePodcastAudio(episodeId);
        setSelectedEpisode(result.episode);
      } else if (action === 'produce') {
        const result = await producePodcastEpisode(episodeId);
        setSelectedEpisode(result.episode);
      } else if (action === 'approve') {
        const result = await approvePodcastEpisode(episodeId);
        setSelectedEpisode(result.episode);
      } else if (action === 'publish') {
        const result = await publishPodcastEpisode(episodeId);
        setSelectedEpisode(result.episode);
      }
      loadEpisodes();
      loadStats();
    } catch (err) {
      console.error('Episode action error:', err);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectTopic = (series, topic) => {
    setCreateDefaults({ series, topic });
    setShowCreate(true);
  };

  const handleGenerateWeekly = async (seriesName) => {
    const conf = SERIES_CONFIG[seriesName];
    const seriesTopics = topics[seriesName] || [];
    const randomTopic = seriesTopics.length > 0
      ? seriesTopics[Math.floor(Math.random() * seriesTopics.length)].topic
      : `${conf.name} Weekly Episode`;

    try {
      setActionLoading(true);
      await createProducedEpisode({
        series_name: seriesName,
        title: randomTopic,
        topic: randomTopic
      });
      loadEpisodes();
      loadStats();
    } catch (err) {
      console.error('Generate weekly error:', err);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEpisodeClick = async (episode) => {
    try {
      const result = await fetchProducedEpisode(episode.id);
      setSelectedEpisode(result.episode);
    } catch (err) {
      setSelectedEpisode(episode);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const seriesTabs = [
    { key: 'all', label: 'All' },
    ...Object.entries(SERIES_CONFIG).map(([key, conf]) => ({ key, label: conf.name }))
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>AI Podcast Producer</h1>
          <p style={styles.subtitle}>Automated podcast production pipeline for BeaconOps</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnPrimary} onClick={() => { setCreateDefaults({}); setShowCreate(true); }}>
            + New Episode
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ backgroundColor: '#ef444422', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#ef4444', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button style={{ ...styles.btnSmall, backgroundColor: 'transparent', color: '#ef4444', border: 'none' }} onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Total Duration Card */}
      {stats && (
        <div style={{ ...styles.grid3, marginBottom: '24px' }}>
          <div style={styles.statCard}>
            <p style={{ ...styles.statValue, color: '#f59e0b' }}>{stats.total || 0}</p>
            <p style={styles.statLabel}>Total Episodes</p>
          </div>
          <div style={styles.statCard}>
            <p style={{ ...styles.statValue, color: '#22d3ee' }}>{stats.total_duration_hours || 0}h</p>
            <p style={styles.statLabel}>Total Duration</p>
          </div>
          <div style={styles.statCard}>
            <p style={{ ...styles.statValue, color: '#10b981' }}>{stats.by_status?.draft || 0}</p>
            <p style={styles.statLabel}>In Pipeline</p>
          </div>
        </div>
      )}

      {/* Generate Weekly Buttons */}
      <div style={{ ...styles.card, marginBottom: '24px' }}>
        <h3 style={{ ...styles.sectionTitle, marginBottom: '12px' }}>Quick Generate</h3>
        <div style={styles.flexRow}>
          {Object.entries(SERIES_CONFIG).map(([key, conf]) => (
            <button
              key={key}
              style={{ ...styles.btnSmall, backgroundColor: conf.color, color: '#fff', padding: '8px 16px', fontSize: '13px' }}
              onClick={() => handleGenerateWeekly(key)}
              disabled={actionLoading}
            >
              Generate This Week&apos;s {conf.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        {/* Left: Episodes */}
        <div>
          {/* Series Tabs */}
          <div style={styles.tabs}>
            {seriesTabs.map((tab) => {
              const isActive = activeSeries === tab.key;
              const seriesColor = SERIES_CONFIG[tab.key]?.color || '#8b5cf6';
              return (
                <button
                  key={tab.key}
                  style={isActive ? { ...styles.tabActive, backgroundColor: seriesColor } : styles.tab}
                  onClick={() => setActiveSeries(tab.key)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Episodes Table */}
          <div style={styles.card}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading episodes...</div>
            ) : episodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                <div style={{ fontSize: '18px', marginBottom: '8px' }}>No episodes yet</div>
                <div style={{ fontSize: '13px' }}>Create your first episode or use Quick Generate above.</div>
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Title</th>
                    <th style={styles.th}>Series</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Duration</th>
                    <th style={styles.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {episodes.map((ep) => (
                    <tr
                      key={ep.id}
                      style={styles.tr}
                      onClick={() => handleEpisodeClick(ep)}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1e1e3a'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={styles.td}>{ep.episode_number}</td>
                      <td style={{ ...styles.td, fontWeight: '600', color: '#e0e0e0', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ep.title}
                      </td>
                      <td style={styles.td}><SeriesBadge seriesName={ep.series_name} /></td>
                      <td style={styles.td}><StatusBadge status={ep.status} /></td>
                      <td style={{ ...styles.td, color: '#9ca3af' }}>{formatDuration(ep.duration_seconds)}</td>
                      <td style={{ ...styles.td, color: '#9ca3af', fontSize: '13px' }}>{formatDate(ep.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Topics Panel */}
        <div>
          <TopicPanel
            topics={topics}
            seriesFilter={activeSeries}
            onSelectTopic={handleSelectTopic}
          />
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateEpisodeModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateEpisode}
          defaultSeries={createDefaults.series}
          defaultTopic={createDefaults.topic}
        />
      )}

      {selectedEpisode && (
        <EpisodeDetailModal
          episode={selectedEpisode}
          onClose={() => setSelectedEpisode(null)}
          onAction={handleEpisodeAction}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
