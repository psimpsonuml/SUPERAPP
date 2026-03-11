const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

function safeQuery(fn) {
  return async (req, res) => {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ error: 'Database not configured' });
    }
    try {
      await fn(req, res);
    } catch (err) {
      console.error('Goals route error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  };
}

// GET / — list goals with filters: category, status. Include milestone counts.
router.get('/', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const accountId = req.query.account_id;
  const { category, status } = req.query;

  if (!accountId) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  let query = supabase
    .from('goals')
    .select('*, goal_milestones(id, completed)')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  const goals = (data || []).map(g => {
    const milestones = g.goal_milestones || [];
    return {
      ...g,
      milestone_total: milestones.length,
      milestone_completed: milestones.filter(m => m.completed).length,
      goal_milestones: undefined
    };
  });

  res.json(goals);
}));

// GET /timeline — all goals and milestones plotted on timeline (sorted by date)
router.get('/timeline', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const accountId = req.query.account_id;

  if (!accountId) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select('id, title, category, target_date, status, metric_target, metric_current')
    .eq('account_id', accountId)
    .not('target_date', 'is', null)
    .order('target_date', { ascending: true });

  if (goalsError) throw goalsError;

  const goalIds = (goals || []).map(g => g.id);

  let milestones = [];
  if (goalIds.length > 0) {
    const { data: msData, error: msError } = await supabase
      .from('goal_milestones')
      .select('id, goal_id, title, target_date, completed, completed_at')
      .in('goal_id', goalIds)
      .not('target_date', 'is', null)
      .order('target_date', { ascending: true });

    if (msError) throw msError;
    milestones = msData || [];
  }

  const timelineItems = [];

  (goals || []).forEach(g => {
    timelineItems.push({
      type: 'goal',
      id: g.id,
      title: g.title,
      category: g.category,
      date: g.target_date,
      status: g.status,
      metric_target: g.metric_target,
      metric_current: g.metric_current
    });
  });

  milestones.forEach(m => {
    const parentGoal = (goals || []).find(g => g.id === m.goal_id);
    timelineItems.push({
      type: 'milestone',
      id: m.id,
      goal_id: m.goal_id,
      title: m.title,
      category: parentGoal ? parentGoal.category : 'other',
      date: m.target_date,
      completed: m.completed,
      completed_at: m.completed_at
    });
  });

  timelineItems.sort((a, b) => new Date(a.date) - new Date(b.date));

  res.json(timelineItems);
}));

// GET /stats — stats: total active, completed, by category, completion rate
router.get('/stats', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const accountId = req.query.account_id;

  if (!accountId) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  const { data: allGoals, error } = await supabase
    .from('goals')
    .select('id, status, category, created_at')
    .eq('account_id', accountId);

  if (error) throw error;

  const goals = allGoals || [];
  const totalActive = goals.filter(g => g.status === 'active').length;
  const totalCompleted = goals.filter(g => g.status === 'completed').length;
  const totalAbandoned = goals.filter(g => g.status === 'abandoned').length;
  const totalPaused = goals.filter(g => g.status === 'paused').length;

  const currentYear = new Date().getFullYear();
  const completedThisYear = goals.filter(g => {
    if (g.status !== 'completed') return false;
    return true;
  }).length;

  const byCategory = {};
  goals.forEach(g => {
    if (!byCategory[g.category]) {
      byCategory[g.category] = { total: 0, active: 0, completed: 0 };
    }
    byCategory[g.category].total++;
    if (g.status === 'active') byCategory[g.category].active++;
    if (g.status === 'completed') byCategory[g.category].completed++;
  });

  const totalFinished = totalCompleted + totalAbandoned;
  const completionRate = totalFinished > 0
    ? Math.round((totalCompleted / totalFinished) * 100)
    : 0;

  res.json({
    total: goals.length,
    total_active: totalActive,
    total_completed: totalCompleted,
    total_paused: totalPaused,
    total_abandoned: totalAbandoned,
    completed_this_year: completedThisYear,
    completion_rate: completionRate,
    by_category: byCategory
  });
}));

// GET /:id — goal detail with milestones
router.get('/:id', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const { id } = req.params;

  const { data, error } = await supabase
    .from('goals')
    .select('*, goal_milestones(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Goal not found' });

  res.json(data);
}));

// POST / — create goal
router.post('/', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const { account_id, title, description, category, target_date, metric_label, metric_target, milestones } = req.body;

  if (!account_id || !title) {
    return res.status(400).json({ error: 'account_id and title are required' });
  }

  const { data: goal, error } = await supabase
    .from('goals')
    .insert({
      account_id,
      title,
      description: description || '',
      category: category || 'other',
      target_date: target_date || null,
      metric_label: metric_label || '',
      metric_target: metric_target || null,
      metric_current: 0
    })
    .select()
    .single();

  if (error) throw error;

  if (milestones && Array.isArray(milestones) && milestones.length > 0) {
    const milestoneRows = milestones.map(m => ({
      account_id,
      goal_id: goal.id,
      title: m.title,
      target_date: m.target_date || null
    }));

    const { error: msError } = await supabase
      .from('goal_milestones')
      .insert(milestoneRows);

    if (msError) throw msError;
  }

  const { data: full, error: fetchError } = await supabase
    .from('goals')
    .select('*, goal_milestones(*)')
    .eq('id', goal.id)
    .single();

  if (fetchError) throw fetchError;

  res.status(201).json(full);
}));

// PUT /:id — update goal (status, progress, etc.)
router.put('/:id', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const { id } = req.params;
  const updates = {};

  const allowedFields = ['title', 'description', 'category', 'target_date', 'metric_label', 'metric_target', 'metric_current', 'status'];
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', id)
    .select('*, goal_milestones(*)')
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Goal not found' });

  res.json(data);
}));

// DELETE /:id — delete goal
router.delete('/:id', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const { id } = req.params;

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id);

  if (error) throw error;

  res.json({ success: true });
}));

// POST /:id/milestones — add milestone
router.post('/:id/milestones', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const { id } = req.params;
  const { account_id, title, target_date } = req.body;

  if (!account_id || !title) {
    return res.status(400).json({ error: 'account_id and title are required' });
  }

  const { data, error } = await supabase
    .from('goal_milestones')
    .insert({
      account_id,
      goal_id: id,
      title,
      target_date: target_date || null
    })
    .select()
    .single();

  if (error) throw error;

  res.status(201).json(data);
}));

// PUT /milestones/:mid — update milestone (complete it)
router.put('/milestones/:mid', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const { mid } = req.params;
  const updates = {};

  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.target_date !== undefined) updates.target_date = req.body.target_date;
  if (req.body.completed !== undefined) {
    updates.completed = req.body.completed;
    updates.completed_at = req.body.completed ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from('goal_milestones')
    .update(updates)
    .eq('id', mid)
    .select()
    .single();

  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Milestone not found' });

  res.json(data);
}));

// DELETE /milestones/:mid — delete milestone
router.delete('/milestones/:mid', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const { mid } = req.params;

  const { error } = await supabase
    .from('goal_milestones')
    .delete()
    .eq('id', mid);

  if (error) throw error;

  res.json({ success: true });
}));

// POST /weekly-checkin — save weekly progress notes for active goals
router.post('/weekly-checkin', safeQuery(async (req, res) => {
  const supabase = getSupabase();
  const { account_id, checkins } = req.body;

  if (!account_id || !checkins || !Array.isArray(checkins)) {
    return res.status(400).json({ error: 'account_id and checkins array are required' });
  }

  const updates = [];
  for (const checkin of checkins) {
    if (!checkin.goal_id) continue;

    const updateData = { updated_at: new Date().toISOString() };
    if (checkin.metric_current !== undefined) {
      updateData.metric_current = checkin.metric_current;
    }
    if (checkin.notes) {
      const { data: existing } = await supabase
        .from('goals')
        .select('description')
        .eq('id', checkin.goal_id)
        .single();

      const weekLabel = new Date().toISOString().slice(0, 10);
      const noteEntry = `\n[${weekLabel}] ${checkin.notes}`;
      updateData.description = (existing?.description || '') + noteEntry;
    }

    const { data, error } = await supabase
      .from('goals')
      .update(updateData)
      .eq('id', checkin.goal_id)
      .eq('account_id', account_id)
      .select()
      .single();

    if (error) throw error;
    if (data) updates.push(data);
  }

  res.json({ updated: updates.length, goals: updates });
}));

module.exports = router;
