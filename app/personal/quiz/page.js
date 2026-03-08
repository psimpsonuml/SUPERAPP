'use client';

import { useState, useEffect } from 'react';
import { fetchQuizQuestions, fetchQuizAnswers, fetchQuizProfile, submitQuizAnswer } from '../../../lib/api';

const CATEGORIES = [
  { id: 'entertainment', label: 'Entertainment', color: 'var(--purple)' },
  { id: 'beliefs', label: 'Beliefs & Values', color: 'var(--accent-hover)' },
  { id: 'personality', label: 'Personality', color: 'var(--cyan)' },
  { id: 'cognitive', label: 'Cognitive', color: 'var(--green)' },
  { id: 'values', label: 'Values', color: 'var(--yellow)' },
  { id: 'food_travel', label: 'Food & Travel', color: 'var(--orange)' },
  { id: 'relationships', label: 'Relationships', color: 'var(--red)' },
  { id: 'nostalgia', label: 'Nostalgia', color: 'var(--purple)' },
  { id: 'hot_takes', label: 'Hot Takes', color: 'var(--red)' },
];

export default function QuizPage() {
  const [tab, setTab] = useState('quiz');
  const [answers, setAnswers] = useState([]);
  const [profile, setProfile] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([fetchQuizAnswers(), fetchQuizProfile()]);
      if (results[0].status === 'fulfilled') setAnswers(results[0].value.answers || []);
      if (results[1].status === 'fulfilled') setProfile(results[1].value.profile || []);
      setLoading(false);
    }
    load();
  }, []);

  async function loadQuestions(category) {
    setSelectedCategory(category);
    try {
      const { questions: q } = await fetchQuizQuestions(category);
      setQuestions(q || []);
    } catch { setQuestions([]); }
  }

  async function handleAnswer(questionId, answer) {
    try {
      await submitQuizAnswer({ question_id: questionId, answer });
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      const { answers: a } = await fetchQuizAnswers();
      setAnswers(a || []);
    } catch (err) { alert(err.message); }
  }

  if (loading) return <div className="loading"><div className="spinner" />Loading...</div>;

  const answeredByCategory = {};
  answers.forEach((a) => {
    const cat = a.quiz_questions?.category || 'unknown';
    answeredByCategory[cat] = (answeredByCategory[cat] || 0) + 1;
  });

  return (
    <>
      <div className="page-header">
        <h1>Personal Profile Quiz</h1>
        <p>Build a deep profile across entertainment, beliefs, personality, and more. {answers.length} answers recorded.</p>
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'quiz' ? ' tab-active' : ''}`} onClick={() => setTab('quiz')}>Take Quiz</button>
        <button className={`tab${tab === 'profile' ? ' tab-active' : ''}`} onClick={() => setTab('profile')}>My Profile</button>
        <button className={`tab${tab === 'history' ? ' tab-active' : ''}`} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'quiz' && (
        <>
          {/* Category selector */}
          {questions.length === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className="card card-compact"
                  style={{ cursor: 'pointer', borderLeft: `3px solid ${cat.color}` }}
                  onClick={() => loadQuestions(cat.id)}
                >
                  <div className="font-semibold text-sm">{cat.label}</div>
                  <div className="text-xs text-muted mt-1">
                    {answeredByCategory[cat.id] || 0} answered
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Questions */}
          {questions.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className="text-sm text-muted">{questions.length} question{questions.length !== 1 ? 's' : ''} in {selectedCategory.replace(/_/g, ' ')}</span>
                <button className="btn btn-sm" onClick={() => setQuestions([])}>Back to categories</button>
              </div>
              {questions.map((q) => (
                <div key={q.id} className="card" style={{ marginBottom: 10 }}>
                  <div className="font-semibold" style={{ marginBottom: 12 }}>{q.question_text}</div>
                  {q.options && Array.isArray(q.options) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {q.options.map((opt, i) => (
                        <button key={i} className="btn btn-sm" onClick={() => handleAnswer(q.id, opt)} style={{ justifyContent: 'flex-start' }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                        <button key={n} className="btn btn-xs" onClick={() => handleAnswer(q.id, String(n))} style={{ minWidth: 32 }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === 'profile' && (
        profile.length === 0 ? (
          <div className="empty-state">
            <p>No profile computed yet.</p>
            <p className="text-xs text-muted mt-2">Answer more questions to build your personal profile across all dimensions.</p>
          </div>
        ) : (
          <div className="grid-2">
            {profile.map((dim, i) => (
              <div key={dim.id || i} className="card card-compact">
                <div className="font-semibold text-sm">{dim.dimension}</div>
                <div className="text-xs text-muted mt-1">{dim.category}</div>
                <div className="progress-track mt-2">
                  <div className="progress-fill" style={{ width: `${(dim.score / 10) * 100}%`, background: 'var(--accent)' }} />
                </div>
                <div className="text-sm mt-1">{dim.description || `Score: ${dim.score?.toFixed(1)}`}</div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'history' && (
        <div className="card card-compact">
          {answers.length === 0 ? (
            <div className="empty-state">No answers yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Question</th><th>Category</th><th>Answer</th><th>Date</th></tr></thead>
                <tbody>
                  {answers.slice(0, 50).map((a, i) => (
                    <tr key={a.id || i}>
                      <td className="text-sm">{a.quiz_questions?.question_text || '—'}</td>
                      <td><span className="badge badge-purple">{a.quiz_questions?.category || '—'}</span></td>
                      <td className="text-sm font-medium">{a.answer}</td>
                      <td className="text-xs text-muted">{a.answered_at ? new Date(a.answered_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
