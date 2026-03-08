const BaseAgent = require('./base-agent');
const products = require('../config/products');

class InboxMonitorAgent extends BaseAgent {
  static agentId = 'inbox-monitor';
  static agentName = 'Inbox Monitor';

  constructor(accountId) {
    super(accountId, {
      agentId: 'inbox-monitor',
      agentName: 'Inbox Monitor',
      cycle: 'continuous',
      defaultTier: 2,
    });
    this.maxDraftsPerDay = 50;
    this.classifications = [
      'customer_support', 'sales_inquiry', 'partnership_request',
      'spam', 'press_media', 'complaint', 'billing_issue',
    ];
  }

  async run() {
    const results = { processed: 0, drafted: 0, spam: 0, complaints: 0 };

    for (const productId of Object.keys(products)) {
      const emails = await this.pollInbox(productId);
      for (const email of emails) {
        const classification = await this.classifyEmail(email);

        if (classification === 'spam') {
          await this.archiveEmail(email.id, productId);
          results.spam++;
          continue;
        }

        const draft = await this.draftResponse(email, classification, productId);
        const tier = classification === 'complaint' || classification === 'billing_issue' ? 3 : 2;

        if (classification === 'complaint') {
          results.complaints++;
        }

        await this.submitForApproval({
          itemType: 'email_response',
          tier,
          contentPreview: `[${productId}] Re: ${email.subject} — ${classification}`,
          fullContent: {
            product: productId,
            originalEmail: email,
            classification,
            draftResponse: draft,
            replyTo: email.from,
          },
        });

        results.drafted++;
        results.processed++;
      }
    }

    return results;
  }

  async pollInbox(productId) {
    // Gmail API integration point
    // Poll inbox, return unread emails since last check
    this.logger.debug(`Polling inbox for ${productId}`, { agentId: this.agentId });
    // TODO: Implement Gmail API polling
    return [];
  }

  async classifyEmail(email) {
    // LLM-based email classification
    // Input: email subject, body, sender
    // Output: one of this.classifications
    const text = `${email.subject || ''} ${email.body || ''}`.toLowerCase();

    if (this.isLikelySpam(text)) return 'spam';
    if (text.includes('partner') || text.includes('integration')) return 'partnership_request';
    if (text.includes('complaint') || text.includes('terrible') || text.includes('unacceptable')) return 'complaint';
    if (text.includes('billing') || text.includes('charge') || text.includes('refund')) return 'billing_issue';
    if (text.includes('press') || text.includes('interview') || text.includes('media')) return 'press_media';
    if (text.includes('price') || text.includes('demo') || text.includes('trial')) return 'sales_inquiry';
    return 'customer_support';
  }

  isLikelySpam(text) {
    const spamSignals = ['unsubscribe from all', 'click here to win', 'nigerian prince', 'act now'];
    return spamSignals.some(signal => text.includes(signal));
  }

  async draftResponse(email, classification, productId) {
    const voiceProfile = this.brandVoice.buildSystemPrompt(
      productId,
      `Draft a professional response to a ${classification} email`
    );

    // LLM call to generate response using brand voice
    // TODO: Implement LLM integration
    return {
      subject: `Re: ${email.subject}`,
      body: `[Draft response for ${classification} using ${products[productId].name} voice]`,
      voiceProfile,
    };
  }

  async archiveEmail(emailId, productId) {
    this.logger.debug(`Archiving spam email ${emailId} for ${productId}`, {
      agentId: this.agentId,
    });
    // TODO: Gmail API archive
  }
}

module.exports = InboxMonitorAgent;
