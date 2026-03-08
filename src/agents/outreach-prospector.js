const BaseAgent = require('./base-agent');
const products = require('../config/products');
const config = require('../config');

class OutreachProspectorAgent extends BaseAgent {
  static agentId = 'outreach-prospector';
  static agentName = 'Outreach Prospector';

  constructor(accountId) {
    super(accountId, {
      agentId: 'outreach-prospector',
      agentName: 'Outreach Prospector',
      cycle: 'daily',
      defaultTier: 2,
    });

    this.maxEmailsPerProductPerDay = 30;

    this.icpDefinitions = {
      chronostates: {
        signals: ['alt history posts', 'civ/eu4 players', 'history teachers', 'history YouTubers'],
        titles: [],
      },
      payroll_beacon: {
        signals: ['payroll software complaints', 'multi-state ops'],
        titles: ['Payroll Manager', 'HR Director', 'CPA'],
        companySize: { min: 50, max: 500 },
      },
      budgeting_beacon: {
        signals: ['budgeting content creation', 'course creators', 'newsletter authors'],
        titles: ['Financial Coach', 'Personal Finance Influencer', 'Fintech Reviewer'],
      },
    };

    this.partnershipTargets = {
      types: ['payroll_company', 'service_bureau', 'regional_firm'],
      pitch: 'compliance database as complementary integration or white-label data source',
    };
  }

  async run() {
    const results = { leadsFound: 0, emailsDrafted: 0, partnershipPitches: 0 };

    // Track A: End-user outreach
    for (const productId of Object.keys(this.icpDefinitions)) {
      const leads = await this.findLeads(productId);

      for (const lead of leads) {
        // Verify email
        const verified = await this.verifyEmail(lead.email);
        if (!verified) continue;

        // Store in pipeline
        await this.supabase.from('prospect_pipeline').insert({
          account_id: this.accountId,
          name: lead.name,
          email: lead.email,
          linkedin_url: lead.linkedinUrl,
          company: lead.company,
          title: lead.title,
          product: productId,
          icp_score: lead.icpScore,
          track: 'user',
          stage: 'discovered',
          source: lead.source,
        });

        // Draft email
        const emailDraft = await this.draftOutreachEmail(lead, productId);
        await this.submitForApproval({
          itemType: 'outreach_email',
          tier: 2,
          contentPreview: `[${productId}] To: ${lead.name} (${lead.company || 'Individual'}) — ${emailDraft.subject}`,
          fullContent: {
            product: productId,
            track: 'user',
            lead,
            email: emailDraft,
          },
        });

        results.leadsFound++;
        results.emailsDrafted++;
      }
    }

    // Track B: Partnership outreach (Payroll Beacon only)
    const partners = await this.findPartnershipTargets();
    for (const partner of partners) {
      const pitch = await this.draftPartnershipPitch(partner);
      await this.submitForApproval({
        itemType: 'partnership_pitch',
        tier: 3,
        contentPreview: `[Partnership] ${partner.name} — ${partner.type}`,
        fullContent: {
          product: 'payroll_beacon',
          track: 'partner',
          partner,
          pitch,
        },
      });
      results.partnershipPitches++;
    }

    return results;
  }

  async findLeads(productId) {
    const provider = config.leadDataProvider;
    // TODO: Integration with Sales Nav + Hunter or Apollo
    this.logger.debug(`Finding leads for ${productId} via ${provider}`, { agentId: this.agentId });
    return [];
  }

  async findPartnershipTargets() {
    // TODO: Research payroll companies for partnership
    return [];
  }

  async verifyEmail(email) {
    if (!email) return false;
    // TODO: NeverBounce API integration
    return true;
  }

  async draftOutreachEmail(lead, productId) {
    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      `Draft a personalized cold outreach email to ${lead.name} at ${lead.company || 'their organization'}`
    );

    // TODO: LLM integration
    return {
      subject: `[Generated subject for ${lead.name}]`,
      body: '[Personalized outreach email body]',
      unsubscribeLink: true,
      physicalAddress: true,
      senderIdentity: products[productId].name,
    };
  }

  async draftPartnershipPitch(partner) {
    // TODO: LLM integration for partnership pitch
    return {
      subject: `[Partnership pitch to ${partner.name}]`,
      body: '[Partnership pitch body — compliance database integration proposal]',
      unsubscribeLink: true,
      physicalAddress: true,
    };
  }

  async getMailboxForSending(productId) {
    const { data } = await this.supabase
      .from('sending_domains')
      .select('*')
      .eq('account_id', this.accountId)
      .eq('warmup_status', 'ready')
      .eq('blacklisted', false)
      .order('daily_volume', { ascending: true })
      .limit(1);

    return data?.[0] || null;
  }
}

module.exports = OutreachProspectorAgent;
