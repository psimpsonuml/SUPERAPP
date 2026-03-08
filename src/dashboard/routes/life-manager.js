const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── REMINDERS / ROUTINES ────────────────────────────────────

// GET /api/life/reminders — all reminders with today's completion status
router.get('/reminders', async (req, res) => {
  try {
    const accountId = req.accountId;
    const today = new Date().toISOString().split('T')[0];

    const { data: reminders } = await safeQuery((sb) =>
      sb.from('reminders')
        .select('*')
        .eq('account_id', accountId)
        .order('time_of_day', { ascending: true })
    );

    // Get today's completions
    const { data: todayCompletions } = await safeQuery((sb) =>
      sb.from('reminder_completions')
        .select('reminder_id, status')
        .eq('account_id', accountId)
        .eq('completed_date', today)
    );

    const completionMap = {};
    (todayCompletions || []).forEach(c => { completionMap[c.reminder_id] = c.status; });

    // Annotate reminders with today's status and whether it's due today
    const now = new Date();
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayDay = dayNames[now.getDay()];

    const enriched = (reminders || []).map(r => {
      let dueToday = false;
      if (r.frequency === 'daily') dueToday = true;
      else if (r.frequency === 'specific_days') {
        const days = Array.isArray(r.days_of_week) ? r.days_of_week : [];
        dueToday = days.includes(todayDay);
      } else if (r.frequency === 'weekly') {
        // Due on the same day of week as created
        const createdDay = dayNames[new Date(r.created_at).getDay()];
        dueToday = todayDay === createdDay;
      } else if (r.frequency === 'custom' && r.custom_interval_days) {
        const created = new Date(r.created_at);
        const daysSince = Math.floor((now - created) / 86400000);
        dueToday = daysSince % r.custom_interval_days === 0;
      }

      // Check if missed (past the time + 30 min grace)
      const [h, m] = (r.time_of_day || '09:00').split(':').map(Number);
      const dueTime = new Date(now);
      dueTime.setHours(h, m + 30, 0, 0); // 30 min grace
      const isPastDue = now > dueTime;

      return {
        ...r,
        due_today: dueToday && r.active,
        today_status: completionMap[r.id] || (dueToday && isPastDue && r.active ? 'missed' : null),
      };
    });

    res.json({ reminders: enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/life/reminders — create a new reminder
router.post('/reminders', async (req, res) => {
  const { name, frequency, days_of_week, custom_interval_days, time_of_day, category } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('reminders').insert({
      account_id: req.accountId,
      name,
      frequency: frequency || 'daily',
      days_of_week: days_of_week || [],
      custom_interval_days: custom_interval_days || null,
      time_of_day: time_of_day || '09:00',
      category: category || 'personal',
      active: true,
      streak: 0,
      longest_streak: 0,
    }).select().single();
    if (error) throw error;
    res.json({ reminder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/life/reminders/:id — update a reminder
router.patch('/reminders/:id', async (req, res) => {
  const { name, frequency, days_of_week, custom_interval_days, time_of_day, category, active } = req.body;
  try {
    const supabase = getSupabase();
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (frequency !== undefined) updates.frequency = frequency;
    if (days_of_week !== undefined) updates.days_of_week = days_of_week;
    if (custom_interval_days !== undefined) updates.custom_interval_days = custom_interval_days;
    if (time_of_day !== undefined) updates.time_of_day = time_of_day;
    if (category !== undefined) updates.category = category;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabase.from('reminders')
      .update(updates)
      .eq('id', req.params.id)
      .eq('account_id', req.accountId)
      .select().single();
    if (error) throw error;
    res.json({ reminder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/life/reminders/:id
router.delete('/reminders/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    await supabase.from('reminders')
      .delete()
      .eq('id', req.params.id)
      .eq('account_id', req.accountId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/life/reminders/:id/complete — mark a reminder complete for today
router.post('/reminders/:id/complete', async (req, res) => {
  try {
    const supabase = getSupabase();
    const accountId = req.accountId;
    const reminderId = req.params.id;
    const today = new Date().toISOString().split('T')[0];

    // Get current reminder
    const { data: reminder, error: rErr } = await supabase.from('reminders')
      .select('*')
      .eq('id', reminderId)
      .eq('account_id', accountId)
      .single();
    if (rErr || !reminder) return res.status(404).json({ error: 'Reminder not found' });

    // Upsert completion for today
    const { error: cErr } = await supabase.from('reminder_completions').upsert({
      account_id: accountId,
      reminder_id: reminderId,
      completed_at: new Date().toISOString(),
      completed_date: today,
      status: 'completed',
    }, { onConflict: 'reminder_id,completed_date' });
    if (cErr) throw cErr;

    // Calculate streak: count consecutive days completed backwards from today
    const { data: completions } = await supabase.from('reminder_completions')
      .select('completed_date')
      .eq('reminder_id', reminderId)
      .eq('account_id', accountId)
      .eq('status', 'completed')
      .order('completed_date', { ascending: false })
      .limit(365);

    let streak = 0;
    if (completions && completions.length > 0) {
      const dates = completions.map(c => c.completed_date);
      const checkDate = new Date(today);
      for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (dates.includes(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const longestStreak = Math.max(streak, reminder.longest_streak || 0);

    // Update reminder streak
    await supabase.from('reminders')
      .update({
        streak,
        longest_streak: longestStreak,
        last_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reminderId);

    res.json({
      completion: { reminder_id: reminderId, date: today, status: 'completed' },
      streak,
      longest_streak: longestStreak,
      milestone: streak === 7 ? '7_days' : streak === 30 ? '30_days' : streak === 100 ? '100_days' : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/life/reminders/:id/completions — completion history for streaks
router.get('/reminders/:id/completions', async (req, res) => {
  const days = parseInt(req.query.days) || 90;
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  const { data } = await safeQuery((sb) =>
    sb.from('reminder_completions')
      .select('completed_date, status')
      .eq('reminder_id', req.params.id)
      .eq('account_id', req.accountId)
      .gte('completed_date', since)
      .order('completed_date', { ascending: true })
  );
  res.json({ completions: data || [] });
});

// GET /api/life/streaks — aggregate streak data for all reminders + contribution grid
router.get('/streaks', async (req, res) => {
  try {
    const accountId = req.accountId;

    // Get all active reminders with streak info
    const { data: reminders } = await safeQuery((sb) =>
      sb.from('reminders')
        .select('id, name, category, streak, longest_streak, active, frequency')
        .eq('account_id', accountId)
        .eq('active', true)
        .order('streak', { ascending: false })
    );

    // Get completions for last 90 days for contribution grid
    const since = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const { data: completions } = await safeQuery((sb) =>
      sb.from('reminder_completions')
        .select('completed_date, status, reminder_id')
        .eq('account_id', accountId)
        .gte('completed_date', since)
        .order('completed_date', { ascending: true })
    );

    // Build contribution grid: date → count of completions
    const grid = {};
    (completions || []).forEach(c => {
      if (c.status === 'completed') {
        grid[c.completed_date] = (grid[c.completed_date] || 0) + 1;
      }
    });

    // Total completion rate
    const totalCompleted = (completions || []).filter(c => c.status === 'completed').length;
    const totalDays = 90;
    const activeCount = (reminders || []).length;
    const totalPossible = totalDays * activeCount;
    const completionRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

    res.json({
      reminders: reminders || [],
      grid,
      total_completed: totalCompleted,
      completion_rate: completionRate,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/life/upcoming — reminders for the next 7 days
router.get('/upcoming', async (req, res) => {
  try {
    const accountId = req.accountId;
    const { data: reminders } = await safeQuery((sb) =>
      sb.from('reminders')
        .select('*')
        .eq('account_id', accountId)
        .eq('active', true)
    );

    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const upcoming = [];

    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      const dayName = dayNames[date.getDay()];
      const dateStr = date.toISOString().split('T')[0];

      const dayReminders = (reminders || []).filter(r => {
        if (r.frequency === 'daily') return true;
        if (r.frequency === 'specific_days') {
          const days = Array.isArray(r.days_of_week) ? r.days_of_week : [];
          return days.includes(dayName);
        }
        if (r.frequency === 'weekly') {
          const createdDay = dayNames[new Date(r.created_at).getDay()];
          return dayName === createdDay;
        }
        if (r.frequency === 'custom' && r.custom_interval_days) {
          const daysSince = Math.floor((date - new Date(r.created_at)) / 86400000);
          return daysSince >= 0 && daysSince % r.custom_interval_days === 0;
        }
        return false;
      });

      upcoming.push({
        date: dateStr,
        day: dayName,
        label: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : dayName.charAt(0).toUpperCase() + dayName.slice(1),
        reminders: dayReminders.map(r => ({ id: r.id, name: r.name, time: r.time_of_day, category: r.category })),
      });
    }

    res.json({ upcoming });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── FAMILY LOG ──────────────────────────────────────────────

// GET /api/life/family — entries with search/filter
router.get('/family', async (req, res) => {
  try {
    const { child, category, month, search, limit = 50 } = req.query;
    const accountId = req.accountId;

    let query = getSupabase().from('family_log')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (child) query = query.eq('child_tag', child);
    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('entry_text', `%${search}%`);
    if (month) {
      // month format: "2026-03"
      const start = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const endDate = new Date(y, m, 0);
      const end = endDate.toISOString().split('T')[0];
      query = query.gte('entry_date', start).lte('entry_date', end);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get unique child names for filter options
    const { data: children } = await safeQuery((sb) =>
      sb.from('family_log')
        .select('child_tag')
        .eq('account_id', accountId)
        .not('child_tag', 'is', null)
    );
    const uniqueChildren = [...new Set((children || []).map(c => c.child_tag).filter(Boolean))];

    res.json({ entries: data || [], children: uniqueChildren });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/life/family — add entry
router.post('/family', async (req, res) => {
  const { entry_text, photo_url, child_tag, category } = req.body;
  if (!entry_text) return res.status(400).json({ error: 'entry_text required' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('family_log').insert({
      account_id: req.accountId,
      entry_text,
      photo_url: photo_url || null,
      child_tag: child_tag || null,
      category: category || 'general',
      entry_date: new Date().toISOString().split('T')[0],
    }).select().single();
    if (error) throw error;
    res.json({ entry: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/life/family/summary?month=2026-03 — monthly summary
router.get('/family/summary', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month parameter required (e.g. 2026-03)' });

    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const endDate = new Date(y, m, 0);
    const end = endDate.toISOString().split('T')[0];
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const { data, error } = await getSupabase().from('family_log')
      .select('*')
      .eq('account_id', req.accountId)
      .gte('entry_date', start)
      .lte('entry_date', end)
      .order('entry_date', { ascending: true });
    if (error) throw error;

    const entries = data || [];

    // Group by category
    const byCategory = {};
    entries.forEach(e => {
      const cat = e.category || 'general';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(e);
    });

    // Group by child
    const byChild = {};
    entries.forEach(e => {
      if (e.child_tag) {
        if (!byChild[e.child_tag]) byChild[e.child_tag] = [];
        byChild[e.child_tag].push(e);
      }
    });

    res.json({
      month: `${monthNames[m]} ${y}`,
      total_entries: entries.length,
      entries,
      by_category: byCategory,
      by_child: byChild,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
