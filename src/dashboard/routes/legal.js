const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: null, error: null };
  try { return await queryFn(getSupabase()); }
  catch (err) { return { data: null, error: err }; }
}

// GET /:type — get latest published version of a legal document
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!['privacy_policy', 'terms_of_service'].includes(type)) {
      return res.status(400).json({ error: 'Invalid document type. Use privacy_policy or terms_of_service.' });
    }

    const { data, error } = await safeQuery(sb =>
      sb.from('legal_documents')
        .select('*')
        .eq('account_id', req.accountId)
        .eq('document_type', type)
        .order('version', { ascending: false })
        .limit(1)
        .single()
    );

    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json({ document: data || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /:type/versions — list all versions
router.get('/:type/versions', async (req, res) => {
  try {
    const { type } = req.params;
    const { data, error } = await safeQuery(sb =>
      sb.from('legal_documents')
        .select('id, version, published_at, created_at')
        .eq('account_id', req.accountId)
        .eq('document_type', type)
        .order('version', { ascending: false })
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ versions: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /:type/generate — generate a new version using AI
router.post('/:type/generate', async (req, res) => {
  try {
    const { type } = req.params;
    if (!['privacy_policy', 'terms_of_service'].includes(type)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // Get current version number
    const { data: existing } = await safeQuery(sb =>
      sb.from('legal_documents')
        .select('version')
        .eq('account_id', req.accountId)
        .eq('document_type', type)
        .order('version', { ascending: false })
        .limit(1)
        .single()
    );
    const nextVersion = (existing?.version || 0) + 1;

    // Generate content based on type
    const content = type === 'privacy_policy'
      ? generatePrivacyPolicyDraft()
      : generateTermsOfServiceDraft();

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('legal_documents')
      .insert({
        account_id: req.accountId,
        document_type: type,
        version: nextVersion,
        content_markdown: content,
        published_at: null, // Draft — not published until reviewed
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ document: data, message: 'Draft generated. Review and publish when ready.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /:id/publish — publish a draft version
router.patch('/:id/publish', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('legal_documents')
      .update({ published_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('account_id', req.accountId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ document: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id — update document content (editing before publish)
router.put('/:id', async (req, res) => {
  try {
    const { content_markdown } = req.body;
    if (!content_markdown) return res.status(400).json({ error: 'content_markdown is required' });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('legal_documents')
      .update({ content_markdown })
      .eq('id', req.params.id)
      .eq('account_id', req.accountId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ document: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function generatePrivacyPolicyDraft() {
  return `# BeaconOps Privacy Policy

*Version: Draft — Pending Review*
*Last Updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*

## 1. Data Collection

### Account Data
We collect your name, email address, and password hash to create and maintain your account.

### Business Data
- Email content processed through Inbox Monitor
- Social media posts managed through Social Distributor
- Community engagement data from Community Scout/Strategist
- Prospect information from Outreach Prospector
- AI-generated content (blog posts, newsletters, videos, ad creatives)
- Revenue and sales data via Stripe integration

### Personal Module Data
- Entertainment ratings, book/music ratings, and cascade scoring data
- Quiz answers and personality profile results
- Journal entries and sentiment data
- Reminders, routines, and family log entries
- Health/fitness metrics (read-only from connected services)
- Learning queue items, news feed preferences
- Live event history, pet records, store/commerce data
- Podcast listening history, wrestling match ratings

### Facebook Archive Data
Full Facebook data export including posts, friends, messages, photos, and search history when uploaded by the user.

## 2. Data Storage

- All data stored in Supabase (PostgreSQL) with per-account row-level security
- Facebook archive data stored encrypted
- Media files (images, audio, video) stored in Supabase Storage or S3, organized by account
- Daily automated backups to S3. 30-day retention on daily backups, 1-year on weekly exports

## 3. Data Usage

- Data is used exclusively for generating your own reports, features, and agent outputs
- Data is **never** shared with other users, sold to third parties, or used for advertising
- Data is **never** used for training AI models by BeaconOps

## 4. Third-Party Services

User data is sent to LLM providers as part of agent processing:

| Provider | Usage | Data Policy |
|----------|-------|-------------|
| xAI (Grok) | Primary inference | Data retention per xAI terms |
| Anthropic (Claude) | Secondary inference | Not used for training per API policy |
| OpenAI (GPT) | Fallback inference | Not used for training per API policy |
| Google (Gemini) | Specialized tasks | Per Google AI terms |
| ElevenLabs | Voice synthesis | Text sent for audio generation |
| TMDB, Wikipedia | Metadata and results queries | No personal data sent |
| Stripe | Payment processing | Transaction metadata only |

## 5. Data Deletion Rights

- Every module has a dedicated delete button for that module's data
- Full account deletion permanently removes all data across all modules
- Facebook data: separate "Delete my Facebook data" button
- Deletion is permanent and irreversible. Backups purged within 30 days

## 6. Compliance

- **GDPR**: Full compliance. Right to access, rectification, erasure, portability, and restriction of processing
- **CCPA**: Full compliance. Right to know, delete, opt-out of sale (we never sell data)
- **Data Breach Notification**: Users notified within 72 hours of any confirmed breach

## 7. Contact

For privacy inquiries, contact us through the BeaconOps dashboard or email privacy@beaconops.com.
`;
}

function generateTermsOfServiceDraft() {
  return `# BeaconOps Terms of Service

*Version: Draft — Pending Review*
*Last Updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*

## 1. Account Terms

- One account per person. Accurate information required.
- You are responsible for maintaining account security.
- Minimum age: 13.

## 2. API Key Responsibility

- You provide your own API keys for third-party services (xAI, Anthropic, OpenAI, Google, ElevenLabs, Stripe, etc.).
- BeaconOps is not responsible for costs incurred through your API keys.
- You must comply with each third-party provider's terms of service.
- API keys are stored in an encrypted vault only — never in plain text.

## 3. Content Ownership

- You own all content generated by your agents (blog posts, social posts, emails, videos, ad creatives, podcast episodes, etc.).
- BeaconOps claims no ownership or license over user-generated content.
- You are responsible for ensuring generated content complies with applicable laws and platform policies.

## 4. Acceptable Use

You agree not to use BeaconOps for:
- Spam, harassment, illegal activity, or violations of third-party platform terms
- Creating content that infringes copyright, trademarks, or other IP rights
- Sending unsolicited bulk email violating CAN-SPAM or equivalent laws
- Harming, deceiving, or manipulating others

## 5. Service Availability

- Best effort availability. No SLA guarantee for Starter and Growth plans.
- Pro and Agency plans: 99.5% uptime target (not guarantee).
- Scheduled maintenance with 24-hour advance notice.
- Not responsible for third-party API outages.

## 6. Limitation of Liability

- **Genetic analysis** is for informational purposes only. Not medical advice. Not a diagnostic tool.
- **Financial data** is for informational purposes only. Not financial advice.
- **Health dashboard** data is informational only. Not medical advice.
- **AI-generated content** may contain errors. You are responsible for reviewing before publishing.
- BeaconOps is not liable for consequences of auto-approved content published without human review.

## 8. Pricing & Billing

- 30 days notice before any price increase on existing plans.
- Billing is monthly or annual. Annual plans non-refundable after 14-day trial period.
- Free trial available for new accounts.

## 9. Account Termination

- BeaconOps may terminate accounts for TOS violations with 7 days notice (immediate for severe violations).
- You may delete your account at any time. All data permanently deleted within 30 days.
- Upon termination, you may export your data before deletion.

## 10. Dispute Resolution

- Governed by the laws of New Hampshire, United States.
- Disputes resolved through binding arbitration, not litigation.
- 30-day informal resolution period before arbitration.

## 11. Changes to Terms

- Material changes communicated via email 30 days before taking effect.
- Continued use after changes constitutes acceptance.
- Version history available on this page.
`;
}

module.exports = router;
