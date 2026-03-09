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

module.exports = router;
