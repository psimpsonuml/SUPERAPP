const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

const CASCADE_WEIGHTS = { host: 1.0, guest: 0.6 };

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── SEARCH ──────────────────────────────────────────────────

// GET /api/podcasts/search?q=tech&category=ai
router.get('/search', async (req, res) => {
  try {
    const { q = '', category = '' } = req.query;

    // Stub: would integrate with Podcast Index API
    const samplePodcasts = [
      { id: 'sample-1', title: 'Tech Deep Dive', author: 'Jane Smith', description: 'Weekly deep dives into technology trends', image_url: '', feed_url: '', category: 'tech', podcast_index_id: '100001' },
      { id: 'sample-2', title: 'AI Frontiers', author: 'Dr. Alan Turing Jr.', description: 'Exploring the cutting edge of artificial intelligence', image_url: '', feed_url: '', category: 'ai', podcast_index_id: '100002' },
      { id: 'sample-3', title: 'Business Builders', author: 'Mike Johnson', description: 'Interviews with successful entrepreneurs', image_url: '', feed_url: '', category: 'business', podcast_index_id: '100003' },
      { id: 'sample-4', title: 'True Crime Files', author: 'Sarah Davis', description: 'Investigating cold cases and unsolved mysteries', image_url: '', feed_url: '', category: 'true_crime', podcast_index_id: '100004' },
      { id: 'sample-5', title: 'Comedy Hour', author: 'The Laugh Factory', description: 'Stand-up comedy and hilarious interviews', image_url: '', feed_url: '', category: 'comedy', podcast_index_id: '100005' },
      { id: 'sample-6', title: 'History Unraveled', author: 'Prof. Williams', description: 'Uncovering fascinating stories from history', image_url: '', feed_url: '', category: 'history', podcast_index_id: '100006' },
    ];

    let results = samplePodcasts;
    if (q) {
      const lower = q.toLowerCase();
      results = results.filter(p => p.title.toLowerCase().includes(lower) || p.description.toLowerCase().includes(lower) || p.author.toLowerCase().includes(lower));
    }
    if (category) {
      results = results.filter(p => p.category === category);
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── SUBSCRIPTIONS ───────────────────────────────────────────

// GET /api/podcasts/subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || 'default';

    const { data: subs, error: subErr } = await safeQuery(sb =>
      sb.from('podcast_subscriptions')
        .select('*, podcasts(*)')
        .eq('account_id', accountId)
        .order('subscribed_at', { ascending: false })
    );
    if (subErr) return res.status(500).json({ error: subErr.message });

    // Get unplayed counts per podcast
    const podcastIds = (subs || []).map(s => s.podcast_id);
    let unplayedCounts = {};

    if (podcastIds.length > 0) {
      const { data: rated } = await safeQuery(sb =>
        sb.from('podcast_ratings')
          .select('episode_id')
          .eq('account_id', accountId)
          .eq('listened', true)
      );
      const ratedEpIds = new Set((rated || []).map(r => r.episode_id));

      const { data: episodes } = await safeQuery(sb =>
        sb.from('podcast_episodes')
          .select('id, podcast_id')
          .in('podcast_id', podcastIds)
      );

      (episodes || []).forEach(ep => {
        if (!ratedEpIds.has(ep.id)) {
          unplayedCounts[ep.podcast_id] = (unplayedCounts[ep.podcast_id] || 0) + 1;
        }
      });
    }

    const subscriptions = (subs || []).map(s => ({
      ...s,
      unplayed_count: unplayedCounts[s.podcast_id] || 0,
    }));

    res.json({ subscriptions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/podcasts/subscriptions
router.post('/subscriptions', async (req, res) => {
  try {
    const accountId = req.body.account_id || req.headers['x-account-id'] || 'default';
    const { podcast } = req.body;

    if (!podcast || !podcast.title) {
      return res.status(400).json({ error: 'podcast object with title required' });
    }

    // Upsert podcast
    const { data: existing } = await safeQuery(sb =>
      sb.from('podcasts')
        .select('id')
        .eq('podcast_index_id', podcast.podcast_index_id || '')
        .maybeSingle()
    );

    let podcastId;
    if (existing && existing.id) {
      podcastId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await safeQuery(sb =>
        sb.from('podcasts')
          .insert({
            title: podcast.title,
            author: podcast.author || '',
            description: podcast.description || '',
            image_url: podcast.image_url || '',
            feed_url: podcast.feed_url || '',
            category: podcast.category || '',
            podcast_index_id: podcast.podcast_index_id || '',
          })
          .select()
          .single()
      );
      if (insErr) return res.status(500).json({ error: insErr.message });
      podcastId = inserted.id;
    }

    // Create subscription
    const { data: sub, error: subErr } = await safeQuery(sb =>
      sb.from('podcast_subscriptions')
        .upsert({ account_id: accountId, podcast_id: podcastId }, { onConflict: 'account_id,podcast_id' })
        .select()
        .single()
    );
    if (subErr) return res.status(500).json({ error: subErr.message });

    res.json({ subscription: sub, podcast_id: podcastId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/podcasts/subscriptions/:podcastId
router.delete('/subscriptions/:podcastId', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || 'default';
    const { podcastId } = req.params;

    const { error } = await safeQuery(sb =>
      sb.from('podcast_subscriptions')
        .delete()
        .eq('account_id', accountId)
        .eq('podcast_id', podcastId)
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── EPISODES ────────────────────────────────────────────────

// GET /api/podcasts/episodes?podcast_id=xxx&page=1&limit=20
router.get('/episodes', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || 'default';
    const { podcast_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query;
    if (podcast_id) {
      query = sb => sb.from('podcast_episodes')
        .select('*, podcasts(title, author, image_url, category)')
        .eq('podcast_id', podcast_id)
        .order('published_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);
    } else {
      // All episodes from subscribed podcasts
      const { data: subs } = await safeQuery(sb =>
        sb.from('podcast_subscriptions')
          .select('podcast_id')
          .eq('account_id', accountId)
      );
      const podcastIds = (subs || []).map(s => s.podcast_id);
      if (podcastIds.length === 0) return res.json({ episodes: [], page: parseInt(page) });

      query = sb => sb.from('podcast_episodes')
        .select('*, podcasts(title, author, image_url, category)')
        .in('podcast_id', podcastIds)
        .order('published_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);
    }

    const { data: episodes, error } = await safeQuery(query);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ episodes: episodes || [], page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/podcasts/episodes/:id
router.get('/episodes/:id', async (req, res) => {
  try {
    const { data: episode, error } = await safeQuery(sb =>
      sb.from('podcast_episodes')
        .select('*, podcasts(title, author, image_url, category)')
        .eq('id', req.params.id)
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    res.json({ episode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/podcasts/episodes/:id/rate
router.post('/episodes/:id/rate', async (req, res) => {
  try {
    const accountId = req.body.account_id || req.headers['x-account-id'] || 'default';
    const episodeId = req.params.id;
    const { score, notes = '', guests = [], host = '' } = req.body;

    if (!score || score < 1 || score > 10) {
      return res.status(400).json({ error: 'score must be between 1 and 10' });
    }

    // Upsert rating
    const { data: rating, error: ratErr } = await safeQuery(sb =>
      sb.from('podcast_ratings')
        .upsert({
          account_id: accountId,
          episode_id: episodeId,
          score: parseInt(score),
          notes,
          listened: true,
          rated_at: new Date().toISOString(),
        }, { onConflict: 'account_id,episode_id' })
        .select()
        .single()
    );
    if (ratErr) return res.status(500).json({ error: ratErr.message });

    // Update guests_json on episode if provided
    if (guests.length > 0 || host) {
      const guestsJson = guests.map(g => typeof g === 'string' ? { name: g } : g);
      await safeQuery(sb =>
        sb.from('podcast_episodes')
          .update({ guests_json: guestsJson })
          .eq('id', episodeId)
      );
    }

    // Cascade scores to hosts and guests
    const people = [];
    if (host) people.push({ name: host, role: 'host' });
    guests.forEach(g => {
      const name = typeof g === 'string' ? g : g.name;
      if (name) people.push({ name, role: 'guest' });
    });

    for (const person of people) {
      const weight = CASCADE_WEIGHTS[person.role] || 0.5;
      const weightedScore = parseFloat(score) * weight;

      // Get existing cascade record
      const { data: existing } = await safeQuery(sb =>
        sb.from('podcast_cascade_scores')
          .select('*')
          .eq('account_id', accountId)
          .eq('person_name', person.name)
          .eq('role', person.role)
          .maybeSingle()
      );

      if (existing && existing.id) {
        const newCount = existing.episodes_rated + 1;
        const newTotal = (parseFloat(existing.composite_score) + weightedScore);
        const newAvg = newTotal / newCount;
        await safeQuery(sb =>
          sb.from('podcast_cascade_scores')
            .update({
              composite_score: newTotal.toFixed(2),
              episodes_rated: newCount,
              avg_score: newAvg.toFixed(1),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        );
      } else {
        await safeQuery(sb =>
          sb.from('podcast_cascade_scores')
            .insert({
              account_id: accountId,
              person_name: person.name,
              role: person.role,
              composite_score: weightedScore.toFixed(2),
              episodes_rated: 1,
              avg_score: (parseFloat(score)).toFixed(1),
              updated_at: new Date().toISOString(),
            })
        );
      }
    }

    res.json({ rating, cascaded_to: people.map(p => p.name) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── RATINGS ─────────────────────────────────────────────────

// GET /api/podcasts/ratings?show=xxx&min_score=5&max_score=10&from=2024-01-01&to=2024-12-31
router.get('/ratings', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || 'default';
    const { show, min_score, max_score, from, to } = req.query;

    let queryFn = sb => {
      let q = sb.from('podcast_ratings')
        .select('*, podcast_episodes(*, podcasts(title, author, image_url, category))')
        .eq('account_id', accountId)
        .order('rated_at', { ascending: false });

      if (min_score) q = q.gte('score', parseInt(min_score));
      if (max_score) q = q.lte('score', parseInt(max_score));
      if (from) q = q.gte('rated_at', from);
      if (to) q = q.lte('rated_at', to);
      return q;
    };

    const { data: ratings, error } = await safeQuery(queryFn);
    if (error) return res.status(500).json({ error: error.message });

    let filtered = ratings || [];
    if (show) {
      filtered = filtered.filter(r =>
        r.podcast_episodes?.podcasts?.title?.toLowerCase().includes(show.toLowerCase())
      );
    }

    res.json({ ratings: filtered });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── HOSTS / CASCADE LEADERBOARD ─────────────────────────────

// GET /api/podcasts/hosts?sort=composite_score&order=desc
router.get('/hosts', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || 'default';
    const { sort = 'composite_score', order = 'desc' } = req.query;

    const { data: hosts, error } = await safeQuery(sb =>
      sb.from('podcast_cascade_scores')
        .select('*')
        .eq('account_id', accountId)
        .order(sort, { ascending: order === 'asc' })
    );
    if (error) return res.status(500).json({ error: error.message });

    res.json({ hosts: hosts || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/podcasts/hosts/:name
router.get('/hosts/:name', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || 'default';
    const personName = decodeURIComponent(req.params.name);

    // Get cascade score record
    const { data: profile } = await safeQuery(sb =>
      sb.from('podcast_cascade_scores')
        .select('*')
        .eq('account_id', accountId)
        .eq('person_name', personName)
    );

    // Find episodes featuring this person as host or guest
    const { data: allRatings } = await safeQuery(sb =>
      sb.from('podcast_ratings')
        .select('*, podcast_episodes(*, podcasts(title, author, image_url, category))')
        .eq('account_id', accountId)
        .order('rated_at', { ascending: false })
    );

    const episodes = (allRatings || []).filter(r => {
      const ep = r.podcast_episodes;
      if (!ep) return false;
      const podcast = ep.podcasts;
      if (podcast && podcast.author && podcast.author.toLowerCase().includes(personName.toLowerCase())) return true;
      const guests = ep.guests_json || [];
      return guests.some(g => {
        const gName = typeof g === 'string' ? g : g.name;
        return gName && gName.toLowerCase().includes(personName.toLowerCase());
      });
    });

    res.json({
      profile: profile || [],
      episodes,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── QUEUE ───────────────────────────────────────────────────

// GET /api/podcasts/queue
router.get('/queue', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || 'default';

    // Get subscribed podcast IDs
    const { data: subs } = await safeQuery(sb =>
      sb.from('podcast_subscriptions')
        .select('podcast_id')
        .eq('account_id', accountId)
    );
    const podcastIds = (subs || []).map(s => s.podcast_id);
    if (podcastIds.length === 0) return res.json({ queue: [] });

    // Get rated/listened episode IDs
    const { data: rated } = await safeQuery(sb =>
      sb.from('podcast_ratings')
        .select('episode_id')
        .eq('account_id', accountId)
        .eq('listened', true)
    );
    const listenedIds = new Set((rated || []).map(r => r.episode_id));

    // Get all episodes from subscribed podcasts
    const { data: episodes } = await safeQuery(sb =>
      sb.from('podcast_episodes')
        .select('*, podcasts(title, author, image_url, category)')
        .in('podcast_id', podcastIds)
        .order('published_at', { ascending: false })
    );

    const queue = (episodes || []).filter(ep => !listenedIds.has(ep.id));

    res.json({ queue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── STATS ───────────────────────────────────────────────────

// GET /api/podcasts/stats
router.get('/stats', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || 'default';

    // Total episodes rated
    const { data: ratings } = await safeQuery(sb =>
      sb.from('podcast_ratings')
        .select('*, podcast_episodes(duration_seconds, podcast_id, podcasts(title))')
        .eq('account_id', accountId)
    );

    const totalRated = (ratings || []).length;

    // Hours listened
    const totalSeconds = (ratings || []).reduce((sum, r) => {
      return sum + (r.podcast_episodes?.duration_seconds || 0);
    }, 0);
    const hoursListened = Math.round((totalSeconds / 3600) * 10) / 10;

    // Most-rated show
    const showCounts = {};
    (ratings || []).forEach(r => {
      const showTitle = r.podcast_episodes?.podcasts?.title;
      if (showTitle) showCounts[showTitle] = (showCounts[showTitle] || 0) + 1;
    });
    const mostRatedShow = Object.entries(showCounts).sort((a, b) => b[1] - a[1])[0];

    // Highest-rated host
    const { data: hosts } = await safeQuery(sb =>
      sb.from('podcast_cascade_scores')
        .select('*')
        .eq('account_id', accountId)
        .eq('role', 'host')
        .order('avg_score', { ascending: false })
        .limit(1)
    );

    res.json({
      total_rated: totalRated,
      hours_listened: hoursListened,
      most_rated_show: mostRatedShow ? { title: mostRatedShow[0], count: mostRatedShow[1] } : null,
      highest_rated_host: (hosts && hosts[0]) || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── RECOMMENDATIONS ─────────────────────────────────────────

// GET /api/podcasts/recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const accountId = req.query.account_id || req.headers['x-account-id'] || 'default';

    // Get top hosts/guests by composite score
    const { data: topPeople } = await safeQuery(sb =>
      sb.from('podcast_cascade_scores')
        .select('*')
        .eq('account_id', accountId)
        .order('composite_score', { ascending: false })
        .limit(10)
    );

    // Get currently subscribed podcast IDs
    const { data: subs } = await safeQuery(sb =>
      sb.from('podcast_subscriptions')
        .select('podcast_id')
        .eq('account_id', accountId)
    );
    const subscribedIds = new Set((subs || []).map(s => s.podcast_id));

    // Find podcasts featuring top people that user isn't subscribed to
    // This is a simplified recommendation - in production would use podcast index API
    const { data: allPodcasts } = await safeQuery(sb =>
      sb.from('podcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
    );

    const topNames = (topPeople || []).map(p => p.person_name.toLowerCase());
    const recommendations = (allPodcasts || [])
      .filter(p => !subscribedIds.has(p.id))
      .filter(p => {
        if (topNames.length === 0) return true;
        return topNames.some(name =>
          (p.author || '').toLowerCase().includes(name) ||
          (p.description || '').toLowerCase().includes(name)
        );
      })
      .slice(0, 10);

    res.json({
      recommendations,
      based_on: (topPeople || []).slice(0, 5).map(p => ({ name: p.person_name, role: p.role, score: p.composite_score })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
