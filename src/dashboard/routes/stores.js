const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: [], error: err }; }
}

// ── SELLER MODE: MY STORES ─────────────────────────────────

// GET / — list my stores (seller mode)
router.get('/', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('user_stores').select('*')
        .eq('account_id', accountId)
        .eq('mode', 'seller')
        .order('created_at', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ stores: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — connect a store
router.post('/', async (req, res) => {
  try {
    const { account_id, platform, store_name, store_url, api_key, mode } = req.body;
    if (!account_id || !platform || !store_name) {
      return res.status(400).json({ error: 'account_id, platform, and store_name required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('user_stores').insert({
        account_id,
        platform,
        store_name,
        store_url: store_url || '',
        api_credentials_encrypted: api_key || '',
        mode: mode || 'seller',
        status: 'active'
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ store: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — update store
router.put('/:id', async (req, res) => {
  try {
    const { store_name, store_url, api_key, status } = req.body;
    const updates = {};
    if (store_name !== undefined) updates.store_name = store_name;
    if (store_url !== undefined) updates.store_url = store_url;
    if (api_key !== undefined) updates.api_credentials_encrypted = api_key;
    if (status !== undefined) updates.status = status;

    const { data, error } = await safeQuery(sb =>
      sb.from('user_stores').update(updates)
        .eq('id', req.params.id)
        .select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ store: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — disconnect store
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await safeQuery(sb =>
      sb.from('user_stores').delete().eq('id', req.params.id)
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/sales — sales for a store, date range filter
router.get('/:id/sales', async (req, res) => {
  try {
    const { from, to, limit = 50 } = req.query;
    let query = getSupabase().from('store_sales').select('*')
      .eq('store_id', req.params.id)
      .order('order_date', { ascending: false })
      .limit(parseInt(limit));

    if (from) query = query.gte('order_date', from);
    if (to) query = query.lte('order_date', to);

    const { data, error } = await safeQuery(() => query);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ sales: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/listings — active listings for a store
router.get('/:id/listings', async (req, res) => {
  try {
    const { data, error } = await safeQuery(sb =>
      sb.from('store_listings').select('*')
        .eq('store_id', req.params.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ listings: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SELLER DASHBOARD ────────────────────────────────────────

// GET /dashboard — unified seller dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
    const monthAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);

    // Fetch stores
    const { data: stores } = await safeQuery(sb =>
      sb.from('user_stores').select('*')
        .eq('account_id', accountId)
        .eq('mode', 'seller')
    );

    // Fetch all sales for dashboard calcs
    const { data: allSales } = await safeQuery(sb =>
      sb.from('store_sales').select('*')
        .eq('account_id', accountId)
        .gte('order_date', monthAgo)
        .order('order_date', { ascending: false })
    );

    // Fetch active listings count
    const { data: listings } = await safeQuery(sb =>
      sb.from('store_listings').select('id, store_id, title, price, status, quantity')
        .eq('account_id', accountId)
        .eq('status', 'active')
    );

    const sales = allSales || [];
    const todaySales = sales.filter(s => s.order_date === todayStr);
    const weekSales = sales.filter(s => s.order_date >= weekAgo);
    const monthSales = sales;

    const sumRevenue = (arr) => arr.reduce((t, s) => t + parseFloat(s.price || 0), 0);

    // Revenue by store
    const revenueByStore = {};
    for (const s of sales) {
      if (!revenueByStore[s.store_id]) revenueByStore[s.store_id] = { today: 0, week: 0, month: 0 };
      const amt = parseFloat(s.price || 0);
      if (s.order_date === todayStr) revenueByStore[s.store_id].today += amt;
      if (s.order_date >= weekAgo) revenueByStore[s.store_id].week += amt;
      revenueByStore[s.store_id].month += amt;
    }

    // Best sellers
    const itemCounts = {};
    for (const s of sales) {
      const key = s.item_name;
      if (!itemCounts[key]) itemCounts[key] = { name: key, count: 0, revenue: 0 };
      itemCounts[key].count++;
      itemCounts[key].revenue += parseFloat(s.price || 0);
    }
    const bestSellers = Object.values(itemCounts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Orders to fulfill
    const pendingOrders = sales.filter(s => s.status === 'pending' || s.status === 'processing');

    // Low inventory alerts
    const lowInventory = (listings || []).filter(l => l.quantity <= 2);

    res.json({
      revenue: {
        today: sumRevenue(todaySales),
        week: sumRevenue(weekSales),
        month: sumRevenue(monthSales),
        byStore: revenueByStore
      },
      activeListings: (listings || []).length,
      ordersToFulfill: pendingOrders.length,
      bestSellers,
      recentSales: sales.slice(0, 10),
      lowInventory,
      stores: stores || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sales/recent — recent sales feed across all stores
router.get('/sales/recent', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    const { limit = 50, from, to, store_id } = req.query;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    let query = getSupabase().from('store_sales').select('*')
      .eq('account_id', accountId)
      .order('order_date', { ascending: false })
      .limit(parseInt(limit));

    if (from) query = query.gte('order_date', from);
    if (to) query = query.lte('order_date', to);
    if (store_id) query = query.eq('store_id', store_id);

    const { data, error } = await safeQuery(() => query);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ sales: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TRACKER MODE: TRACKED STORES ────────────────────────────

// GET /tracked — list tracked stores (buyer mode)
router.get('/tracked', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('tracked_stores').select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ tracked: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tracked — add store to track
router.post('/tracked', async (req, res) => {
  try {
    const { account_id, platform, store_url, store_name, notification_prefs } = req.body;
    if (!account_id || !platform || !store_url) {
      return res.status(400).json({ error: 'account_id, platform, and store_url required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('tracked_stores').insert({
        account_id,
        platform,
        store_url,
        store_name: store_name || '',
        notification_prefs_json: notification_prefs || { new_listings: true, price_drops: true, sold: false }
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ tracked: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /tracked/:id — stop tracking
router.delete('/tracked/:id', async (req, res) => {
  try {
    const { error } = await safeQuery(sb =>
      sb.from('tracked_stores').delete().eq('id', req.params.id)
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /tracked/:id/changes — changes detected for tracked store
router.get('/tracked/:id/changes', async (req, res) => {
  try {
    // Return listings that changed since last_checked on the tracked store
    const { data: tracked } = await safeQuery(sb =>
      sb.from('tracked_stores').select('*').eq('id', req.params.id).single()
    );

    if (!tracked) return res.json({ changes: [] });

    // Look for new/changed listings associated with this store URL
    const { data: listings } = await safeQuery(sb =>
      sb.from('store_listings').select('*')
        .eq('store_id', req.params.id)
        .order('last_checked', { ascending: false })
        .limit(50)
    );

    const lastChecked = tracked.last_checked ? new Date(tracked.last_checked) : new Date(0);
    const changes = (listings || []).filter(l => new Date(l.last_checked) > lastChecked);

    // Update last_checked
    await safeQuery(sb =>
      sb.from('tracked_stores').update({ last_checked: new Date().toISOString() })
        .eq('id', req.params.id)
    );

    res.json({ changes, store: tracked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WISHLIST ────────────────────────────────────────────────

// GET /wishlist — wishlist items
router.get('/wishlist', async (req, res) => {
  try {
    const accountId = req.query.account_id;
    if (!accountId) return res.status(400).json({ error: 'account_id required' });

    const { data, error } = await safeQuery(sb =>
      sb.from('wishlist_items').select('*, tracked_stores(*)')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ wishlist: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /wishlist — add to wishlist
router.post('/wishlist', async (req, res) => {
  try {
    const { account_id, tracked_store_id, listing_url, title, current_price, alert_threshold } = req.body;
    if (!account_id || !title) {
      return res.status(400).json({ error: 'account_id and title required' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('wishlist_items').insert({
        account_id,
        tracked_store_id: tracked_store_id || null,
        listing_url: listing_url || '',
        title,
        current_price: current_price || null,
        alert_threshold: alert_threshold || null,
        price_history_json: current_price ? [{ price: current_price, date: new Date().toISOString() }] : []
      }).select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /wishlist/:id — update wishlist item (threshold)
router.put('/wishlist/:id', async (req, res) => {
  try {
    const { alert_threshold, current_price, title } = req.body;
    const updates = {};
    if (alert_threshold !== undefined) updates.alert_threshold = alert_threshold;
    if (title !== undefined) updates.title = title;

    // If price update, append to history
    if (current_price !== undefined) {
      updates.current_price = current_price;
      const { data: existing } = await safeQuery(sb =>
        sb.from('wishlist_items').select('price_history_json').eq('id', req.params.id).single()
      );
      const history = existing?.price_history_json || [];
      history.push({ price: current_price, date: new Date().toISOString() });
      updates.price_history_json = history;
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('wishlist_items').update(updates)
        .eq('id', req.params.id)
        .select().single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /wishlist/:id — remove from wishlist
router.delete('/wishlist/:id', async (req, res) => {
  try {
    const { error } = await safeQuery(sb =>
      sb.from('wishlist_items').delete().eq('id', req.params.id)
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /wishlist/:id/price-history — price history for item
router.get('/wishlist/:id/price-history', async (req, res) => {
  try {
    const { data, error } = await safeQuery(sb =>
      sb.from('wishlist_items').select('id, title, current_price, price_history_json, alert_threshold')
        .eq('id', req.params.id)
        .single()
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({
      item_id: data?.id,
      title: data?.title,
      current_price: data?.current_price,
      alert_threshold: data?.alert_threshold,
      history: data?.price_history_json || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
