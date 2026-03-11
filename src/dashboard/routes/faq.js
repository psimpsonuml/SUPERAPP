const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: null, error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: null, error: err }; }
}

// GET / — get FAQ entries, optionally filtered by visibility for public view
router.get('/', async (req, res) => {
  try {
    const isPublic = req.query.public === 'true';
    const isAdmin = req.accountId === '00000000-0000-0000-0000-000000000001';
    const search = req.query.search?.toLowerCase();

    // Get all features with visibility
    let query = isSupabaseConfigured()
      ? getSupabase().from('feature_visibility').select('*').order('category').order('feature_name')
      : null;

    const { data: features } = query ? await query : { data: null };

    // Use features from DB or fall back to built-in agent/module list
    let entries = (features || getBuiltInEntries()).map(f => ({
      feature_id: f.feature_id,
      feature_name: f.feature_name,
      category: f.category,
      visibility: f.visibility || 'public',
      description: f.description,
    }));

    // Filter by visibility for public FAQ
    if (isPublic && !isAdmin) {
      entries = entries.filter(e => e.visibility === 'public' || e.visibility === 'premium_only');
    }

    // Filter internal_only for non-admin
    if (!isAdmin) {
      entries = entries.filter(e => e.visibility !== 'internal_only' && e.visibility !== 'hidden');
    }

    // Search filter
    if (search) {
      entries = entries.filter(e =>
        e.feature_name.toLowerCase().includes(search) ||
        (e.description || '').toLowerCase().includes(search)
      );
    }

    // Group by category
    const grouped = {};
    for (const entry of entries) {
      const cat = entry.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(entry);
    }

    res.json({
      entries,
      grouped,
      total: entries.length,
      overview: getOverviewSection(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /regenerate — regenerate descriptions from agent configs (admin only)
router.post('/regenerate', async (req, res) => {
  try {
    const isAdmin = req.accountId === '00000000-0000-0000-0000-000000000001';
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });

    // In production, this would call Grok 4.1 Fast to regenerate descriptions
    // from the agent config and module definitions
    res.json({
      message: 'FAQ descriptions would be regenerated using Grok 4.1 Fast from agent configs. This requires AI API access.',
      note: 'Currently using built-in descriptions from feature_visibility table.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getOverviewSection() {
  return {
    title: 'What is BeaconOps?',
    content: `BeaconOps is an autonomous marketing, content, and operations engine built for founders who need a marketing team but can't afford one. It runs 29 AI agents that handle everything from SEO blog posts and social media to community marketing, outreach, and even personal life management — all from a single dashboard.

Unlike traditional marketing tools that require constant manual input, BeaconOps agents run on schedules, make decisions based on your approval preferences, and produce ready-to-publish content. You set the automation level with a single slider: from fully manual (you approve everything) to fully autonomous (agents publish on their own).

Built by a solo founder running three products, every feature was battle-tested on real businesses before being offered to others. BeaconOps also includes a unique personal intelligence layer — entertainment ranking, life management, health tracking, and more — because the best founders optimize their whole life, not just their business.

You bring your own API keys, you control your costs, and your data stays yours. Period.`,
  };
}

function getBuiltInEntries() {
  // Fallback when DB is not available
  return [
    { feature_id: 'inbox-monitor', feature_name: 'Inbox Monitor', category: 'operations', visibility: 'public', description: 'Monitors email for customer inquiries, support requests, and business opportunities. Auto-drafts responses for approval.' },
    { feature_id: 'seo-aeo-writer', feature_name: 'SEO/AEO Writer', category: 'operations', visibility: 'public', description: 'Generates daily SEO-optimized blog posts with automatic keyword research, then repurposes into social posts, video scripts, and community content.' },
    { feature_id: 'social-distributor', feature_name: 'Social Distributor', category: 'operations', visibility: 'public', description: 'Posts content across Twitter, LinkedIn, Reddit, Facebook, Instagram, TikTok, and YouTube with platform-specific formatting.' },
    { feature_id: 'pain-point-hunter', feature_name: 'Pain Point Hunter', category: 'operations', visibility: 'public', description: 'Scans Reddit, forums, and communities for people expressing problems your product solves. Drafts contextual responses.' },
    { feature_id: 'approval-queue', feature_name: 'Approval Queue', category: 'operations', visibility: 'public', description: 'Central hub for reviewing all agent-generated content before publication. Supports batch approve/reject and inline editing.' },
    { feature_id: 'entertainment', feature_name: 'Entertainment Ranker', category: 'personal', visibility: 'public', description: 'Rate movies, TV shows, and wrestling matches. Cascade scoring automatically ranks directors, actors, and other people.' },
    { feature_id: 'companion', feature_name: 'Personal Companion', category: 'personal', visibility: 'premium_only', description: 'AI personality that knows you through all personal modules. Daily check-ins, life coaching, and optional romantic companion mode.' },
  ];
}

module.exports = router;
