const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: null, error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: null, error: err }; }
}

// GET / — list all features with visibility
router.get('/', async (req, res) => {
  try {
    const { data, error } = await safeQuery(sb =>
      sb.from('feature_visibility').select('*').order('category').order('feature_name')
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ features: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /check/:featureId — check if a feature is visible for the current account
router.get('/check/:featureId', async (req, res) => {
  try {
    const { featureId } = req.params;

    // Get account plan
    const { data: account } = await safeQuery(sb =>
      sb.from('accounts').select('plan').eq('id', req.accountId).single()
    );
    const plan = account?.plan || 'starter';
    const isAdmin = req.accountId === '00000000-0000-0000-0000-000000000001';

    // Get feature visibility
    const { data: feature } = await safeQuery(sb =>
      sb.from('feature_visibility').select('*').eq('feature_id', featureId).single()
    );

    if (!feature) return res.json({ visible: true, reason: 'no_visibility_rule' });

    // Admin sees everything
    if (isAdmin) return res.json({ visible: true, reason: 'admin_override', feature });

    // Check visibility level
    if (feature.visibility === 'hidden' || feature.visibility === 'internal_only') {
      return res.json({ visible: false, reason: feature.visibility, feature });
    }
    if (feature.visibility === 'premium_only') {
      const premiumPlans = ['growth', 'pro', 'agency', 'personal'];
      const visible = premiumPlans.includes(plan);
      return res.json({ visible, reason: visible ? 'plan_allowed' : 'upgrade_required', feature });
    }

    res.json({ visible: true, reason: 'public', feature });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /:featureId — update visibility level (admin only)
router.patch('/:featureId', async (req, res) => {
  try {
    const isAdmin = req.accountId === '00000000-0000-0000-0000-000000000001';
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { visibility } = req.body;
    const validLevels = ['public', 'premium_only', 'internal_only', 'hidden'];
    if (!validLevels.includes(visibility)) {
      return res.status(400).json({ error: `Visibility must be one of: ${validLevels.join(', ')}` });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('feature_visibility')
      .update({ visibility, updated_at: new Date().toISOString() })
      .eq('feature_id', req.params.featureId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /bulk — bulk update visibility (admin only)
router.post('/bulk', async (req, res) => {
  try {
    const isAdmin = req.accountId === '00000000-0000-0000-0000-000000000001';
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { feature_ids, visibility } = req.body;
    const validLevels = ['public', 'premium_only', 'internal_only', 'hidden'];
    if (!validLevels.includes(visibility)) {
      return res.status(400).json({ error: `Invalid visibility level` });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('feature_visibility')
      .update({ visibility, updated_at: new Date().toISOString() })
      .in('feature_id', feature_ids)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ updated: data?.length || 0, features: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
