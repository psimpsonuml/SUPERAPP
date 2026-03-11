const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); } catch (err) { return { data: [], error: err }; }
}

// GET / — list testimonials with filters, paginated
router.get('/', async (req, res) => {
  const {
    product, source, tag, rating, approved, category,
    page = 1, limit = 20, sort = 'created_at', order = 'desc'
  } = req.query;
  const accountId = req.query.account_id || req.headers['x-account-id'];
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase
      .from('testimonials')
      .select('*', { count: 'exact' });

    if (accountId) query = query.eq('account_id', accountId);
    if (product) query = query.eq('product', product);
    if (source) query = query.eq('source_platform', source);
    if (tag) query = query.contains('tags', [tag]);
    if (rating) query = query.eq('rating', parseInt(rating));
    if (approved !== undefined) query = query.eq('approved', approved === 'true');
    if (category) query = query.eq('category', category);

    query = query.order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    testimonials: data || [],
    page: parseInt(page),
    limit: parseInt(limit),
    total: data?.length || 0
  });
});

// GET /stats — totals per product, average rating, common tags, growth over time
router.get('/stats', async (req, res) => {
  const accountId = req.query.account_id || req.headers['x-account-id'];

  const { data: allTestimonials, error } = await safeQuery(async (supabase) => {
    let query = supabase.from('testimonials').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  const testimonials = allTestimonials || [];
  const total = testimonials.length;

  // Totals per product
  const byProduct = {};
  testimonials.forEach((t) => {
    byProduct[t.product] = (byProduct[t.product] || 0) + 1;
  });

  // Average rating
  const rated = testimonials.filter((t) => t.rating != null);
  const averageRating = rated.length > 0
    ? parseFloat((rated.reduce((sum, t) => sum + t.rating, 0) / rated.length).toFixed(2))
    : 0;

  // Most common tags
  const tagCounts = {};
  testimonials.forEach((t) => {
    const tags = Array.isArray(t.tags) ? t.tags : [];
    tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const commonTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  // Growth over time (by month)
  const growth = {};
  testimonials.forEach((t) => {
    const month = t.created_at ? t.created_at.substring(0, 7) : 'unknown';
    growth[month] = (growth[month] || 0) + 1;
  });
  const growthTimeline = Object.entries(growth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  // Approval stats
  const approvedCount = testimonials.filter((t) => t.approved).length;
  const verifiedCount = testimonials.filter((t) => t.verified).length;

  res.json({
    total,
    byProduct,
    averageRating,
    commonTags,
    growthTimeline,
    approvedCount,
    verifiedCount
  });
});

// GET /export — export approved testimonials as JSON
router.get('/export', async (req, res) => {
  const accountId = req.query.account_id || req.headers['x-account-id'];

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase
      .from('testimonials')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false });

    if (accountId) query = query.eq('account_id', accountId);
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=testimonials_export.json');
  res.json({
    exported_at: new Date().toISOString(),
    count: (data || []).length,
    testimonials: data || []
  });
});

// GET /:id — single testimonial
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('testimonials')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return res.status(404).json({ error: 'Testimonial not found' });
  }

  res.json(data);
});

// POST / — add testimonial manually
router.post('/', async (req, res) => {
  const {
    account_id, product, quote_text, author_name, author_title,
    author_company, source_platform, source_url, rating,
    photo_url, tags, category, verified, approved
  } = req.body;

  if (!account_id || !product || !quote_text) {
    return res.status(400).json({ error: 'account_id, product, and quote_text are required' });
  }

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('testimonials')
      .insert({
        account_id,
        product,
        quote_text,
        author_name: author_name || '',
        author_title: author_title || '',
        author_company: author_company || '',
        source_platform: source_platform || '',
        source_url: source_url || '',
        rating: rating != null ? parseInt(rating) : null,
        photo_url: photo_url || '',
        tags: tags || [],
        category: category || 'text_review',
        verified: verified || false,
        approved: approved || false
      })
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json(data);
});

// PUT /:id — update testimonial (edit, approve, verify)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove fields that should not be directly updated
  delete updates.id;
  delete updates.created_at;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('testimonials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return res.status(404).json({ error: 'Testimonial not found' });
  }

  res.json(data);
});

// DELETE /:id — remove testimonial
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('testimonials')
      .delete()
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: 'Testimonial deleted', testimonial: data });
});

// POST /:id/approve — mark testimonial as approved
router.post('/:id/approve', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('testimonials')
      .update({ approved: true })
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return res.status(404).json({ error: 'Testimonial not found' });
  }

  res.json({ message: 'Testimonial approved', testimonial: data });
});

// POST /:id/social — generate social media post from testimonial (Claude API stub)
router.post('/:id/social', async (req, res) => {
  const { id } = req.params;
  const { platform = 'twitter' } = req.body;

  // Fetch the testimonial first
  const { data: testimonial, error: fetchError } = await safeQuery(async (supabase) => {
    return await supabase
      .from('testimonials')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!testimonial || (Array.isArray(testimonial) && testimonial.length === 0)) {
    return res.status(404).json({ error: 'Testimonial not found' });
  }

  // Stub: In production, this would call the Claude API to generate a social post
  // const prompt = `Generate a ${platform} post featuring this customer testimonial: "${testimonial.quote_text}" — ${testimonial.author_name}, ${testimonial.author_title} at ${testimonial.author_company}`;
  const generatedPost = `"${testimonial.quote_text}" — ${testimonial.author_name}${testimonial.author_company ? `, ${testimonial.author_company}` : ''}`;

  res.json({
    testimonial_id: id,
    platform,
    generated_post: generatedPost,
    note: 'This is a stub response. Connect Claude API for AI-generated social posts.'
  });
});

module.exports = router;
