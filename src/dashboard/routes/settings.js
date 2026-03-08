const express = require('express');
const { getSupabase } = require('../../db/supabase');

const router = express.Router();

// GET /api/settings — get account settings
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', req.accountId)
      .single();

    if (error) return res.status(404).json({ error: 'Account not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/slider — get current slider position
router.get('/slider', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .select('slider_position')
      .eq('id', req.accountId)
      .single();

    if (error) return res.status(404).json({ error: 'Account not found' });

    const pos = data.slider_position;
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

    if (error) return res.status(500).json({ error: error.message });

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

    if (error) return res.status(500).json({ error: error.message });
    res.json({ reducedOps: data.reduced_ops });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/brand-profiles — get brand voice profiles
router.get('/brand-profiles', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('account_id', req.accountId);

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
    const supabase = getSupabase();
    const { data } = await supabase
      .from('sending_domains')
      .select('*')
      .eq('account_id', req.accountId)
      .order('created_at', { ascending: true });

    res.json({ domains: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
