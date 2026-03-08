const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── SEED QUESTIONS (served from JS, seeded to DB on first call) ──

// Load questions from shared constants (ESM → CJS bridge)
let QUIZ_QUESTIONS_CACHE = null;
async function getQuestions() {
  if (QUIZ_QUESTIONS_CACHE) return QUIZ_QUESTIONS_CACHE;
  try {
    // Dynamic import for ESM module
    const mod = await import('../../../lib/quiz-questions.js');
    QUIZ_QUESTIONS_CACHE = mod.QUIZ_QUESTIONS;
    return QUIZ_QUESTIONS_CACHE;
  } catch {
    return [];
  }
}

// GET /api/quiz/questions — Returns all questions (optionally filtered by category)
// Merges local seed with DB, preferring DB records if they exist
router.get('/questions', async (req, res) => {
  try {
    const allQuestions = await getQuestions();
    const { category } = req.query;

    let questions = allQuestions.map((q, i) => ({
      id: `seed_${i}`,
      ...q,
      sort_order: i,
    }));

    if (category) {
      questions = questions.filter(q => q.category === category);
    }

    // Try to load DB questions too (may have custom questions added)
    const { data: dbQuestions } = await safeQuery((sb) => {
      let query = sb.from('quiz_questions').select('*');
      if (category) query = query.eq('category', category);
      return query.order('sort_order', { ascending: true });
    });

    if (dbQuestions && dbQuestions.length > 0) {
      // Merge: DB questions take priority by question_text match
      const dbTexts = new Set(dbQuestions.map(q => q.question_text));
      const seedOnly = questions.filter(q => !dbTexts.has(q.question_text));
      questions = [...dbQuestions, ...seedOnly];
    }

    res.json({ questions, total: questions.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/quiz/categories — Category stats
router.get('/categories', async (req, res) => {
  try {
    const allQuestions = await getQuestions();
    const accountId = req.accountId;

    // Count questions per category
    const categoryCounts = {};
    allQuestions.forEach(q => {
      categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
    });

    // Count answered per category
    const { data: answers } = await safeQuery((sb) =>
      sb.from('quiz_answers')
        .select('question_id, quiz_questions(category)')
        .eq('account_id', accountId)
    );

    const answeredCounts = {};
    (answers || []).forEach(a => {
      const cat = a.quiz_questions?.category;
      if (cat) answeredCounts[cat] = (answeredCounts[cat] || 0) + 1;
    });

    const categories = Object.entries(categoryCounts).map(([id, total]) => ({
      id,
      total,
      answered: answeredCounts[id] || 0,
      pct: total > 0 ? Math.round(((answeredCounts[id] || 0) / total) * 100) : 0,
    }));

    res.json({ categories, total_questions: allQuestions.length, total_answered: (answers || []).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/quiz/unanswered — Get next batch of unanswered questions
router.get('/unanswered', async (req, res) => {
  try {
    const allQuestions = await getQuestions();
    const { category, limit = 1 } = req.query;
    const accountId = req.accountId;

    // Get all answered question texts for this user
    const { data: answers } = await safeQuery((sb) =>
      sb.from('quiz_answers')
        .select('question_id, quiz_questions(question_text)')
        .eq('account_id', accountId)
    );

    const answeredTexts = new Set((answers || []).map(a => a.quiz_questions?.question_text).filter(Boolean));

    let unanswered = allQuestions
      .map((q, i) => ({ id: `seed_${i}`, ...q, sort_order: i }))
      .filter(q => !answeredTexts.has(q.question_text));

    if (category) {
      unanswered = unanswered.filter(q => q.category === category);
    }

    // Shuffle for variety
    for (let i = unanswered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unanswered[i], unanswered[j]] = [unanswered[j], unanswered[i]];
    }

    res.json({
      questions: unanswered.slice(0, parseInt(limit)),
      remaining: unanswered.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/quiz/reask — Questions due for re-asking (beliefs that may have changed)
router.get('/reask', async (req, res) => {
  try {
    const allQuestions = await getQuestions();
    const accountId = req.accountId;

    // Get all answers
    const { data: answers } = await safeQuery((sb) =>
      sb.from('quiz_answers')
        .select('*, quiz_questions(question_text, category)')
        .eq('account_id', accountId)
    );

    // Find questions with reask_days that were answered > reask_days ago
    const now = Date.now();
    const reaskable = [];

    (answers || []).forEach(answer => {
      const qText = answer.quiz_questions?.question_text;
      if (!qText) return;

      const seedQ = allQuestions.find(q => q.question_text === qText);
      if (!seedQ || !seedQ.reask_days) return;

      const answeredAt = new Date(answer.answered_at).getTime();
      const daysSince = (now - answeredAt) / (1000 * 60 * 60 * 24);

      if (daysSince >= seedQ.reask_days) {
        reaskable.push({
          ...seedQ,
          id: answer.question_id,
          previous_answer: answer.answer,
          previous_answered_at: answer.answered_at,
          days_since: Math.floor(daysSince),
        });
      }
    });

    res.json({ questions: reaskable });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quiz/answer — Submit an answer (seeds question to DB if needed)
router.post('/answer', async (req, res) => {
  const { question_text, answer, category, answer_type, options, dimension, reask_days } = req.body;
  if (!question_text || answer == null) {
    return res.status(400).json({ error: 'question_text and answer required' });
  }

  try {
    const supabase = getSupabase();
    const accountId = req.accountId;

    // 1. Ensure question exists in DB (upsert by question_text)
    const { data: question } = await supabase
      .from('quiz_questions')
      .upsert({
        question_text,
        category: category || 'general',
        answer_type: answer_type || 'open_text',
        options: options || [],
        dimension: dimension || null,
        reask_days: reask_days || null,
        sort_order: 0,
      }, { onConflict: 'question_text' })
      .select()
      .single();

    if (!question) return res.status(500).json({ error: 'Failed to upsert question' });

    // 2. Check for existing answer (for re-ask tracking)
    const { data: existing } = await supabase
      .from('quiz_answers')
      .select('*')
      .eq('account_id', accountId)
      .eq('question_id', question.id)
      .single();

    // 3. Upsert answer, preserving previous answer if it exists
    const answerData = {
      account_id: accountId,
      question_id: question.id,
      answer: String(answer),
      answered_at: new Date().toISOString(),
    };

    if (existing) {
      answerData.previous_answer = existing.answer;
      answerData.previous_answered_at = existing.answered_at;
    }

    const { data: savedAnswer } = await supabase
      .from('quiz_answers')
      .upsert(answerData, { onConflict: 'account_id,question_id' })
      .select()
      .single();

    // 4. Recompute profile dimensions (async)
    computeProfile(accountId).catch(err => console.error('Profile compute error:', err));

    res.json({
      answer: savedAnswer,
      changed: existing ? existing.answer !== String(answer) : false,
      previous: existing?.answer || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/quiz/answers — All answers with question details
router.get('/answers', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('quiz_answers')
      .select('*, quiz_questions(question_text, category, answer_type, dimension)')
      .eq('account_id', req.accountId)
      .order('answered_at', { ascending: false })
      .limit(500)
  );
  res.json({ answers: data || [] });
});

// GET /api/quiz/profile — Computed profile dimensions
router.get('/profile', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('quiz_profile')
      .select('*')
      .eq('account_id', req.accountId)
      .order('category', { ascending: true })
  );
  res.json({ profile: data || [] });
});

// GET /api/quiz/changes — View answers that changed on re-ask
router.get('/changes', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('quiz_answers')
      .select('*, quiz_questions(question_text, category, dimension)')
      .eq('account_id', req.accountId)
      .not('previous_answer', 'is', null)
      .order('answered_at', { ascending: false })
  );
  res.json({ changes: data || [] });
});

// ── PROFILE COMPUTATION ENGINE ──────────────────────────────

async function computeProfile(accountId) {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();

  // Get all answers with dimension info
  const { data: answers } = await supabase
    .from('quiz_answers')
    .select('answer, quiz_questions(category, answer_type, dimension, options)')
    .eq('account_id', accountId);

  if (!answers || answers.length === 0) return;

  const dimensions = {};

  answers.forEach(a => {
    const q = a.quiz_questions;
    if (!q || !q.dimension) return;

    const key = q.dimension;
    if (!dimensions[key]) {
      dimensions[key] = { category: q.category, scores: [], answers: [] };
    }

    // Convert answer to numeric score where possible
    let score = null;
    if (q.answer_type === 'scale') {
      score = parseFloat(a.answer);
    } else if (q.answer_type === 'spectrum') {
      const spectrumMap = { 'Strongly Disagree': 1, 'Strongly Oppose': 1, 'Disagree': 3, 'Oppose': 3, 'Neutral': 5, 'Agree': 7, 'Support': 7, 'Strongly Agree': 9, 'Strongly Support': 9 };
      score = spectrumMap[a.answer] || 5;
    } else if (q.answer_type === 'boolean') {
      score = (a.answer === 'true' || a.answer === 'Yes') ? 8 : 2;
    }

    if (score != null && !isNaN(score)) {
      dimensions[key].scores.push(score);
    }
    dimensions[key].answers.push(a.answer);
  });

  // Compute aggregate profiles
  const profiles = [];

  // Personality dimensions (from scale/spectrum answers)
  for (const [dim, data] of Object.entries(dimensions)) {
    if (data.scores.length > 0) {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      profiles.push({
        account_id: accountId,
        dimension: dim,
        category: data.category,
        score: Math.round(avg * 100) / 100,
        description: describeScore(dim, avg),
        computed_at: new Date().toISOString(),
      });
    }
  }

  // Compute meta-dimensions
  const introExtro = dimensions.introversion_extroversion?.scores?.[0];
  const adventureSeeking = dimensions.adventure_seeking?.scores?.[0];
  const ruleBreaking = dimensions.rule_breaking?.scores?.[0];

  // Contrarian Index (how often answers diverge from expected mainstream)
  const spectrumAnswers = answers.filter(a => a.quiz_questions?.answer_type === 'spectrum');
  if (spectrumAnswers.length >= 5) {
    const extremeCount = spectrumAnswers.filter(a =>
      a.answer === 'Strongly Disagree' || a.answer === 'Strongly Agree' ||
      a.answer === 'Strongly Oppose' || a.answer === 'Strongly Support'
    ).length;
    const contrarianScore = (extremeCount / spectrumAnswers.length) * 10;
    profiles.push({
      account_id: accountId,
      dimension: 'contrarian_index',
      category: 'meta',
      score: Math.round(contrarianScore * 100) / 100,
      description: contrarianScore >= 7 ? 'Strong opinions, rarely fence-sits'
        : contrarianScore >= 4 ? 'Balanced mix of strong and moderate views'
        : 'Tends toward moderate positions',
      computed_at: new Date().toISOString(),
    });
  }

  // Openness to Experience (composite)
  const opennessInputs = [
    dimensions.food_adventure?.scores?.[0],
    dimensions.adventure_seeking?.scores?.[0],
    dimensions.intellectual_flexibility?.scores?.[0],
    dimensions.adaptability?.scores?.[0],
  ].filter(s => s != null);

  if (opennessInputs.length >= 2) {
    const openness = opennessInputs.reduce((a, b) => a + b, 0) / opennessInputs.length;
    profiles.push({
      account_id: accountId,
      dimension: 'openness_to_experience',
      category: 'meta',
      score: Math.round(openness * 100) / 100,
      description: openness >= 7 ? 'Highly open to new experiences'
        : openness >= 4 ? 'Selectively open to novelty'
        : 'Prefers familiarity and routine',
      computed_at: new Date().toISOString(),
    });
  }

  // Emotional Awareness (composite)
  const emotionalInputs = [
    dimensions.emotional_intelligence?.scores?.[0],
    dimensions.vulnerability?.scores?.[0],
    dimensions.emotional_sensitivity?.scores?.[0],
  ].filter(s => s != null);

  if (emotionalInputs.length >= 2) {
    const emotional = emotionalInputs.reduce((a, b) => a + b, 0) / emotionalInputs.length;
    profiles.push({
      account_id: accountId,
      dimension: 'emotional_awareness',
      category: 'meta',
      score: Math.round(emotional * 100) / 100,
      description: emotional >= 7 ? 'Deeply in touch with emotions'
        : emotional >= 4 ? 'Moderate emotional awareness'
        : 'Tends to intellectualize over feeling',
      computed_at: new Date().toISOString(),
    });
  }

  // Upsert all profiles
  if (profiles.length > 0) {
    await supabase.from('quiz_profile').upsert(profiles, { onConflict: 'account_id,dimension' });
  }
}

function describeScore(dimension, score) {
  if (score >= 8) return 'Very high';
  if (score >= 6) return 'Above average';
  if (score >= 4) return 'Moderate';
  if (score >= 2) return 'Below average';
  return 'Very low';
}

module.exports = router;
