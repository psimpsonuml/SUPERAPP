// ══════════════════════════════════════════════════════════════════
// Suppression List
//
// Spec §13: every outbound workflow must check suppressions before
// queuing or sending. No exceptions.
//
// Fails CLOSED — if the check itself errors, the address is treated as
// suppressed. A send that shouldn't happen is far more costly than a
// send that gets delayed.
// ══════════════════════════════════════════════════════════════════

const { getSupabase, isSupabaseConfigured } = require('../db/supabase');
const logger = require('./logger');

const REASONS = [
  'unsubscribed', 'requested_no_contact', 'bounced', 'spam_complaint',
  'manually_blocked', 'competitor', 'invalid', 'other',
];

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function domainOf(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  return at === -1 ? '' : normalized.slice(at + 1);
}

class SuppressionService {
  constructor(accountId) {
    this.accountId = accountId;
  }

  /**
   * Is this address suppressed?
   * Returns { suppressed: boolean, reason?, matchedOn?: 'email'|'domain'|'error' }
   */
  async check(email) {
    const normalized = normalizeEmail(email);

    if (!normalized || !normalized.includes('@')) {
      return { suppressed: true, reason: 'invalid', matchedOn: 'email' };
    }

    if (!isSupabaseConfigured()) {
      // No database means no way to verify — refuse rather than guess.
      return { suppressed: true, reason: 'other', matchedOn: 'error' };
    }

    const domain = domainOf(normalized);

    try {
      const sb = getSupabase();

      // Two exact-match queries rather than one interpolated .or() filter.
      // PostgREST parses .or() from a string, so an address containing a
      // comma or parenthesis could alter the predicate.
      const { data: byEmail, error: emailErr } = await sb
        .from('growth_suppressions')
        .select('id, email, domain, reason')
        .eq('account_id', this.accountId)
        .eq('email', normalized)
        .limit(1);

      if (emailErr) throw new Error(emailErr.message);
      if (byEmail && byEmail.length > 0) {
        return { suppressed: true, reason: byEmail[0].reason, matchedOn: 'email' };
      }

      if (domain) {
        const { data: byDomain, error: domainErr } = await sb
          .from('growth_suppressions')
          .select('id, email, domain, reason')
          .eq('account_id', this.accountId)
          .eq('domain', domain)
          .limit(1);

        if (domainErr) throw new Error(domainErr.message);
        if (byDomain && byDomain.length > 0) {
          return { suppressed: true, reason: byDomain[0].reason, matchedOn: 'domain' };
        }
      }

      return { suppressed: false };
    } catch (err) {
      // Fail closed.
      logger.error(`Suppression check failed for ${normalized} — treating as suppressed: ${err.message}`, {
        accountId: this.accountId,
      });
      return { suppressed: true, reason: 'other', matchedOn: 'error' };
    }
  }

  /** Filter a list of prospects down to those safe to contact. */
  async filterContactable(prospects) {
    const allowed = [];
    const blocked = [];

    for (const prospect of prospects || []) {
      if (prospect.do_not_contact) {
        blocked.push({ prospect, reason: 'requested_no_contact', matchedOn: 'prospect_flag' });
        continue;
      }
      const result = await this.check(prospect.email);
      if (result.suppressed) {
        blocked.push({ prospect, ...result });
      } else {
        allowed.push(prospect);
      }
    }

    return { allowed, blocked };
  }

  /** Add an address or domain to the suppression list. Idempotent. */
  async add({ email, domain, prospectId, reason = 'other', source = 'manual', notes }) {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    if (!email && !domain) throw new Error('Either email or domain is required');
    if (!REASONS.includes(reason)) throw new Error(`Invalid suppression reason: ${reason}`);

    const record = {
      account_id: this.accountId,
      email: email ? normalizeEmail(email) : null,
      domain: domain ? domain.trim().toLowerCase() : null,
      prospect_id: prospectId || null,
      reason,
      source,
      notes: notes || null,
    };

    const { data, error } = await getSupabase()
      .from('growth_suppressions')
      .upsert(record, { onConflict: email ? 'account_id,email' : 'account_id,domain', ignoreDuplicates: true })
      .select()
      .maybeSingle();

    if (error && !/duplicate|conflict/i.test(error.message)) {
      throw new Error(`Failed to add suppression: ${error.message}`);
    }

    // Mirror onto the prospect so queue views can filter without a join
    if (prospectId) {
      await getSupabase()
        .from('prospect_pipeline')
        .update({ do_not_contact: true, updated_at: new Date().toISOString() })
        .eq('id', prospectId)
        .eq('account_id', this.accountId);
    }

    logger.info(`Suppressed ${email || domain} (${reason})`, { accountId: this.accountId });
    return data;
  }

  async list({ limit = 100, offset = 0 } = {}) {
    if (!isSupabaseConfigured()) return [];
    const { data } = await getSupabase()
      .from('growth_suppressions')
      .select('*')
      .eq('account_id', this.accountId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return data || [];
  }

  async remove(id) {
    if (!isSupabaseConfigured()) throw new Error('Database not configured');
    const { error } = await getSupabase()
      .from('growth_suppressions')
      .delete()
      .eq('id', id)
      .eq('account_id', this.accountId);
    if (error) throw new Error(`Failed to remove suppression: ${error.message}`);
    return { removed: true };
  }
}

module.exports = SuppressionService;
module.exports.REASONS = REASONS;
module.exports.normalizeEmail = normalizeEmail;
module.exports.domainOf = domainOf;
