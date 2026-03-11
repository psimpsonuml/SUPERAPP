const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); } catch (err) { return { data: [], error: err }; }
}

// ── MEDIA CONTACTS ──────────────────────────────────────────────────────────

// GET /contacts — list media contacts with filters
router.get('/contacts', async (req, res) => {
  const { beat, outlet, product, page = 1, limit = 50, sort = 'name', order = 'asc' } = req.query;
  const accountId = req.query.account_id || req.headers['x-account-id'];
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase.from('media_contacts').select('*', { count: 'exact' });
    if (accountId) query = query.eq('account_id', accountId);
    if (beat) query = query.ilike('beat', `%${beat}%`);
    if (outlet) query = query.ilike('outlet', `%${outlet}%`);
    if (product) query = query.contains('product_relevance', [product]);
    query = query.order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ contacts: data || [], page: parseInt(page), limit: parseInt(limit), total: data?.length || 0 });
});

// POST /contacts — add contact
router.post('/contacts', async (req, res) => {
  const accountId = req.body.account_id || req.headers['x-account-id'];
  const { name, outlet, beat, email, social_url, recent_articles_json, reach_estimate, product_relevance, notes } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('media_contacts').insert({
      account_id: accountId,
      name,
      outlet: outlet || '',
      beat: beat || '',
      email: email || '',
      social_url: social_url || '',
      recent_articles_json: recent_articles_json || [],
      reach_estimate: reach_estimate || 0,
      product_relevance: product_relevance || [],
      notes: notes || ''
    }).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /contacts/:id — update contact
router.put('/contacts/:id', async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.account_id;
  delete updates.id;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('media_contacts').update(updates).eq('id', id).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /contacts/:id — remove contact
router.delete('/contacts/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await safeQuery(async (supabase) => {
    return await supabase.from('media_contacts').delete().eq('id', id);
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── PRESS RELEASES ──────────────────────────────────────────────────────────

// GET /releases — list press releases
router.get('/releases', async (req, res) => {
  const { product, status, page = 1, limit = 20, sort = 'created_at', order = 'desc' } = req.query;
  const accountId = req.query.account_id || req.headers['x-account-id'];
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase.from('press_releases').select('*', { count: 'exact' });
    if (accountId) query = query.eq('account_id', accountId);
    if (product) query = query.eq('product', product);
    if (status) query = query.eq('status', status);
    query = query.order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ releases: data || [], page: parseInt(page), limit: parseInt(limit), total: data?.length || 0 });
});

// POST /releases — create press release (Claude API stub for generation)
router.post('/releases', async (req, res) => {
  const accountId = req.body.account_id || req.headers['x-account-id'];
  const { product, headline, body, generate } = req.body;

  if (!product) return res.status(400).json({ error: 'product is required' });

  let finalHeadline = headline || '';
  let finalBody = body || '';

  // Claude API stub: if generate flag is set, simulate AI-generated content
  if (generate) {
    finalHeadline = finalHeadline || `[AI Generated] ${product} — New Announcement`;
    finalBody = finalBody || `[AI Generated Press Release]\n\nProduct: ${product}\n\nThis is a placeholder for Claude API-generated press release content. In production, this would call the Claude API to generate a professional press release based on product details, key messaging points, and target audience.\n\nKey highlights:\n- Feature announcement details\n- Market impact\n- Customer benefits\n- Executive quotes\n\n###`;
  }

  if (!finalHeadline || !finalBody) return res.status(400).json({ error: 'headline and body are required (or set generate: true)' });

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('press_releases').insert({
      account_id: accountId,
      product,
      headline: finalHeadline,
      body: finalBody,
      status: 'draft'
    }).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /releases/:id — update/approve release
router.put('/releases/:id', async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.account_id;
  delete updates.id;

  if (updates.status === 'published' && !updates.published_at) {
    updates.published_at = new Date().toISOString();
  }

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('press_releases').update(updates).eq('id', id).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /releases/:id/pitch — generate personalized pitch emails for relevant contacts
router.post('/releases/:id/pitch', async (req, res) => {
  const { id } = req.params;
  const accountId = req.body.account_id || req.headers['x-account-id'];

  // Fetch the press release
  const { data: release, error: relError } = await safeQuery(async (supabase) => {
    return await supabase.from('press_releases').select('*').eq('id', id).single();
  });

  if (relError) return res.status(500).json({ error: relError.message });
  if (!release) return res.status(404).json({ error: 'Press release not found' });

  // Fetch relevant media contacts
  const { data: contacts, error: conError } = await safeQuery(async (supabase) => {
    let query = supabase.from('media_contacts').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    return await query;
  });

  if (conError) return res.status(500).json({ error: conError.message });

  // Filter contacts by product relevance
  const relevantContacts = (contacts || []).filter(c => {
    const relevance = c.product_relevance || [];
    return relevance.length === 0 || relevance.includes(release.product);
  });

  // Claude API stub: generate personalized pitches
  const pitches = relevantContacts.map(contact => ({
    contact_id: contact.id,
    contact_name: contact.name,
    contact_email: contact.email,
    outlet: contact.outlet,
    subject: `[Pitch] ${release.headline}`,
    body: `Hi ${contact.name},\n\nI wanted to share an exciting announcement from our team that aligns with your coverage of ${contact.beat || 'the industry'}.\n\n${release.headline}\n\n${release.body.substring(0, 200)}...\n\nWould you be interested in covering this story? I'd be happy to arrange an interview or provide additional details.\n\nBest regards`
  }));

  // Update pitches_sent count
  await safeQuery(async (supabase) => {
    return await supabase.from('press_releases').update({
      pitches_sent: (release.pitches_sent || 0) + pitches.length
    }).eq('id', id);
  });

  res.json({ release_id: id, pitches_generated: pitches.length, pitches });
});

// ── MEDIA MENTIONS ──────────────────────────────────────────────────────────

// GET /mentions — media mentions list
router.get('/mentions', async (req, res) => {
  const { product, sentiment, page = 1, limit = 30, sort = 'date_found', order = 'desc' } = req.query;
  const accountId = req.query.account_id || req.headers['x-account-id'];
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase.from('media_mentions').select('*', { count: 'exact' });
    if (accountId) query = query.eq('account_id', accountId);
    if (product) query = query.eq('product', product);
    if (sentiment) query = query.eq('sentiment', sentiment);
    query = query.order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ mentions: data || [], page: parseInt(page), limit: parseInt(limit), total: data?.length || 0 });
});

// POST /mentions — add mention manually
router.post('/mentions', async (req, res) => {
  const accountId = req.body.account_id || req.headers['x-account-id'];
  const { product, source, url, title, sentiment, reach_estimate, date_found } = req.body;

  if (!source) return res.status(400).json({ error: 'source is required' });

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('media_mentions').insert({
      account_id: accountId,
      product: product || '',
      source,
      url: url || '',
      title: title || '',
      sentiment: sentiment || 'neutral',
      reach_estimate: reach_estimate || 0,
      date_found: date_found || new Date().toISOString().split('T')[0]
    }).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── MEDIA OPPORTUNITIES ─────────────────────────────────────────────────────

// GET /opportunities — media opportunities (HARO etc.)
router.get('/opportunities', async (req, res) => {
  const { status, page = 1, limit = 20, sort = 'deadline', order = 'asc' } = req.query;
  const accountId = req.query.account_id || req.headers['x-account-id'];
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase.from('media_opportunities').select('*', { count: 'exact' });
    if (accountId) query = query.eq('account_id', accountId);
    if (status) query = query.eq('status', status);
    query = query.order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ opportunities: data || [], page: parseInt(page), limit: parseInt(limit), total: data?.length || 0 });
});

// POST /opportunities — add opportunity
router.post('/opportunities', async (req, res) => {
  const accountId = req.body.account_id || req.headers['x-account-id'];
  const { source, query_text, deadline, relevance } = req.body;

  if (!source || !query_text) return res.status(400).json({ error: 'source and query_text are required' });

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('media_opportunities').insert({
      account_id: accountId,
      source,
      query_text,
      deadline: deadline || null,
      relevance: relevance || '',
      status: 'new'
    }).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /opportunities/:id — update opportunity (respond/expire)
router.put('/opportunities/:id', async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.account_id;
  delete updates.id;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('media_opportunities').update(updates).eq('id', id).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /opportunities/:id/draft — draft response using Claude API (stub)
router.post('/opportunities/:id/draft', async (req, res) => {
  const { id } = req.params;

  const { data: opp, error: oppError } = await safeQuery(async (supabase) => {
    return await supabase.from('media_opportunities').select('*').eq('id', id).single();
  });

  if (oppError) return res.status(500).json({ error: oppError.message });
  if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

  // Claude API stub: generate draft response
  const draftResponse = `[AI Generated Response Draft]\n\nRe: ${opp.query_text}\n\nThank you for this opportunity. As a subject matter expert in this area, I'd like to offer the following perspective:\n\n1. Key insight relevant to your query\n2. Supporting data point or example\n3. Expert opinion with actionable takeaway\n\nI'm available for follow-up questions and can provide additional context as needed.\n\n[This is a placeholder — in production, Claude API would generate a tailored response based on the query, company expertise, and relevant product information.]`;

  // Save draft to the opportunity
  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('media_opportunities').update({
      response_draft: draftResponse
    }).eq('id', id).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PRESS KIT ───────────────────────────────────────────────────────────────

// GET /press-kit/:product — press kit data for a product
router.get('/press-kit/:product', async (req, res) => {
  const { product } = req.params;
  const accountId = req.query.account_id || req.headers['x-account-id'];

  // Fetch mentions for the product
  const { data: mentions } = await safeQuery(async (supabase) => {
    let query = supabase.from('media_mentions').select('*').eq('product', product);
    if (accountId) query = query.eq('account_id', accountId);
    return await query.order('date_found', { ascending: false }).limit(10);
  });

  // Fetch published releases for the product
  const { data: releases } = await safeQuery(async (supabase) => {
    let query = supabase.from('press_releases').select('*').eq('product', product).eq('status', 'published');
    if (accountId) query = query.eq('account_id', accountId);
    return await query.order('published_at', { ascending: false }).limit(10);
  });

  const totalMentions = (mentions || []).length;
  const positiveMentions = (mentions || []).filter(m => m.sentiment === 'positive').length;

  res.json({
    product,
    company_descriptions: {
      short: `${product} — a cutting-edge solution for modern businesses.`,
      medium: `${product} is a comprehensive platform designed to help businesses streamline operations, increase efficiency, and drive growth. Built with the latest technology, it serves customers across multiple industries.`,
      full: `${product} is an industry-leading platform that empowers businesses of all sizes to transform their operations. With a robust feature set spanning automation, analytics, and integrations, ${product} has established itself as a trusted partner for organizations seeking to modernize their workflows. Our team of experts is dedicated to continuous innovation and customer success.`
    },
    founder_bio: 'Company founder biography — customize in settings.',
    key_metrics: {
      total_press_mentions: totalMentions,
      positive_sentiment_rate: totalMentions > 0 ? Math.round((positiveMentions / totalMentions) * 100) : 0,
      published_releases: (releases || []).length
    },
    recent_coverage: mentions || [],
    published_releases: releases || [],
    sections: [
      { title: 'Company Overview', downloadable: true },
      { title: 'Product Screenshots', downloadable: true },
      { title: 'Executive Bios', downloadable: true },
      { title: 'Brand Assets & Logos', downloadable: true },
      { title: 'Fact Sheet', downloadable: true }
    ]
  });
});

// ── STATS ───────────────────────────────────────────────────────────────────

// GET /stats — PR stats overview
router.get('/stats', async (req, res) => {
  const accountId = req.query.account_id || req.headers['x-account-id'];

  const { data: contacts } = await safeQuery(async (supabase) => {
    let query = supabase.from('media_contacts').select('id');
    if (accountId) query = query.eq('account_id', accountId);
    return await query;
  });

  const { data: releases } = await safeQuery(async (supabase) => {
    let query = supabase.from('press_releases').select('id, status');
    if (accountId) query = query.eq('account_id', accountId);
    return await query;
  });

  const { data: allMentions } = await safeQuery(async (supabase) => {
    let query = supabase.from('media_mentions').select('id, sentiment, date_found');
    if (accountId) query = query.eq('account_id', accountId);
    return await query;
  });

  const { data: opportunities } = await safeQuery(async (supabase) => {
    let query = supabase.from('media_opportunities').select('id, status');
    if (accountId) query = query.eq('account_id', accountId);
    return await query;
  });

  const mentionsList = allMentions || [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const mentionsThisMonth = mentionsList.filter(m => m.date_found >= startOfMonth);

  const sentimentBreakdown = {
    positive: mentionsList.filter(m => m.sentiment === 'positive').length,
    neutral: mentionsList.filter(m => m.sentiment === 'neutral').length,
    negative: mentionsList.filter(m => m.sentiment === 'negative').length
  };

  const releasesList = releases || [];
  const publishedCount = releasesList.filter(r => r.status === 'published').length;

  const oppsList = opportunities || [];
  const activeOpps = oppsList.filter(o => o.status === 'new').length;
  const wonOpps = oppsList.filter(o => o.status === 'won').length;

  res.json({
    total_contacts: (contacts || []).length,
    releases_published: publishedCount,
    releases_total: releasesList.length,
    mentions_this_month: mentionsThisMonth.length,
    mentions_total: mentionsList.length,
    sentiment_breakdown: sentimentBreakdown,
    positive_negative_ratio: sentimentBreakdown.negative > 0
      ? Math.round((sentimentBreakdown.positive / sentimentBreakdown.negative) * 10) / 10
      : sentimentBreakdown.positive > 0 ? Infinity : 0,
    active_opportunities: activeOpps,
    won_opportunities: wonOpps
  });
});

module.exports = router;
