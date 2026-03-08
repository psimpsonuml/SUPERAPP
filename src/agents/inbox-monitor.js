const Anthropic = require('@anthropic-ai/sdk');
const Imap = require('imap');
const { google } = require('googleapis');
const { simpleParser } = require('mailparser');
const BaseAgent = require('./base-agent');
const products = require('../config/products');

// ── Connection configs ─────────────────────────────────────
// Connection 1: ChronoStates via Namecheap IMAP
// Connection 2: Payroll Beacon Gmail (shared inbox — also handles Budgeting Beacon)

const INBOX_CONNECTIONS = {
  chronostates: {
    type: 'imap',
    productIds: ['chronostates'],
    config: () => ({
      host: process.env.CHRONOSTATES_IMAP_HOST,
      user: process.env.CHRONOSTATES_IMAP_USER,
      password: process.env.CHRONOSTATES_IMAP_PASS,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    }),
  },
  payroll_beacon: {
    type: 'gmail',
    productIds: ['payroll_beacon', 'budgeting_beacon'],
    config: () => ({
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN_PAYROLL,
    }),
  },
};

// Keywords used to route shared-inbox emails to the correct product
const PRODUCT_ROUTING_SIGNALS = {
  budgeting_beacon: [
    'budgeting beacon', 'budgetingbeacon', 'budgetingbeacon.com',
    'budget', 'personal finance', 'savings', 'spending', 'expense',
    'debt', 'financial goal', 'money management',
  ],
  payroll_beacon: [
    'payroll beacon', 'payrollbeacon', 'payrollbeacon.com',
    'payroll', 'compliance', 'w-2', 'w2', '1099', 'withholding',
    'multi-state', 'paycheck', 'employer', 'wages', 'tax filing',
  ],
};

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
    this.anthropic = new Anthropic();
  }

  // ── Main run loop ──────────────────────────────────────
  async run() {
    const results = { processed: 0, drafted: 0, spam: 0, complaints: 0 };

    for (const [connId, conn] of Object.entries(INBOX_CONNECTIONS)) {
      try {
        const emails = conn.type === 'imap'
          ? await this.pollImap(conn.config())
          : await this.pollGmail(conn.config());

        for (const email of emails) {
          // Determine which product this email belongs to
          const productId = conn.productIds.length === 1
            ? conn.productIds[0]
            : this.routeToProduct(email, conn.productIds);

          const classification = await this.classifyEmail(email);

          if (classification === 'spam') {
            if (conn.type === 'gmail') {
              await this.archiveGmail(email.messageId, conn.config());
            }
            results.spam++;
            continue;
          }

          const draft = await this.draftResponse(email, classification, productId);
          const tier = classification === 'complaint' || classification === 'billing_issue' ? 3 : 2;

          if (classification === 'complaint') results.complaints++;

          await this.submitForApproval({
            itemType: 'email_response',
            tier,
            contentPreview: `[${products[productId]?.name || productId}] Re: ${email.subject} — ${classification}`,
            fullContent: {
              product: productId,
              connection: connId,
              originalEmail: email,
              classification,
              draftResponse: draft,
              replyTo: email.from,
            },
          });

          results.drafted++;
          results.processed++;
        }
      } catch (err) {
        this.logger.error(`Failed to poll ${connId} inbox`, { error: err.message, agentId: this.agentId });
        await this.alert('warning', `inbox-${connId}`, `Inbox poll failed: ${err.message}`);
      }
    }

    return results;
  }

  // ── IMAP polling (ChronoStates / Namecheap) ───────────
  async pollImap(config) {
    if (!config.host || !config.user || !config.password) {
      this.logger.debug('IMAP credentials not configured, skipping', { agentId: this.agentId });
      return [];
    }

    return new Promise((resolve, reject) => {
      const imap = new Imap(config);
      const emails = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) { imap.end(); return reject(err); }

          // Search for unseen emails
          imap.search(['UNSEEN'], (err, uids) => {
            if (err) { imap.end(); return reject(err); }
            if (!uids || uids.length === 0) { imap.end(); return resolve([]); }

            // Limit to 25 per poll to stay within rate limits
            const batch = uids.slice(0, 25);
            const fetch = imap.fetch(batch, { bodies: '', markSeen: true });

            fetch.on('message', (msg) => {
              let raw = '';
              msg.on('body', (stream) => {
                stream.on('data', (chunk) => { raw += chunk.toString('utf8'); });
              });
              msg.once('end', () => {
                emails.push(raw);
              });
            });

            fetch.once('end', () => {
              imap.end();
            });

            fetch.once('error', (err) => {
              imap.end();
              reject(err);
            });
          });
        });
      });

      imap.once('error', reject);
      imap.once('end', async () => {
        // Parse raw emails
        const parsed = [];
        for (const raw of emails) {
          try {
            const mail = await simpleParser(raw);
            parsed.push({
              messageId: mail.messageId,
              from: mail.from?.text || '',
              to: mail.to?.text || '',
              subject: mail.subject || '(no subject)',
              body: mail.text || mail.html || '',
              date: mail.date,
              headers: Object.fromEntries(mail.headers),
            });
          } catch (e) {
            this.logger.warn('Failed to parse IMAP email', { error: e.message });
          }
        }
        resolve(parsed);
      });

      imap.connect();
    });
  }

  // ── Gmail OAuth2 polling (Payroll Beacon shared inbox) ─
  async pollGmail(config) {
    if (!config.clientId || !config.clientSecret || !config.refreshToken) {
      this.logger.debug('Gmail OAuth2 credentials not configured, skipping', { agentId: this.agentId });
      return [];
    }

    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
    );
    oauth2Client.setCredentials({ refresh_token: config.refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch unread messages from inbox
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults: 25,
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0) return [];

    const emails = [];
    for (const msg of messages) {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers = full.data.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      // Extract body from payload
      const body = this.extractGmailBody(full.data.payload);

      emails.push({
        messageId: msg.id,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject') || '(no subject)',
        body,
        date: new Date(parseInt(full.data.internalDate)),
      });

      // Mark as read
      await gmail.users.messages.modify({
        userId: 'me',
        id: msg.id,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    }

    return emails;
  }

  extractGmailBody(payload) {
    if (!payload) return '';

    // Direct body
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    // Multipart — find text/plain first, then text/html
    if (payload.parts) {
      const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        return Buffer.from(textPart.body.data, 'base64').toString('utf8');
      }
      const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
      if (htmlPart?.body?.data) {
        return Buffer.from(htmlPart.body.data, 'base64').toString('utf8');
      }
      // Recurse into nested multipart
      for (const part of payload.parts) {
        const nested = this.extractGmailBody(part);
        if (nested) return nested;
      }
    }
    return '';
  }

  // ── Product routing for shared inbox ───────────────────
  // Determines whether an email from the PB/BB shared inbox
  // belongs to Payroll Beacon or Budgeting Beacon
  routeToProduct(email, candidateProducts) {
    const text = `${email.from || ''} ${email.to || ''} ${email.subject || ''} ${email.body || ''}`.toLowerCase();

    const scores = {};
    for (const productId of candidateProducts) {
      const signals = PRODUCT_ROUTING_SIGNALS[productId] || [];
      scores[productId] = signals.reduce((count, signal) => count + (text.includes(signal) ? 1 : 0), 0);
    }

    // Check To: address for domain hints
    const toAddr = (email.to || '').toLowerCase();
    if (toAddr.includes('budgetingbeacon') || toAddr.includes('budgeting')) {
      scores.budgeting_beacon = (scores.budgeting_beacon || 0) + 5;
    }
    if (toAddr.includes('payrollbeacon') || toAddr.includes('payroll')) {
      scores.payroll_beacon = (scores.payroll_beacon || 0) + 5;
    }

    // Pick highest scorer; default to first candidate (payroll_beacon)
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0][1] > 0 ? sorted[0][0] : candidateProducts[0];
  }

  // ── Email classification via Claude ────────────────────
  async classifyEmail(email) {
    const text = `${email.subject || ''} ${email.body || ''}`.toLowerCase();

    // Quick spam check before LLM call
    if (this.isLikelySpam(text)) return 'spam';

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Classify this email into exactly ONE of these categories:
- customer_support (general questions, how-to, feature requests)
- sales_inquiry (pricing, demos, trials)
- partnership_request (integrations, partnerships, affiliates)
- spam (unsolicited, marketing, phishing)
- press_media (interviews, press inquiries)
- complaint (negative experience, frustration, escalation)
- billing_issue (charges, refunds, invoices, payment problems)

Email subject: ${email.subject}
Email from: ${email.from}
Email body (first 1500 chars): ${(email.body || '').slice(0, 1500)}

Respond with ONLY the classification category, nothing else.`,
        }],
      });

      const classification = (response.content[0]?.text || '').trim().toLowerCase();
      if (this.classifications.includes(classification)) return classification;
    } catch (err) {
      this.logger.warn('Claude classification failed, using fallback', { error: err.message });
    }

    // Fallback keyword-based classification
    return this.classifyByKeywords(text);
  }

  classifyByKeywords(text) {
    if (text.includes('partner') || text.includes('integration') || text.includes('affiliate')) return 'partnership_request';
    if (text.includes('complaint') || text.includes('terrible') || text.includes('unacceptable') || text.includes('angry')) return 'complaint';
    if (text.includes('billing') || text.includes('charge') || text.includes('refund') || text.includes('invoice')) return 'billing_issue';
    if (text.includes('press') || text.includes('interview') || text.includes('media inquiry')) return 'press_media';
    if (text.includes('price') || text.includes('demo') || text.includes('trial') || text.includes('pricing')) return 'sales_inquiry';
    return 'customer_support';
  }

  isLikelySpam(text) {
    const spamSignals = [
      'unsubscribe from all', 'click here to win', 'nigerian prince',
      'act now', 'congratulations you won', 'claim your prize',
      'buy now', 'limited time offer', 'no obligation',
    ];
    return spamSignals.some(signal => text.includes(signal));
  }

  // ── Response drafting via Claude + brand voice ─────────
  async draftResponse(email, classification, productId) {
    const product = products[productId];
    const voicePrompt = this.brandVoice.buildSystemPrompt(
      productId,
      `Draft a professional email response to a ${classification.replace(/_/g, ' ')} email`,
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: voicePrompt,
        messages: [{
          role: 'user',
          content: `Draft a response to this ${classification.replace(/_/g, ' ')} email.

From: ${email.from}
Subject: ${email.subject}
Body: ${(email.body || '').slice(0, 2000)}

Requirements:
- Use the ${product?.name || productId} brand voice
- Be helpful and professional
- For complaints/billing issues, show empathy and offer clear next steps
- For sales inquiries, highlight value props without being pushy
- Keep it concise (under 200 words)
- Do NOT include a subject line — just the response body
- Sign off as "The ${product?.name || productId} Team"`,
        }],
      });

      return {
        subject: `Re: ${email.subject}`,
        body: response.content[0]?.text || '',
        productId,
        voiceProfile: voicePrompt,
      };
    } catch (err) {
      this.logger.warn('Claude draft failed, using template', { error: err.message });
      return {
        subject: `Re: ${email.subject}`,
        body: `Thank you for reaching out to ${product?.name || productId}. We've received your ${classification.replace(/_/g, ' ')} and a team member will follow up shortly.\n\nBest regards,\nThe ${product?.name || productId} Team`,
        productId,
        voiceProfile: voicePrompt,
      };
    }
  }

  // ── Gmail archive (move out of inbox) ──────────────────
  async archiveGmail(messageId, config) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
      );
      oauth2Client.setCredentials({ refresh_token: config.refreshToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { removeLabelIds: ['INBOX'] },
      });
    } catch (err) {
      this.logger.warn('Failed to archive Gmail message', { messageId, error: err.message });
    }
  }
}

module.exports = InboxMonitorAgent;
