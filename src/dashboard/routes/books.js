const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

const OL_BASE = 'https://openlibrary.org';
const OL_COVERS = 'https://covers.openlibrary.org';

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

async function olFetch(path) {
  const res = await fetch(`${OL_BASE}${path}`);
  if (!res.ok) throw new Error(`Open Library API error: ${res.status}`);
  return res.json();
}

function coverUrl(coverId, size = 'M') {
  if (!coverId) return null;
  return `${OL_COVERS}/b/id/${coverId}-${size}.jpg`;
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

// ── OPEN LIBRARY BROWSE ───────────────────────────────────

// GET /api/books/discover?feed=trending|popular|subject&subject=fiction&page=1
router.get('/discover', async (req, res) => {
  try {
    const { feed = 'trending', subject, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * 20;

    let results = [];

    if (feed === 'search' && req.query.q) {
      // Search mode
      const data = await olFetch(`/search.json?q=${encodeURIComponent(req.query.q)}&limit=20&offset=${offset}&fields=key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,edition_count`);
      results = (data.docs || []).map(formatSearchDoc);
    } else if (subject) {
      // Subject-based browsing
      const data = await olFetch(`/subjects/${encodeURIComponent(subject)}.json?limit=20&offset=${offset}`);
      results = (data.works || []).map(w => formatSubjectWork(w, subject));
    } else if (feed === 'trending') {
      const data = await olFetch(`/trending/daily.json?limit=20&page=${page}`);
      results = (data.works || []).map(formatTrendingWork);
    } else {
      // Popular — use a well-known subject
      const data = await olFetch(`/subjects/popular.json?limit=20&offset=${offset}`);
      results = (data.works || []).map(w => formatSubjectWork(w, 'popular'));
    }

    res.json({ results, page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/books/search?q=dune&page=1
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1 } = req.query;
    if (!q) return res.status(400).json({ error: 'q parameter required' });

    const offset = (parseInt(page) - 1) * 20;
    const data = await olFetch(`/search.json?q=${encodeURIComponent(q)}&limit=20&offset=${offset}&fields=key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,edition_count`);

    res.json({
      results: (data.docs || []).map(formatSearchDoc),
      total: data.numFound || 0,
      page: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/books/detail/:workId — get full book details
router.get('/detail/:workId', async (req, res) => {
  try {
    const workId = req.params.workId;
    const data = await olFetch(`/works/${workId}.json`);

    // Get editions for page count
    let pageCount = null;
    try {
      const editions = await olFetch(`/works/${workId}/editions.json?limit=5`);
      const withPages = (editions.entries || []).find(e => e.number_of_pages);
      pageCount = withPages?.number_of_pages || null;
    } catch {}

    const description = typeof data.description === 'string'
      ? data.description
      : data.description?.value || '';

    res.json({
      key: data.key,
      title: data.title,
      description,
      covers: data.covers || [],
      subjects: (data.subjects || []).slice(0, 10),
      first_publish_date: data.first_publish_date,
      page_count: pageCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/books/subjects — common book genres/subjects
router.get('/subjects', (_req, res) => {
  res.json({
    subjects: [
      { id: 'fiction', label: 'Fiction' },
      { id: 'science_fiction', label: 'Science Fiction' },
      { id: 'fantasy', label: 'Fantasy' },
      { id: 'mystery', label: 'Mystery' },
      { id: 'thriller', label: 'Thriller' },
      { id: 'romance', label: 'Romance' },
      { id: 'horror', label: 'Horror' },
      { id: 'biography', label: 'Biography' },
      { id: 'history', label: 'History' },
      { id: 'science', label: 'Science' },
      { id: 'philosophy', label: 'Philosophy' },
      { id: 'psychology', label: 'Psychology' },
      { id: 'self-help', label: 'Self Help' },
      { id: 'business', label: 'Business' },
      { id: 'poetry', label: 'Poetry' },
      { id: 'young_adult', label: 'Young Adult' },
      { id: 'children', label: 'Children' },
      { id: 'classics', label: 'Classics' },
    ],
  });
});

// ── RATE / STATUS ─────────────────────────────────────────

// POST /api/books/rate — rate or set status on a book
router.post('/rate', async (req, res) => {
  const { open_library_id, title, author, year, genre, cover_url, page_count, description, score, status, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Database not configured' });
    const supabase = getSupabase();
    const accountId = req.accountId;

    // 1. Upsert book item
    const itemData = {
      account_id: accountId,
      title,
      author: author || null,
      year: year || null,
      genre: genre || null,
      cover_url: cover_url || null,
      page_count: page_count || null,
      description: description || null,
      metadata_json: {},
      updated_at: new Date().toISOString(),
    };
    if (open_library_id) itemData.open_library_id = open_library_id;

    const conflictKey = open_library_id ? 'account_id,open_library_id' : 'account_id,title,author';
    const { data: item, error: itemErr } = await supabase
      .from('book_items')
      .upsert(itemData, { onConflict: conflictKey })
      .select()
      .single();
    if (itemErr) throw itemErr;

    // 2. Upsert rating
    const ratingData = {
      account_id: accountId,
      book_id: item.id,
      status: status || 'rated',
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };
    if (score && status !== 'want_to_read' && status !== 'abandoned') {
      ratingData.score = score;
      ratingData.rated_at = new Date().toISOString();
    }

    const { data: rating, error: ratingErr } = await supabase
      .from('book_ratings')
      .upsert(ratingData, { onConflict: 'account_id,book_id' })
      .select()
      .single();
    if (ratingErr) throw ratingErr;

    // 3. Run author cascade if rated with a score
    if (score && author && status !== 'want_to_read' && status !== 'abandoned') {
      runBookCascade(accountId, author).catch(err => console.error('Book cascade error:', err));
    }

    res.json({ item, rating });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── LIBRARY ───────────────────────────────────────────────

// GET /api/books/library?status=rated&sort=score&genre=fiction
router.get('/library', async (req, res) => {
  try {
    const { status, sort = 'rated_at', genre } = req.query;
    const accountId = req.accountId;

    if (!isSupabaseConfigured()) return res.json({ library: [], stats: {} });

    let query = getSupabase()
      .from('book_ratings')
      .select('*, book_items(*)')
      .eq('account_id', accountId);

    if (status) query = query.eq('status', status);

    // Sort
    const sortMap = {
      score: { column: 'score', ascending: false },
      rated_at: { column: 'rated_at', ascending: false },
      created_at: { column: 'created_at', ascending: false },
    };
    const sortOpts = sortMap[sort] || sortMap.rated_at;
    query = query.order(sortOpts.column, { ascending: sortOpts.ascending });
    query = query.limit(200);

    const { data, error } = await query;
    if (error) throw error;

    let results = data || [];

    // Client-side filters that need join data
    if (genre) {
      results = results.filter(r => {
        const g = r.book_items?.genre || '';
        return g.toLowerCase().includes(genre.toLowerCase());
      });
    }

    // Extract unique genres for filter options
    const genres = [...new Set(results.map(r => r.book_items?.genre).filter(Boolean))];

    res.json({ ratings: results, genres });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/books/rated-ids — all Open Library IDs already interacted with
router.get('/rated-ids', async (req, res) => {
  try {
    if (!isSupabaseConfigured()) return res.json({ ids: [] });
    const supabase = getSupabase();
    const { data } = await supabase
      .from('book_items')
      .select('open_library_id')
      .eq('account_id', req.accountId)
      .not('open_library_id', 'is', null);

    const ids = (data || []).map(d => d.open_library_id).filter(Boolean);
    res.json({ ids });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── AUTHOR RANKINGS (CASCADE) ─────────────────────────────

// GET /api/books/authors — ranked authors by cascade score
router.get('/authors', async (req, res) => {
  try {
    const accountId = req.accountId;

    const { data } = await safeQuery((sb) =>
      sb.from('cascade_scores')
        .select('*')
        .eq('account_id', accountId)
        .eq('source_type', 'book')
        .order('composite_score', { ascending: false })
        .limit(100)
    );

    res.json({ authors: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/books/authors/:name — all rated + unrated books by author
router.get('/authors/:name', async (req, res) => {
  try {
    const accountId = req.accountId;
    const authorName = decodeURIComponent(req.params.name);

    // Get rated books by this author
    const { data: ratedItems } = await safeQuery((sb) =>
      sb.from('book_items')
        .select('*, book_ratings(*)')
        .eq('account_id', accountId)
        .eq('author', authorName)
        .order('created_at', { ascending: false })
    );

    // Search Open Library for more books by this author
    let unrated = [];
    try {
      const searchData = await olFetch(`/search.json?author=${encodeURIComponent(authorName)}&limit=20&fields=key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median`);
      const ratedOlIds = new Set((ratedItems || []).map(r => r.open_library_id).filter(Boolean));
      unrated = (searchData.docs || [])
        .map(formatSearchDoc)
        .filter(d => !ratedOlIds.has(d.open_library_id));
    } catch {}

    res.json({
      author: authorName,
      rated: ratedItems || [],
      unrated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── CASCADE ENGINE ────────────────────────────────────────

async function runBookCascade(accountId, authorName) {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();

  // Get all rated books by this author
  const { data: items } = await supabase
    .from('book_items')
    .select('id, author')
    .eq('account_id', accountId)
    .eq('author', authorName);

  if (!items || items.length === 0) return;

  const itemIds = items.map(i => i.id);

  // Get all ratings for those books
  const { data: ratings } = await supabase
    .from('book_ratings')
    .select('book_id, score, status')
    .eq('account_id', accountId)
    .in('book_id', itemIds)
    .eq('status', 'rated')
    .not('score', 'is', null);

  if (!ratings || ratings.length === 0) return;

  // Author gets 100% weight
  const weightedSum = ratings.reduce((sum, r) => sum + r.score, 0);
  const count = ratings.length;
  const compositeScore = weightedSum / count;

  await supabase.from('cascade_scores').upsert({
    account_id: accountId,
    person_name: authorName,
    tmdb_person_id: null,
    primary_role: 'author',
    composite_score: Math.round(compositeScore * 100) / 100,
    weighted_sum: Math.round(weightedSum * 100) / 100,
    weight_total: count,
    ratings_count: count,
    item_type: 'book',
    source_type: 'book',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'account_id,person_name,primary_role,item_type' });
}

// ── FORMAT HELPERS ────────────────────────────────────────

function formatSearchDoc(doc) {
  return {
    open_library_id: doc.key, // e.g. "/works/OL45883W"
    title: doc.title,
    author: (doc.author_name || [])[0] || null,
    year: doc.first_publish_year || null,
    cover_url: coverUrl(doc.cover_i),
    cover_id: doc.cover_i || null,
    page_count: doc.number_of_pages_median || null,
    genre: (doc.subject || []).slice(0, 3).join(', ') || null,
    description: null, // Search results don't include descriptions
    edition_count: doc.edition_count || null,
  };
}

function formatTrendingWork(w) {
  return {
    open_library_id: w.key,
    title: w.title,
    author: w.author_name || (w.authors && w.authors[0]?.name) || null,
    year: w.first_publish_year || extractYear(w.first_publish_date) || null,
    cover_url: coverUrl(w.cover_i || (w.cover_id)),
    cover_id: w.cover_i || w.cover_id || null,
    page_count: null,
    genre: null,
    description: null,
  };
}

function formatSubjectWork(w, subject) {
  return {
    open_library_id: w.key,
    title: w.title,
    author: (w.authors || [])[0]?.name || null,
    year: extractYear(w.first_publish_date) || w.first_publish_year || null,
    cover_url: coverUrl(w.cover_id || w.cover_i),
    cover_id: w.cover_id || w.cover_i || null,
    page_count: null,
    genre: subject,
    description: null,
  };
}

module.exports = router;
