const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');
const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try { return await queryFn(getSupabase()); } catch (err) { return { data: [], error: err }; }
}

// GET /assets — list assets with filters, paginated
router.get('/assets', async (req, res) => {
  const {
    product, type, format,
    page = 1, limit = 20, sort = 'created_at', order = 'desc'
  } = req.query;
  const accountId = req.query.account_id || req.headers['x-account-id'];
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase
      .from('design_assets')
      .select('*', { count: 'exact' });

    if (accountId) query = query.eq('account_id', accountId);
    if (product) query = query.eq('product', product);
    if (type) query = query.eq('asset_type', type);
    if (format) query = query.eq('format', format);

    query = query.order(sort, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    assets: data || [],
    page: parseInt(page),
    limit: parseInt(limit),
    total: data?.length || 0
  });
});

// GET /assets/:id — asset detail
router.get('/assets/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_assets')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Asset not found' });

  res.json({ asset: data });
});

// POST /assets — create asset
router.post('/assets', async (req, res) => {
  const {
    account_id, product, asset_type, title,
    template_id, image_url, dimensions, format, metadata_json
  } = req.body;

  if (!account_id || !product || !asset_type || !title) {
    return res.status(400).json({ error: 'account_id, product, asset_type, and title are required' });
  }

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_assets')
      .insert({
        account_id,
        product,
        asset_type,
        title,
        template_id: template_id || null,
        image_url: image_url || '',
        dimensions: dimensions || '',
        format: format || 'png',
        metadata_json: metadata_json || {}
      })
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ asset: data });
});

// PUT /assets/:id — update asset metadata
router.put('/assets/:id', async (req, res) => {
  const { id } = req.params;
  const updates = {};
  const allowed = ['title', 'product', 'asset_type', 'template_id', 'image_url', 'dimensions', 'format', 'metadata_json'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Asset not found' });

  res.json({ asset: data });
});

// DELETE /assets/:id — remove asset
router.delete('/assets/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_assets')
      .delete()
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ deleted: true, asset: data });
});

// POST /assets/generate — generate asset using AI (stub: HTML/CSS based card)
router.post('/assets/generate', async (req, res) => {
  const {
    account_id, product, asset_type, title,
    headline, subtext, dimensions, style, template_id, metadata_json
  } = req.body;

  if (!account_id || !product || !asset_type || !title) {
    return res.status(400).json({ error: 'account_id, product, asset_type, and title are required' });
  }

  // Stub AI generation: produce an HTML/CSS card description
  const dims = dimensions || '1080x1080';
  const [width, height] = dims.split('x').map(Number);
  const bgColor = style?.backgroundColor || '#1a1a2e';
  const accentColor = style?.accentColor || '#f59e0b';
  const fontFamily = style?.fontFamily || 'Inter, sans-serif';

  const generatedHtml = `
<div style="width:${width}px;height:${height}px;background:${bgColor};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;box-sizing:border-box;font-family:${fontFamily};color:#ffffff;border-radius:16px;">
  <h1 style="font-size:${Math.round(width / 16)}px;color:${accentColor};margin:0 0 16px 0;text-align:center;">${headline || title}</h1>
  ${subtext ? `<p style="font-size:${Math.round(width / 32)}px;color:#d1d5db;margin:0;text-align:center;max-width:80%;">${subtext}</p>` : ''}
  <div style="margin-top:auto;font-size:${Math.round(width / 48)}px;color:#6b7280;">${product}</div>
</div>`.trim();

  const assetMetadata = {
    ...(metadata_json || {}),
    generated: true,
    headline: headline || '',
    subtext: subtext || '',
    style: style || {},
    html_preview: generatedHtml
  };

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_assets')
      .insert({
        account_id,
        product,
        asset_type,
        title,
        template_id: template_id || null,
        image_url: '',
        dimensions: dims,
        format: 'html',
        metadata_json: assetMetadata
      })
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ asset: data, html_preview: generatedHtml });
});

// GET /templates — list templates
router.get('/templates', async (req, res) => {
  const { asset_type, page = 1, limit = 20 } = req.query;
  const accountId = req.query.account_id || req.headers['x-account-id'];
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase
      .from('design_templates')
      .select('*', { count: 'exact' });

    if (accountId) query = query.eq('account_id', accountId);
    if (asset_type) query = query.eq('asset_type', asset_type);

    query = query.order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    templates: data || [],
    page: parseInt(page),
    limit: parseInt(limit),
    total: data?.length || 0
  });
});

// POST /templates — create template
router.post('/templates', async (req, res) => {
  const { account_id, name, asset_type, template_config_json, thumbnail_url } = req.body;

  if (!account_id || !name || !asset_type) {
    return res.status(400).json({ error: 'account_id, name, and asset_type are required' });
  }

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_templates')
      .insert({
        account_id,
        name,
        asset_type,
        template_config_json: template_config_json || {},
        thumbnail_url: thumbnail_url || ''
      })
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ template: data });
});

// PUT /templates/:id — update template
router.put('/templates/:id', async (req, res) => {
  const { id } = req.params;
  const updates = {};
  const allowed = ['name', 'asset_type', 'template_config_json', 'thumbnail_url'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Template not found' });

  res.json({ template: data });
});

// DELETE /templates/:id — remove template
router.delete('/templates/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_templates')
      .delete()
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ deleted: true, template: data });
});

// GET /brand/:product — brand assets for a product (colors, fonts, logos from brand_profiles)
router.get('/brand/:product', async (req, res) => {
  const { product } = req.params;
  const accountId = req.query.account_id || req.headers['x-account-id'];

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase
      .from('brand_profiles')
      .select('*')
      .eq('product', product);

    if (accountId) query = query.eq('account_id', accountId);

    return await query.single();
  });

  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });

  const brand = data || {
    product,
    colors: { primary: '#f59e0b', secondary: '#1a1a2e', accent: '#10b981', text: '#ffffff', muted: '#6b7280' },
    fonts: { heading: 'Inter', body: 'Inter', mono: 'JetBrains Mono' },
    logos: [],
    style_notes: ''
  };

  res.json({ brand });
});

// GET /gallery — gallery view grouped by product and type
router.get('/gallery', async (req, res) => {
  const accountId = req.query.account_id || req.headers['x-account-id'];

  const { data, error } = await safeQuery(async (supabase) => {
    let query = supabase
      .from('design_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (accountId) query = query.eq('account_id', accountId);

    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  const assets = data || [];

  // Group by product, then by asset_type
  const gallery = {};
  assets.forEach((asset) => {
    if (!gallery[asset.product]) gallery[asset.product] = {};
    if (!gallery[asset.product][asset.asset_type]) gallery[asset.product][asset.asset_type] = [];
    gallery[asset.product][asset.asset_type].push(asset);
  });

  res.json({ gallery, total: assets.length });
});

// POST /assets/:id/regenerate — regenerate asset with same params
router.post('/assets/:id/regenerate', async (req, res) => {
  const { id } = req.params;

  // Fetch original asset
  const { data: original, error: fetchErr } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_assets')
      .select('*')
      .eq('id', id)
      .single();
  });

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!original) return res.status(404).json({ error: 'Asset not found' });

  const meta = original.metadata_json || {};
  const dims = original.dimensions || '1080x1080';
  const [width, height] = dims.split('x').map(Number);
  const style = meta.style || {};
  const bgColor = style.backgroundColor || '#1a1a2e';
  const accentColor = style.accentColor || '#f59e0b';
  const fontFamily = style.fontFamily || 'Inter, sans-serif';
  const headline = meta.headline || original.title;
  const subtext = meta.subtext || '';

  const generatedHtml = `
<div style="width:${width}px;height:${height}px;background:${bgColor};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;box-sizing:border-box;font-family:${fontFamily};color:#ffffff;border-radius:16px;">
  <h1 style="font-size:${Math.round(width / 16)}px;color:${accentColor};margin:0 0 16px 0;text-align:center;">${headline}</h1>
  ${subtext ? `<p style="font-size:${Math.round(width / 32)}px;color:#d1d5db;margin:0;text-align:center;max-width:80%;">${subtext}</p>` : ''}
  <div style="margin-top:auto;font-size:${Math.round(width / 48)}px;color:#6b7280;">${original.product}</div>
</div>`.trim();

  const updatedMeta = { ...meta, html_preview: generatedHtml, regenerated_at: new Date().toISOString() };

  const { data, error } = await safeQuery(async (supabase) => {
    return await supabase
      .from('design_assets')
      .update({ metadata_json: updatedMeta })
      .eq('id', id)
      .select()
      .single();
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ asset: data, html_preview: generatedHtml });
});

// GET /stats — asset counts by type, by product
router.get('/stats', async (req, res) => {
  const accountId = req.query.account_id || req.headers['x-account-id'];

  const { data: allAssets, error } = await safeQuery(async (supabase) => {
    let query = supabase.from('design_assets').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    return await query;
  });

  if (error) return res.status(500).json({ error: error.message });

  const assets = allAssets || [];
  const total = assets.length;

  const byType = {};
  const byProduct = {};
  const byFormat = {};

  assets.forEach((a) => {
    byType[a.asset_type] = (byType[a.asset_type] || 0) + 1;
    byProduct[a.product] = (byProduct[a.product] || 0) + 1;
    byFormat[a.format] = (byFormat[a.format] || 0) + 1;
  });

  // Recent assets (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = assets.filter((a) => new Date(a.created_at) >= thirtyDaysAgo).length;

  res.json({
    total,
    recentCount,
    byType,
    byProduct,
    byFormat
  });
});

module.exports = router;
