'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { QUESTIONS, type Personality } from '@/lib/questions';
import { PERSONALITIES } from '@/lib/personalities';

type Screen = 'start' | 'quiz' | 'result';

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const QUIZ_LENGTH = 12;

export default function Home() {
  const [screen, setScreen] = useState<Screen>('start');
  const [questions, setQuestions] = useState(QUESTIONS.slice(0, QUIZ_LENGTH));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<Record<Personality, number>>({
    divergent: 0,
    preserver: 0,
    agent: 0,
    visionary: 0,
  });
  const [startTime, setStartTime] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [fadeTrigger, setFadeTrigger] = useState(0);

  const startQuiz = useCallback(() => {
    const shuffled = shuffleArray(QUESTIONS).slice(0, QUIZ_LENGTH);
    setQuestions(shuffled);
    setCurrentIndex(0);
    setScores({ divergent: 0, preserver: 0, agent: 0, visionary: 0 });
    setStartTime(Date.now());
    setDiscountCode('');
    setCopied(false);
    setScreen('quiz');
    setFadeTrigger((p) => p + 1);
  }, []);

  const handleAnswer = useCallback(
    (personality: Personality) => {
      setScores((prev) => ({ ...prev, [personality]: prev[personality] + 1 }));
      if (currentIndex + 1 >= QUIZ_LENGTH) {
        setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
        setScreen('result');
      } else {
        setCurrentIndex((prev) => prev + 1);
        setFadeTrigger((p) => p + 1);
      }
    },
    [currentIndex, startTime],
  );

  const dominantPersonality = useMemo((): Personality => {
    const entries = Object.entries(scores) as [Personality, number][];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }, [scores]);

  const personality = PERSONALITIES[dominantPersonality];

  const shareText = useMemo(
    () =>
      `I'm a "${personality.title}" ${personality.emoji} on the Alt History Quiz! What kind of history maker are you? Take the quiz:`,
    [personality],
  );

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareText]);

  const handleGetDiscount = useCallback(async () => {
    try {
      const res = await fetch('/api/discount', { method: 'POST' });
      const data = await res.json();
      setDiscountCode(data.code);
    } catch {
      setDiscountCode('CS-QUIZ20');
    }
  }, []);

  // -- Start Screen --
  if (screen === 'start') {
    return (
      <div className="start-screen fade-in">
        <h1 className="start-title">What Kind of History Maker Are You?</h1>
        <p className="start-subtitle">
          What if Rome never fell? What if the internet came 50 years early? Answer 12
          mind-bending alternate history questions and discover your history-maker
          personality type. It only takes a couple of minutes.
        </p>
        <button className="start-button" onClick={startQuiz}>
          Start Quiz
        </button>

        <section className="faq-section">
          <h2 className="faq-heading">Frequently Asked Questions</h2>
          <details className="faq-item">
            <summary>What is the Alt History Quiz?</summary>
            <p>
              The Alt History Quiz is a free personality quiz that presents you with
              alternate history scenarios — &apos;what if&apos; questions about pivotal moments
              in history — and determines your history maker personality type based on
              your choices.
            </p>
          </details>
          <details className="faq-item">
            <summary>What are the personality types?</summary>
            <p>
              There are four personality types: Timeline Divergent (embraces radical
              change), History Preserver (values stability and continuity), Chaos Agent
              (thrives on unpredictable outcomes), and Future Architect (focuses on
              long-term technological and social progress).
            </p>
          </details>
          <details className="faq-item">
            <summary>How many questions are in the quiz?</summary>
            <p>
              Each quiz session presents 12 questions randomly selected from a pool of
              over 50 alternate history scenarios, so you get a different experience
              each time you take it.
            </p>
          </details>
          <details className="faq-item">
            <summary>Is the Alt History Quiz free?</summary>
            <p>
              Yes, the quiz is completely free to take. You can retake it as many times
              as you like to explore different scenarios and potentially get a different
              personality result.
            </p>
          </details>
          <details className="faq-item">
            <summary>Can I share my quiz results?</summary>
            <p>
              Yes! After completing the quiz, you can copy your results to share with
              friends on social media or messaging apps.
            </p>
          </details>
        </section>
      </div>
    );
  }

  // -- Quiz Screen --
  if (screen === 'quiz') {
    const q = questions[currentIndex];
    return (
      <div style={{ padding: '32px 0' }}>
        <div className="progress-label">
          Question {currentIndex + 1} of {QUIZ_LENGTH}
        </div>
        <div className="progress-container">
          <div
            className="progress-bar"
            style={{ width: `${((currentIndex + 1) / QUIZ_LENGTH) * 100}%` }}
          />
        </div>
        <div className="quiz-card fade-in" key={fadeTrigger}>
          <h2 className="quiz-question">{q.question}</h2>
          <div className="options-grid">
            {q.options.map((opt, i) => (
              <button
                key={i}
                className="option-button"
                onClick={() => handleAnswer(opt.personality)}
              >
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -- Result Screen --
  return (
    <div className="result-screen fade-in">
      <div
        className="result-card"
        style={{ borderColor: personality.color }}
      >
        <div
          className="result-card"
          style={{
            border: 'none',
            boxShadow: 'none',
            padding: 0,
            marginBottom: 0,
          }}
        >
          <span className="result-emoji">{personality.emoji}</span>
          <span
            className="personality-badge"
            style={{
              backgroundColor: personality.color + '18',
              color: personality.color,
            }}
          >
            Your Personality Type
          </span>
          <h2 className="result-title" style={{ color: personality.color }}>
            {personality.title}
          </h2>
          <p className="result-description">{personality.description}</p>
        </div>

        <div className="score-breakdown">
          {(Object.entries(PERSONALITIES) as [Personality, typeof personality][]).map(
            ([key, p]) => (
              <div className="score-item" key={key}>
                <div className="score-item-label">
                  {p.emoji} {p.title}
                </div>
                <div className="score-item-value" style={{ color: p.color }}>
                  {scores[key]}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="result-stats">
          You answered {QUIZ_LENGTH} questions in {elapsedSeconds} seconds
        </div>
      </div>

      <div className="button-row">
        <button className="btn btn-primary" onClick={handleShare}>
          {copied ? 'Copied!' : 'Share Your Result'}
        </button>
        <button className="btn btn-secondary" onClick={startQuiz}>
          Take Again
        </button>
      </div>

      <div className="cta-card">
        <h3>Love alternate history?</h3>
        <p>
          Play out your own timelines on <strong>ChronoStates</strong> — the alternate
          history strategy game where every decision rewrites the world.
        </p>
        {discountCode ? (
          <div className="discount-code">{discountCode} &mdash; 20% off</div>
        ) : (
          <button className="cta-discount" onClick={handleGetDiscount}>
            Get 20% Off ChronoStates
          </button>
        )}
      </div>
    </div>
  );
}
