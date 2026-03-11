const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: null, error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: null, error: err }; }
}

// GET /api/settings — get account settings
router.get('/', async (req, res) => {
  try {
    const { data, error } = await safeQuery((sb) =>
      sb.from('accounts').select('*').eq('id', req.accountId).single()
    );

    if (error || !data) {
      return res.json({
        id: req.accountId,
        slider_position: 50,
        reduced_ops: false,
        note: 'Account not found — returning defaults',
      });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/slider — get current slider position
router.get('/slider', async (req, res) => {
  try {
    const { data } = await safeQuery((sb) =>
      sb.from('accounts').select('slider_position').eq('id', req.accountId).single()
    );

    const pos = data?.slider_position ?? 50;
    const label = pos <= 25 ? 'Maximum oversight'
      : pos <= 50 ? 'Cautious'
      : pos <= 75 ? 'Balanced'
      : 'Aggressive';

    res.json({ sliderPosition: pos, label });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/settings/slider — update automation slider
router.patch('/slider', async (req, res) => {
  try {
    const { position } = req.body;
    if (typeof position !== 'number' || position < 0 || position > 100) {
      return res.status(400).json({ error: 'Slider position must be 0-100' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .update({ slider_position: position, updated_at: new Date().toISOString() })
      .eq('id', req.accountId)
      .select()
      .single();

    if (error || !data) {
      return res.status(500).json({ error: error?.message || 'Account not found' });
    }

    const sliderLabel = position <= 25 ? 'Maximum oversight'
      : position <= 50 ? 'Cautious'
      : position <= 75 ? 'Balanced'
      : 'Aggressive';

    res.json({ sliderPosition: data.slider_position, label: sliderLabel });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/settings/reduced-ops — toggle reduced ops mode
router.patch('/reduced-ops', async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .update({ reduced_ops: enabled, updated_at: new Date().toISOString() })
      .eq('id', req.accountId)
      .select()
      .single();

    if (error || !data) {
      return res.status(500).json({ error: error?.message || 'Account not found' });
    }
    res.json({ reducedOps: data.reduced_ops });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/brand-profiles — get brand voice profiles
router.get('/brand-profiles', async (req, res) => {
  try {
    const { data } = await safeQuery((sb) =>
      sb.from('brand_profiles').select('*').eq('account_id', req.accountId)
    );
    res.json({ profiles: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings/brand-profiles/:product — update brand voice profile
router.put('/brand-profiles/:product', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { voice_config, language_settings, hashtag_sets, prohibited_phrases, emoji_policy } = req.body;

    const { data, error } = await supabase
      .from('brand_profiles')
      .upsert({
        account_id: req.accountId,
        product: req.params.product,
        voice_config: voice_config || {},
        language_settings: language_settings || ['en'],
        hashtag_sets: hashtag_sets || [],
        prohibited_phrases: prohibited_phrases || [],
        emoji_policy: emoji_policy || 'minimal',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,product' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/sending-domains — get outreach domain status
router.get('/sending-domains', async (req, res) => {
  try {
    const { data } = await safeQuery((sb) =>
      sb.from('sending_domains').select('*').eq('account_id', req.accountId).order('created_at', { ascending: true })
    );
    res.json({ domains: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Connected Accounts (Social Platforms) ────────────────────────

const SOCIAL_PLATFORMS = [
  { id: 'reddit', name: 'Reddit', authType: 'oauth2', envVars: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME', 'REDDIT_PASSWORD'] },
  { id: 'facebook', name: 'Facebook Pages', authType: 'oauth2', envVars: ['FB_PAGE_ACCESS_TOKEN'] },
  { id: 'instagram', name: 'Instagram', authType: 'oauth2', envVars: ['FB_PAGE_ACCESS_TOKEN'], requiresBusiness: true },
  { id: 'linkedin', name: 'LinkedIn', authType: 'oauth2', envVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'] },
  { id: 'discord', name: 'Discord', authType: 'bot_token', envVars: ['DISCORD_BOT_TOKEN'] },
  { id: 'spotify', name: 'Spotify', authType: 'oauth2', envVars: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'], personal: true },
];

// GET /api/settings/connected-accounts — list all platform connections with status
router.get('/connected-accounts', async (req, res) => {
  try {
    const { data: connections } = await safeQuery((sb) =>
      sb.from('social_connections')
        .select('id, platform, product, status, platform_user_name, connected_at, expires_at, last_error, metadata')
        .eq('account_id', req.accountId)
    );

    // Merge with platform definitions to show all platforms
    const accounts = SOCIAL_PLATFORMS.map((platform) => {
      const conns = (connections || []).filter(c => c.platform === platform.id);
      const hasEnvVars = platform.envVars.every(v => !!process.env[v]);

      return {
        platform: platform.id,
        name: platform.name,
        authType: platform.authType,
        requiresBusiness: platform.requiresBusiness || false,
        envConfigured: hasEnvVars,
        connections: conns.length > 0 ? conns : [{
          id: null,
          platform: platform.id,
          product: null,
          status: hasEnvVars ? 'ready_to_connect' : 'disconnected',
          platform_user_name: null,
          connected_at: null,
          expires_at: null,
          last_error: !hasEnvVars ? `Missing env vars: ${platform.envVars.filter(v => !process.env[v]).join(', ')}` : null,
        }],
      };
    });

    res.json({ accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/connected-accounts/:platform/connect — connect a platform
router.post('/connected-accounts/:platform/connect', async (req, res) => {
  try {
    const { platform } = req.params;
    const { product, credentials, metadata } = req.body;
    const platformDef = SOCIAL_PLATFORMS.find(p => p.id === platform);

    if (!platformDef) {
      return res.status(400).json({ error: `Unknown platform: ${platform}` });
    }

    const supabase = getSupabase();

    // Build credentials from env vars + provided credentials
    const credentialsJson = { ...credentials };
    for (const envVar of platformDef.envVars) {
      if (process.env[envVar] && !credentialsJson[envVar.toLowerCase()]) {
        credentialsJson[envVar.toLowerCase()] = process.env[envVar];
      }
    }

    const { data, error } = await supabase
      .from('social_connections')
      .upsert({
        account_id: req.accountId,
        platform,
        product: product || null,
        status: 'connected',
        credentials_json: credentialsJson,
        platform_user_name: req.body.platform_user_name || null,
        platform_user_id: req.body.platform_user_id || null,
        metadata: metadata || {},
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,platform,product' })
      .select('id, platform, product, status, platform_user_name, connected_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ connection: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/connected-accounts/:platform/disconnect — disconnect a platform
router.post('/connected-accounts/:platform/disconnect', async (req, res) => {
  try {
    const { platform } = req.params;
    const { product } = req.body;
    const supabase = getSupabase();

    let query = supabase
      .from('social_connections')
      .update({ status: 'disconnected', credentials_json: {}, updated_at: new Date().toISOString() })
      .eq('account_id', req.accountId)
      .eq('platform', platform);

    if (product) {
      query = query.eq('product', product);
    } else {
      query = query.is('product', null);
    }

    const { data, error } = await query.select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ connection: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/connected-accounts/:platform/test — test a connection
router.get('/connected-accounts/:platform/test', async (req, res) => {
  try {
    const { platform } = req.params;
    const { data: conn } = await safeQuery((sb) =>
      sb.from('social_connections')
        .select('*')
        .eq('account_id', req.accountId)
        .eq('platform', platform)
        .eq('status', 'connected')
        .limit(1)
        .single()
    );

    if (!conn) {
      return res.json({ status: 'disconnected', message: `${platform} is not connected` });
    }

    // Basic validation — check if env vars / credentials exist
    const platformDef = SOCIAL_PLATFORMS.find(p => p.id === platform);
    const missing = (platformDef?.envVars || []).filter(v =>
      !process.env[v] && !conn.credentials_json?.[v.toLowerCase()]
    );

    if (missing.length > 0) {
      return res.json({ status: 'error', message: `Missing credentials: ${missing.join(', ')}` });
    }

    // Check token expiry
    if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
      return res.json({ status: 'expired', message: 'Access token has expired — reconnect required' });
    }

    res.json({ status: 'ok', message: `${platform} connection is active`, connectedAs: conn.platform_user_name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
