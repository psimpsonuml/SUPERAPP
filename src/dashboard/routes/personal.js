const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

// Helper: graceful fallback when table doesn't exist yet
async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try {
    return await queryFn(getSupabase());
  } catch (err) {
    return { data: [], error: err };
  }
}

// ── Entertainment ────────────────────────────────────────────

// GET /api/personal/entertainment/ratings
router.get('/entertainment/ratings', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('entertainment_ratings').select('*, entertainment_items(*)').eq('account_id', req.accountId).order('created_at', { ascending: false }).limit(100)
  );
  res.json({ ratings: data || [] });
});

// POST /api/personal/entertainment/rate
router.post('/entertainment/rate', async (req, res) => {
  const { item_id, score, item_type, title, year, metadata } = req.body;
  if (!score || score < 1 || score > 10) return res.status(400).json({ error: 'Score must be 1-10' });

  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    // Upsert item if needed
    let itemId = item_id;
    if (!itemId && title) {
      const { data: item } = await supabase
        .from('entertainment_items').upsert({
          account_id: req.accountId, title, item_type: item_type || 'movie', year, metadata: metadata || {},
        }, { onConflict: 'account_id,title,item_type' }).select().single();
      itemId = item?.id;
    }
    if (!itemId) return res.status(400).json({ error: 'item_id or title required' });

    const { data } = await supabase
      .from('entertainment_ratings').upsert({
        account_id: req.accountId, item_id: itemId, score, updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,item_id' }).select().single();
    res.json({ rating: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/personal/entertainment/cascade — computed cascade scores
router.get('/entertainment/cascade', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('cascade_scores').select('*').eq('account_id', req.accountId).order('composite_score', { ascending: false }).limit(50)
  );
  res.json({ scores: data || [] });
});

// ── Books ────────────────────────────────────────────────────

router.get('/books', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('book_items').select('*, book_ratings(*)').eq('account_id', req.accountId).order('created_at', { ascending: false }).limit(100)
  );
  res.json({ books: data || [] });
});

router.post('/books/rate', async (req, res) => {
  const { title, author, score, status } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('book_items').upsert({
      account_id: req.accountId, title, author, status: status || 'finished',
      score: score || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id,title' }).select().single();
    res.json({ book: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Reminders (Life Manager) ─────────────────────────────────

router.get('/reminders', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('reminders').select('*').eq('account_id', req.accountId).order('next_due', { ascending: true })
  );
  res.json({ reminders: data || [] });
});

router.post('/reminders', async (req, res) => {
  const { title, frequency, time, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('reminders').insert({
      account_id: req.accountId, title, frequency: frequency || 'daily',
      time: time || '09:00', notes, next_due: new Date().toISOString(),
      streak: 0, active: true,
    }).select().single();
    res.json({ reminder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/reminders/:id/complete', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data: current } = await supabase.from('reminders')
      .select('*').eq('id', req.params.id).eq('account_id', req.accountId).single();
    if (!current) return res.status(404).json({ error: 'Not found' });

    const { data } = await supabase.from('reminders')
      .update({ streak: (current.streak || 0) + 1, last_completed: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    res.json({ reminder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Family Log ───────────────────────────────────────────────

router.get('/family-log', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('family_log').select('*').eq('account_id', req.accountId).order('created_at', { ascending: false }).limit(50)
  );
  res.json({ entries: data || [] });
});

router.post('/family-log', async (req, res) => {
  const { text, child, category, photo_url } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('family_log').insert({
      account_id: req.accountId, text, child: child || null,
      category: category || 'memory', photo_url: photo_url || null,
    }).select().single();
    res.json({ entry: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Quiz ─────────────────────────────────────────────────────

router.get('/quiz/questions', async (req, res) => {
  const category = req.query.category;
  const query = safeQuery((sb) => {
    let q = sb.from('quiz_questions').select('*');
    if (category) q = q.eq('category', category);
    return q.order('sort_order', { ascending: true }).limit(20);
  });
  const { data } = await query;
  res.json({ questions: data || [] });
});

router.get('/quiz/answers', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('quiz_answers').select('*, quiz_questions(question_text, category)').eq('account_id', req.accountId).order('answered_at', { ascending: false }).limit(200)
  );
  res.json({ answers: data || [] });
});

router.post('/quiz/answer', async (req, res) => {
  const { question_id, answer } = req.body;
  if (!question_id || answer == null) return res.status(400).json({ error: 'question_id and answer required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('quiz_answers').upsert({
      account_id: req.accountId, question_id, answer, answered_at: new Date().toISOString(),
    }, { onConflict: 'account_id,question_id' }).select().single();
    res.json({ answer: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/quiz/profile', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('quiz_profile').select('*').eq('account_id', req.accountId)
  );
  res.json({ profile: data || [] });
});

// ── Learning Queue ───────────────────────────────────────────

router.get('/learning', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('learning_queue').select('*').eq('account_id', req.accountId).order('priority', { ascending: false }).limit(50)
  );
  res.json({ items: data || [] });
});

router.post('/learning', async (req, res) => {
  const { title, topic, url, estimated_time, priority } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const { data } = await supabase.from('learning_queue').insert({
      account_id: req.accountId, title, topic, url,
      estimated_time: estimated_time || null, priority: priority || 'medium',
      status: 'queued',
    }).select().single();
    res.json({ item: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Health ────────────────────────────────────────────────────

// GET /health — all metrics for a time range, grouped by type with today snapshot
router.get('/health', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const { data: metrics } = await safeQuery(sb =>
      sb.from('health_metrics').select('*')
        .eq('account_id', req.accountId)
        .gte('date', since)
        .order('date', { ascending: false })
    );

    const allMetrics = metrics || [];

    // Today's snapshot — latest value per metric type for today
    const todayMetrics = allMetrics.filter(m => m.date === today);
    const yesterdayMetrics = allMetrics.filter(m => m.date === yesterday);
    const snapshot = {};
    for (const m of todayMetrics) {
      if (!snapshot[m.metric_type]) snapshot[m.metric_type] = m;
    }
    // Add deltas from yesterday
    for (const [type, current] of Object.entries(snapshot)) {
      const yesterdayVal = yesterdayMetrics.find(m => m.metric_type === type);
      snapshot[type] = {
        ...current,
        delta: yesterdayVal ? +(current.value - yesterdayVal.value).toFixed(2) : null,
      };
    }

    // Group by metric type for charts
    const byType = {};
    for (const m of allMetrics) {
      if (!byType[m.metric_type]) byType[m.metric_type] = [];
      byType[m.metric_type].push({ date: m.date, value: +m.value, source: m.source });
    }
    // Sort each type by date ascending for charting
    for (const type of Object.keys(byType)) {
      byType[type].sort((a, b) => a.date.localeCompare(b.date));
    }

    // Targets
    const { data: targets } = await safeQuery(sb =>
      sb.from('health_targets').select('*').eq('account_id', req.accountId)
    );
    const targetMap = {};
    for (const t of (targets || [])) {
      targetMap[t.metric_type] = +t.target_value;
    }

    res.json({ metrics: allMetrics, snapshot, byType, targets: targetMap, days });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /health/manual — manual metric entry
router.post('/health/manual', async (req, res) => {
  try {
    const { metricType, value, unit, date } = req.body;
    if (!metricType || value == null) {
      return res.status(400).json({ error: 'metricType and value are required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('health_metrics').insert({
        account_id: req.accountId,
        date: date || new Date().toISOString().slice(0, 10),
        metric_type: metricType,
        value: +value,
        unit: unit || null,
        source: 'manual',
        recorded_at: new Date().toISOString(),
      }).select().single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /health/import — import health data from Apple Health XML, Google Fit, Fitbit, or CSV
router.post('/health/import', async (req, res) => {
  try {
    const { source, fileName, records } = req.body;
    if (!source || !records?.length) {
      return res.status(400).json({ error: 'source and records array are required' });
    }

    // Insert metrics in batches of 500
    let imported = 0;
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize).map(r => ({
        account_id: req.accountId,
        date: r.date,
        metric_type: r.metricType || r.metric_type,
        value: +r.value,
        unit: r.unit || null,
        source,
        recorded_at: r.recordedAt || r.recorded_at || new Date().toISOString(),
      }));

      const { error } = await safeQuery(sb =>
        sb.from('health_metrics').upsert(batch, { onConflict: 'id' })
      );
      if (!error) imported += batch.length;
    }

    // Record import
    await safeQuery(sb =>
      sb.from('health_imports').insert({
        account_id: req.accountId,
        source,
        file_name: fileName || `${source}-import`,
        records_imported: imported,
      })
    );

    res.json({ imported, source, fileName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /health/imports — import history
router.get('/health/imports', async (req, res) => {
  try {
    const { data } = await safeQuery(sb =>
      sb.from('health_imports').select('*')
        .eq('account_id', req.accountId)
        .order('imported_at', { ascending: false })
        .limit(20)
    );
    res.json({ imports: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /health/targets — get all targets
router.get('/health/targets', async (req, res) => {
  try {
    const { data } = await safeQuery(sb =>
      sb.from('health_targets').select('*').eq('account_id', req.accountId)
    );
    res.json({ targets: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /health/targets — set/update a target
router.put('/health/targets', async (req, res) => {
  try {
    const { metricType, targetValue } = req.body;
    if (!metricType || targetValue == null) {
      return res.status(400).json({ error: 'metricType and targetValue are required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('health_targets').upsert({
        account_id: req.accountId,
        metric_type: metricType,
        target_value: +targetValue,
        created_at: new Date().toISOString(),
      }, { onConflict: 'account_id,metric_type' }).select().single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /health/workouts — workout log with filtering
router.get('/health/workouts', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const workoutType = req.query.type;
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    let query = getSupabase().from('health_metrics').select('*')
      .eq('account_id', req.accountId)
      .eq('metric_type', 'workout')
      .gte('date', since)
      .order('date', { ascending: false });

    if (workoutType) query = query.eq('unit', workoutType);

    const { data, error } = await safeQuery(() => query.limit(200));
    if (error) return res.status(500).json({ error: error.message });

    const workouts = data || [];

    // Monthly summary
    const byMonth = {};
    for (const w of workouts) {
      const month = w.date.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { count: 0, totalMinutes: 0, types: {} };
      byMonth[month].count++;
      byMonth[month].totalMinutes += +w.value || 0;
      const type = w.unit || 'other';
      byMonth[month].types[type] = (byMonth[month].types[type] || 0) + 1;
    }

    // Workout types for filter
    const workoutTypes = [...new Set(workouts.map(w => w.unit).filter(Boolean))];

    res.json({ workouts, byMonth, workoutTypes, total: workouts.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /health/correlations — AI-generated correlations
router.get('/health/correlations', async (req, res) => {
  try {
    const { data } = await safeQuery(sb =>
      sb.from('health_correlations').select('*')
        .eq('account_id', req.accountId)
        .order('generated_at', { ascending: false })
        .limit(10)
    );
    res.json({ correlations: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /health/correlations/generate — generate new correlations via Claude
router.post('/health/correlations/generate', async (req, res) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    // Get 90 days of data
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const { data: metrics } = await safeQuery(sb =>
      sb.from('health_metrics').select('date, metric_type, value, unit')
        .eq('account_id', req.accountId)
        .gte('date', since)
        .order('date', { ascending: true })
    );

    if (!metrics || metrics.length < 14) {
      return res.json({ correlations: [], message: 'Need at least 2 weeks of data for correlations' });
    }

    // Build summary by type
    const byType = {};
    for (const m of metrics) {
      if (!byType[m.metric_type]) byType[m.metric_type] = [];
      byType[m.metric_type].push({ date: m.date, value: +m.value });
    }

    const summaryText = Object.entries(byType).map(([type, values]) => {
      const avg = values.reduce((s, v) => s + v.value, 0) / values.length;
      return `${type}: ${values.length} entries, avg=${avg.toFixed(1)}, range ${Math.min(...values.map(v => v.value)).toFixed(1)}-${Math.max(...values.map(v => v.value)).toFixed(1)}`;
    }).join('\n');

    // Daily aligned data for cross-correlation
    const dates = [...new Set(metrics.map(m => m.date))].sort();
    const dailyData = dates.slice(-60).map(date => {
      const dayMetrics = {};
      metrics.filter(m => m.date === date).forEach(m => { dayMetrics[m.metric_type] = +m.value; });
      return { date, ...dayMetrics };
    });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Analyze this health data and find 3-5 meaningful correlations between metrics. Be specific with numbers.

Metric summaries:
${summaryText}

Daily data (last 60 days, JSON):
${JSON.stringify(dailyData.slice(-30))}

Respond with ONLY a JSON array of correlation strings. Each should be a specific, data-backed observation like:
["You sleep 45 minutes longer on days you exceed 8,000 steps", "Your resting heart rate drops 3 BPM during weeks with 3+ workouts"]`,
      }],
    });

    let correlations;
    try {
      correlations = JSON.parse(response.content[0]?.text || '[]');
    } catch {
      correlations = [];
    }

    // Store correlations
    const metricsInvolved = Object.keys(byType);
    for (const text of correlations) {
      await safeQuery(sb =>
        sb.from('health_correlations').insert({
          account_id: req.accountId,
          correlation_text: text,
          metrics_involved: metricsInvolved,
        })
      );
    }

    res.json({ correlations: correlations.map(c => ({ correlation_text: c, generated_at: new Date().toISOString() })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /health/digest — weekly health digest
router.get('/health/digest', async (req, res) => {
  try {
    const { data } = await safeQuery(sb =>
      sb.from('health_digests').select('*')
        .eq('account_id', req.accountId)
        .order('week_start', { ascending: false })
        .limit(4)
    );
    res.json({ digests: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /health/digest/generate — generate weekly digest via Claude
router.post('/health/digest/generate', async (req, res) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    // Get last 7 days
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const weekStart = weekAgo;
    const { data: metrics } = await safeQuery(sb =>
      sb.from('health_metrics').select('date, metric_type, value, unit')
        .eq('account_id', req.accountId)
        .gte('date', weekAgo)
        .order('date', { ascending: true })
    );

    if (!metrics || metrics.length < 7) {
      return res.json({ digest: null, message: 'Need at least a week of data for a digest' });
    }

    // Get targets
    const { data: targets } = await safeQuery(sb =>
      sb.from('health_targets').select('metric_type, target_value').eq('account_id', req.accountId)
    );
    const targetText = (targets || []).map(t => `${t.metric_type}: target ${t.target_value}`).join(', ');

    // Summarize by type
    const byType = {};
    for (const m of metrics) {
      if (!byType[m.metric_type]) byType[m.metric_type] = [];
      byType[m.metric_type].push({ date: m.date, value: +m.value });
    }

    const summaryText = Object.entries(byType).map(([type, values]) => {
      const avg = values.reduce((s, v) => s + v.value, 0) / values.length;
      const daysHit = values.length;
      return `${type}: ${daysHit} days tracked, avg=${avg.toFixed(1)}, min=${Math.min(...values.map(v => v.value)).toFixed(1)}, max=${Math.max(...values.map(v => v.value)).toFixed(1)}`;
    }).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Write a brief, encouraging weekly health summary (150-200 words) for this person. Be specific with their numbers. Note what went well, what needs attention, and any patterns.

This week's health data:
${summaryText}

Personal targets: ${targetText || 'none set'}

Write conversationally, like a supportive coach. Use specific numbers from their data.`,
      }],
    });

    const digestText = response.content[0]?.text || '';

    // Store digest
    const metricsSummary = {};
    for (const [type, values] of Object.entries(byType)) {
      metricsSummary[type] = {
        avg: +(values.reduce((s, v) => s + v.value, 0) / values.length).toFixed(1),
        days: values.length,
      };
    }

    await safeQuery(sb =>
      sb.from('health_digests').upsert({
        account_id: req.accountId,
        digest_text: digestText,
        week_start: weekStart,
        metrics_summary: metricsSummary,
      }, { onConflict: 'account_id,week_start' })
    );

    res.json({ digest: { digest_text: digestText, week_start: weekStart, metrics_summary: metricsSummary, generated_at: new Date().toISOString() } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /health/dna-crossref — cross-reference health with DNA data if available
router.get('/health/dna-crossref', async (req, res) => {
  try {
    // Check if DNA data exists (cross-reference with dna_personal table)
    const { data: dnaData } = await safeQuery(sb =>
      sb.from('dna_personal').select('snp_id, genotype, source_service')
        .eq('account_id', req.accountId)
        .limit(50)
    );

    if (!dnaData?.length) {
      return res.json({ available: false, insights: [] });
    }

    // Check if we have health metrics
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: metrics } = await safeQuery(sb =>
      sb.from('health_metrics').select('metric_type, value, date')
        .eq('account_id', req.accountId)
        .gte('date', since)
        .limit(100)
    );

    if (!metrics?.length) {
      return res.json({ available: true, insights: [], message: 'Need health data for cross-reference' });
    }

    res.json({
      available: true,
      dnaSnps: dnaData.length,
      healthMetrics: [...new Set(metrics.map(m => m.metric_type))],
      insights: [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /health — delete all health data
router.delete('/health', async (req, res) => {
  try {
    await safeQuery(sb => sb.from('health_metrics').delete().eq('account_id', req.accountId));
    await safeQuery(sb => sb.from('health_targets').delete().eq('account_id', req.accountId));
    await safeQuery(sb => sb.from('health_imports').delete().eq('account_id', req.accountId));
    await safeQuery(sb => sb.from('health_correlations').delete().eq('account_id', req.accountId));
    await safeQuery(sb => sb.from('health_digests').delete().eq('account_id', req.accountId));
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── News Feed ────────────────────────────────────────────────

router.get('/news', async (req, res) => {
  const topic = req.query.topic || 'all';
  const limit = Math.min(parseInt(req.query.limit) || 80, 200);
  const saved = req.query.saved === 'true';
  const sort = req.query.sort || 'chronological';

  let query = getSupabase()
    .from('news_feed_items')
    .select('*')
    .eq('account_id', req.accountId);

  if (topic !== 'all') query = query.eq('topic', topic);
  if (saved) query = query.eq('saved', true);
  query = query.order('published_at', { ascending: false }).limit(limit);

  const { data, error } = await safeQuery(() => query);
  if (error) return res.json({ items: [] });

  // Group into clusters
  const items = data || [];
  const clusterIds = [...new Set(items.map(i => i.cluster_id).filter(Boolean))];

  let clusters = [];
  if (clusterIds.length > 0) {
    const { data: clusterData } = await safeQuery(() =>
      getSupabase()
        .from('news_clusters')
        .select('*')
        .eq('account_id', req.accountId)
        .in('id', clusterIds)
    );
    clusters = clusterData || [];
  }

  // Build cluster map
  const clusterMap = {};
  for (const c of clusters) {
    clusterMap[c.id] = { ...c, items: [] };
  }
  const standalone = [];
  for (const item of items) {
    if (item.cluster_id && clusterMap[item.cluster_id]) {
      clusterMap[item.cluster_id].items.push(item);
    } else {
      standalone.push(item);
    }
  }

  // Merge: clusters as grouped entries + standalone items, sorted by newest
  const feed = [];
  for (const c of Object.values(clusterMap)) {
    if (c.items.length > 0) {
      feed.push({
        type: 'cluster',
        id: c.id,
        cluster_title: c.cluster_title,
        synthesis: c.synthesis,
        sentiment: c.sentiment,
        source_count: c.items.length,
        topic: c.topic,
        published_at: c.items[0].published_at,
        items: c.items,
      });
    }
  }
  for (const item of standalone) {
    feed.push({ type: 'item', ...item });
  }

  // Sort by published_at descending
  if (sort === 'chronological') {
    feed.sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
  }

  res.json({ feed, totalItems: items.length, clusterCount: clusters.length });
});

// POST /news/save — toggle save/bookmark
router.post('/news/save', async (req, res) => {
  const { itemId, saved } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId required' });

  const { error } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_items')
      .update({ saved: saved !== false })
      .eq('id', itemId)
      .eq('account_id', req.accountId)
  );

  if (error) return res.status(500).json({ error: error.message });
  res.json({ saved: saved !== false });
});

// GET /news/briefing — get or generate morning briefing
router.get('/news/briefing', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  // Check for cached briefing
  const { data: existing } = await safeQuery(() =>
    getSupabase()
      .from('news_briefings')
      .select('*')
      .eq('account_id', req.accountId)
      .gte('generated_at', `${today}T00:00:00Z`)
      .order('generated_at', { ascending: false })
      .limit(1)
  );

  if (existing?.[0] && req.query.refresh !== 'true') {
    return res.json({ briefing: existing[0] });
  }

  // Generate fresh briefing from today's top items
  const { data: topItems } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_items')
      .select('headline, summary, topic, source, source_lean')
      .eq('account_id', req.accountId)
      .gte('published_at', `${today}T00:00:00Z`)
      .order('published_at', { ascending: false })
      .limit(30)
  );

  const items = topItems || [];
  if (items.length === 0) {
    return res.json({ briefing: null, message: 'No stories available for briefing yet' });
  }

  try {
    const config = require('../../config');
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

    // Pick top 5-8 across diverse topics
    const topicBuckets = {};
    for (const item of items) {
      if (!topicBuckets[item.topic]) topicBuckets[item.topic] = [];
      topicBuckets[item.topic].push(item);
    }
    const selected = [];
    const topics = Object.keys(topicBuckets);
    let round = 0;
    while (selected.length < 8 && round < 5) {
      for (const topic of topics) {
        if (selected.length >= 8) break;
        if (topicBuckets[topic][round]) selected.push(topicBuckets[topic][round]);
      }
      round++;
    }

    const storyList = selected.map((s, i) =>
      `${i + 1}. [${s.topic}] "${s.headline}" (${s.source}) — ${s.summary || ''}`
    ).join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Write a 2-minute morning briefing summarizing these top stories. Be conversational, informative, and cover each topic area briefly. Group related stories. Keep it under 400 words.\n\nStories:\n${storyList}`,
      }],
    });

    const briefingText = response.content[0].text;
    const topicsCovered = [...new Set(selected.map(s => s.topic))];

    // Cache it
    const { data: saved } = await safeQuery(() =>
      getSupabase()
        .from('news_briefings')
        .insert({
          account_id: req.accountId,
          briefing_text: briefingText,
          story_count: selected.length,
          topics_covered: topicsCovered,
        })
        .select()
        .single()
    );

    res.json({ briefing: saved || { briefing_text: briefingText, story_count: selected.length, topics_covered: topicsCovered } });
  } catch (err) {
    res.status(500).json({ error: `Briefing generation failed: ${err.message}` });
  }
});

// GET /news/preferences — feed preferences
router.get('/news/preferences', async (req, res) => {
  const { data } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_preferences')
      .select('*')
      .eq('account_id', req.accountId)
      .single()
  );
  res.json({ preferences: data || { active_topics: ['all'], disabled_sources: [], sort_mode: 'chronological' } });
});

// PUT /news/preferences — update feed preferences
router.put('/news/preferences', async (req, res) => {
  const { active_topics, disabled_sources, sort_mode } = req.body;
  const { data, error } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_preferences')
      .upsert({
        account_id: req.accountId,
        active_topics: active_topics || ['all'],
        disabled_sources: disabled_sources || [],
        sort_mode: sort_mode || 'chronological',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id' })
      .select()
      .single()
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ preferences: data });
});

// GET /news/top-stories — compact widget for personal dashboard
router.get('/news/top-stories', async (req, res) => {
  const { data } = await safeQuery(() =>
    getSupabase()
      .from('news_feed_items')
      .select('id, headline, source, topic, source_lean, published_at, source_url')
      .eq('account_id', req.accountId)
      .order('published_at', { ascending: false })
      .limit(5)
  );
  res.json({ stories: data || [] });
});

// ── Release Tracker ──────────────────────────────────────────

router.get('/releases', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('release_digest').select('*').eq('account_id', req.accountId).order('release_date', { ascending: false }).limit(30)
  );
  res.json({ releases: data || [] });
});

// ── Music ────────────────────────────────────────────────────

router.get('/music', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('music_items').select('*, music_ratings(*)').eq('account_id', req.accountId).order('created_at', { ascending: false }).limit(100)
  );
  res.json({ music: data || [] });
});

// ── Finance Snapshot ─────────────────────────────────────────

router.get('/finance', async (req, res) => {
  // Read-only Budgeting Beacon integration — pulls summary
  const { data } = await safeQuery((sb) =>
    sb.from('finance_snapshot').select('*').eq('account_id', req.accountId).order('snapshot_date', { ascending: false }).limit(1)
  );
  res.json({ snapshot: data?.[0] || null });
});

// ── Facebook Archaeologist ───────────────────────────────────

// GET /facebook/status — import status
router.get('/facebook/status', async (req, res) => {
  const { data } = await safeQuery((sb) =>
    sb.from('fb_import_status').select('*').eq('account_id', req.accountId).single()
  );
  res.json({ status: data || null });
});

// POST /facebook/upload — receive uploaded FB export and parse
router.post('/facebook/upload', async (req, res) => {
  const { files, includeMessages } = req.body;
  if (!files || typeof files !== 'object') return res.status(400).json({ error: 'Parsed file data required' });

  const supabase = getSupabase();

  // Upsert import status
  await safeQuery((sb) =>
    sb.from('fb_import_status').upsert({
      account_id: req.accountId,
      status: 'processing',
      progress: 0,
      total_files: Object.keys(files).length,
      files_parsed: 0,
      include_messages: !!includeMessages,
      started_at: new Date().toISOString(),
    }, { onConflict: 'account_id' })
  );

  // Store each parsed data type
  const dataTypes = Object.keys(files);
  let parsed = 0;

  for (const dataType of dataTypes) {
    const items = files[dataType];
    const itemCount = Array.isArray(items) ? items.length : (typeof items === 'object' ? 1 : 0);

    await safeQuery((sb) =>
      sb.from('fb_archive').upsert({
        account_id: req.accountId,
        data_type: dataType,
        items: items,
        item_count: itemCount,
        imported_at: new Date().toISOString(),
      }, { onConflict: 'account_id,data_type' })
    );

    parsed++;
    await safeQuery((sb) =>
      sb.from('fb_import_status').update({
        files_parsed: parsed,
        progress: Math.round((parsed / dataTypes.length) * 50),
      }).eq('account_id', req.accountId)
    );
  }

  // Mark processing complete, start analysis
  await safeQuery((sb) =>
    sb.from('fb_import_status').update({
      status: 'analyzing',
      progress: 50,
    }).eq('account_id', req.accountId)
  );

  // Run analysis in background (non-blocking)
  runFbAnalysis(req.accountId, files).catch((err) => {
    safeQuery((sb) =>
      sb.from('fb_import_status').update({
        status: 'error',
        error_message: err.message,
      }).eq('account_id', req.accountId)
    );
  });

  res.json({ status: 'processing', dataTypes: dataTypes.length, message: 'Upload received, analysis starting' });
});

// GET /facebook/data — all archive data by type
router.get('/facebook/data', async (req, res) => {
  const type = req.query.type;
  let query = getSupabase().from('fb_archive').select('data_type, items, item_count, imported_at').eq('account_id', req.accountId);
  if (type) query = query.eq('data_type', type);

  const { data } = await safeQuery(() => query);
  res.json({ archive: data || [] });
});

// GET /facebook/analysis — all analysis results
router.get('/facebook/analysis', async (req, res) => {
  const type = req.query.type;
  let query = getSupabase().from('fb_analysis').select('*').eq('account_id', req.accountId);
  if (type) query = query.eq('analysis_type', type);

  const { data } = await safeQuery(() => query);

  // Build structured response
  const analyses = {};
  for (const row of data || []) {
    analyses[row.analysis_type] = row.results;
  }
  res.json({ analyses });
});

// POST /facebook/analyze — re-run or run specific analysis
router.post('/facebook/analyze', async (req, res) => {
  const { analysisType } = req.body;

  // Load archive data
  const { data: archive } = await safeQuery((sb) =>
    sb.from('fb_archive').select('data_type, items').eq('account_id', req.accountId)
  );

  if (!archive || archive.length === 0) {
    return res.status(400).json({ error: 'No Facebook data imported yet' });
  }

  const files = {};
  for (const row of archive) {
    files[row.data_type] = row.items;
  }

  try {
    if (analysisType === 'story') {
      await runFbStoryAnalysis(req.accountId, files);
    } else {
      await runFbAnalysis(req.accountId, files);
    }
    res.json({ status: 'complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /facebook/data — delete all FB data
router.delete('/facebook/data', async (req, res) => {
  const supabase = getSupabase();
  await safeQuery((sb) => sb.from('fb_archive').delete().eq('account_id', req.accountId));
  await safeQuery((sb) => sb.from('fb_analysis').delete().eq('account_id', req.accountId));
  await safeQuery((sb) => sb.from('fb_import_status').delete().eq('account_id', req.accountId));
  res.json({ deleted: true });
});

// ── FB Analysis engine ──────────────────────────────────────
async function runFbAnalysis(accountId, files) {
  const supabase = getSupabase();
  const config = require('../../config');

  const posts = Array.isArray(files.posts) ? files.posts : [];
  const friends = Array.isArray(files.friends) ? files.friends : [];
  const removedFriends = Array.isArray(files.removed_friends) ? files.removed_friends : [];
  const likes = Array.isArray(files.likes) ? files.likes : [];
  const comments = Array.isArray(files.comments) ? files.comments : [];
  const profile = files.profile || {};
  const photos = Array.isArray(files.photos) ? files.photos : [];
  const messages = Array.isArray(files.messages) ? files.messages : [];
  const searches = Array.isArray(files.searches) ? files.searches : [];

  // 1. Post history analysis
  const postsByYear = {};
  const sentimentByYear = {};
  const wordFreq = {};

  for (const post of posts) {
    const date = new Date((post.timestamp || 0) * 1000);
    const year = date.getFullYear();
    if (!postsByYear[year]) postsByYear[year] = [];
    postsByYear[year].push(post);

    const text = post.data?.[0]?.post || post.title || '';
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    for (const w of words) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  }

  const postFrequency = Object.entries(postsByYear).map(([year, items]) => ({
    year: parseInt(year), count: items.length,
  })).sort((a, b) => a.year - b.year);

  const mostActiveYear = postFrequency.reduce((max, y) => y.count > (max?.count || 0) ? y : max, null);
  const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([word, count]) => ({ word, count }));

  await storeAnalysis(supabase, accountId, 'post_history', {
    totalPosts: posts.length,
    postFrequency,
    mostActiveYear,
    topWords,
    yearRange: postFrequency.length > 0 ? { start: postFrequency[0].year, end: postFrequency[postFrequency.length - 1].year } : null,
    yearsOnFacebook: postFrequency.length,
  });

  // 2. Friends analysis
  const friendsByYear = {};
  for (const f of friends) {
    const date = new Date((f.timestamp || 0) * 1000);
    const year = date.getFullYear();
    if (!friendsByYear[year]) friendsByYear[year] = 0;
    friendsByYear[year]++;
  }

  const friendTimeline = Object.entries(friendsByYear).map(([year, count]) => ({
    year: parseInt(year), added: count,
  })).sort((a, b) => a.year - b.year);

  // Cumulative
  let cumulative = 0;
  const friendsCumulative = friendTimeline.map(y => {
    cumulative += y.added;
    return { ...y, total: cumulative };
  });

  await storeAnalysis(supabase, accountId, 'friends', {
    totalFriends: friends.length,
    removedCount: removedFriends.length,
    friendTimeline: friendsCumulative,
    removedFriends: removedFriends.slice(0, 100).map(f => ({
      name: f.name, timestamp: f.timestamp,
    })),
    additionClusters: findClusters(friends.map(f => f.timestamp).filter(Boolean)),
  });

  // 3. Engagement analysis
  const interactors = {};
  for (const like of likes) {
    const author = like.data?.[0]?.reaction?.actor || 'unknown';
    if (!interactors[author]) interactors[author] = { likes: 0, comments: 0 };
    interactors[author].likes++;
  }
  for (const comment of comments) {
    const author = comment.data?.[0]?.comment?.author || 'unknown';
    if (!interactors[author]) interactors[author] = { likes: 0, comments: 0 };
    interactors[author].comments++;
  }

  const topInteractors = Object.entries(interactors)
    .map(([name, counts]) => ({ name, ...counts, total: counts.likes + counts.comments }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);

  await storeAnalysis(supabase, accountId, 'engagement', {
    totalLikes: likes.length,
    totalComments: comments.length,
    topInteractors,
  });

  // 4. Life events
  const lifeEvents = [];
  if (profile.life_events) {
    for (const event of profile.life_events) {
      lifeEvents.push({
        title: event.title,
        description: event.description,
        timestamp: event.timestamp,
        year: new Date((event.timestamp || 0) * 1000).getFullYear(),
      });
    }
  }

  // Extract events from posts mentioning keywords
  const eventKeywords = ['married', 'engaged', 'graduated', 'new job', 'moved to', 'born', 'died', 'promoted', 'retired', 'started at'];
  for (const post of posts.slice(0, 5000)) {
    const text = (post.data?.[0]?.post || post.title || '').toLowerCase();
    for (const keyword of eventKeywords) {
      if (text.includes(keyword)) {
        lifeEvents.push({
          title: keyword.charAt(0).toUpperCase() + keyword.slice(1),
          description: (post.data?.[0]?.post || post.title || '').slice(0, 200),
          timestamp: post.timestamp,
          year: new Date((post.timestamp || 0) * 1000).getFullYear(),
          source: 'post_detection',
        });
        break;
      }
    }
  }

  lifeEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  await storeAnalysis(supabase, accountId, 'life_events', {
    events: lifeEvents,
    totalEvents: lifeEvents.length,
  });

  // 5. Photo analysis
  const photosByYear = {};
  const photoLocations = [];
  for (const photo of photos) {
    const year = new Date((photo.creation_timestamp || 0) * 1000).getFullYear();
    if (!photosByYear[year]) photosByYear[year] = 0;
    photosByYear[year]++;

    if (photo.media_metadata?.photo_metadata?.latitude) {
      photoLocations.push({
        lat: photo.media_metadata.photo_metadata.latitude,
        lng: photo.media_metadata.photo_metadata.longitude,
        year,
      });
    }
  }

  await storeAnalysis(supabase, accountId, 'photos', {
    totalPhotos: photos.length,
    photosByYear: Object.entries(photosByYear).map(([year, count]) => ({ year: parseInt(year), count })).sort((a, b) => a.year - b.year),
    locations: photoLocations.slice(0, 500),
    locationCount: photoLocations.length,
  });

  // 6. Messages (optional)
  if (messages.length > 0) {
    const conversationStats = {};
    for (const thread of messages) {
      const participants = thread.participants?.map(p => p.name).join(', ') || 'Unknown';
      const msgCount = thread.messages?.length || 0;
      conversationStats[participants] = (conversationStats[participants] || 0) + msgCount;
    }

    const topConversations = Object.entries(conversationStats)
      .map(([partner, count]) => ({ partner, messageCount: count }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 20);

    await storeAnalysis(supabase, accountId, 'messages', {
      totalThreads: messages.length,
      totalMessages: Object.values(conversationStats).reduce((a, b) => a + b, 0),
      topConversations,
    });
  }

  // 7. Search history
  if (searches.length > 0) {
    const searchByYear = {};
    for (const s of searches) {
      const year = new Date((s.timestamp || 0) * 1000).getFullYear();
      if (!searchByYear[year]) searchByYear[year] = [];
      searchByYear[year].push(s.data?.[0]?.text || s.title || '');
    }

    await storeAnalysis(supabase, accountId, 'searches', {
      totalSearches: searches.length,
      searchesByYear: Object.entries(searchByYear).map(([year, items]) => ({
        year: parseInt(year), count: items.length, samples: items.slice(0, 10),
      })).sort((a, b) => a.year - b.year),
    });
  }

  // 8. Overview stats
  await storeAnalysis(supabase, accountId, 'overview', {
    totalPosts: posts.length,
    totalFriends: friends.length,
    totalPhotos: photos.length,
    totalLikes: likes.length,
    totalComments: comments.length,
    yearsOnFacebook: postFrequency.length,
    mostActiveYear: mostActiveYear?.year,
    mostActiveYearPosts: mostActiveYear?.count,
    profileName: profile.name?.full_name || profile.name,
    hasMessages: messages.length > 0,
  });

  // 9. Run Claude sentiment/story analysis
  await runFbSentimentAnalysis(accountId, posts, config);

  // Mark complete
  await safeQuery((sb) =>
    sb.from('fb_import_status').update({
      status: 'complete',
      progress: 100,
      completed_at: new Date().toISOString(),
    }).eq('account_id', accountId)
  );
}

async function runFbSentimentAnalysis(accountId, posts, config) {
  try {
    if (!config.llm?.anthropic?.apiKey) return;

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

    // Sample posts by year for sentiment
    const postsByYear = {};
    for (const post of posts) {
      const year = new Date((post.timestamp || 0) * 1000).getFullYear();
      if (!postsByYear[year]) postsByYear[year] = [];
      if (postsByYear[year].length < 20) {
        const text = post.data?.[0]?.post || post.title || '';
        if (text.length > 10) postsByYear[year].push(text.slice(0, 200));
      }
    }

    const yearSummaries = Object.entries(postsByYear)
      .sort(([a], [b]) => a - b)
      .map(([year, samples]) => `${year}: "${samples.slice(0, 5).join('" | "')}"`)
      .join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Analyze the emotional tone/sentiment of these Facebook posts grouped by year. For each year, rate sentiment 1-10 (1=very negative, 5=neutral, 10=very positive). Also identify the happiest period, most difficult period, and biggest tone shifts.

Posts by year:
${yearSummaries}

Return JSON:
{
  "sentimentByYear": [{"year": 2010, "score": 7, "tone": "upbeat, social"}],
  "happiestPeriod": {"years": "2012-2013", "reason": "..."},
  "hardestPeriod": {"years": "2016", "reason": "..."},
  "biggestShifts": [{"from": 2015, "to": 2016, "description": "..."}],
  "overallArc": "One sentence describing the emotional journey"
}`,
      }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const sentimentData = JSON.parse(jsonMatch[0]);
      await storeAnalysis(getSupabase(), accountId, 'sentiment', sentimentData);
    }
  } catch { /* sentiment analysis is optional */ }
}

async function runFbStoryAnalysis(accountId, files) {
  const config = require('../../config');
  if (!config.llm?.anthropic?.apiKey) throw new Error('Claude API key not configured');

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

  // Gather key stats
  const { data: analyses } = await safeQuery((sb) =>
    sb.from('fb_analysis').select('analysis_type, results').eq('account_id', accountId)
  );

  const stats = {};
  for (const a of analyses || []) {
    stats[a.analysis_type] = a.results;
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Write a 500-word "Your Facebook Story" narrative analysis. This should read like a personal retrospective — warm, insightful, covering patterns, changes, relationships, and interesting observations.

Stats:
- Posts: ${stats.overview?.totalPosts || 0} total, most active year: ${stats.overview?.mostActiveYear || '?'}
- Friends: ${stats.overview?.totalFriends || 0}
- Years on Facebook: ${stats.overview?.yearsOnFacebook || '?'}
- Posting frequency: ${JSON.stringify(stats.post_history?.postFrequency?.slice(0, 15) || [])}
- Top interactors: ${JSON.stringify(stats.engagement?.topInteractors?.slice(0, 5) || [])}
- Life events: ${JSON.stringify(stats.life_events?.events?.slice(0, 10) || [])}
- Sentiment journey: ${JSON.stringify(stats.sentiment?.sentimentByYear?.slice(0, 10) || [])}
- Friend addition clusters: ${JSON.stringify(stats.friends?.additionClusters?.slice(0, 5) || [])}
- Top words: ${JSON.stringify(stats.post_history?.topWords?.slice(0, 15) || [])}

Write as a personal narrative addressed to the user (second person "you"). Be warm and observational.`,
    }],
  });

  const storyText = response.content[0].text;
  await storeAnalysis(getSupabase(), accountId, 'story', {
    text: storyText,
    generatedAt: new Date().toISOString(),
  });
}

async function storeAnalysis(supabase, accountId, analysisType, results) {
  await supabase.from('fb_analysis').upsert({
    account_id: accountId,
    analysis_type: analysisType,
    results,
    computed_at: new Date().toISOString(),
  }, { onConflict: 'account_id,analysis_type' });
}

function findClusters(timestamps) {
  if (!timestamps || timestamps.length < 3) return [];
  const sorted = timestamps.sort((a, b) => a - b);
  const clusters = [];
  let currentCluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap < 604800) { // Within a week
      currentCluster.push(sorted[i]);
    } else {
      if (currentCluster.length >= 3) {
        clusters.push({
          start: new Date(currentCluster[0] * 1000).toISOString().slice(0, 10),
          end: new Date(currentCluster[currentCluster.length - 1] * 1000).toISOString().slice(0, 10),
          count: currentCluster.length,
        });
      }
      currentCluster = [sorted[i]];
    }
  }
  if (currentCluster.length >= 3) {
    clusters.push({
      start: new Date(currentCluster[0] * 1000).toISOString().slice(0, 10),
      end: new Date(currentCluster[currentCluster.length - 1] * 1000).toISOString().slice(0, 10),
      count: currentCluster.length,
    });
  }

  return clusters.sort((a, b) => b.count - a.count).slice(0, 10);
}

module.exports = router;
