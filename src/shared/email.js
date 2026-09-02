// ══════════════════════════════════════════════════════════════════
// Email Service (Resend)
//
// Four agents previously called api.resend.com inline with inconsistent
// auth headers, `to` shapes, timeouts and error handling. This is the
// single path for outbound mail.
//
// Outreach mail goes through sendOutreach(), which enforces:
//   - suppression check (fails closed)
//   - mailbox rotation with per-day volume caps
//   - List-Unsubscribe headers
// Transactional alerts use sendAlert(), which skips those.
// ══════════════════════════════════════════════════════════════════

const config = require('../config');
const logger = require('./logger');
const { getSupabase, isSupabaseConfigured } = require('../db/supabase');
const SuppressionService = require('./suppression');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 15000;

function apiKey() {
  return config.email?.resendApiKey || process.env.RESEND_API_KEY || null;
}

function isConfigured() {
  return !!apiKey();
}

/** Low-level Resend call. Returns { id } or throws. */
async function postToResend(payload) {
  const key = apiKey();
  if (!key) throw new Error('RESEND_API_KEY not configured');

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = await res.text();
  let parsed = {};
  try { parsed = body ? JSON.parse(body) : {}; } catch { /* non-JSON error page */ }

  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${parsed.message || body.slice(0, 200)}`);
  }
  if (parsed.error) {
    throw new Error(`Resend error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
  }

  return { id: parsed.id || null };
}

// ── Mailbox rotation ──────────────────────────────────────
// Volume is stored per-day (volume_date), so the count resets by date
// comparison rather than needing a nightly reset job.

async function getNextMailbox(accountId, product = null) {
  if (!isSupabaseConfigured()) return null;
  const today = new Date().toISOString().slice(0, 10);

  let query = getSupabase()
    .from('sending_mailboxes')
    .select('*')
    .eq('account_id', accountId)
    .eq('active', true)
    .eq('warmup_status', 'ready')
    .order('daily_volume', { ascending: true })
    .limit(25);

  const { data } = await query;
  let candidates = data || [];

  // Prefer a mailbox dedicated to this product, else a shared one
  if (product) {
    const productMatch = candidates.filter(m => m.product === product);
    const shared = candidates.filter(m => !m.product);
    candidates = productMatch.length > 0 ? productMatch : shared;
  }

  for (const mailbox of candidates) {
    // A stale volume_date means today's count is effectively zero
    const usedToday = mailbox.volume_date === today ? mailbox.daily_volume : 0;
    if (usedToday < mailbox.max_daily_volume) {
      return { ...mailbox, usedToday };
    }
  }

  return null;
}

async function recordMailboxSend(mailbox) {
  if (!isSupabaseConfigured() || !mailbox?.id) return;
  const today = new Date().toISOString().slice(0, 10);
  const nextVolume = (mailbox.volume_date === today ? mailbox.daily_volume : 0) + 1;

  await getSupabase()
    .from('sending_mailboxes')
    .update({
      daily_volume: nextVolume,
      volume_date: today,
      last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', mailbox.id);
}

function formatFrom(mailbox) {
  if (!mailbox?.email) return null;
  return mailbox.display_name ? `${mailbox.display_name} <${mailbox.email}>` : mailbox.email;
}

// ── Public API ────────────────────────────────────────────

/**
 * Send a cold/outreach email. Enforces suppression and mailbox caps.
 * Returns { sent: boolean, reason?, messageId?, mailbox? } — never throws
 * for a policy refusal, only for genuine transport failures.
 */
async function sendOutreach({ accountId, to, subject, text, html, product = null, unsubscribeUrl = null }) {
  if (!isConfigured()) {
    return { sent: false, reason: 'resend_not_configured' };
  }
  if (!to || !subject || (!text && !html)) {
    return { sent: false, reason: 'missing_required_fields' };
  }

  // 1. Suppression — hard gate, fails closed
  const suppression = new SuppressionService(accountId);
  const check = await suppression.check(to);
  if (check.suppressed) {
    logger.info(`Outreach blocked by suppression: ${to} (${check.reason})`, { accountId });
    return { sent: false, reason: 'suppressed', suppressionReason: check.reason };
  }

  // 2. Mailbox with remaining capacity
  const mailbox = await getNextMailbox(accountId, product);
  if (!mailbox) {
    return { sent: false, reason: 'no_mailbox_available' };
  }

  const from = formatFrom(mailbox);
  if (!from) {
    return { sent: false, reason: 'mailbox_missing_email' };
  }

  // 3. Send with unsubscribe headers
  const headers = {};
  if (unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  const payload = { from, to: [to], subject };
  if (text) payload.text = text;
  if (html) payload.html = html;
  if (Object.keys(headers).length > 0) payload.headers = headers;

  const result = await postToResend(payload);
  await recordMailboxSend(mailbox);

  logger.info(`Outreach sent to ${to} via ${mailbox.email}`, { accountId, messageId: result.id });

  return {
    sent: true,
    messageId: result.id,
    mailbox: { id: mailbox.id, email: mailbox.email, domain_id: mailbox.domain_id },
  };
}

/**
 * Send a transactional/internal alert. No suppression or mailbox logic —
 * these go to the operator, not to prospects.
 */
async function sendAlert({ to, subject, text, html, from }) {
  if (!isConfigured()) return { sent: false, reason: 'resend_not_configured' };

  const recipient = to || config.email?.notificationEmail;
  if (!recipient) return { sent: false, reason: 'no_recipient' };

  const payload = {
    from: from || 'BeaconOps <alerts@beaconops.com>',
    to: Array.isArray(recipient) ? recipient : [recipient],
    subject,
  };
  if (text) payload.text = text;
  if (html) payload.html = html;

  try {
    const result = await postToResend(payload);
    return { sent: true, messageId: result.id };
  } catch (err) {
    logger.warn(`Alert email failed: ${err.message}`);
    return { sent: false, reason: 'send_failed', error: err.message };
  }
}

module.exports = {
  sendOutreach,
  sendAlert,
  getNextMailbox,
  recordMailboxSend,
  isConfigured,
  formatFrom,
};
