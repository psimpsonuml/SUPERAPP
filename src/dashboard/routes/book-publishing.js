const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── GET /books — list books with chapter counts, publishing status summary ──
router.get('/books', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: books, error } = await safeQuery(sb =>
      sb.from('books_authored').select('*').eq('account_id', accountId).order('created_at', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });

    const enriched = [];
    for (const book of books) {
      const { data: chapters } = await safeQuery(sb =>
        sb.from('book_chapters').select('id, status, word_count').eq('book_id', book.id)
      );
      const { data: pubs } = await safeQuery(sb =>
        sb.from('book_publishing').select('id, platform, status').eq('book_id', book.id)
      );
      const chapterList = chapters || [];
      const pubList = pubs || [];
      const totalChapterWords = chapterList.reduce((s, c) => s + (c.word_count || 0), 0);
      const pubStatusSummary = {};
      pubList.forEach(p => { pubStatusSummary[p.status] = (pubStatusSummary[p.status] || 0) + 1; });

      enriched.push({
        ...book,
        chapter_count: chapterList.length,
        chapter_word_total: totalChapterWords,
        chapters_final: chapterList.filter(c => c.status === 'final').length,
        publishing_count: pubList.length,
        publishing_status_summary: pubStatusSummary,
      });
    }

    res.json({ books: enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /books/:id — book detail with chapters, publishing, queries ──
router.get('/books/:id', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: book, error } = await safeQuery(sb =>
      sb.from('books_authored').select('*').eq('id', req.params.id).eq('account_id', accountId).single()
    );
    if (error) return res.status(500).json({ error: error.message });
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const { data: chapters } = await safeQuery(sb =>
      sb.from('book_chapters').select('*').eq('book_id', book.id).order('chapter_number')
    );
    const { data: publishing } = await safeQuery(sb =>
      sb.from('book_publishing').select('*').eq('book_id', book.id).order('platform')
    );
    const { data: queries } = await safeQuery(sb =>
      sb.from('book_queries').select('*').eq('book_id', book.id).order('date_sent', { ascending: false })
    );

    res.json({
      book,
      chapters: chapters || [],
      publishing: publishing || [],
      queries: queries || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /books — create book ──
router.post('/books', async (req, res) => {
  try {
    const { account_id, title, series_name, series_order, genre, word_count, synopsis, target_date, cover_url, metadata_json } = req.body;
    if (!account_id || !title) return res.status(400).json({ error: 'account_id and title required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('books_authored').insert({
        account_id, title,
        series_name: series_name || '',
        series_order: series_order || null,
        genre: genre || '',
        word_count: word_count || 0,
        synopsis: synopsis || '',
        target_date: target_date || null,
        cover_url: cover_url || '',
        metadata_json: metadata_json || {},
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ book: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /books/:id — update book ──
router.put('/books/:id', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.account_id;
    delete updates.id;

    const { data, error } = await safeQuery(sb =>
      sb.from('books_authored').update(updates).eq('id', req.params.id).eq('account_id', accountId).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ book: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /books/:id — remove book ──
router.delete('/books/:id', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { error } = await safeQuery(sb =>
      sb.from('books_authored').delete().eq('id', req.params.id).eq('account_id', accountId)
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /books/:id/chapters — list chapters ──
router.get('/books/:id/chapters', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_chapters').select('*').eq('book_id', req.params.id).eq('account_id', accountId).order('chapter_number')
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ chapters: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /books/:id/chapters — add chapter ──
router.post('/books/:id/chapters', async (req, res) => {
  try {
    const { account_id, chapter_number, title, word_count, status } = req.body;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_chapters').insert({
        account_id,
        book_id: req.params.id,
        chapter_number: chapter_number || 1,
        title: title || '',
        word_count: word_count || 0,
        status: status || 'drafting',
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ chapter: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /chapters/:chapId — update chapter ──
router.put('/chapters/:chapId', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const updates = { ...req.body };
    delete updates.account_id;
    delete updates.id;

    const { data, error } = await safeQuery(sb =>
      sb.from('book_chapters').update(updates).eq('id', req.params.chapId).eq('account_id', accountId).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ chapter: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /chapters/:chapId/edit-assist — editing assistance via Claude API (stub) ──
router.post('/chapters/:chapId/edit-assist', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: chapter } = await safeQuery(sb =>
      sb.from('book_chapters').select('*').eq('id', req.params.chapId).eq('account_id', accountId).single()
    );
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    // Stub: In production, call Claude API for editing suggestions
    const editResult = {
      chapter_id: chapter.id,
      suggestions: [
        { type: 'pacing', note: 'Consider tightening the opening paragraph for stronger hook.' },
        { type: 'dialogue', note: 'Dialogue tags could be varied more for natural flow.' },
        { type: 'show_dont_tell', note: 'Paragraph 3 could benefit from more sensory details.' },
      ],
      readability_score: 72,
      pacing_score: 68,
      dialogue_score: 75,
      overall_score: 71,
      generated_at: new Date().toISOString(),
    };

    // Save scores to chapter
    await safeQuery(sb =>
      sb.from('book_chapters').update({ edit_score_json: editResult }).eq('id', chapter.id)
    );

    res.json({ edit_assist: editResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /books/:id/publishing — publishing platform status ──
router.get('/books/:id/publishing', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_publishing').select('*').eq('book_id', req.params.id).eq('account_id', accountId).order('platform')
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ publishing: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /books/:id/publishing — add platform listing ──
router.post('/books/:id/publishing', async (req, res) => {
  try {
    const { account_id, platform, format, isbn, listing_url, price, publish_date, status, enrollment_json } = req.body;
    if (!account_id || !platform) return res.status(400).json({ error: 'account_id and platform required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_publishing').insert({
        account_id,
        book_id: req.params.id,
        platform,
        format: format || 'ebook',
        isbn: isbn || '',
        listing_url: listing_url || '',
        price: price || null,
        publish_date: publish_date || null,
        status: status || 'pending',
        enrollment_json: enrollment_json || {},
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ publishing: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /publishing/:pubId — update listing status ──
router.put('/publishing/:pubId', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const updates = { ...req.body };
    delete updates.account_id;
    delete updates.id;

    const { data, error } = await safeQuery(sb =>
      sb.from('book_publishing').update(updates).eq('id', req.params.pubId).eq('account_id', accountId).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ publishing: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /books/:id/queries — query submissions for a book ──
router.get('/books/:id/queries', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_queries').select('*').eq('book_id', req.params.id).eq('account_id', accountId).order('date_sent', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ queries: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /books/:id/queries — create query (with letter generation stub) ──
router.post('/books/:id/queries', async (req, res) => {
  try {
    const { account_id, agent_name, agency, email, materials_sent, date_sent, response_deadline, status, response_notes } = req.body;
    if (!account_id || !agent_name) return res.status(400).json({ error: 'account_id and agent_name required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_queries').insert({
        account_id,
        book_id: req.params.id,
        agent_name,
        agency: agency || '',
        email: email || '',
        materials_sent: materials_sent || '',
        date_sent: date_sent || new Date().toISOString().slice(0, 10),
        response_deadline: response_deadline || null,
        status: status || 'sent',
        response_notes: response_notes || '',
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });

    // Stub: In production, generate a query letter via Claude API
    const generatedLetter = {
      subject: `Query: ${req.body.book_title || 'Untitled'} - ${req.body.genre || 'Fiction'}`,
      body: 'Dear ' + agent_name + ',\n\n[Generated query letter would appear here based on book synopsis, genre, and agent preferences.]\n\nThank you for your time and consideration.\n\nBest regards',
      generated_at: new Date().toISOString(),
    };

    res.json({ query: data, generated_letter: generatedLetter });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /queries/:qId — update query status ──
router.put('/queries/:qId', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const updates = { ...req.body };
    delete updates.account_id;
    delete updates.id;

    const { data, error } = await safeQuery(sb =>
      sb.from('book_queries').update(updates).eq('id', req.params.qId).eq('account_id', accountId).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ query: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /books/:id/arcs — ARC readers list ──
router.get('/books/:id/arcs', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_arcs').select('*').eq('book_id', req.params.id).eq('account_id', accountId).order('date_sent', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ arcs: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /books/:id/arcs — add ARC reader ──
router.post('/books/:id/arcs', async (req, res) => {
  try {
    const { account_id, reader_name, reader_email, date_sent, platform } = req.body;
    if (!account_id || !reader_name) return res.status(400).json({ error: 'account_id and reader_name required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_arcs').insert({
        account_id,
        book_id: req.params.id,
        reader_name,
        reader_email: reader_email || '',
        date_sent: date_sent || new Date().toISOString().slice(0, 10),
        platform: platform || '',
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ arc: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /arcs/:arcId — update ARC (review received) ──
router.put('/arcs/:arcId', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const updates = { ...req.body };
    delete updates.account_id;
    delete updates.id;

    const { data, error } = await safeQuery(sb =>
      sb.from('book_arcs').update(updates).eq('id', req.params.arcId).eq('account_id', accountId).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ arc: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /books/:id/marketing — marketing calendar ──
router.get('/books/:id/marketing', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_marketing_calendar').select('*').eq('book_id', req.params.id).eq('account_id', accountId).order('date')
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ marketing: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /books/:id/marketing — add calendar item ──
router.post('/books/:id/marketing', async (req, res) => {
  try {
    const { account_id, date, action_type, description, content_draft, status } = req.body;
    if (!account_id || !date || !action_type) return res.status(400).json({ error: 'account_id, date, and action_type required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_marketing_calendar').insert({
        account_id,
        book_id: req.params.id,
        date,
        action_type,
        description: description || '',
        content_draft: content_draft || '',
        status: status || 'pending',
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ marketing_item: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /marketing/:mId — update calendar item status ──
router.put('/marketing/:mId', async (req, res) => {
  try {
    const accountId = req.body.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const updates = { ...req.body };
    delete updates.account_id;
    delete updates.id;

    const { data, error } = await safeQuery(sb =>
      sb.from('book_marketing_calendar').update(updates).eq('id', req.params.mId).eq('account_id', accountId).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ marketing_item: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /books/:id/marketing/generate — auto-generate launch calendar (stub) ──
router.post('/books/:id/marketing/generate', async (req, res) => {
  try {
    const { account_id, launch_date } = req.body;
    if (!account_id || !launch_date) return res.status(400).json({ error: 'account_id and launch_date required' });

    const bookId = req.params.id;
    const launch = new Date(launch_date);

    const calendarTemplate = [
      { dayOffset: -90, action_type: 'cover_reveal_prep', description: 'Begin cover reveal planning and teaser graphics' },
      { dayOffset: -60, action_type: 'arc_distribution', description: 'Send ARCs to readers and reviewers' },
      { dayOffset: -30, action_type: 'cover_reveal', description: 'Official cover reveal across social media' },
      { dayOffset: -30, action_type: 'preorder_setup', description: 'Set up preorder links on all platforms' },
      { dayOffset: -14, action_type: 'blog_tour', description: 'Begin blog tour and guest posts' },
      { dayOffset: -14, action_type: 'social_campaign', description: 'Launch countdown social media campaign' },
      { dayOffset: -7, action_type: 'newsletter_blast', description: 'Send newsletter announcement with preorder link' },
      { dayOffset: -7, action_type: 'review_push', description: 'Remind ARC readers to post reviews' },
      { dayOffset: 0, action_type: 'launch_day', description: 'Launch day! Post across all platforms, send newsletter' },
      { dayOffset: 0, action_type: 'price_promo', description: 'Launch day pricing promotion' },
      { dayOffset: 7, action_type: 'follow_up', description: 'Post-launch social media push and thank readers' },
      { dayOffset: 7, action_type: 'ad_campaign', description: 'Begin paid advertising campaign' },
      { dayOffset: 30, action_type: 'review_roundup', description: 'Share review roundup and reader testimonials' },
      { dayOffset: 30, action_type: 'sales_analysis', description: 'Analyze first month sales and adjust strategy' },
    ];

    const items = calendarTemplate.map(t => {
      const d = new Date(launch);
      d.setDate(d.getDate() + t.dayOffset);
      return {
        account_id,
        book_id: bookId,
        date: d.toISOString().slice(0, 10),
        action_type: t.action_type,
        description: t.description,
        status: 'pending',
      };
    });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_marketing_calendar').insert(items).select()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ marketing_items: data || [], count: (data || []).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /books/:id/sales — sales data with date range filter ──
router.get('/books/:id/sales', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    let query = getSupabase()
      .from('book_sales')
      .select('*')
      .eq('book_id', req.params.id)
      .eq('account_id', accountId)
      .order('date', { ascending: false });

    if (req.query.start_date) query = query.gte('date', req.query.start_date);
    if (req.query.end_date) query = query.lte('date', req.query.end_date);

    if (!isSupabaseConfigured()) return res.json({ sales: [] });
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ sales: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /books/:id/sales/summary — sales summary per platform ──
router.get('/books/:id/sales/summary', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_sales').select('*').eq('book_id', req.params.id).eq('account_id', accountId)
    );
    if (error) return res.status(500).json({ error: error.message });

    const sales = data || [];
    let totalUnits = 0, totalRevenue = 0, totalRoyalty = 0;
    const byPlatform = {};

    sales.forEach(s => {
      totalUnits += s.units_sold || 0;
      totalRevenue += parseFloat(s.revenue) || 0;
      totalRoyalty += parseFloat(s.royalty) || 0;

      if (!byPlatform[s.platform]) {
        byPlatform[s.platform] = { platform: s.platform, units: 0, revenue: 0, royalty: 0 };
      }
      byPlatform[s.platform].units += s.units_sold || 0;
      byPlatform[s.platform].revenue += parseFloat(s.revenue) || 0;
      byPlatform[s.platform].royalty += parseFloat(s.royalty) || 0;
    });

    res.json({
      total_units: totalUnits,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_royalty: Math.round(totalRoyalty * 100) / 100,
      by_platform: Object.values(byPlatform),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /books/:id/reviews — reviews list ──
router.get('/books/:id/reviews', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_reviews').select('*').eq('book_id', req.params.id).eq('account_id', accountId).order('date_found', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ reviews: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /books/:id/reviews — add review ──
router.post('/books/:id/reviews', async (req, res) => {
  try {
    const { account_id, platform, reviewer, rating, review_text, review_url, sentiment, date_found } = req.body;
    if (!account_id || !platform) return res.status(400).json({ error: 'account_id and platform required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('book_reviews').insert({
        account_id,
        book_id: req.params.id,
        platform,
        reviewer: reviewer || '',
        rating: rating || null,
        review_text: review_text || '',
        review_url: review_url || '',
        sentiment: sentiment || 'neutral',
        date_found: date_found || new Date().toISOString().slice(0, 10),
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ review: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /sales/dashboard — unified sales dashboard across all books ──
router.get('/sales/dashboard', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: sales, error } = await safeQuery(sb =>
      sb.from('book_sales').select('*').eq('account_id', accountId).order('date', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });

    const { data: books } = await safeQuery(sb =>
      sb.from('books_authored').select('id, title').eq('account_id', accountId)
    );
    const bookMap = {};
    (books || []).forEach(b => { bookMap[b.id] = b.title; });

    let totalUnits = 0, totalRevenue = 0, totalRoyalty = 0;
    const byBook = {};
    const byPlatform = {};
    const byMonth = {};

    (sales || []).forEach(s => {
      const units = s.units_sold || 0;
      const rev = parseFloat(s.revenue) || 0;
      const roy = parseFloat(s.royalty) || 0;
      totalUnits += units;
      totalRevenue += rev;
      totalRoyalty += roy;

      const bookTitle = bookMap[s.book_id] || 'Unknown';
      if (!byBook[bookTitle]) byBook[bookTitle] = { title: bookTitle, units: 0, revenue: 0, royalty: 0 };
      byBook[bookTitle].units += units;
      byBook[bookTitle].revenue += rev;
      byBook[bookTitle].royalty += roy;

      if (!byPlatform[s.platform]) byPlatform[s.platform] = { platform: s.platform, units: 0, revenue: 0, royalty: 0 };
      byPlatform[s.platform].units += units;
      byPlatform[s.platform].revenue += rev;
      byPlatform[s.platform].royalty += roy;

      if (s.date) {
        const month = s.date.slice(0, 7);
        if (!byMonth[month]) byMonth[month] = { month, units: 0, revenue: 0, royalty: 0 };
        byMonth[month].units += units;
        byMonth[month].revenue += rev;
        byMonth[month].royalty += roy;
      }
    });

    res.json({
      total_units: totalUnits,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_royalty: Math.round(totalRoyalty * 100) / 100,
      by_book: Object.values(byBook),
      by_platform: Object.values(byPlatform),
      by_month: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /stats — overall stats ──
router.get('/stats', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data: books } = await safeQuery(sb =>
      sb.from('books_authored').select('id, draft_status').eq('account_id', accountId)
    );
    const { data: sales } = await safeQuery(sb =>
      sb.from('book_sales').select('units_sold, revenue, royalty').eq('account_id', accountId)
    );
    const { data: queries } = await safeQuery(sb =>
      sb.from('book_queries').select('id, status').eq('account_id', accountId)
    );
    const { data: reviews } = await safeQuery(sb =>
      sb.from('book_reviews').select('id').eq('account_id', accountId)
    );

    const bookList = books || [];
    const salesList = sales || [];
    const queryList = queries || [];

    let totalUnits = 0, totalRevenue = 0, totalRoyalty = 0;
    salesList.forEach(s => {
      totalUnits += s.units_sold || 0;
      totalRevenue += parseFloat(s.revenue) || 0;
      totalRoyalty += parseFloat(s.royalty) || 0;
    });

    const statusCounts = {};
    bookList.forEach(b => {
      statusCounts[b.draft_status] = (statusCounts[b.draft_status] || 0) + 1;
    });

    const querySent = queryList.filter(q => q.status === 'sent').length;
    const queryPending = queryList.filter(q => ['sent', 'requested_materials'].includes(q.status)).length;
    const queryOffers = queryList.filter(q => q.status === 'offer').length;

    res.json({
      books_count: bookList.length,
      books_by_status: statusCounts,
      total_sales_units: totalUnits,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_royalty: Math.round(totalRoyalty * 100) / 100,
      queries_sent: querySent,
      queries_active: queryPending,
      query_offers: queryOffers,
      reviews_count: (reviews || []).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
