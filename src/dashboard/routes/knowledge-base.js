const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); } catch (err) { return { data: [], error: err }; }
}

// GET / — list articles with filters: product, status, search, sort. Paginated.
router.get('/', async (req, res) => {
  const { product, status, search, sort = 'date', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase
      .from('kb_articles')
      .select('*', { count: 'exact' });

    if (product) query = query.eq('product', product);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`title.ilike.%${search}%,question_normalized.ilike.%${search}%,body_markdown.ilike.%${search}%`);

    if (sort === 'frequency') {
      query = query.order('frequency', { ascending: false });
    } else if (sort === 'views') {
      query = query.order('view_count', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + parseInt(limit) - 1);
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ articles: data || [], page: parseInt(page), limit: parseInt(limit) });
});

// GET /analytics — stats: total articles, most viewed, most helpful, gaps count, articles per product
router.get('/analytics', async (req, res) => {
  const { data: articles, error: artErr } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles').select('*');
  });

  const { data: questions, error: qErr } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_question_log').select('*');
  });

  if (artErr || qErr) return res.status(500).json({ error: 'Failed to fetch analytics' });

  const allArticles = articles || [];
  const allQuestions = questions || [];

  const totalArticles = allArticles.length;
  const publishedArticles = allArticles.filter(a => a.status === 'published');
  const totalViews = allArticles.reduce((sum, a) => sum + (a.view_count || 0), 0);
  const totalHelpful = allArticles.reduce((sum, a) => sum + (a.helpful_count || 0), 0);
  const totalNotHelpful = allArticles.reduce((sum, a) => sum + (a.not_helpful_count || 0), 0);
  const helpfulPercent = (totalHelpful + totalNotHelpful) > 0
    ? Math.round((totalHelpful / (totalHelpful + totalNotHelpful)) * 100)
    : 0;

  const mostViewed = [...allArticles].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 10);
  const mostHelpful = [...allArticles].sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0)).slice(0, 10);

  // Articles per product
  const articlesPerProduct = allArticles.reduce((acc, a) => {
    acc[a.product] = (acc[a.product] || 0) + 1;
    return acc;
  }, {});

  // Gaps: normalized questions without matching articles
  const articleQuestions = new Set(allArticles.map(a => a.question_normalized?.toLowerCase()));
  const questionFreq = {};
  allQuestions.forEach(q => {
    const norm = (q.normalized_question || q.raw_question).toLowerCase();
    questionFreq[norm] = (questionFreq[norm] || 0) + 1;
  });
  const gaps = Object.entries(questionFreq)
    .filter(([q]) => !articleQuestions.has(q))
    .map(([question, frequency]) => ({ question, frequency }))
    .sort((a, b) => b.frequency - a.frequency);

  res.json({
    totalArticles,
    publishedCount: publishedArticles.length,
    totalViews,
    helpfulPercent,
    mostViewed,
    mostHelpful,
    gapsCount: gaps.length,
    articlesPerProduct,
    gaps: gaps.slice(0, 20)
  });
});

// GET /questions — list question log with frequency grouping
router.get('/questions', async (req, res) => {
  const { product, page = 1, limit = 50 } = req.query;

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase.from('kb_question_log').select('*');
    if (product) query = query.eq('product', product);
    query = query.order('created_at', { ascending: false });
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  const questions = data || [];
  const grouped = {};
  questions.forEach(q => {
    const key = (q.normalized_question || q.raw_question).toLowerCase();
    if (!grouped[key]) {
      grouped[key] = { question: q.normalized_question || q.raw_question, product: q.product, frequency: 0, latest: q.created_at, entries: [] };
    }
    grouped[key].frequency += 1;
    grouped[key].entries.push(q);
    if (q.created_at > grouped[key].latest) grouped[key].latest = q.created_at;
  });

  const result = Object.values(grouped).sort((a, b) => b.frequency - a.frequency);
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paginated = result.slice(offset, offset + parseInt(limit));

  res.json({ questions: paginated, total: result.length, page: parseInt(page), limit: parseInt(limit) });
});

// GET /gaps — knowledge gaps: questions without matching articles, sorted by frequency
router.get('/gaps', async (req, res) => {
  const { product } = req.query;

  const { data: articles } = await safeQuery(async (supabase) => {
    let query = supabase.from('kb_articles').select('question_normalized, product');
    if (product) query = query.eq('product', product);
    return await query;
  });

  const { data: questions } = await safeQuery(async (supabase) => {
    let query = supabase.from('kb_question_log').select('*');
    if (product) query = query.eq('product', product);
    return await query;
  });

  const articleQuestions = new Set((articles || []).map(a => a.question_normalized?.toLowerCase()));
  const questionFreq = {};
  (questions || []).forEach(q => {
    const norm = (q.normalized_question || q.raw_question).toLowerCase();
    if (!articleQuestions.has(norm)) {
      if (!questionFreq[norm]) {
        questionFreq[norm] = { question: q.normalized_question || q.raw_question, product: q.product, frequency: 0 };
      }
      questionFreq[norm].frequency += 1;
    }
  });

  const gaps = Object.values(questionFreq).sort((a, b) => b.frequency - a.frequency);
  res.json({ gaps });
});

// GET /export — export all published articles as markdown or HTML
router.get('/export', async (req, res) => {
  const { format = 'md', product } = req.query;

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase.from('kb_articles').select('*').eq('status', 'published');
    if (product) query = query.eq('product', product);
    query = query.order('product').order('title');
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  const articles = data || [];

  if (format === 'html') {
    let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Knowledge Base Export</title>';
    html += '<style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px}';
    html += 'h1{color:#f59e0b}h2{border-bottom:1px solid #333;padding-bottom:8px}';
    html += '.article{margin-bottom:40px}.meta{color:#888;font-size:0.9em}</style></head><body>';
    html += '<h1>Knowledge Base</h1>';

    articles.forEach(article => {
      html += `<div class="article">`;
      html += `<h2>${escapeHtml(article.title)}</h2>`;
      html += `<p class="meta">Product: ${escapeHtml(article.product)} | Views: ${article.view_count} | Helpful: ${article.helpful_count}</p>`;
      html += `<div>${escapeHtml(article.body_markdown)}</div>`;
      html += `</div>`;
    });

    html += '</body></html>';
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="knowledge-base.html"');
    res.send(html);
  } else {
    let md = '# Knowledge Base\n\n';
    articles.forEach(article => {
      md += `## ${article.title}\n\n`;
      md += `**Product:** ${article.product} | **Views:** ${article.view_count} | **Helpful:** ${article.helpful_count}\n\n`;
      md += `${article.body_markdown || ''}\n\n---\n\n`;
    });

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="knowledge-base.md"');
    res.send(md);
  }
});

// GET /:id — single article detail
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles').select('*').eq('id', id).single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Article not found' });

  // Increment view count
  await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id);
  });

  res.json({ article: { ...data, view_count: (data.view_count || 0) + 1 } });
});

// POST /articles — create article manually
router.post('/articles', async (req, res) => {
  const { account_id, product, question_normalized, title, body_markdown, status, tags } = req.body;

  if (!account_id || !product || !title || !question_normalized) {
    return res.status(400).json({ error: 'account_id, product, title, and question_normalized are required' });
  }

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles').insert({
      account_id,
      product,
      question_normalized,
      title,
      body_markdown: body_markdown || '',
      status: status || 'draft',
      tags: tags || []
    }).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ article: data });
});

// PUT /articles/:id — update article
router.put('/articles/:id', async (req, res) => {
  const { id } = req.params;
  const { title, body_markdown, status, tags, question_normalized, product } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (body_markdown !== undefined) updates.body_markdown = body_markdown;
  if (status !== undefined) updates.status = status;
  if (tags !== undefined) updates.tags = tags;
  if (question_normalized !== undefined) updates.question_normalized = question_normalized;
  if (product !== undefined) updates.product = product;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles').update(updates).eq('id', id).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Article not found' });
  res.json({ article: data });
});

// POST /articles/:id/helpful — increment helpful count
router.post('/articles/:id/helpful', async (req, res) => {
  const { id } = req.params;

  const { data: article } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles').select('helpful_count').eq('id', id).single();
  });

  if (!article) return res.status(404).json({ error: 'Article not found' });

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles')
      .update({ helpful_count: (article.helpful_count || 0) + 1 })
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ article: data });
});

// POST /articles/:id/not-helpful — increment not_helpful count
router.post('/articles/:id/not-helpful', async (req, res) => {
  const { id } = req.params;

  const { data: article } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles').select('not_helpful_count').eq('id', id).single();
  });

  if (!article) return res.status(404).json({ error: 'Article not found' });

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles')
      .update({ not_helpful_count: (article.not_helpful_count || 0) + 1 })
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ article: data });
});

// POST /questions — log a new question (with Claude API normalization stub)
router.post('/questions', async (req, res) => {
  const { account_id, product, raw_question, email_id } = req.body;

  if (!account_id || !product || !raw_question) {
    return res.status(400).json({ error: 'account_id, product, and raw_question are required' });
  }

  // Claude API normalization stub
  // In production, this would call Claude to normalize the question
  const normalized_question = normalizeQuestion(raw_question);

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_question_log').insert({
      account_id,
      product,
      raw_question,
      normalized_question,
      email_id: email_id || null
    }).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });

  // Update frequency on matching article if exists
  await safeQuery(async (supabase) => {
    const { data: existing } = await supabase.from('kb_articles')
      .select('id, frequency')
      .eq('question_normalized', normalized_question.toLowerCase())
      .eq('account_id', account_id)
      .single();

    if (existing) {
      await supabase.from('kb_articles')
        .update({ frequency: (existing.frequency || 1) + 1 })
        .eq('id', existing.id);
    }
  });

  res.status(201).json({ question: data });
});

// POST /generate — auto-generate article from a frequent question using Claude API (stub)
router.post('/generate', async (req, res) => {
  const { account_id, product, question } = req.body;

  if (!account_id || !product || !question) {
    return res.status(400).json({ error: 'account_id, product, and question are required' });
  }

  // Claude API stub — in production this would call Claude to generate the article
  const generatedTitle = `How to: ${question.charAt(0).toUpperCase() + question.slice(1)}`;
  const generatedBody = `# ${generatedTitle}\n\n` +
    `## Overview\n\nThis article addresses the frequently asked question: "${question}"\n\n` +
    `## Product\n\n${product}\n\n` +
    `## Answer\n\n` +
    `*This article was auto-generated and needs review.*\n\n` +
    `<!-- TODO: Replace this placeholder with the actual answer. -->\n\n` +
    `The answer to this question involves the following steps:\n\n` +
    `1. Step one — describe the first action\n` +
    `2. Step two — describe the second action\n` +
    `3. Step three — describe the third action\n\n` +
    `## Additional Resources\n\n` +
    `- [Product Documentation](#)\n` +
    `- [Contact Support](#)\n`;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase.from('kb_articles').insert({
      account_id,
      product,
      question_normalized: question.toLowerCase(),
      title: generatedTitle,
      body_markdown: generatedBody,
      status: 'draft',
      tags: ['auto-generated']
    }).select().single();
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ article: data, generated: true });
});

// Helper: normalize question (stub — would use Claude API in production)
function normalizeQuestion(raw) {
  return raw
    .toLowerCase()
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
