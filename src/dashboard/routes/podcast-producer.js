const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); } catch (err) { return { data: [], error: err }; }
}

const SERIES_CONFIG = {
  what_if: {
    product: 'ChronoStates',
    name: 'What If?',
    description: 'Weekly alternate history deep dives',
    voice: 'dramatic_narrator',
    duration: '10-15 min'
  },
  compliance_corner: {
    product: 'Payroll Beacon',
    name: 'Compliance Corner',
    description: 'Weekly payroll compliance updates',
    voice: 'professional',
    duration: '5-10 min'
  },
  money_clarity: {
    product: 'Budgeting Beacon',
    name: 'Money Clarity',
    description: 'Weekly personal finance tips',
    voice: 'warm_encouraging',
    duration: '5-10 min'
  }
};

const STUB_TOPICS = {
  what_if: [
    { topic: 'What if the Roman Empire never fell?', category: 'ancient_history' },
    { topic: 'What if the internet was invented in the 1800s?', category: 'technology' },
    { topic: 'What if dinosaurs survived the asteroid?', category: 'science' },
    { topic: 'What if the moon landing happened in 1959?', category: 'space' },
    { topic: 'What if electricity was never discovered?', category: 'technology' }
  ],
  compliance_corner: [
    { topic: 'New overtime rules for 2026', category: 'federal' },
    { topic: 'State-by-state minimum wage update', category: 'state' },
    { topic: 'Remote worker tax implications', category: 'tax' },
    { topic: 'Understanding the new I-9 requirements', category: 'federal' },
    { topic: 'Payroll fraud prevention best practices', category: 'security' }
  ],
  money_clarity: [
    { topic: '5 budgeting myths debunked', category: 'budgeting' },
    { topic: 'How to build an emergency fund fast', category: 'savings' },
    { topic: 'Understanding your credit score', category: 'credit' },
    { topic: 'Side income tax basics', category: 'tax' },
    { topic: 'Automating your savings in 2026', category: 'savings' }
  ]
};

// GET / — list all episodes across series, filterable by series/status/product
router.get('/', async (req, res) => {
  const { series, status, product, page = 1, limit = 20, sort = 'created_at', order = 'desc' } = req.query;
  const accountId = req.query.account_id || req.headers['x-account-id'];
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase
      .from('podcast_episodes_produced')
      .select('*', { count: 'exact' });

    if (accountId) query = query.eq('account_id', accountId);
    if (series) query = query.eq('series_name', series);
    if (status) query = query.eq('status', status);
    if (product) query = query.eq('product', product);

    query = query.order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    episodes: data || [],
    series_config: SERIES_CONFIG,
    page: parseInt(page),
    limit: parseInt(limit),
    total: data?.length || 0
  });
});

// GET /series/:seriesName — episodes for a specific series
router.get('/series/:seriesName', async (req, res) => {
  const { seriesName } = req.params;
  const accountId = req.query.account_id || req.headers['x-account-id'];

  if (!SERIES_CONFIG[seriesName]) {
    return res.status(400).json({ error: `Unknown series: ${seriesName}` });
  }

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase
      .from('podcast_episodes_produced')
      .select('*')
      .eq('series_name', seriesName);

    if (accountId) query = query.eq('account_id', accountId);
    query = query.order('episode_number', { ascending: false });

    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    series: SERIES_CONFIG[seriesName],
    episodes: data || []
  });
});

// GET /episode/:id — episode detail with script, audio, metadata
router.get('/episode/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Episode not found' });

  res.json({
    episode: data,
    series_config: SERIES_CONFIG[data.series_name] || null
  });
});

// POST /episode — create episode (topic selection + script generation via Claude API stub)
router.post('/episode', async (req, res) => {
  const { series_name, title, topic, account_id } = req.body;

  if (!series_name || !title) {
    return res.status(400).json({ error: 'series_name and title are required' });
  }

  if (!SERIES_CONFIG[series_name]) {
    return res.status(400).json({ error: `Unknown series: ${series_name}` });
  }

  const seriesConf = SERIES_CONFIG[series_name];

  // Get next episode number
  const { data: existing } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .select('episode_number')
      .eq('series_name', series_name)
      .order('episode_number', { ascending: false })
      .limit(1);
  });

  const nextNumber = (existing && existing.length > 0) ? existing[0].episode_number + 1 : 1;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .insert({
        account_id: account_id || req.headers['x-account-id'] || '00000000-0000-0000-0000-000000000000',
        series_name,
        product: seriesConf.product,
        episode_number: nextNumber,
        title,
        status: 'draft',
        metadata_json: { topic: topic || title, voice: seriesConf.voice, target_duration: seriesConf.duration },
        cover_art_prompt: `Podcast cover art for "${title}" - ${seriesConf.name} series, episode ${nextNumber}`
      })
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ episode: data });
});

// PUT /episode/:id — update episode (edit script, status changes)
router.put('/episode/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove fields that shouldn't be directly updated
  delete updates.id;
  delete updates.created_at;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Episode not found' });

  res.json({ episode: data });
});

// DELETE /episode/:id — remove episode
router.delete('/episode/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .delete()
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ deleted: true, episode: data });
});

// POST /episode/:id/generate-script — generate script using Claude API (stub with template)
router.post('/episode/:id/generate-script', async (req, res) => {
  const { id } = req.params;

  const { data: episode, error: fetchErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  const seriesConf = SERIES_CONFIG[episode.series_name] || {};
  const topic = episode.metadata_json?.topic || episode.title;

  // Stub: generate a template script (would call Claude API in production)
  const script = `# ${seriesConf.name} — Episode ${episode.episode_number}\n## "${episode.title}"\n\n[INTRO MUSIC]\n\nHost: Welcome back to ${seriesConf.name}! I'm your host, and today we're diving into an incredible topic: ${topic}.\n\n[SEGMENT 1: SETUP]\n\nHost: Let's set the stage. ${topic} is a fascinating subject that touches on so many aspects of our understanding...\n\n[SEGMENT 2: DEEP DIVE]\n\nHost: Now let's really dig into the details. What makes this topic so compelling is...\n\n[SEGMENT 3: IMPLICATIONS]\n\nHost: So what does all of this mean for us today? The implications are far-reaching...\n\n[SEGMENT 4: WRAP-UP]\n\nHost: And that's our show for today! If you enjoyed this episode of ${seriesConf.name}, make sure to subscribe and leave a review.\n\n[OUTRO MUSIC]\n\n---\nGenerated by AI Podcast Producer | Series: ${seriesConf.name} | Voice: ${seriesConf.voice}\nTarget Duration: ${seriesConf.duration}`;

  const showNotes = `Episode ${episode.episode_number}: ${episode.title}\n\nTopics covered:\n- Introduction to ${topic}\n- Deep dive analysis\n- Key implications and takeaways\n\nSeries: ${seriesConf.name}\nProduct: ${seriesConf.product}`;

  const { data: updated, error: updateErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .update({
        script,
        show_notes: showNotes,
        status: 'scripted',
        metadata_json: {
          ...episode.metadata_json,
          script_generated_at: new Date().toISOString(),
          script_model: 'claude-stub'
        }
      })
      .eq('id', id)
      .select()
      .single();
  });

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ episode: updated, message: 'Script generated successfully' });
});

// POST /episode/:id/generate-audio — send to ElevenLabs (stub: marks as recorded)
router.post('/episode/:id/generate-audio', async (req, res) => {
  const { id } = req.params;

  const { data: episode, error: fetchErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  if (episode.status !== 'scripted') {
    return res.status(400).json({ error: 'Episode must be in scripted status to generate audio' });
  }

  const seriesConf = SERIES_CONFIG[episode.series_name] || {};
  const estimatedDuration = episode.script ? Math.round(episode.script.split(' ').length / 2.5) : 300;

  // Stub: would call ElevenLabs API in production
  const { data: updated, error: updateErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .update({
        status: 'recorded',
        audio_url: `https://cdn.beaconops.com/podcasts/${episode.series_name}/ep${episode.episode_number}.mp3`,
        duration_seconds: estimatedDuration,
        metadata_json: {
          ...episode.metadata_json,
          audio_generated_at: new Date().toISOString(),
          audio_engine: 'elevenlabs-stub',
          voice_id: seriesConf.voice
        }
      })
      .eq('id', id)
      .select()
      .single();
  });

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ episode: updated, message: 'Audio generated successfully' });
});

// POST /episode/:id/produce — post-production (stub: marks as produced)
router.post('/episode/:id/produce', async (req, res) => {
  const { id } = req.params;

  const { data: episode, error: fetchErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  if (episode.status !== 'recorded') {
    return res.status(400).json({ error: 'Episode must be in recorded status for post-production' });
  }

  const { data: updated, error: updateErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .update({
        status: 'produced',
        metadata_json: {
          ...episode.metadata_json,
          produced_at: new Date().toISOString(),
          post_production: {
            noise_reduction: true,
            normalization: true,
            intro_outro_added: true,
            chapters_added: true
          }
        }
      })
      .eq('id', id)
      .select()
      .single();
  });

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ episode: updated, message: 'Post-production complete' });
});

// POST /episode/:id/approve — approve for publishing
router.post('/episode/:id/approve', async (req, res) => {
  const { id } = req.params;

  const { data: episode, error: fetchErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  if (episode.status !== 'produced') {
    return res.status(400).json({ error: 'Episode must be in produced status to approve' });
  }

  const { data: updated, error: updateErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .update({
        status: 'approved',
        metadata_json: {
          ...episode.metadata_json,
          approved_at: new Date().toISOString(),
          approved_by: req.body.approved_by || 'system'
        }
      })
      .eq('id', id)
      .select()
      .single();
  });

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ episode: updated, message: 'Episode approved for publishing' });
});

// POST /episode/:id/publish — publish episode
router.post('/episode/:id/publish', async (req, res) => {
  const { id } = req.params;

  const { data: episode, error: fetchErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  if (episode.status !== 'approved') {
    return res.status(400).json({ error: 'Episode must be approved before publishing' });
  }

  const { data: updated, error: updateErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        metadata_json: {
          ...episode.metadata_json,
          published_at: new Date().toISOString(),
          distribution: {
            apple_podcasts: true,
            spotify: true,
            google_podcasts: true,
            rss_feed: true
          }
        }
      })
      .eq('id', id)
      .select()
      .single();
  });

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  res.json({ episode: updated, message: 'Episode published successfully' });
});

// GET /next-episode-number/:seriesName — get next episode number
router.get('/next-episode-number/:seriesName', async (req, res) => {
  const { seriesName } = req.params;

  if (!SERIES_CONFIG[seriesName]) {
    return res.status(400).json({ error: `Unknown series: ${seriesName}` });
  }

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('podcast_episodes_produced')
      .select('episode_number')
      .eq('series_name', seriesName)
      .order('episode_number', { ascending: false })
      .limit(1);
  });

  if (error) return res.status(500).json({ error: error.message });

  const nextNumber = (data && data.length > 0) ? data[0].episode_number + 1 : 1;

  res.json({ series: seriesName, next_episode_number: nextNumber });
});

// GET /topics — suggested topics per series (stub data)
router.get('/topics', async (req, res) => {
  const { series } = req.query;

  if (series && STUB_TOPICS[series]) {
    return res.json({ topics: { [series]: STUB_TOPICS[series] } });
  }

  res.json({ topics: STUB_TOPICS });
});

// GET /stats — episodes per series, published count, total duration
router.get('/stats', async (req, res) => {
  const accountId = req.query.account_id || req.headers['x-account-id'];

  const { data: allEpisodes, error } = await safeQuery(async (supabase) => {
    let query = supabase.from('podcast_episodes_produced').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  const episodes = allEpisodes || [];
  const total = episodes.length;

  // Episodes per series
  const bySeries = {};
  Object.keys(SERIES_CONFIG).forEach((key) => { bySeries[key] = 0; });
  episodes.forEach((ep) => {
    bySeries[ep.series_name] = (bySeries[ep.series_name] || 0) + 1;
  });

  // By status
  const byStatus = {};
  episodes.forEach((ep) => {
    byStatus[ep.status] = (byStatus[ep.status] || 0) + 1;
  });

  // Published count
  const publishedCount = episodes.filter((ep) => ep.status === 'published').length;

  // Total duration
  const totalDurationSeconds = episodes.reduce((sum, ep) => sum + (ep.duration_seconds || 0), 0);
  const totalDurationHours = parseFloat((totalDurationSeconds / 3600).toFixed(2));

  res.json({
    total,
    by_series: bySeries,
    by_status: byStatus,
    published_count: publishedCount,
    total_duration_seconds: totalDurationSeconds,
    total_duration_hours: totalDurationHours,
    series_config: SERIES_CONFIG
  });
});

module.exports = router;
