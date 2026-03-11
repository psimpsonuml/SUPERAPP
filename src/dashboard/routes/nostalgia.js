const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── HELPERS ──────────────────────────────────────────────────

function getMonthDay(dateStr) {
  const d = new Date(dateStr);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

function yearsAgo(year) {
  return new Date().getFullYear() - year;
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    startMonth: mon.getMonth() + 1,
    startDay: mon.getDate(),
    endMonth: sun.getMonth() + 1,
    endDay: sun.getDate(),
  };
}

// ── GET /today — "On This Day" memories ─────────────────────

router.get('/today', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const { data, error } = await safeQuery(sb =>
      sb.from('nostalgia_cache')
        .select('*')
        .eq('account_id', accountId)
        .order('year', { ascending: true })
    );

    if (error) return res.status(500).json({ error: error.message });

    // Filter to matching month+day
    const matches = (data || []).filter(row => {
      const md = getMonthDay(row.memory_date);
      return md.month === month && md.day === day;
    });

    // Group by year
    const grouped = {};
    matches.forEach(m => {
      if (!grouped[m.year]) grouped[m.year] = [];
      grouped[m.year].push({ ...m, years_ago: yearsAgo(m.year) });
    });

    res.json({ date: now.toISOString().slice(0, 10), memories: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /date/:date — memories for a specific date ──────────

router.get('/date/:date', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const targetDate = req.params.date; // YYYY-MM-DD
    const parsed = new Date(targetDate);
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();

    const { data, error } = await safeQuery(sb =>
      sb.from('nostalgia_cache')
        .select('*')
        .eq('account_id', accountId)
        .order('year', { ascending: true })
    );

    if (error) return res.status(500).json({ error: error.message });

    const matches = (data || []).filter(row => {
      const md = getMonthDay(row.memory_date);
      return md.month === month && md.day === day;
    });

    const grouped = {};
    matches.forEach(m => {
      if (!grouped[m.year]) grouped[m.year] = [];
      grouped[m.year].push({ ...m, years_ago: yearsAgo(m.year) });
    });

    res.json({ date: targetDate, memories: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /week — this week in history ────────────────────────

router.get('/week', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const range = weekRange();

    const { data, error } = await safeQuery(sb =>
      sb.from('nostalgia_cache')
        .select('*')
        .eq('account_id', accountId)
        .order('memory_date', { ascending: true })
    );

    if (error) return res.status(500).json({ error: error.message });

    // Filter to current week's month+day range
    const matches = (data || []).filter(row => {
      const md = getMonthDay(row.memory_date);
      const dayOfYear = md.month * 100 + md.day;
      const startDoy = range.startMonth * 100 + range.startDay;
      const endDoy = range.endMonth * 100 + range.endDay;

      if (startDoy <= endDoy) {
        return dayOfYear >= startDoy && dayOfYear <= endDoy;
      }
      // Week spans year boundary (rare for month+day)
      return dayOfYear >= startDoy || dayOfYear <= endDoy;
    });

    matches.forEach(m => { m.years_ago = yearsAgo(m.year); });

    res.json({ range, memories: matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /calendar — dates with memories (dot indicators) ────

router.get('/calendar', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const { data, error } = await safeQuery(sb =>
      sb.from('nostalgia_cache')
        .select('memory_date, source_module')
        .eq('account_id', accountId)
    );

    if (error) return res.status(500).json({ error: error.message });

    // Find which days of the requested month have memories (any year)
    const daysWithMemories = {};
    (data || []).forEach(row => {
      const md = getMonthDay(row.memory_date);
      if (md.month === month) {
        if (!daysWithMemories[md.day]) daysWithMemories[md.day] = new Set();
        daysWithMemories[md.day].add(row.source_module);
      }
    });

    // Convert sets to arrays
    const days = {};
    Object.entries(daysWithMemories).forEach(([day, modules]) => {
      days[day] = Array.from(modules);
    });

    res.json({ month, year, days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /browse — paginated browse with filters ─────────────

router.get('/browse', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sourceModule = req.query.source_module;
    const year = req.query.year ? parseInt(req.query.year) : null;
    const offset = (page - 1) * limit;

    let query = getSupabase()
      .from('nostalgia_cache')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('memory_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (sourceModule) query = query.eq('source_module', sourceModule);
    if (year) query = query.eq('year', year);

    if (!isSupabaseConfigured()) {
      return res.json({ memories: [], total: 0, page, limit });
    }

    const { data, error, count } = await query;

    if (error) return res.status(500).json({ error: error.message });

    const memories = (data || []).map(m => ({ ...m, years_ago: yearsAgo(m.year) }));

    res.json({ memories, total: count || 0, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /rebuild — rebuild cache from source tables ────────

router.post('/rebuild', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    // Source table scanning stubs — in production these would query
    // facebook_data, journal_entries, entertainment_ratings, book_ratings,
    // music_ratings, goal_milestones, etc. and upsert into nostalgia_cache.

    const sampleMemories = [
      { source_module: 'facebook', memory_date: '2019-03-11', content_preview: 'Shared a photo from spring break road trip', year: 2019 },
      { source_module: 'journal', memory_date: '2021-03-11', content_preview: 'Reflected on one year of remote work — grateful for the flexibility', year: 2021 },
      { source_module: 'entertainment', memory_date: '2020-03-11', content_preview: 'Watched Parasite — absolutely blown away', year: 2020 },
      { source_module: 'books', memory_date: '2022-03-11', content_preview: 'Finished reading "Project Hail Mary" by Andy Weir', year: 2022 },
      { source_module: 'music', memory_date: '2018-03-11', content_preview: 'Discovered Khruangbin — obsessed with "Maria También"', year: 2018 },
      { source_module: 'goals', memory_date: '2023-03-11', content_preview: 'Hit 100-day meditation streak milestone', year: 2023 },
      { source_module: 'family', memory_date: '2017-03-11', content_preview: 'Family dinner for Mom\'s birthday — homemade lasagna', year: 2017 },
      { source_module: 'learning', memory_date: '2024-03-11', content_preview: 'Completed AWS Solutions Architect certification', year: 2024 },
      { source_module: 'facebook', memory_date: '2016-06-15', content_preview: 'Graduated from university! Best day ever.', year: 2016 },
      { source_module: 'journal', memory_date: '2020-07-04', content_preview: 'Quiet 4th of July at home — watched fireworks from the roof', year: 2020 },
      { source_module: 'entertainment', memory_date: '2023-12-25', content_preview: 'Christmas movie marathon: Die Hard, Home Alone, Elf', year: 2023 },
      { source_module: 'books', memory_date: '2021-09-01', content_preview: 'Started reading "Dune" before the movie came out', year: 2021 },
      { source_module: 'music', memory_date: '2022-08-20', content_preview: 'First concert post-pandemic — Tame Impala was unreal', year: 2022 },
      { source_module: 'goals', memory_date: '2019-01-01', content_preview: 'Set New Year resolution: run a half marathon', year: 2019 },
      { source_module: 'goals', memory_date: '2019-05-12', content_preview: 'Finished my first half marathon! 1:58:32', year: 2019 },
    ];

    const rows = sampleMemories.map(m => ({
      account_id: accountId,
      source_module: m.source_module,
      source_id: m.source_module + '_' + m.year + '_' + m.memory_date,
      memory_date: m.memory_date,
      content_preview: m.content_preview,
      year: m.year,
      metadata_json: {},
    }));

    const { data, error } = await safeQuery(sb =>
      sb.from('nostalgia_cache')
        .upsert(rows, { onConflict: 'account_id,source_module,source_id,year' })
        .select()
    );

    if (error) return res.status(500).json({ error: error.message });

    res.json({ rebuilt: true, count: (data || rows).length, message: 'Cache rebuilt with sample data' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /share — generate shareable text/card ──────────────

router.post('/share', async (req, res) => {
  try {
    const { memory_id, format = 'text' } = req.body;
    if (!memory_id) return res.status(400).json({ error: 'memory_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('nostalgia_cache')
        .select('*')
        .eq('id', memory_id)
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Memory not found' });

    const ago = yearsAgo(data.year);
    const dateLabel = new Date(data.memory_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const shareText = `📅 On This Day, ${ago} year${ago !== 1 ? 's' : ''} ago (${dateLabel}):\n\n${data.content_preview}\n\n— via BeaconOps Nostalgia Engine`;

    const shareCard = {
      title: `${ago} Year${ago !== 1 ? 's' : ''} Ago Today`,
      date: dateLabel,
      content: data.content_preview,
      source: data.source_module,
      year: data.year,
      years_ago: ago,
    };

    res.json({
      text: shareText,
      card: shareCard,
      format,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stats — memory statistics ──────────────────────────

router.get('/stats', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('nostalgia_cache')
        .select('source_module, year')
        .eq('account_id', accountId)
    );

    if (error) return res.status(500).json({ error: error.message });

    const rows = data || [];
    const total = rows.length;

    // Count by module
    const byModule = {};
    const yearsSet = new Set();
    rows.forEach(r => {
      byModule[r.source_module] = (byModule[r.source_module] || 0) + 1;
      yearsSet.add(r.year);
    });

    const years = Array.from(yearsSet).sort();

    res.json({
      total,
      by_module: byModule,
      years_covered: years.length,
      years,
      oldest_year: years[0] || null,
      newest_year: years[years.length - 1] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
