const BaseAgent = require('./base-agent');

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
    this.eras = ['ancient', 'medieval', 'renaissance', 'colonial', 'industrial', 'modern', 'cold_war', 'contemporary'];
    this.regions = ['europe', 'asia', 'americas', 'africa', 'middle_east', 'oceania', 'global'];
  }

  async run() {
    const results = { scenariosGenerated: 0, themedScenarios: 0 };
    const count = this.targetScenariosPerWeek.min +
      Math.floor(Math.random() * (this.targetScenariosPerWeek.max - this.targetScenariosPerWeek.min + 1));

    // Check current marketing themes for at least 1 themed scenario
    const currentThemes = await this.getCurrentThemes();

    for (let i = 0; i < count; i++) {
      const isThemed = i === 0 && currentThemes.length > 0;
      const scenario = await this.generateScenario(isThemed ? currentThemes[0] : null);

      await this.submitForApproval({
        itemType: 'chronostates_scenario',
        contentPreview: `[Scenario] ${scenario.title} — ${scenario.era}/${scenario.region}`,
        fullContent: {
          product: 'chronostates',
          scenario,
          isThemed,
        },
      });

      results.scenariosGenerated++;
      if (isThemed) results.themedScenarios++;
    }

    return results;
  }

  async generateScenario(theme) {
    const era = theme?.era || this.eras[Math.floor(Math.random() * this.eras.length)];
    const region = theme?.region || this.regions[Math.floor(Math.random() * this.regions.length)];

    const voicePrompt = this.brandVoice.buildSystemPrompt(
      'chronostates',
      `Generate a Chronoverse scenario set in the ${era} era, ${region} region`
    );

    // TODO: LLM integration
    return {
      title: `[Generated Scenario: ${era}/${region}]`,
      description: '[Scenario description]',
      era,
      region,
      difficulty: ['beginner', 'intermediate', 'advanced'][Math.floor(Math.random() * 3)],
      startingConditions: {},
      decisionPoints: [],
      branchPaths: [],
      tags: [era, region],
      multiLanguageDescriptions: {},
    };
  }

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
      themes: e.content_themes,
    }));
  }
}

module.exports = ContentLibraryManagerAgent;
