'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchQuizCategories,
  fetchQuizUnanswered,
  fetchQuizProfile,
  fetchQuizReask,
  fetchQuizChanges,
  submitQuizAnswer,
} from '../../../lib/api';

// ── Category config ──────────────────────────────────────────
const CATEGORIES = [
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: 'var(--purple)', desc: 'Movies, TV, music, games' },
  { id: 'beliefs', label: 'Beliefs & Values', icon: '⚖️', color: 'var(--accent-hover)', desc: 'Ethics, politics, philosophy' },
  { id: 'personality', label: 'Personality', icon: '🧠', color: 'var(--cyan)', desc: 'Who you are at the core' },
  { id: 'cognitive', label: 'Cognitive', icon: '🧩', color: 'var(--green)', desc: 'Patterns, logic, puzzles' },
  { id: 'values', label: 'Values', icon: '💎', color: '#f59e0b', desc: 'What matters most to you' },
  { id: 'food_travel', label: 'Food & Travel', icon: '🌍', color: 'var(--orange)', desc: 'Tastes and adventures' },
  { id: 'relationships', label: 'Relationships', icon: '💬', color: 'var(--red)', desc: 'Connections and attachment' },
  { id: 'nostalgia', label: 'Nostalgia', icon: '📼', color: 'var(--purple)', desc: 'The past that shaped you' },
  { id: 'hot_takes', label: 'Hot Takes', icon: '🔥', color: 'var(--red)', desc: 'Spicy, divisive opinions' },
];

const CAT_MAP = {};
CATEGORIES.forEach(c => { CAT_MAP[c.id] = c; });

// ── Spectrum options in order ────────────────────────────────
const SPECTRUM_OPTIONS = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
const SPECTRUM_SUPPORT = ['Strongly Oppose', 'Oppose', 'Neutral', 'Support', 'Strongly Support'];

function spectrumColor(idx) {
  const colors = ['var(--red)', 'var(--orange)', 'var(--text-muted)', 'var(--cyan)', 'var(--green)'];
  return colors[idx] || 'var(--text-muted)';
}

export default function QuizPage() {
  const [view, setView] = useState('home'); // home | quiz | profile | reask | changes
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [question, setQuestion] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [profile, setProfile] = useState([]);
  const [reaskQuestions, setReaskQuestions] = useState([]);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [flashClass, setFlashClass] = useState('');
  const [openText, setOpenText] = useState('');
  const [rankOrder, setRankOrder] = useState([]);
  const cardRef = useRef(null);

  // ── Load categories on mount ─────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const [catRes, profileRes] = await Promise.allSettled([
          fetchQuizCategories(),
          fetchQuizProfile(),
        ]);
        if (catRes.status === 'fulfilled') {
          setCategories(catRes.value.categories || []);
          setTotalAnswered(catRes.value.total_answered || 0);
          setTotalQuestions(catRes.value.total_questions || 0);
        }
        if (profileRes.status === 'fulfilled') {
          setProfile(profileRes.value.profile || []);
        }
      } catch {}
      setLoading(false);
    }
    init();
  }, []);

  // ── Load next question ───────────────────────────────────
  const loadNext = useCallback(async (category) => {
    try {
      const res = await fetchQuizUnanswered(category, 1);
      if (res.questions && res.questions.length > 0) {
        setQuestion(res.questions[0]);
        setRemaining(res.remaining);
        setOpenText('');
        setRankOrder([]);
      } else {
        setQuestion(null);
        setRemaining(0);
      }
    } catch {
      setQuestion(null);
    }
  }, []);

  // ── Start a category ─────────────────────────────────────
  function startCategory(catId) {
    setActiveCategory(catId);
    setView('quiz');
    setStreak(0);
    loadNext(catId);
  }

  // ── Start random mix ─────────────────────────────────────
  function startMix() {
    setActiveCategory(null);
    setView('quiz');
    setStreak(0);
    loadNext(null);
  }

  // ── Submit answer ────────────────────────────────────────
  async function handleAnswer(answer) {
    if (answering || !question) return;
    setAnswering(true);
    setFlashClass('quiz-card-exit');

    try {
      await submitQuizAnswer({
        question_text: question.question_text,
        answer: String(answer),
        category: question.category,
        answer_type: question.answer_type,
        options: question.options,
        dimension: question.dimension,
        reask_days: question.reask_days,
      });

      setStreak(s => s + 1);
      setTotalAnswered(t => t + 1);

      // Update category counts locally
      setCategories(prev => prev.map(c =>
        c.id === question.category
          ? { ...c, answered: c.answered + 1, pct: Math.round(((c.answered + 1) / c.total) * 100) }
          : c
      ));

      // Short delay for exit animation, then load next
      setTimeout(async () => {
        setFlashClass('quiz-card-enter');
        await loadNext(activeCategory);
        setAnswering(false);
        setTimeout(() => setFlashClass(''), 400);
      }, 300);
    } catch (err) {
      setAnswering(false);
      setFlashClass('');
    }
  }

  // ── Load re-ask questions ────────────────────────────────
  async function loadReask() {
    setView('reask');
    try {
      const res = await fetchQuizReask();
      setReaskQuestions(res.questions || []);
    } catch { setReaskQuestions([]); }
  }

  // ── Load changes ─────────────────────────────────────────
  async function loadChanges() {
    setView('changes');
    try {
      const res = await fetchQuizChanges();
      setChanges(res.changes || []);
    } catch { setChanges([]); }
  }

  // ── Load profile ─────────────────────────────────────────
  async function loadProfile() {
    setView('profile');
    try {
      const res = await fetchQuizProfile();
      setProfile(res.profile || []);
    } catch {}
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading quiz...</div>;

  // ── Render helpers ───────────────────────────────────────

  function renderAnswerUI(q) {
    if (!q) return null;
    const type = q.answer_type;
    const opts = Array.isArray(q.options) ? q.options : [];

    if (type === 'multiple_choice') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map((opt, i) => (
            <button
              key={i}
              className="quiz-option-btn"
              disabled={answering}
              onClick={() => handleAnswer(opt)}
            >
              <span className="quiz-option-key">{String.fromCharCode(65 + i)}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
      );
    }

    if (type === 'scale') {
      return (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button
              key={n}
              className="quiz-scale-btn"
              disabled={answering}
              onClick={() => handleAnswer(n)}
              style={{
                '--scale-color': n >= 8 ? 'var(--green)' : n >= 5 ? 'var(--accent)' : 'var(--red)',
              }}
            >
              {n}
            </button>
          ))}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span className="text-xs text-muted">Not at all</span>
            <span className="text-xs text-muted">Extremely</span>
          </div>
        </div>
      );
    }

    if (type === 'spectrum') {
      // Detect if question uses Support/Oppose style
      const isSupport = q.question_text?.toLowerCase().includes('support') || q.question_text?.toLowerCase().includes('oppose');
      const labels = isSupport ? SPECTRUM_SUPPORT : SPECTRUM_OPTIONS;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {labels.map((label, i) => (
            <button
              key={label}
              className="quiz-spectrum-btn"
              disabled={answering}
              onClick={() => handleAnswer(label)}
              style={{ '--spectrum-color': spectrumColor(i) }}
            >
              <span className="quiz-spectrum-dot" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      );
    }

    if (type === 'boolean') {
      return (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="quiz-bool-btn quiz-bool-yes" disabled={answering} onClick={() => handleAnswer('Yes')}>
            Yes
          </button>
          <button className="quiz-bool-btn quiz-bool-no" disabled={answering} onClick={() => handleAnswer('No')}>
            No
          </button>
        </div>
      );
    }

    if (type === 'ranking' && opts.length > 0) {
      const items = rankOrder.length > 0 ? rankOrder : opts;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Click items to rank them in order:</div>
          {items.map((opt, i) => {
            const isRanked = rankOrder.includes(opt);
            return (
              <button
                key={opt}
                className={`quiz-option-btn${isRanked ? ' quiz-option-ranked' : ''}`}
                disabled={answering}
                onClick={() => {
                  if (!isRanked) {
                    const newOrder = [...rankOrder, opt];
                    setRankOrder(newOrder);
                    if (newOrder.length === opts.length) {
                      handleAnswer(newOrder.join(' > '));
                    }
                  }
                }}
              >
                <span className="quiz-option-key">{isRanked ? rankOrder.indexOf(opt) + 1 : '—'}</span>
                <span>{opt}</span>
              </button>
            );
          })}
          {rankOrder.length > 0 && rankOrder.length < opts.length && (
            <button className="btn btn-sm" style={{ alignSelf: 'center', marginTop: 4 }} onClick={() => setRankOrder([])}>
              Reset
            </button>
          )}
        </div>
      );
    }

    // open_text fallback
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          className="quiz-textarea"
          placeholder="Type your answer..."
          value={openText}
          onChange={e => setOpenText(e.target.value)}
          rows={3}
        />
        <button
          className="btn"
          disabled={answering || !openText.trim()}
          onClick={() => handleAnswer(openText.trim())}
          style={{ alignSelf: 'flex-end' }}
        >
          Submit
        </button>
      </div>
    );
  }

  const catMeta = activeCategory ? CAT_MAP[activeCategory] : null;

  // ═════════════════════════════════════════════════════════
  // HOME VIEW — Category coverage map + entry points
  // ═════════════════════════════════════════════════════════
  if (view === 'home') {
    const overallPct = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

    return (
      <div className="page-enter">
        <div className="page-header">
          <h1>Profile Quiz</h1>
          <p className="text-secondary">
            {totalAnswered} of {totalQuestions} questions answered — build a deep profile of who you are
          </p>
        </div>

        {/* Overall progress */}
        <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="font-semibold">Overall Progress</span>
            <span className="font-mono text-sm" style={{ color: 'var(--accent)' }}>{overallPct}%</span>
          </div>
          <div className="progress-track" style={{ height: 8 }}>
            <div className="progress-fill" style={{ width: `${overallPct}%`, background: 'var(--accent)', transition: 'width 0.6s var(--ease-out)' }} />
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="btn" onClick={startMix} style={{ background: 'var(--accent)', color: '#000', fontWeight: 600 }}>
            Random Mix
          </button>
          <button className="btn" onClick={loadProfile}>My Profile</button>
          <button className="btn" onClick={loadReask}>Re-ask Queue</button>
          <button className="btn" onClick={loadChanges}>Views Changed</button>
        </div>

        {/* Category grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {CATEGORIES.map(cat => {
            const data = categories.find(c => c.id === cat.id) || { total: 0, answered: 0, pct: 0 };
            return (
              <div
                key={cat.id}
                className="quiz-category-card"
                onClick={() => startCategory(cat.id)}
                style={{ '--cat-color': cat.color }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>{cat.icon}</span>
                  <div>
                    <div className="font-semibold text-sm">{cat.label}</div>
                    <div className="text-xs text-muted">{cat.desc}</div>
                  </div>
                </div>
                <div className="progress-track" style={{ height: 4, marginBottom: 6 }}>
                  <div className="progress-fill" style={{ width: `${data.pct}%`, background: cat.color, transition: 'width 0.6s var(--ease-out)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-xs text-muted">{data.answered}/{data.total} answered</span>
                  <span className="font-mono text-xs" style={{ color: cat.color }}>{data.pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════
  // QUIZ VIEW — Full-screen one-at-a-time cards
  // ═════════════════════════════════════════════════════════
  if (view === 'quiz') {
    if (!question) {
      return (
        <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ marginBottom: 8 }}>
            {activeCategory ? `All ${CAT_MAP[activeCategory]?.label || activeCategory} questions answered!` : 'All questions answered!'}
          </h2>
          <p className="text-secondary" style={{ marginBottom: 20 }}>
            {streak > 0 && `${streak} question streak! `}Come back later for new questions or try another category.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setView('home')}>Back to Categories</button>
            <button className="btn" onClick={loadProfile} style={{ background: 'var(--accent)', color: '#000' }}>View Profile</button>
          </div>
        </div>
      );
    }

    return (
      <div className="quiz-fullscreen">
        {/* Top bar */}
        <div className="quiz-top-bar">
          <button className="btn btn-sm" onClick={() => setView('home')} style={{ opacity: 0.7 }}>
            ← Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {catMeta && (
              <span className="badge" style={{ background: `${catMeta.color}20`, color: catMeta.color, border: `1px solid ${catMeta.color}40` }}>
                {catMeta.icon} {catMeta.label}
              </span>
            )}
            {streak > 0 && (
              <span className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
                🔥 {streak}
              </span>
            )}
            <span className="text-xs text-muted">{remaining} left</span>
          </div>
          <button className="btn btn-sm" onClick={() => loadNext(activeCategory)} style={{ opacity: 0.7 }}>
            Skip →
          </button>
        </div>

        {/* Question card */}
        <div className={`quiz-card ${flashClass}`} ref={cardRef}>
          {/* Category accent stripe */}
          <div className="quiz-card-stripe" style={{ background: catMeta?.color || 'var(--accent)' }} />

          <div className="quiz-card-content">
            {/* Question type badge */}
            <div style={{ marginBottom: 16 }}>
              <span className="badge badge-sm" style={{ opacity: 0.6 }}>
                {question.answer_type === 'multiple_choice' && 'Choose one'}
                {question.answer_type === 'scale' && 'Rate 1–10'}
                {question.answer_type === 'spectrum' && 'Agree / Disagree'}
                {question.answer_type === 'boolean' && 'Yes or No'}
                {question.answer_type === 'ranking' && 'Rank in order'}
                {question.answer_type === 'open_text' && 'Free response'}
              </span>
            </div>

            {/* Question text */}
            <h2 className="quiz-question-text">{question.question_text}</h2>

            {/* Answer UI */}
            <div className="quiz-answer-area">
              {renderAnswerUI(question)}
            </div>

            {/* Dimension hint */}
            {question.dimension && (
              <div className="text-xs text-muted" style={{ textAlign: 'center', marginTop: 16, opacity: 0.5 }}>
                Measures: {question.dimension.replace(/_/g, ' ')}
              </div>
            )}
          </div>
        </div>

        {/* Progress dots */}
        <div className="quiz-progress-dots">
          {[...Array(Math.min(remaining + streak, 20))].map((_, i) => (
            <div
              key={i}
              className="quiz-dot"
              style={{
                background: i < streak ? 'var(--accent)' : 'var(--border)',
                width: i < streak ? 8 : 6,
                height: i < streak ? 8 : 6,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════
  // PROFILE VIEW — Computed personality dimensions
  // ═════════════════════════════════════════════════════════
  if (view === 'profile') {
    const metaDims = profile.filter(p => p.category === 'meta');
    const personalityDims = profile.filter(p => p.category !== 'meta');

    // Group by category
    const grouped = {};
    personalityDims.forEach(p => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });

    return (
      <div className="page-enter">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-sm" onClick={() => setView('home')}>← Back</button>
            <h1>My Profile</h1>
          </div>
          <p className="text-secondary">Computed from {totalAnswered} answers across {categories.length} categories</p>
        </div>

        {profile.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <h3>No profile data yet</h3>
            <p className="text-secondary" style={{ marginBottom: 16 }}>Answer scale, spectrum, and boolean questions to build your personality profile.</p>
            <button className="btn" onClick={startMix} style={{ background: 'var(--accent)', color: '#000' }}>Start Answering</button>
          </div>
        ) : (
          <>
            {/* Meta dimensions — big cards */}
            {metaDims.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  Meta Dimensions
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {metaDims.map(dim => (
                    <div key={dim.dimension} className="quiz-profile-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div className="font-semibold" style={{ textTransform: 'capitalize' }}>
                          {dim.dimension.replace(/_/g, ' ')}
                        </div>
                        <span className="font-mono" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 700 }}>
                          {dim.score?.toFixed(1)}
                        </span>
                      </div>
                      <div className="progress-track" style={{ height: 6, marginBottom: 8 }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(dim.score / 10) * 100}%`,
                            background: `linear-gradient(90deg, var(--accent-dim), var(--accent))`,
                            transition: 'width 0.8s var(--ease-out)',
                          }}
                        />
                      </div>
                      <div className="text-sm text-secondary">{dim.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category dimensions */}
            {Object.entries(grouped).map(([category, dims]) => {
              const catInfo = CAT_MAP[category];
              return (
                <div key={category} style={{ marginBottom: 24 }}>
                  <h3 style={{ marginBottom: 12, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    {catInfo?.icon} {catInfo?.label || category}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    {dims.map(dim => (
                      <div key={dim.dimension} className="quiz-profile-card" style={{ '--cat-color': catInfo?.color || 'var(--accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span className="text-sm font-semibold" style={{ textTransform: 'capitalize' }}>
                            {dim.dimension.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono text-sm" style={{ color: catInfo?.color || 'var(--accent)' }}>
                            {dim.score?.toFixed(1)}
                          </span>
                        </div>
                        <div className="progress-track" style={{ height: 4, marginBottom: 6 }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${(dim.score / 10) * 100}%`,
                              background: catInfo?.color || 'var(--accent)',
                              transition: 'width 0.8s var(--ease-out)',
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted">{dim.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════
  // RE-ASK VIEW — Questions due for re-evaluation
  // ═════════════════════════════════════════════════════════
  if (view === 'reask') {
    return (
      <div className="page-enter">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-sm" onClick={() => setView('home')}>← Back</button>
            <h1>Re-ask Queue</h1>
          </div>
          <p className="text-secondary">Belief and value questions due for re-evaluation — have your views changed?</p>
        </div>

        {reaskQuestions.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3>No questions due for re-asking</h3>
            <p className="text-secondary">Belief and value questions are re-asked after 90–180 days.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reaskQuestions.map((q, i) => {
              const catInfo = CAT_MAP[q.category];
              return (
                <div key={i} className="card" style={{ borderLeft: `3px solid ${catInfo?.color || 'var(--accent)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="badge badge-sm" style={{ background: `${catInfo?.color || 'var(--accent)'}20`, color: catInfo?.color }}>
                      {catInfo?.label || q.category}
                    </span>
                    <span className="text-xs text-muted">{q.days_since}d ago</span>
                  </div>
                  <div className="font-semibold" style={{ marginBottom: 8 }}>{q.question_text}</div>
                  <div className="text-sm text-secondary" style={{ marginBottom: 12 }}>
                    Previous answer: <span style={{ color: 'var(--accent)' }}>{q.previous_answer}</span>
                  </div>
                  {renderAnswerUI(q)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════
  // CHANGES VIEW — How views evolved over time
  // ═════════════════════════════════════════════════════════
  if (view === 'changes') {
    return (
      <div className="page-enter">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-sm" onClick={() => setView('home')}>← Back</button>
            <h1>Views Changed</h1>
          </div>
          <p className="text-secondary">Questions where your answer changed on re-ask — tracked evolution of beliefs</p>
        </div>

        {changes.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔄</div>
            <h3>No changes tracked yet</h3>
            <p className="text-secondary">When you re-answer belief questions differently, the changes appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {changes.map((c, i) => {
              const catInfo = CAT_MAP[c.quiz_questions?.category];
              return (
                <div key={i} className="card">
                  <div style={{ marginBottom: 8 }}>
                    <span className="badge badge-sm" style={{ background: `${catInfo?.color || 'var(--accent)'}20`, color: catInfo?.color }}>
                      {catInfo?.label || c.quiz_questions?.category}
                    </span>
                  </div>
                  <div className="font-semibold" style={{ marginBottom: 12 }}>{c.quiz_questions?.question_text}</div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div className="text-xs text-muted">Before</div>
                      <div className="text-sm" style={{ color: 'var(--red)', marginTop: 2 }}>{c.previous_answer}</div>
                      {c.previous_answered_at && (
                        <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                          {new Date(c.previous_answered_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 20 }}>→</div>
                    <div style={{ flex: 1 }}>
                      <div className="text-xs text-muted">After</div>
                      <div className="text-sm" style={{ color: 'var(--green)', marginTop: 2 }}>{c.answer}</div>
                      <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                        {new Date(c.answered_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}
