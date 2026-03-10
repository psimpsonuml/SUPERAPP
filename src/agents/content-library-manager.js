const BaseAgent = require('./base-agent');
const config = require('../config');

// ── Chronoverse constants ─────────────────────────────────
const ERAS = [
  { id: 'ancient', label: 'Ancient', range: 'pre-500 CE' },
  { id: 'medieval', label: 'Medieval', range: '500-1400' },
  { id: 'renaissance', label: 'Renaissance', range: '1400-1700' },
  { id: 'industrial', label: 'Industrial', range: '1700-1900' },
  { id: 'modern', label: 'Modern', range: '1900-2000' },
  { id: 'future', label: 'Future', range: '2000+' },
];

const REGIONS = [
  'North America', 'South America', 'Western Europe', 'Eastern Europe', 'Scandinavia',
  'Middle East', 'North Africa', 'Sub-Saharan Africa', 'East Africa', 'Southern Africa',
  'Central Asia', 'South Asia', 'Southeast Asia', 'East Asia', 'Oceania',
  'Caribbean', 'Central America', 'Balkans', 'Iberian Peninsula', 'British Isles',
  'Mediterranean', 'Pacific Islands', 'Arabian Peninsula', 'Mesopotamia', 'Indochina',
  'Himalayan', 'Siberia', 'Patagonia', 'Arctic', 'Antarctic',
  'Great Plains', 'Sahel', 'Horn of Africa', 'Levant', 'Polynesia',
];

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const DIFFICULTY_DESCRIPTIONS = {
  easy: 'Straightforward divergence, familiar history',
  medium: 'Complex geopolitics, multiple factions',
  hard: 'Obscure history, cascading butterfly effects',
};

const TRANSLATION_LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'pt', name: 'Portuguese' },
];

class ContentLibraryManagerAgent extends BaseAgent {
  static agentId = 'content-library-manager';
  static agentName = 'Content Library Manager';

  constructor(accountId) {
    super(accountId, {
      agentId: 'content-library-manager',
      agentName: 'Content Library Manager',
      cycle: 'weekly',
      defaultTier: 2,
    });

    this.targetScenariosPerWeek = { min: 3, max: 5 };
    this.csSupabaseUrl = process.env.CS_SUPABASE_URL || '';
    this.csSupabaseKey = process.env.CS_SUPABASE_SERVICE_KEY || '';
  }

  // ── Main run ────────────────────────────────────────────
  async run() {
    const count = this.targetScenariosPerWeek.min +
      Math.floor(Math.random() * (this.targetScenariosPerWeek.max - this.targetScenariosPerWeek.min + 1));

    // Fetch variety context
    const recentScenarios = await this.getRecentScenarios(30);
    const currentThemes = await this.getCurrentThemes();
    const varietyConstraints = this.buildVarietyConstraints(recentScenarios);

    const results = {
      scenariosGenerated: 0,
      themedScenarios: 0,
      varietyCheck: { erasUsed: [], regionsUsed: [], difficultiesUsed: [] },
      pendingApproval: 0,
    };

    // Plan the week's batch to ensure variety
    const batchPlan = this.planBatch(count, varietyConstraints, currentThemes);

    for (let i = 0; i < batchPlan.length; i++) {
      const plan = batchPlan[i];

      try {
        const scenario = await this.generateScenario(plan, currentThemes, recentScenarios);

        // Queue for Tier 2 approval
        const approvalResult = await this.submitForApproval({
          itemType: 'chronostates_scenario',
          contentPreview: `[${scenario.difficulty.toUpperCase()}] ${scenario.title} — ${scenario.era}/${scenario.region}`,
          fullContent: {
            product: 'chronostates',
            scenario,
            isThemed: plan.isThemed,
            targetLanguages: scenario.translations ? Object.keys(scenario.translations) : [],
            approvalAction: 'inject_to_content_library',
          },
        });

        // Store in our DB for tracking
        await this.storeScenarioRecord(scenario, approvalResult);

        results.scenariosGenerated++;
        results.varietyCheck.erasUsed.push(scenario.era);
        results.varietyCheck.regionsUsed.push(scenario.region);
        results.varietyCheck.difficultiesUsed.push(scenario.difficulty);
        if (plan.isThemed) results.themedScenarios++;
        if (approvalResult.status === 'pending') results.pendingApproval++;
      } catch (error) {
        this.logger.warn(`Scenario generation ${i + 1} failed: ${error.message}`, { agentId: this.agentId });
        this.errors.push({ scenario: i + 1, error: error.message });
      }
    }

    // Run variety validation
    results.varietyCheck.passed = this.validateVariety(results.varietyCheck);

    return results;
  }

  // ── Batch planning ──────────────────────────────────────
  planBatch(count, constraints, themes) {
    const plan = [];
    const usedEras = new Set();
    const usedRegions = new Set();
    const usedDifficulties = new Set();

    // Ensure at least 1 of each difficulty
    const requiredDifficulties = [...DIFFICULTIES];

    for (let i = 0; i < count; i++) {
      const isThemed = i === 0 && themes.length > 0;

      // Pick era (no repeats this week)
      let era;
      const availableEras = ERAS.filter(e => !usedEras.has(e.id) && !constraints.recentEras.has(e.id));
      if (availableEras.length > 0) {
        era = availableEras[Math.floor(Math.random() * availableEras.length)].id;
      } else {
        era = ERAS[Math.floor(Math.random() * ERAS.length)].id;
      }
      usedEras.add(era);

      // Pick region (no repeats this week)
      let region;
      const availableRegions = REGIONS.filter(r => !usedRegions.has(r));
      region = availableRegions[Math.floor(Math.random() * availableRegions.length)] || REGIONS[Math.floor(Math.random() * REGIONS.length)];
      usedRegions.add(region);

      // Pick difficulty (ensure variety)
      let difficulty;
      if (requiredDifficulties.length > 0) {
        difficulty = requiredDifficulties.shift();
      } else {
        difficulty = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
      }
      usedDifficulties.add(difficulty);

      // Pick 2 translation languages (rotate weekly)
      const weekOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (7 * 86400000));
      const langOffset = (weekOfYear * 2 + i) % TRANSLATION_LANGUAGES.length;
      const translationLangs = [
        TRANSLATION_LANGUAGES[langOffset % TRANSLATION_LANGUAGES.length],
        TRANSLATION_LANGUAGES[(langOffset + 1) % TRANSLATION_LANGUAGES.length],
      ];

      plan.push({
        era,
        region,
        difficulty,
        isThemed,
        theme: isThemed ? themes[0] : null,
        translationLangs,
      });
    }

    return plan;
  }

  // ── Scenario generation via Claude ──────────────────────
  async generateScenario(plan, themes, recentScenarios) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

    const voicePrompt = this.brandVoice.buildSystemPrompt(
      'chronostates',
      'Generate a complete alternate history scenario for the ChronoStates content library.'
    );

    const recentTitles = recentScenarios.slice(0, 15).map(s => s.title || s.scenario?.title).filter(Boolean);
    const recentPremises = recentScenarios.slice(0, 10).map(s =>
      (s.scenario?.description || s.description || '').slice(0, 100)
    ).filter(Boolean);

    const themeGuidance = plan.isThemed && plan.theme
      ? `\n\nIMPORTANT: This scenario should tie into the current marketing theme: "${plan.theme.name}" with themes: ${plan.theme.themes.join(', ')}. Make the scenario relevant to this theme while keeping it as an engaging alternate history.`
      : '';

    const eraInfo = ERAS.find(e => e.id === plan.era);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4000,
      system: voicePrompt,
      messages: [{
        role: 'user',
        content: `Generate a complete ChronoStates alternate history scenario with these constraints:

ERA: ${plan.era} (${eraInfo?.range || ''})
REGION: ${plan.region}
DIFFICULTY: ${plan.difficulty} — ${DIFFICULTY_DESCRIPTIONS[plan.difficulty]}
${themeGuidance}

The Chronoverse premise: Alternate timelines across 600+ years of history, spanning 35 regions worldwide. Players explore "what if" scenarios where key historical moments diverged.

AVOID these recent titles/premises (ensure freshness):
${recentTitles.map(t => `- "${t}"`).join('\n')}

VARIETY RULE: No more than one "what if X never happened" framing per week. Be creative with divergence types: technology accelerated, cultural fusion, geographic change, person born elsewhere, trade route shifts, diseases cured early, etc.

Return a JSON object with EXACTLY this structure:
{
  "title": "Evocative, curiosity-driven title (e.g., 'The Byzantine Internet', 'America Without the Revolution')",
  "description": "2-3 paragraphs. Hook explaining the premise, what's different about this timeline, and why it's interesting to explore. Epic, speculative, intellectually provocative voice.",
  "starting_conditions": {
    "year": 1200,
    "region": "${plan.region}",
    "key_political_entities": ["Entity 1", "Entity 2"],
    "technology_level": "Description of tech level",
    "cultural_factors": ["Factor 1", "Factor 2"],
    "economic_conditions": "Description",
    "key_figures": [{"name": "Figure Name", "role": "Their role", "alive": true}],
    "recent_events": ["Event that sets up the divergence point"],
    "divergence_point": "The specific moment where history changes"
  },
  "decision_points": [
    {
      "sequence": 1,
      "situation": "Description of the situation the player faces",
      "options": [
        {"label": "Option A", "description": "What this choice means", "leads_to": "Brief note on consequences"},
        {"label": "Option B", "description": "What this choice means", "leads_to": "Brief note on consequences"}
      ]
    }
  ],
  "difficulty": "${plan.difficulty}",
  "era": "${plan.era}",
  "region": "${plan.region}",
  "era_tags": ["${plan.era}"],
  "region_tags": ["${plan.region}"]
}

Generate 5-10 decision points with 2-4 options each. Make decisions meaningful with real consequences.
Return ONLY the JSON — no markdown fences.`,
      }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude did not return valid JSON for scenario');

    const scenario = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!scenario.title || !scenario.description || !scenario.starting_conditions || !scenario.decision_points) {
      throw new Error('Scenario missing required fields');
    }

    // Generate translations
    scenario.translations = await this.generateTranslations(scenario, plan.translationLangs, client);

    // Check for duplicate via content memory
    const dupCheck = await this.checkDuplicate(scenario.title + ' ' + scenario.description, 'chronostates');
    if (dupCheck.isDuplicate) {
      this.logger.warn(`Scenario "${scenario.title}" flagged as duplicate (${dupCheck.matchType})`, { agentId: this.agentId });
      scenario.duplicateWarning = dupCheck;
    }

    return scenario;
  }

  // ── Multi-language translations ─────────────────────────
  async generateTranslations(scenario, langs, client) {
    const translations = {};

    for (const lang of langs) {
      try {
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Translate this alternate history scenario title and description into ${lang.name}. Keep the epic, speculative tone. Return JSON only:
{
  "title": "translated title",
  "description": "translated description (2-3 paragraphs)"
}

Original:
Title: "${scenario.title}"
Description: "${scenario.description}"`,
          }],
        });

        const text = response.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          translations[lang.code] = JSON.parse(jsonMatch[0]);
        }
      } catch (error) {
        this.logger.warn(`Translation to ${lang.name} failed: ${error.message}`, { agentId: this.agentId });
      }
    }

    return translations;
  }

  // ── Variety constraints from recent history ─────────────
  buildVarietyConstraints(recentScenarios) {
    // Look at the last week's worth
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const thisWeek = recentScenarios.filter(s => new Date(s.created_at) >= oneWeekAgo);

    return {
      recentEras: new Set(thisWeek.map(s => s.scenario?.era || s.era).filter(Boolean)),
      recentRegions: new Set(thisWeek.map(s => s.scenario?.region || s.region).filter(Boolean)),
      recentDifficulties: thisWeek.map(s => s.scenario?.difficulty || s.difficulty).filter(Boolean),
      recentTitles: thisWeek.map(s => s.scenario?.title || s.title).filter(Boolean),
    };
  }

  validateVariety(check) {
    const erasUnique = new Set(check.erasUsed).size === check.erasUsed.length;
    const regionsUnique = new Set(check.regionsUsed).size === check.regionsUsed.length;
    const hasDifficultySpread = DIFFICULTIES.every(d => check.difficultiesUsed.includes(d)) || check.difficultiesUsed.length < 3;
    return erasUnique && regionsUnique && hasDifficultySpread;
  }

  // ── Recent scenarios lookup ─────────────────────────────
  async getRecentScenarios(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data } = await this.supabase
      .from('approval_queue')
      .select('full_content, created_at, status')
      .eq('account_id', this.accountId)
      .eq('agent_id', 'content-library-manager')
      .eq('item_type', 'chronostates_scenario')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    return (data || []).map(d => ({
      ...d.full_content?.scenario,
      status: d.status,
      created_at: d.created_at,
    }));
  }

  // ── Current marketing themes ────────────────────────────
  async getCurrentThemes() {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await this.supabase
      .from('event_calendar')
      .select('event_name, content_themes')
      .eq('account_id', this.accountId)
      .lte('start_date', today)
      .gte('end_date', today)
      .contains('products', ['chronostates']);

    return (data || []).map(e => ({
      name: e.event_name,
      themes: e.content_themes || [],
    }));
  }

  // ── Store scenario record for tracking ──────────────────
  async storeScenarioRecord(scenario, approvalResult) {
    await this.supabase.from('cs_scenario_library').upsert({
      account_id: this.accountId,
      title: scenario.title,
      era: scenario.era,
      region: scenario.region,
      difficulty: scenario.difficulty,
      description: scenario.description?.slice(0, 500),
      starting_conditions: scenario.starting_conditions,
      decision_point_count: scenario.decision_points?.length || 0,
      translations: scenario.translations || {},
      approval_queue_id: approvalResult.id,
      approval_status: approvalResult.status,
      injected: false,
    }, { onConflict: 'account_id,title' });

    // Store in content memory for dedup
    await this.storeContent({
      product: 'chronostates',
      platform: 'content_library',
      contentType: 'scenario',
      title: scenario.title,
      contentText: `${scenario.title}\n${scenario.description}`,
      metadata: { era: scenario.era, region: scenario.region, difficulty: scenario.difficulty },
    });
  }

  // ── Inject approved scenario to ChronoStates Supabase ──
  async injectToChronoStates(scenario) {
    if (!this.csSupabaseUrl || !this.csSupabaseKey) {
      this.logger.warn('CS_SUPABASE_URL or CS_SUPABASE_SERVICE_KEY not configured — skipping injection', { agentId: this.agentId });
      return { injected: false, reason: 'not_configured' };
    }

    const { createClient } = require('@supabase/supabase-js');
    const csSupabase = createClient(this.csSupabaseUrl, this.csSupabaseKey);

    const record = {
      title: scenario.title,
      description: scenario.description,
      era: scenario.era,
      region: scenario.region,
      difficulty: scenario.difficulty,
      era_tags: scenario.era_tags || [scenario.era],
      region_tags: scenario.region_tags || [scenario.region],
      starting_conditions: scenario.starting_conditions,
      decision_points: scenario.decision_points,
      translations: scenario.translations || {},
      status: 'active',
      source: 'beaconops_content_library_manager',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await csSupabase
      .from('scenarios')
      .insert(record)
      .select('id')
      .single();

    if (error) {
      this.logger.error(`ChronoStates injection failed: ${error.message}`, { agentId: this.agentId });
      return { injected: false, error: error.message };
    }

    // Mark as injected in our tracking table
    await this.supabase
      .from('cs_scenario_library')
      .update({ injected: true, cs_scenario_id: data.id, injected_at: new Date().toISOString() })
      .eq('account_id', this.accountId)
      .eq('title', scenario.title);

    return { injected: true, csScenarioId: data.id };
  }
}

module.exports = ContentLibraryManagerAgent;
