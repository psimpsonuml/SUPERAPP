const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── Daily Prompt Rotation ────────────────────────────────────
const DAILY_PROMPTS = [
  "What are you most grateful for today?",
  "What's one thing you learned recently that changed your perspective?",
  "Describe a moment today that made you smile.",
  "What challenge are you currently facing, and how are you approaching it?",
  "Write about a person who positively influenced you recently.",
  "What would you tell your past self from one year ago?",
  "What does your ideal day look like?",
  "What's something you've been avoiding? Why?",
  "Describe a recent win, no matter how small.",
  "What are three things you're looking forward to?",
  "What habit do you want to build or break?",
  "Write about a fear you'd like to overcome.",
  "What does success mean to you right now?",
  "Reflect on a mistake that taught you something valuable.",
  "What boundaries do you need to set or reinforce?",
  "How are you taking care of yourself this week?",
  "What would you do if you knew you couldn't fail?",
  "Write a letter to your future self.",
  "What's one thing you can let go of today?",
  "Describe a place where you feel completely at peace.",
  "What are your top three priorities right now?",
  "How have you grown in the past month?",
  "What conversation do you need to have?",
  "Write about something that excites you about the future.",
  "What's your relationship with rest and how can you improve it?",
  "Describe a core value and how you lived it recently.",
  "What would you do with an extra hour each day?",
  "Write about a relationship you want to nurture.",
  "What's weighing on your mind right now?",
  "Celebrate yourself: list five things you've accomplished recently.",
  "What does balance look like in your life?",
];

// ── GET / — List entries with filters ────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      account_id,
      type,
      date_from,
      date_to,
      search,
      sentiment_min,
      sentiment_max,
      page = 1,
      limit = 20,
    } = req.query;

    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data, error } = await safeQuery(async (sb) => {
      let q = sb
        .from('journal_entries')
        .select('*', { count: 'exact' })
        .eq('account_id', account_id)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (type) q = q.eq('entry_type', type);
      if (date_from) q = q.gte('entry_date', date_from);
      if (date_to) q = q.lte('entry_date', date_to);
      if (sentiment_min) q = q.gte('sentiment_score', parseFloat(sentiment_min));
      if (sentiment_max) q = q.lte('sentiment_score', parseFloat(sentiment_max));
      if (search) q = q.ilike('content', `%${search}%`);

      return q;
    });

    // Compute streak info inline
    const streakResult = await safeQuery(async (sb) => {
      return sb
        .from('journal_entries')
        .select('entry_date')
        .eq('account_id', account_id)
        .order('entry_date', { ascending: false });
    });

    const streak = computeStreak(streakResult.data || []);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ entries: data || [], streak, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /entry/:id — Single entry ───────────────────────────
router.get('/entry/:id', async (req, res) => {
  try {
    const { data, error } = await safeQuery(async (sb) => {
      return sb
        .from('journal_entries')
        .select('*')
        .eq('id', req.params.id)
        .single();
    });
    if (error) return res.status(404).json({ error: 'Entry not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST / — Create entry ───────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { account_id, entry_type, content, prompt_used, tags, entry_date } = req.body;
    if (!account_id || !content) {
      return res.status(400).json({ error: 'account_id and content required' });
    }

    // Stub sentiment analysis (would call Claude API in production)
    const sentiment_score = analyzeSentiment(content);

    const { data, error } = await safeQuery(async (sb) => {
      return sb
        .from('journal_entries')
        .insert({
          account_id,
          entry_type: entry_type || 'journal',
          content,
          prompt_used: prompt_used || '',
          sentiment_score,
          tags: tags || [],
          entry_date: entry_date || new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
    });

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /:id — Update entry ─────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { content, entry_type, tags, prompt_used, entry_date } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (content !== undefined) {
      updates.content = content;
      updates.sentiment_score = analyzeSentiment(content);
    }
    if (entry_type !== undefined) updates.entry_type = entry_type;
    if (tags !== undefined) updates.tags = tags;
    if (prompt_used !== undefined) updates.prompt_used = prompt_used;
    if (entry_date !== undefined) updates.entry_date = entry_date;

    const { data, error } = await safeQuery(async (sb) => {
      return sb
        .from('journal_entries')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();
    });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id — Delete entry ──────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await safeQuery(async (sb) => {
      return sb.from('journal_entries').delete().eq('id', req.params.id);
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /streak — Current and longest streak ────────────────
router.get('/streak', async (req, res) => {
  try {
    const { account_id } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(async (sb) => {
      return sb
        .from('journal_entries')
        .select('entry_date')
        .eq('account_id', account_id)
        .order('entry_date', { ascending: false });
    });

    if (error) return res.status(500).json({ error: error.message });
    res.json(computeStreak(data || []));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /calendar — Dates with entries for calendar view ────
router.get('/calendar', async (req, res) => {
  try {
    const { account_id, year, month } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const { data, error } = await safeQuery(async (sb) => {
      return sb
        .from('journal_entries')
        .select('id, entry_date, entry_type, sentiment_score')
        .eq('account_id', account_id)
        .gte('entry_date', startDate)
        .lt('entry_date', endDate)
        .order('entry_date', { ascending: true });
    });

    if (error) return res.status(500).json({ error: error.message });

    // Group by date
    const byDate = {};
    (data || []).forEach((e) => {
      if (!byDate[e.entry_date]) byDate[e.entry_date] = [];
      byDate[e.entry_date].push({ id: e.id, type: e.entry_type, sentiment: e.sentiment_score });
    });

    res.json({ year: y, month: m, dates: byDate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /prompt — Daily prompt ──────────────────────────────
router.get('/prompt', async (_req, res) => {
  try {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
    );
    const prompt = DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length];
    res.json({ prompt, date: today.toISOString().split('T')[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /reflections — Monthly sentiment chart data ─────────
router.get('/reflections', async (req, res) => {
  try {
    const { account_id, months = 12 } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - parseInt(months));

    const { data, error } = await safeQuery(async (sb) => {
      return sb
        .from('journal_entries')
        .select('entry_date, entry_type, sentiment_score')
        .eq('account_id', account_id)
        .gte('entry_date', cutoff.toISOString().split('T')[0])
        .order('entry_date', { ascending: true });
    });

    if (error) return res.status(500).json({ error: error.message });

    // Aggregate by month
    const monthlyData = {};
    (data || []).forEach((e) => {
      const monthKey = e.entry_date.substring(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { sentiments: [], types: {}, count: 0 };
      }
      monthlyData[monthKey].count++;
      if (e.sentiment_score != null) {
        monthlyData[monthKey].sentiments.push(parseFloat(e.sentiment_score));
      }
      const t = e.entry_type || 'journal';
      monthlyData[monthKey].types[t] = (monthlyData[monthKey].types[t] || 0) + 1;
    });

    const chart = Object.entries(monthlyData).map(([month, d]) => ({
      month,
      avg_sentiment: d.sentiments.length
        ? +(d.sentiments.reduce((a, b) => a + b, 0) / d.sentiments.length).toFixed(2)
        : null,
      entry_count: d.count,
      type_distribution: d.types,
    }));

    res.json({ months: chart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /monthly-reflection — AI reflection stub ───────────
router.post('/monthly-reflection', async (req, res) => {
  try {
    const { account_id, year, month } = req.body;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const { data, error } = await safeQuery(async (sb) => {
      return sb
        .from('journal_entries')
        .select('content, entry_type, sentiment_score, entry_date')
        .eq('account_id', account_id)
        .gte('entry_date', startDate)
        .lt('entry_date', endDate)
        .order('entry_date', { ascending: true });
    });

    if (error) return res.status(500).json({ error: error.message });

    const entries = data || [];
    if (entries.length === 0) {
      return res.json({ reflection: 'No entries found for this month.' });
    }

    // Stub: In production, this would call the Claude API with the entries
    // to generate a personalized monthly reflection.
    const avgSentiment = entries
      .filter((e) => e.sentiment_score != null)
      .reduce((sum, e, _, arr) => sum + parseFloat(e.sentiment_score) / arr.length, 0);

    const typeCounts = {};
    entries.forEach((e) => {
      const t = e.entry_type || 'journal';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    const monthName = new Date(y, m - 1).toLocaleString('en', { month: 'long' });
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

    const reflection = [
      `## ${monthName} ${y} Reflection`,
      '',
      `You wrote **${entries.length} entries** this month — great commitment to self-reflection!`,
      '',
      avgSentiment > 0.6
        ? `Your overall mood trended **positive** (avg sentiment: ${avgSentiment.toFixed(2)}). It seems like things are going well.`
        : avgSentiment > 0.3
          ? `Your mood was **balanced** this month (avg sentiment: ${avgSentiment.toFixed(2)}). A mix of highs and lows is perfectly normal.`
          : `Your entries suggest a **challenging month** (avg sentiment: ${avgSentiment.toFixed(2)}). Remember that acknowledging difficulty is a form of strength.`,
      '',
      topType
        ? `Your most common entry type was **${topType[0]}** (${topType[1]} entries). ${typeInsight(topType[0])}`
        : '',
      '',
      `Keep showing up for yourself. Consistency in reflection builds self-awareness over time.`,
    ].join('\n');

    res.json({ reflection, month: m, year: y, entry_count: entries.length, avg_sentiment: +avgSentiment.toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /search — Full-text search ──────────────────────────
router.get('/search', async (req, res) => {
  try {
    const { account_id, q, page = 1, limit = 20 } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });
    if (!q) return res.json({ results: [] });

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data, error } = await safeQuery(async (sb) => {
      return sb
        .from('journal_entries')
        .select('*')
        .eq('account_id', account_id)
        .ilike('content', `%${q}%`)
        .order('entry_date', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);
    });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ results: data || [], query: q, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ─────────────────────────────────────────────────

function computeStreak(entries) {
  if (!entries.length) return { current: 0, longest: 0 };

  // Get unique sorted dates descending
  const uniqueDates = [...new Set(entries.map((e) => e.entry_date))].sort().reverse();

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let current = 0;
  // Check if streak is active (today or yesterday)
  if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
    current = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      const diffDays = (prev - curr) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        current++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longest = 0;
  let streak = 1;
  const sorted = [...uniqueDates].sort();
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      streak++;
    } else {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }
  longest = Math.max(longest, streak, current);

  return { current, longest };
}

function analyzeSentiment(text) {
  // Stub sentiment analysis — returns a score between 0.00 and 1.00
  // In production, this would call the Claude API for nuanced analysis
  const positiveWords = ['grateful', 'happy', 'love', 'excited', 'wonderful', 'great', 'amazing', 'joy', 'blessed', 'thankful', 'proud', 'accomplished', 'peaceful', 'inspired', 'hopeful', 'win', 'success', 'beautiful', 'kind', 'growth'];
  const negativeWords = ['sad', 'angry', 'frustrated', 'anxious', 'worried', 'stressed', 'difficult', 'hard', 'struggle', 'fail', 'lost', 'alone', 'tired', 'exhausted', 'overwhelmed', 'fear', 'hurt', 'pain', 'regret', 'disappointed'];

  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  let score = 0.5; // neutral baseline

  words.forEach((w) => {
    if (positiveWords.some((pw) => w.includes(pw))) score += 0.03;
    if (negativeWords.some((nw) => w.includes(nw))) score -= 0.03;
  });

  return Math.max(0, Math.min(1, +score.toFixed(2)));
}

function typeInsight(type) {
  const insights = {
    journal: 'Free-form journaling is a great way to process your thoughts.',
    gratitude: 'Practicing gratitude has been shown to improve well-being and resilience.',
    goal_reflection: 'Reflecting on your goals keeps you aligned with your values.',
    vent: 'Expressing frustrations is healthy — it helps you process and move forward.',
    win: 'Celebrating wins reinforces positive momentum. Keep acknowledging your progress!',
  };
  return insights[type] || '';
}

module.exports = router;
