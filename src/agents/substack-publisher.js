const BaseAgent = require('./base-agent');

class SubstackPublisherAgent extends BaseAgent {
  static agentId = 'substack-publisher';
  static agentName = 'Substack Publisher';

  constructor(accountId) {
    super(accountId, {
      agentId: 'substack-publisher',
      agentName: 'Substack Publisher',
      cycle: 'daily',
      defaultTier: 2,
    });
  }

  async run() {
    const results = { newsletters: 0 };

    // ChronoStates-focused paywalled newsletter
    const theme = await this.selectDailyTheme();
    const newsletter = await this.generateNewsletter(theme);

    const dupCheck = await this.checkDuplicate(newsletter.body, 'chronostates');
    if (dupCheck.isDuplicate) {
      this.logger.warn('Duplicate newsletter content detected', { agentId: this.agentId });
      return results;
    }

    const contentId = await this.storeContent({
      product: 'chronostates',
      platform: 'substack',
      contentType: 'newsletter',
      title: newsletter.title,
      contentText: newsletter.body,
      metadata: {
        freeTeaser: newsletter.freeTeaser,
        paywallContent: newsletter.paywallContent,
        cta: newsletter.cta,
      },
    });

    await this.submitForApproval({
      itemType: 'newsletter',
      contentPreview: `[ChronoStates Substack] ${newsletter.title}`,
      fullContent: {
        product: 'chronostates',
        contentId,
        newsletter,
      },
    });

    results.newsletters++;
    return results;
  }

  async selectDailyTheme() {
    // Sources: content calendar, QA playtest highlights, community buzz, seasonal events
    const { data: qaHighlights } = await this.supabase
      .from('qa_results')
      .select('scenario_id, checks, bugs')
      .eq('account_id', this.accountId)
      .order('test_date', { ascending: false })
      .limit(3);

    const { data: painPoints } = await this.supabase
      .from('pain_points')
      .select('text, category')
      .eq('account_id', this.accountId)
      .eq('product_relevance', 'chronostates')
      .order('date_found', { ascending: false })
      .limit(5);

    return {
      qaHighlights: qaHighlights || [],
      communityBuzz: painPoints || [],
      type: 'narrative_excerpt',
    };
  }

  async generateNewsletter(theme) {
    const voicePrompt = this.brandVoice.buildSystemPrompt(
      'chronostates',
      'Write a compelling daily newsletter with free teaser and paywalled content'
    );

    // TODO: LLM integration
    return {
      title: '[Generated Newsletter Title]',
      freeTeaser: '[2-3 compelling paragraphs visible to non-subscribers]',
      paywallContent: '[Substantial paywalled content: narrative, updates, community highlights]',
      body: '[Full newsletter body]',
      cta: '[Subscription conversion CTA]',
    };
  }
}

module.exports = SubstackPublisherAgent;
