const express = require('express');
const AnalyticsPipeline = require('../../shared/analytics');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// GET /api/reports/daily — get today's or a specific day's report data
router.get('/daily', async (req, res) => {
  try {
    const analytics = new AnalyticsPipeline(req.accountId);
    const data = await analytics.getDailyReportData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/content-performance — content performance analytics
router.get('/content-performance', async (req, res) => {
  try {
    const analytics = new AnalyticsPipeline(req.accountId);
    const product = req.query.product;
    const days = parseInt(req.query.days, 10) || 30;

    if (!product) {
      return res.status(400).json({ error: 'product query parameter required' });
    }

    const data = await analytics.getContentPerformance(product, days);
    res.json({ product, days, content: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/health — system health overview
router.get('/health', async (req, res) => {
  try {
    const analytics = new AnalyticsPipeline(req.accountId);
    const health = await analytics.getAccountHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/pain-points — pain point trends
router.get('/pain-points', async (req, res) => {
  try {
    const supabase = getSupabase();
    const days = parseInt(req.query.days, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await safeQuery(sb =>
      sb.from('pain_points')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('date_found', since.toISOString())
        .order('date_found', { ascending: false })
    );

    res.json({ days, painPoints: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/pain-points-today — today's pain points grouped by product, sorted by score
router.get('/pain-points-today', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await safeQuery(sb =>
      sb.from('pain_points')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('date_found', todayStart.toISOString())
        .order('score', { ascending: false })
    );

    // Group by product
    const byProduct = {};
    for (const pp of (data || [])) {
      const prod = pp.product || pp.product_relevance || 'unknown';
      if (!byProduct[prod]) byProduct[prod] = [];
      byProduct[prod].push(pp);
    }

    res.json({
      total: (data || []).length,
      highScore: (data || []).filter(p => p.score >= 7).length,
      byProduct,
      painPoints: data || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/pipeline — CRM pipeline overview
router.get('/pipeline', async (req, res) => {
  try {
    const track = req.query.track || 'user';

    const { data } = await safeQuery(sb =>
      sb.from('prospect_pipeline')
        .select('stage, product, track')
        .eq('account_id', req.accountId)
        .eq('track', track)
    );

    // Aggregate by stage
    const stages = {};
    for (const prospect of data || []) {
      const key = `${prospect.stage}`;
      stages[key] = (stages[key] || 0) + 1;
    }

    res.json({ track, stages, total: (data || []).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/product-intelligence — product intelligence with filters
router.get('/product-intelligence', async (req, res) => {
  try {
    const { product, status, rec_type, tab, days } = req.query;
    const limit = parseInt(req.query.limit, 10) || 100;

    let query = getSupabase()
      .from('product_intelligence')
      .select('*')
      .eq('account_id', req.accountId)
      .order('created_at', { ascending: false });

    // Tab-based filtering
    if (tab === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      query = query.in('status', ['new', 'reviewed']).gte('created_at', todayStart.toISOString());
    } else if (tab === 'backlog') {
      query = query.eq('status', 'accepted');
    } else if (tab === 'history') {
      // All items, optionally filtered
    } else {
      // Default: exclude snoozed
      query = query.neq('status', 'snoozed');
    }

    if (product) query = query.eq('product', product);
    if (status) query = query.eq('status', status);
    if (rec_type) query = query.eq('rec_type', rec_type);

    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await safeQuery(() => query.limit(limit));
    const recs = data || [];

    // Stats
    const allQuery = getSupabase()
      .from('product_intelligence')
      .select('status, product, rec_type, impact_estimate, snoozed_until')
      .eq('account_id', req.accountId);
    const { data: allRecs } = await safeQuery(() => allQuery.limit(500));
    const all = allRecs || [];

    const byStatus = {};
    const byProduct = {};
    const snoozedCount = all.filter(r => r.status === 'snoozed').length;
    const snoozedExpiringThisWeek = all.filter(r => {
      if (r.status !== 'snoozed' || !r.snoozed_until) return false;
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      return new Date(r.snoozed_until) <= weekFromNow;
    }).length;

    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (!byProduct[r.product]) byProduct[r.product] = { total: 0, new: 0, accepted: 0 };
      byProduct[r.product].total++;
      if (r.status === 'new') byProduct[r.product].new++;
      if (r.status === 'accepted') byProduct[r.product].accepted++;
    }

    // Top 3 highest-impact new recommendations
    const topImpact = all
      .filter(r => r.status === 'new' && r.impact_estimate === 'high')
      .slice(0, 3);

    res.json({
      recommendations: recs,
      stats: {
        total: all.length,
        byStatus,
        byProduct,
        snoozedCount,
        snoozedExpiringThisWeek,
        topImpact,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/reports/product-intelligence/:id/accept — accept recommendation
router.patch('/product-intelligence/:id/accept', async (req, res) => {
  try {
    const { data, error } = await safeQuery(() =>
      getSupabase()
        .from('product_intelligence')
        .update({ status: 'accepted', snoozed_until: null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('account_id', req.accountId)
        .select('id, status')
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/reports/product-intelligence/:id/reject — reject recommendation
router.patch('/product-intelligence/:id/reject', async (req, res) => {
  try {
    const { data, error } = await safeQuery(() =>
      getSupabase()
        .from('product_intelligence')
        .update({ status: 'rejected', snoozed_until: null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('account_id', req.accountId)
        .select('id, status')
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/reports/product-intelligence/:id/snooze — snooze for 30 days
router.patch('/product-intelligence/:id/snooze', async (req, res) => {
  try {
    const snoozeDays = parseInt(req.body.days, 10) || 30;
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + snoozeDays);

    const { data, error } = await safeQuery(() =>
      getSupabase()
        .from('product_intelligence')
        .update({
          status: 'snoozed',
          snoozed_until: snoozedUntil.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .eq('account_id', req.accountId)
        .select('id, status, snoozed_until')
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/communities — community discovery report (recent + all)
router.get('/communities', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Newly discovered communities
    const { data: recent } = await safeQuery(sb =>
      sb.from('community_profiles')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('created_at', since.toISOString())
        .order('overall_score', { ascending: false })
    );

    // Group by product then platform
    const byProduct = {};
    for (const c of (recent || [])) {
      if (!byProduct[c.product]) byProduct[c.product] = {};
      if (!byProduct[c.product][c.platform]) byProduct[c.product][c.platform] = [];
      byProduct[c.product][c.platform].push(c);
    }

    // Summary stats
    const { data: allCommunities } = await safeQuery(sb =>
      sb.from('community_profiles')
        .select('id, platform, product, overall_score')
        .eq('account_id', req.accountId)
    );

    const total = (allCommunities || []).length;
    const byPlatformCount = {};
    for (const c of (allCommunities || [])) {
      byPlatformCount[c.platform] = (byPlatformCount[c.platform] || 0) + 1;
    }

    res.json({
      days,
      newCount: (recent || []).length,
      totalTracked: total,
      byPlatformCount,
      byProduct,
      recent: recent || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/seo-posts-today — today's SEO/AEO posts from content_memory
router.get('/seo-posts-today', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await safeQuery(sb =>
      sb.from('content_memory')
        .select('*')
        .eq('account_id', req.accountId)
        .eq('content_type', 'blog_post')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: true })
    );

    const posts = (data || []).map(post => ({
      id: post.id,
      product: post.product,
      title: post.title,
      keyword: post.metadata?.keyword || null,
      wordCount: post.metadata?.wordCount || null,
      approvalTier: post.metadata?.approvalTier || null,
      status: post.status,
      hasFaqSchema: !!post.metadata?.faqSchema,
      metaTitle: post.metadata?.metaTitle || null,
      createdAt: post.created_at,
    }));

    res.json({
      total: posts.length,
      posts,
      byProduct: posts.reduce((acc, p) => {
        acc[p.product] = (acc[p.product] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/outreach — outreach prospector summary
router.get('/outreach', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Today's prospects
    const { data: todayProspects } = await safeQuery(sb =>
      sb.from('prospect_pipeline')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('created_at', todayStart.toISOString())
        .order('icp_score', { ascending: false })
    );

    const prospects = todayProspects || [];

    // Group by product
    const byProduct = {};
    for (const p of prospects) {
      if (!byProduct[p.product]) byProduct[p.product] = { found: 0, drafted: 0 };
      byProduct[p.product].found++;
      if (['email_drafted', 'pitch_drafted', 'contacted', 'pitched'].includes(p.stage)) {
        byProduct[p.product].drafted++;
      }
    }

    // Pipeline breakdown (all time)
    const { data: allProspects } = await safeQuery(sb =>
      sb.from('prospect_pipeline')
        .select('stage, track, product')
        .eq('account_id', req.accountId)
    );

    const pipelineBreakdown = {};
    for (const p of (allProspects || [])) {
      pipelineBreakdown[p.stage] = (pipelineBreakdown[p.stage] || 0) + 1;
    }

    // Response rates (7-day and 30-day)
    const days7 = new Date();
    days7.setDate(days7.getDate() - 7);
    const days30 = new Date();
    days30.setDate(days30.getDate() - 30);

    const { data: sends7 } = await safeQuery(sb =>
      sb.from('outreach_sends')
        .select('id, replied_at')
        .eq('account_id', req.accountId)
        .gte('sent_at', days7.toISOString())
    );

    const { data: sends30 } = await safeQuery(sb =>
      sb.from('outreach_sends')
        .select('id, replied_at')
        .eq('account_id', req.accountId)
        .gte('sent_at', days30.toISOString())
    );

    const calcRate = (sends) => {
      if (!sends || sends.length === 0) return null;
      const replied = sends.filter(s => s.replied_at).length;
      return { sent: sends.length, replied, rate: (replied / sends.length * 100).toFixed(1) };
    };

    res.json({
      today: {
        total: prospects.length,
        userTrack: prospects.filter(p => p.track === 'user').length,
        partnerTrack: prospects.filter(p => p.track === 'partner').length,
        emailsDrafted: prospects.filter(p => ['email_drafted', 'pitch_drafted'].includes(p.stage)).length,
        byProduct,
      },
      pipeline: pipelineBreakdown,
      totalProspects: (allProspects || []).length,
      responseRate7d: calcRate(sends7),
      responseRate30d: calcRate(sends30),
      topProspects: prospects.filter(p => p.icp_score >= 7).slice(0, 10).map(p => ({
        id: p.id,
        name: p.name,
        product: p.product,
        track: p.track,
        stage: p.stage,
        icp_score: p.icp_score,
        platform: p.platform,
        source: p.source,
        source_url: p.source_url,
        company: p.company,
        title: p.title,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/social — today's social distribution summary
router.get('/social', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Today's scheduled/published/pending posts
    const { data: todayPosts } = await safeQuery(sb =>
      sb.from('social_post_log')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('created_at', todayStart.toISOString())
        .order('scheduled_for', { ascending: true })
    );

    const posts = todayPosts || [];

    // Yesterday's engagement data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const { data: yesterdayPosts } = await safeQuery(sb =>
      sb.from('social_post_log')
        .select('platform, product, likes, comments, shares, impressions, engagement_score, platform_post_url')
        .eq('account_id', req.accountId)
        .eq('status', 'published')
        .gte('published_at', yesterday.toISOString())
        .lte('published_at', yesterdayEnd.toISOString())
    );

    // Shadowban warnings
    const { data: shadowbanAlerts } = await safeQuery(sb =>
      sb.from('infra_alerts')
        .select('service, message, details, created_at')
        .eq('account_id', req.accountId)
        .like('alert_type', 'social-distributor_alert')
        .eq('resolved', false)
        .gte('created_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())
    );

    // Group by status
    const scheduled = posts.filter(p => p.status === 'scheduled' || p.status === 'queued');
    const published = posts.filter(p => p.status === 'published');
    const pending = posts.filter(p => p.status === 'queued');

    // Engagement summary from yesterday
    const engagement = {
      totalLikes: 0, totalComments: 0, totalShares: 0,
      byPlatform: {},
    };
    for (const p of (yesterdayPosts || [])) {
      engagement.totalLikes += p.likes || 0;
      engagement.totalComments += p.comments || 0;
      engagement.totalShares += p.shares || 0;
      if (!engagement.byPlatform[p.platform]) {
        engagement.byPlatform[p.platform] = { likes: 0, comments: 0, shares: 0, posts: 0 };
      }
      engagement.byPlatform[p.platform].likes += p.likes || 0;
      engagement.byPlatform[p.platform].comments += p.comments || 0;
      engagement.byPlatform[p.platform].shares += p.shares || 0;
      engagement.byPlatform[p.platform].posts++;
    }

    // By platform breakdown
    const byPlatform = {};
    for (const p of posts) {
      if (!byPlatform[p.platform]) byPlatform[p.platform] = { scheduled: 0, published: 0, pending: 0, failed: 0 };
      if (p.status === 'scheduled') byPlatform[p.platform].scheduled++;
      else if (p.status === 'published') byPlatform[p.platform].published++;
      else if (p.status === 'queued') byPlatform[p.platform].pending++;
      else if (p.status === 'failed') byPlatform[p.platform].failed++;
    }

    res.json({
      today: {
        totalScheduled: scheduled.length,
        totalPublished: published.length,
        totalPending: pending.length,
        byPlatform,
        posts: posts.map(p => ({
          id: p.id,
          platform: p.platform,
          product: p.product,
          status: p.status,
          contentPreview: p.content_preview,
          scheduledFor: p.scheduled_for,
          publishedAt: p.published_at,
          platformPostUrl: p.platform_post_url,
        })),
      },
      yesterdayEngagement: engagement,
      shadowbanWarnings: (shadowbanAlerts || []).map(a => ({
        platform: a.service?.replace('social-', ''),
        message: a.message,
        details: a.details,
        detectedAt: a.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/intelligence — intelligence briefing (top opportunities + all findings)
router.get('/intelligence', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const category = req.query.category;
    const product = req.query.product;
    const status = req.query.status;
    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = getSupabase()
      .from('intelligence_log')
      .select('*')
      .eq('account_id', req.accountId)
      .gte('date_found', since.toISOString())
      .order('date_found', { ascending: false });

    if (category) query = query.eq('category', category);
    if (product) query = query.eq('product', product);
    if (status) query = query.eq('status', status);

    const { data, error } = await safeQuery(() => query.limit(200));

    // Compute ROI-ranked top 10
    const scored = (data || [])
      .filter(e => e.status === 'discovered' || e.status === 'new')
      .map(entry => {
        const reach = entry.potential_reach || 1;
        const relevance = entry.relevance_score || 5;
        const cost = Math.max(entry.estimated_cost || 1, 1);
        return { ...entry, roiScore: (reach * relevance) / cost };
      })
      .sort((a, b) => b.roiScore - a.roiScore)
      .slice(0, 10);

    // Stats by category
    const byCategory = {};
    for (const entry of (data || [])) {
      const cat = entry.category || entry.intel_type || 'unknown';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, new: 0 };
      byCategory[cat].total++;
      if (entry.status === 'discovered' || entry.status === 'new') byCategory[cat].new++;
    }

    // Stats by status
    const byStatus = {};
    for (const entry of (data || [])) {
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    }

    res.json({
      days,
      total: (data || []).length,
      byCategory,
      byStatus,
      topOpportunities: scored,
      findings: data || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/newsletter — newsletter edition stats and recent editions
router.get('/newsletter', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const { data, error } = await safeQuery(() =>
      getSupabase()
        .from('newsletter_editions')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(30)
    );

    const editions = data || [];

    // Today's edition
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEdition = editions.find(e => new Date(e.created_at) >= todayStart);

    // By status
    const byStatus = {};
    for (const e of editions) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    }

    // Average open rate (from editions that have it)
    const withOpenRate = editions.filter(e => e.open_rate != null);
    const avgOpenRate = withOpenRate.length > 0
      ? withOpenRate.reduce((sum, e) => sum + Number(e.open_rate), 0) / withOpenRate.length
      : null;

    res.json({
      days,
      total: editions.length,
      byStatus,
      avgOpenRate: avgOpenRate ? Math.round(avgOpenRate * 100) / 100 : null,
      today: todayEdition ? {
        id: todayEdition.id,
        subjectLine: todayEdition.subject_line,
        wordCount: todayEdition.word_count,
        status: todayEdition.status,
        themeType: todayEdition.theme_type,
        publishMethod: todayEdition.publish_method,
        openRate: todayEdition.open_rate,
        headerImageUrl: todayEdition.header_image_url,
        createdAt: todayEdition.created_at,
        publishedAt: todayEdition.published_at,
      } : null,
      recentEditions: editions.map(e => ({
        id: e.id,
        subjectLine: e.subject_line,
        wordCount: e.word_count,
        status: e.status,
        themeType: e.theme_type,
        openRate: e.open_rate,
        subscriberCount: e.subscriber_count,
        createdAt: e.created_at,
        publishedAt: e.published_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/reports/newsletter/:id/stats — update open rate and subscriber count
router.patch('/newsletter/:id/stats', async (req, res) => {
  try {
    const { open_rate, subscriber_count } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (open_rate != null) updates.open_rate = open_rate;
    if (subscriber_count != null) updates.subscriber_count = subscriber_count;

    const { data, error } = await safeQuery(() =>
      getSupabase()
        .from('newsletter_editions')
        .update(updates)
        .eq('id', req.params.id)
        .eq('account_id', req.accountId)
        .select('id, open_rate, subscriber_count')
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/video-production — today's video production summary
router.get('/video-production', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 1;
    const product = req.query.product;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    let query = getSupabase()
      .from('video_assets')
      .select('*')
      .eq('account_id', req.accountId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (product) query = query.eq('product', product);

    const { data, error } = await safeQuery(() => query.limit(100));

    const videos = data || [];

    // Group by product
    const byProduct = {};
    for (const v of videos) {
      if (!byProduct[v.product]) byProduct[v.product] = { short: 0, long: 0, pending: 0, approved: 0, published: 0 };
      if (v.format === 'short') byProduct[v.product].short++;
      else byProduct[v.product].long++;
      if (v.status === 'pending_approval') byProduct[v.product].pending++;
      else if (v.status === 'approved') byProduct[v.product].approved++;
      else if (v.status === 'published') byProduct[v.product].published++;
    }

    // By status
    const byStatus = {};
    for (const v of videos) {
      byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    }

    // Quality gate stats
    const qgStats = {
      totalChecked: videos.length,
      allPassed: videos.filter(v => {
        const qg = v.quality_gate || {};
        return qg.audioSynced && !qg.hasBlankFrames && !qg.hasSilentGaps && (qg.captionAccuracy || 0) >= 0.95;
      }).length,
    };

    res.json({
      days,
      total: videos.length,
      shortForm: videos.filter(v => v.format === 'short').length,
      longForm: videos.filter(v => v.format === 'long').length,
      byProduct,
      byStatus,
      qualityGate: qgStats,
      videos: videos.map(v => ({
        id: v.id,
        product: v.product,
        title: v.title,
        format: v.format,
        duration: v.duration_sec,
        status: v.status,
        videoUrl: v.video_url,
        thumbnailUrl: v.thumbnail_url,
        platforms: v.platforms,
        hashtags: v.hashtags,
        fileSizeBytes: v.file_size_bytes,
        qualityGate: v.quality_gate,
        createdAt: v.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/reports/intelligence/:id/status — update status of an intelligence entry
router.patch('/intelligence/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['discovered', 'contacted', 'in_progress', 'completed', 'passed', 'new'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('intelligence_log')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('account_id', req.accountId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Ad Creatives ──────────────────────────────────────────

// GET /api/reports/ad-creatives — list ad creatives from approval queue + content memory
router.get('/ad-creatives', async (req, res) => {
  try {
    const { product, platform, status, days } = req.query;
    const limit = parseInt(req.query.limit, 10) || 100;

    let query = getSupabase()
      .from('approval_queue')
      .select('*')
      .eq('account_id', req.accountId)
      .eq('item_type', 'ad_creative')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await safeQuery(() => query.limit(limit));
    if (error) return res.status(500).json({ error: error.message });

    let creatives = (data || []).map(item => ({
      id: item.id,
      status: item.status,
      created_at: item.created_at,
      preview: item.content_preview,
      ...(typeof item.full_content === 'object' ? item.full_content : {}),
    }));

    // Apply product/platform filters on the JSONB content
    if (product) creatives = creatives.filter(c => c.product === product);
    if (platform) creatives = creatives.filter(c => c.platform === platform);

    // Stats
    const allCreatives = (data || []).map(item => ({
      status: item.status,
      ...(typeof item.full_content === 'object' ? item.full_content : {}),
    }));

    const stats = {
      total: allCreatives.length,
      byStatus: {},
      byProduct: {},
      byPlatform: {},
      complianceFlags: allCreatives.filter(c => c.compliance && !c.compliance.pass).length,
    };

    for (const c of allCreatives) {
      stats.byStatus[c.status] = (stats.byStatus[c.status] || 0) + 1;
      if (c.product) stats.byProduct[c.product] = (stats.byProduct[c.product] || 0) + 1;
      if (c.platform) stats.byPlatform[c.platform] = (stats.byPlatform[c.platform] || 0) + 1;
    }

    res.json({ creatives, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/reports/ad-creatives/:id/used — mark creative as actually placed
router.patch('/ad-creatives/:id/used', async (req, res) => {
  try {
    const { data: existing } = await safeQuery(() =>
      getSupabase()
        .from('approval_queue')
        .select('full_content')
        .eq('id', req.params.id)
        .eq('account_id', req.accountId)
        .single()
    );

    if (!existing) return res.status(404).json({ error: 'Creative not found' });

    const content = typeof existing.full_content === 'object' ? existing.full_content : {};
    content.used = true;
    content.used_at = new Date().toISOString();
    if (req.body.performanceUrl) content.performanceUrl = req.body.performanceUrl;

    const { data, error } = await safeQuery(() =>
      getSupabase()
        .from('approval_queue')
        .update({ full_content: content })
        .eq('id', req.params.id)
        .eq('account_id', req.accountId)
        .select('id')
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data.id, used: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── QA Playtest ───────────────────────────────────────────

// GET /api/reports/qa-playtest — QA test results with stats and trends
router.get('/qa-playtest', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await safeQuery(() =>
      getSupabase()
        .from('qa_results')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('test_date', since.toISOString().slice(0, 10))
        .order('test_date', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });

    const results = data || [];

    // Build calendar grid (pass/fail/warning per day)
    const calendar = {};
    for (const r of results) {
      const date = r.test_date;
      const hasCritical = (r.bugs || []).some(b => ['critical', 'media', 'synthesis', 'localization'].includes(b.severity));
      const hasWarnings = (r.bugs || []).some(b => ['performance', 'content_flag', 'media_flag'].includes(b.severity));
      calendar[date] = r.pass_fail === 'pass' && !hasCritical ? (hasWarnings ? 'warning' : 'pass') : 'fail';
    }

    // Trend data: latency and narrative quality over time
    const trends = results.map(r => ({
      date: r.test_date,
      passFail: r.pass_fail,
      avgLatency: r.latency_stats?.avg || 0,
      maxLatency: r.latency_stats?.max || 0,
      narrativeQuality: r.narrative_quality_score || 0,
      bugCount: (r.bugs || []).length,
    })).reverse();

    // Last night's result
    const lastNight = results[0] || null;

    // 7-day stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekResults = results.filter(r => new Date(r.test_date) >= weekAgo);
    const weekPassRate = weekResults.length > 0
      ? weekResults.filter(r => r.pass_fail === 'pass').length / weekResults.length
      : null;

    res.json({
      results,
      calendar,
      trends,
      lastNight: lastNight ? {
        date: lastNight.test_date,
        passFail: lastNight.pass_fail,
        worldId: lastNight.world_id,
        scenarioConfig: lastNight.scenario_config,
        latencyStats: lastNight.latency_stats,
        narrativeQuality: lastNight.narrative_quality_score,
        bugs: lastNight.bugs,
        checks: lastNight.checks,
      } : null,
      stats: {
        totalTests: results.length,
        passRate: results.length > 0 ? results.filter(r => r.pass_fail === 'pass').length / results.length : null,
        weekPassRate,
        avgLatency: results.length > 0 ? Math.round(results.reduce((s, r) => s + (r.latency_stats?.avg || 0), 0) / results.length) : 0,
        avgNarrativeQuality: results.length > 0 ? +(results.reduce((s, r) => s + (r.narrative_quality_score || 0), 0) / results.length).toFixed(1) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/qa-playtest/:date — single day's full test report
router.get('/qa-playtest/:date', async (req, res) => {
  try {
    const { data, error } = await safeQuery(() =>
      getSupabase()
        .from('qa_results')
        .select('*')
        .eq('account_id', req.accountId)
        .eq('test_date', req.params.date)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    );
    if (error) return res.status(404).json({ error: 'No results for this date' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Content Library ───────────────────────────────────────

// GET /api/reports/content-library — scenario library data
router.get('/content-library', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: scenarios, error } = await safeQuery(() =>
      getSupabase()
        .from('cs_scenario_library')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });

    const items = scenarios || [];

    // Weekly stats (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = items.filter(s => new Date(s.created_at) >= weekAgo);

    // Variety check for this week
    const weekEras = [...new Set(thisWeek.map(s => s.era))];
    const weekRegions = [...new Set(thisWeek.map(s => s.region))];
    const weekDiffs = [...new Set(thisWeek.map(s => s.difficulty))];
    const varietyPassed = weekEras.length === thisWeek.length &&
      weekRegions.length === thisWeek.length &&
      (thisWeek.length < 3 || ['easy', 'medium', 'hard'].every(d => weekDiffs.includes(d)));

    res.json({
      scenarios: items,
      stats: {
        total: items.length,
        thisWeek: thisWeek.length,
        pendingApproval: items.filter(s => s.approval_status === 'pending').length,
        injected: items.filter(s => s.injected).length,
        byEra: ERAS_SIMPLE.reduce((acc, e) => { acc[e] = items.filter(s => s.era === e).length; return acc; }, {}),
        byDifficulty: { easy: items.filter(s => s.difficulty === 'easy').length, medium: items.filter(s => s.difficulty === 'medium').length, hard: items.filter(s => s.difficulty === 'hard').length },
      },
      varietyCheck: {
        passed: varietyPassed,
        erasUsed: weekEras,
        regionsUsed: weekRegions,
        difficultiesUsed: weekDiffs,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const ERAS_SIMPLE = ['ancient', 'medieval', 'renaissance', 'industrial', 'modern', 'future'];

// ── Growth: Satellite Blogs ──────────────────────────────

// GET /api/reports/satellite-blogs — satellite blog network overview
router.get('/satellite-blogs', async (req, res) => {
  try {
    const { data: blogs } = await safeQuery(sb =>
      sb.from('satellite_blogs')
        .select('*')
        .eq('account_id', req.accountId)
        .order('created_at', { ascending: false })
    );

    const allBlogs = blogs || [];

    // Get recent posts across all satellite blogs
    const { data: recentPosts } = await safeQuery(sb =>
      sb.from('satellite_posts')
        .select('*')
        .eq('account_id', req.accountId)
        .order('created_at', { ascending: false })
        .limit(50)
    );

    const posts = recentPosts || [];

    // Stats per blog
    const blogStats = allBlogs.map(blog => {
      const blogPosts = posts.filter(p => p.satellite_blog_id === blog.id);
      const withLinks = blogPosts.filter(p => p.has_product_link);
      return {
        ...blog,
        recentPostCount: blogPosts.length,
        linkRate: blogPosts.length > 0 ? Math.round(withLinks.length / blogPosts.length * 100) : 0,
        anchorDistribution: blogPosts.reduce((acc, p) => {
          if (p.link_type) acc[p.link_type] = (acc[p.link_type] || 0) + 1;
          return acc;
        }, {}),
      };
    });

    // Overall stats
    const totalPosts = allBlogs.reduce((s, b) => s + (b.posts_generated || 0), 0);
    const totalBacklinks = allBlogs.reduce((s, b) => s + (b.backlinks_created || 0), 0);
    const linkTypeDistribution = posts.reduce((acc, p) => {
      if (p.link_type) acc[p.link_type] = (acc[p.link_type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      blogs: blogStats,
      stats: {
        totalBlogs: allBlogs.length,
        activeBlogs: allBlogs.filter(b => b.status === 'active').length,
        totalPosts,
        totalBacklinks,
        linkTypeDistribution,
        overallLinkRate: totalPosts > 0 ? Math.round(totalBacklinks / totalPosts * 100) : 0,
      },
      recentPosts: posts.slice(0, 20).map(p => ({
        id: p.id,
        blogId: p.satellite_blog_id,
        title: p.title,
        keyword: p.keyword,
        wordCount: p.word_count,
        hasProductLink: p.has_product_link,
        anchorText: p.anchor_text,
        linkType: p.link_type,
        status: p.status,
        createdAt: p.created_at,
        publishedAt: p.published_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reports/satellite-blogs — create a new satellite blog
router.post('/satellite-blogs', async (req, res) => {
  try {
    const { domain, name, topic, voiceProfile, parentProduct, publishingFrequency } = req.body;
    if (!domain || !name || !topic || !parentProduct) {
      return res.status(400).json({ error: 'domain, name, topic, and parentProduct are required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('satellite_blogs')
        .insert({
          account_id: req.accountId,
          domain,
          name,
          topic,
          voice_profile: voiceProfile || {},
          parent_product: parentProduct,
          publishing_frequency: publishingFrequency || '2-3/week',
          status: 'setup',
        })
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/reports/satellite-blogs/:id — update a satellite blog
router.patch('/satellite-blogs/:id', async (req, res) => {
  try {
    const updates = {};
    const allowed = ['name', 'topic', 'voice_profile', 'publishing_frequency', 'status'];
    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (req.body[camel] !== undefined) updates[key] = req.body[camel];
      else if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('satellite_blogs')
        .update(updates)
        .eq('id', req.params.id)
        .eq('account_id', req.accountId)
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Growth: Vertical Tools ──────────────────────────────

// GET /api/reports/vertical-tools — vertical tool network overview
router.get('/vertical-tools', async (req, res) => {
  try {
    const { data: tools } = await safeQuery(sb =>
      sb.from('vertical_tools')
        .select('*')
        .eq('account_id', req.accountId)
        .order('created_at', { ascending: false })
    );

    const allTools = tools || [];

    // Get discount code stats
    const { data: codes } = await safeQuery(sb =>
      sb.from('discount_codes')
        .select('tool_id, status')
        .eq('account_id', req.accountId)
    );

    const allCodes = codes || [];

    const toolStats = allTools.map(tool => {
      const toolCodes = allCodes.filter(c => c.tool_id === tool.id);
      return {
        ...tool,
        totalCodes: toolCodes.length,
        redeemedCodes: toolCodes.filter(c => c.status === 'redeemed').length,
        conversionRate: tool.visits > 0 ? +(tool.conversions / tool.visits * 100).toFixed(1) : 0,
        ctaRate: tool.visits > 0 ? +(tool.cta_clicks / tool.visits * 100).toFixed(1) : 0,
      };
    });

    // Overall stats
    const totalVisits = allTools.reduce((s, t) => s + (t.visits || 0), 0);
    const totalCtaClicks = allTools.reduce((s, t) => s + (t.cta_clicks || 0), 0);
    const totalConversions = allTools.reduce((s, t) => s + (t.conversions || 0), 0);
    const totalDiscountCodes = allTools.reduce((s, t) => s + (t.discount_codes_generated || 0), 0);

    res.json({
      tools: toolStats,
      stats: {
        totalTools: allTools.length,
        activeTools: allTools.filter(t => t.status === 'active').length,
        totalVisits,
        totalCtaClicks,
        totalConversions,
        totalDiscountCodes,
        overallConversionRate: totalVisits > 0 ? +(totalConversions / totalVisits * 100).toFixed(1) : 0,
        overallCtaRate: totalVisits > 0 ? +(totalCtaClicks / totalVisits * 100).toFixed(1) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reports/vertical-tools — create a new vertical tool
router.post('/vertical-tools', async (req, res) => {
  try {
    const { name, domain, parentProduct, toolType, description, targetKeyword } = req.body;
    if (!name || !domain || !parentProduct || !toolType) {
      return res.status(400).json({ error: 'name, domain, parentProduct, and toolType are required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('vertical_tools')
        .insert({
          account_id: req.accountId,
          name,
          domain,
          parent_product: parentProduct,
          tool_type: toolType,
          description: description || null,
          target_keyword: targetKeyword || null,
          status: 'setup',
        })
        .select()
        .single()
    );

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/discount-codes — discount code overview
router.get('/discount-codes', async (req, res) => {
  try {
    const { tool_id, status } = req.query;
    let query = getSupabase()
      .from('discount_codes')
      .select('*')
      .eq('account_id', req.accountId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (tool_id) query = query.eq('tool_id', tool_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await safeQuery(() => query);
    if (error) return res.status(500).json({ error: error.message });

    const items = data || [];
    const byStatus = items.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});

    res.json({
      codes: items,
      stats: {
        total: items.length,
        byStatus,
        redemptionRate: items.length > 0 ? +(items.filter(c => c.status === 'redeemed').length / items.length * 100).toFixed(1) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
