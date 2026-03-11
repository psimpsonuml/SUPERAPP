const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── GET / — list events with filters, paginated ─────────────
router.get('/', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { data, error } = await safeQuery(sb => {
      let q = sb.from('live_events')
        .select('*')
        .eq('account_id', accountId)
        .order('event_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (req.query.type) q = q.eq('event_type', req.query.type);
      if (req.query.venue) q = q.ilike('venue', `%${req.query.venue}%`);
      if (req.query.city) q = q.ilike('city', `%${req.query.city}%`);
      if (req.query.year) {
        q = q.gte('event_date', `${req.query.year}-01-01`)
             .lte('event_date', `${req.query.year}-12-31`);
      }
      if (req.query.date_from) q = q.gte('event_date', req.query.date_from);
      if (req.query.date_to) q = q.lte('event_date', req.query.date_to);

      return q;
    });

    if (error) return res.status(500).json({ error: error.message });

    // Get total count
    const { data: countData } = await safeQuery(sb => {
      let q = sb.from('live_events')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);
      if (req.query.type) q = q.eq('event_type', req.query.type);
      if (req.query.venue) q = q.ilike('venue', `%${req.query.venue}%`);
      if (req.query.city) q = q.ilike('city', `%${req.query.city}%`);
      if (req.query.year) {
        q = q.gte('event_date', `${req.query.year}-01-01`)
             .lte('event_date', `${req.query.year}-12-31`);
      }
      if (req.query.date_from) q = q.gte('event_date', req.query.date_from);
      if (req.query.date_to) q = q.lte('event_date', req.query.date_to);
      return q;
    });

    res.json({ events: data || [], page, limit, total: countData?.length || (data || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /upcoming — future events with countdown ────────────
router.get('/upcoming', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await safeQuery(sb =>
      sb.from('live_events')
        .select('*')
        .eq('account_id', accountId)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
    );

    if (error) return res.status(500).json({ error: error.message });

    const now = Date.now();
    const events = (data || []).map(ev => {
      const eventTime = new Date(ev.event_date).getTime();
      const diffMs = eventTime - now;
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return { ...ev, countdown_days: Math.max(0, days) };
    });

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stats — aggregate statistics ───────────────────────
router.get('/stats', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('live_events')
        .select('*')
        .eq('account_id', accountId)
        .order('event_date', { ascending: false })
    );

    if (error) return res.status(500).json({ error: error.message });

    const events = data || [];
    const totalEvents = events.length;

    // Events per year
    const perYear = {};
    events.forEach(ev => {
      const y = ev.event_date ? ev.event_date.substring(0, 4) : 'Unknown';
      perYear[y] = (perYear[y] || 0) + 1;
    });

    // Most visited venue
    const venueCounts = {};
    events.forEach(ev => {
      if (ev.venue) venueCounts[ev.venue] = (venueCounts[ev.venue] || 0) + 1;
    });
    const venuesSorted = Object.entries(venueCounts).sort((a, b) => b[1] - a[1]);

    // Most seen artist/team (from event_name)
    const nameCounts = {};
    events.forEach(ev => {
      if (ev.event_name) nameCounts[ev.event_name] = (nameCounts[ev.event_name] || 0) + 1;
    });
    const namesSorted = Object.entries(nameCounts).sort((a, b) => b[1] - a[1]);

    // Total spent
    const totalSpent = events.reduce((sum, ev) => sum + (parseFloat(ev.cost) || 0), 0);

    // Average rating
    const rated = events.filter(ev => ev.rating != null);
    const avgRating = rated.length > 0
      ? rated.reduce((sum, ev) => sum + ev.rating, 0) / rated.length
      : null;

    // Type breakdown
    const typeBreakdown = {};
    events.forEach(ev => {
      const t = ev.event_type || 'other';
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    });

    res.json({
      totalEvents,
      eventsPerYear: perYear,
      topVenues: venuesSorted.slice(0, 10).map(([venue, count]) => ({ venue, count })),
      topNames: namesSorted.slice(0, 10).map(([name, count]) => ({ name, count })),
      totalSpent: Math.round(totalSpent * 100) / 100,
      avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      typeBreakdown,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /map — events with lat/lng for map plotting ─────────
router.get('/map', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('live_events')
        .select('id, event_name, event_type, venue, city, latitude, longitude, event_date, rating')
        .eq('account_id', accountId)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('event_date', { ascending: false })
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ events: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /history — events grouped by year for timeline ──────
router.get('/history', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('live_events')
        .select('*')
        .eq('account_id', accountId)
        .order('event_date', { ascending: false })
    );

    if (error) return res.status(500).json({ error: error.message });

    const grouped = {};
    (data || []).forEach(ev => {
      const year = ev.event_date ? ev.event_date.substring(0, 4) : 'Unknown';
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(ev);
    });

    // Sort years descending
    const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    const timeline = years.map(year => ({ year, events: grouped[year] }));

    res.json({ timeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /:id — event detail ─────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('live_events')
        .select('*')
        .eq('id', req.params.id)
        .eq('account_id', accountId)
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Event not found' });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST / — add event ──────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });
    if (!req.body.event_name) return res.status(400).json({ error: 'event_name required' });
    if (!req.body.event_date) return res.status(400).json({ error: 'event_date required' });

    const row = {
      account_id: accountId,
      event_name: req.body.event_name,
      event_type: req.body.event_type || 'concert',
      venue: req.body.venue || '',
      city: req.body.city || '',
      latitude: req.body.latitude || null,
      longitude: req.body.longitude || null,
      event_date: req.body.event_date,
      companions: req.body.companions || '',
      cost: req.body.cost != null ? req.body.cost : null,
      rating: req.body.rating != null ? req.body.rating : null,
      notes: req.body.notes || '',
      photos_json: req.body.photos_json || '[]',
      source_cascade_type: req.body.source_cascade_type || '',
      cascade_person: req.body.cascade_person || '',
    };

    const { data, error } = await safeQuery(sb =>
      sb.from('live_events')
        .insert(row)
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /:id — update event ─────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const updates = {};
    const fields = [
      'event_name', 'event_type', 'venue', 'city', 'latitude', 'longitude',
      'event_date', 'companions', 'cost', 'rating', 'notes', 'photos_json',
      'source_cascade_type', 'cascade_person',
    ];
    fields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const { data, error } = await safeQuery(sb =>
      sb.from('live_events')
        .update(updates)
        .eq('id', req.params.id)
        .eq('account_id', accountId)
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Event not found' });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id — remove event ──────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { error } = await safeQuery(sb =>
      sb.from('live_events')
        .delete()
        .eq('id', req.params.id)
        .eq('account_id', accountId)
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /share — generate shareable event history ──────────
router.post('/share', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('live_events')
        .select('event_name, event_type, venue, city, event_date, rating')
        .eq('account_id', accountId)
        .order('event_date', { ascending: false })
    );

    if (error) return res.status(500).json({ error: error.message });

    const events = data || [];
    const shareId = `events-${accountId.substring(0, 8)}-${Date.now()}`;

    // Build a summary for sharing
    const totalEvents = events.length;
    const cities = [...new Set(events.map(e => e.city).filter(Boolean))];
    const venues = [...new Set(events.map(e => e.venue).filter(Boolean))];
    const years = [...new Set(events.map(e => e.event_date?.substring(0, 4)).filter(Boolean))].sort();

    res.json({
      shareId,
      summary: {
        totalEvents,
        citiesVisited: cities.length,
        uniqueVenues: venues.length,
        yearRange: years.length > 0 ? `${years[0]}-${years[years.length - 1]}` : '',
        topCities: cities.slice(0, 5),
      },
      events: events.slice(0, 50), // limit shared events
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
