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

// GET /api/reports/product-intelligence — product intelligence summary
router.get('/product-intelligence', async (req, res) => {
  try {
    const product = req.query.product;

    const { data } = await safeQuery(sb => {
      let query = sb
        .from('product_intelligence')
        .select('*')
        .eq('account_id', req.accountId)
        .neq('status', 'stays')
        .order('created_at', { ascending: false })
        .limit(50);
      if (product) query = query.eq('product', product);
      return query;
    });
    res.json({ recommendations: data || [] });
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

// GET /api/reports/builder-intel — today's builder community intel
router.get('/builder-intel', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 1;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const { data } = await safeQuery(sb =>
      sb.from('builder_intel')
        .select('*')
        .eq('account_id', req.accountId)
        .gte('date_found', since.toISOString())
        .order('relevance_score', { ascending: false })
    );

    // Group by intel type
    const byType = {};
    const byProduct = {};
    for (const item of (data || [])) {
      byType[item.intel_type] = (byType[item.intel_type] || 0) + 1;
      byProduct[item.product_relevance] = (byProduct[item.product_relevance] || 0) + 1;
    }

    res.json({
      total: (data || []).length,
      byType,
      byProduct,
      items: data || [],
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

module.exports = router;
