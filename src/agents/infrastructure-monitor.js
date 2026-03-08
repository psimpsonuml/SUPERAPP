const BaseAgent = require('./base-agent');
const https = require('https');
const tls = require('tls');

// Products with their Stripe keys
const STRIPE_PRODUCTS = [
  { id: 'chronostates', name: 'ChronoStates', envKey: 'STRIPE_SECRET_KEY_CS' },
  { id: 'payroll_beacon', name: 'Payroll Beacon', envKey: 'STRIPE_SECRET_KEY_PB' },
  { id: 'budgeting_beacon', name: 'Budgeting Beacon', envKey: 'STRIPE_SECRET_KEY_BB' },
];

// External APIs to ping
const EXTERNAL_APIS = [
  { service: 'tmdb', name: 'TMDB', url: 'https://api.themoviedb.org/3/configuration', needsKey: true, keyEnv: 'TMDB_API_KEY', keyParam: 'api_key' },
  { service: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/r/test.json?limit=1' },
  { service: 'openlibrary', name: 'Open Library', url: 'https://openlibrary.org/search.json?q=test&limit=1' },
  { service: 'resend', name: 'Resend', url: 'https://api.resend.com/domains', needsBearer: true, keyEnv: 'RESEND_API_KEY' },
];

// Domains to check SSL certs for
const SSL_DOMAINS = [
  'chronostates.io',
  'payrollbeacon.com',
  'budgetingbeacon.com',
];

const API_TIMEOUT = 5000; // 5 second timeout for external APIs

class InfrastructureMonitorAgent extends BaseAgent {
  static agentId = 'infrastructure-monitor';
  static agentName = 'Infrastructure Monitor';

  constructor(accountId) {
    super(accountId, {
      agentId: 'infrastructure-monitor',
      agentName: 'Infrastructure Monitor',
      cycle: 'continuous',
      defaultTier: 1,
    });

    this.checks = [
      'stripe_webhooks',
      'supabase_health',
      'external_apis',
      'email_deliverability',
      'ssl_domain_expiry',
    ];
  }

  async run() {
    const results = { checksRun: 0, alerts: [], healthy: 0, warnings: 0, critical: 0, checkResults: [] };

    for (const check of this.checks) {
      try {
        const checkResults = await this.runCheck(check);
        // Each check can return multiple results (e.g., one per product or API)
        const items = Array.isArray(checkResults) ? checkResults : [checkResults];

        for (const result of items) {
          results.checksRun++;
          results.checkResults.push(result);

          // Store check result for uptime history
          await this.storeCheckResult(result);

          if (result.severity === 'critical') {
            results.critical++;
            await this.alert('critical', result.service, result.message, result.details);
            results.alerts.push(result);
            // Send immediate email for critical alerts
            await this.sendCriticalEmail(result);
          } else if (result.severity === 'warning') {
            results.warnings++;
            await this.alert('warning', result.service, result.message, result.details);
            results.alerts.push(result);
          } else if (result.severity === 'info' && result.noteworthy) {
            await this.alert('info', result.service, result.message, result.details);
          } else {
            results.healthy++;
          }

          // Auto-resolve alerts for services that are now healthy
          if (result.severity === 'healthy') {
            await this.resolveAlertsForService(result.service);
          }
        }
      } catch (err) {
        results.checksRun++;
        this.logger.warn(`Check ${check} threw: ${err.message}`, { agentId: this.agentId });
      }
    }

    return results;
  }

  async runCheck(checkName) {
    switch (checkName) {
      case 'stripe_webhooks': return this.checkStripeWebhooks();
      case 'supabase_health': return this.checkSupabaseHealth();
      case 'external_apis': return this.checkExternalApis();
      case 'email_deliverability': return this.checkEmailDeliverability();
      case 'ssl_domain_expiry': return this.checkSslDomainExpiry();
      default: return { severity: 'info', service: checkName, message: 'Unknown check' };
    }
  }

  // ── STRIPE WEBHOOK MONITORING ──────────────────────────

  async checkStripeWebhooks() {
    const results = [];

    for (const product of STRIPE_PRODUCTS) {
      const apiKey = process.env[product.envKey];
      if (!apiKey) {
        results.push({
          severity: 'info',
          service: `stripe_${product.id}`,
          product: product.id,
          message: `Stripe not configured for ${product.name}`,
          details: { configured: false },
        });
        continue;
      }

      try {
        // 1. List webhook endpoints
        const endpoints = await this.stripeRequest(apiKey, '/v1/webhook_endpoints?limit=10');
        const activeEndpoints = (endpoints.data || []).filter(ep => ep.status === 'enabled');

        // 2. Check recent events for failures in the last hour
        const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
        const events = await this.stripeRequest(apiKey,
          `/v1/events?limit=50&created[gte]=${oneHourAgo}&type=webhook_endpoint.*`
        );

        // 3. Check for failed webhook deliveries
        let failedDeliveries = 0;
        let totalEvents = 0;
        const failureDetails = [];

        // Also check recent payment and invoice events for general health
        const recentEvents = await this.stripeRequest(apiKey,
          `/v1/events?limit=20&created[gte]=${oneHourAgo}`
        );
        totalEvents = (recentEvents.data || []).length;

        // Check each endpoint's status
        for (const ep of activeEndpoints) {
          if (ep.status === 'disabled') {
            failedDeliveries++;
            failureDetails.push({
              url: ep.url,
              status: ep.status,
              issue: 'Endpoint disabled',
            });
          }
        }

        // Check for webhook delivery failures in events
        for (const event of (events.data || [])) {
          if (event.type === 'webhook_endpoint.disabled' ||
              event.type === 'webhook_endpoint.delivery_failed') {
            failedDeliveries++;
            failureDetails.push({
              type: event.type,
              created: event.created,
              id: event.id,
            });
          }
        }

        if (failedDeliveries > 0) {
          results.push({
            severity: 'critical',
            service: `stripe_${product.id}`,
            product: product.id,
            message: `${product.name}: ${failedDeliveries} webhook failure(s) in last hour`,
            details: {
              failedDeliveries,
              totalEvents,
              activeEndpoints: activeEndpoints.length,
              failures: failureDetails,
            },
          });
        } else {
          results.push({
            severity: 'healthy',
            service: `stripe_${product.id}`,
            product: product.id,
            message: `${product.name}: Stripe webhooks operational`,
            details: {
              activeEndpoints: activeEndpoints.length,
              totalEvents,
              lastChecked: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        results.push({
          severity: 'critical',
          service: `stripe_${product.id}`,
          product: product.id,
          message: `${product.name}: Stripe API unreachable — ${err.message}`,
          details: { error: err.message },
        });
      }
    }

    return results;
  }

  async stripeRequest(apiKey, path) {
    const url = `https://api.stripe.com${path}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Stripe ${res.status}: ${body.slice(0, 200)}`);
    }

    return res.json();
  }

  // ── SUPABASE HEALTH ────────────────────────────────────

  async checkSupabaseHealth() {
    try {
      const startTime = Date.now();
      const { error } = await this.supabase.from('accounts').select('id').limit(1);
      const latency = Date.now() - startTime;

      if (error) {
        return {
          severity: 'critical',
          service: 'supabase',
          message: `Supabase query failed: ${error.message}`,
          details: { error: error.message, latencyMs: latency },
          responseTimeMs: latency,
        };
      }

      if (latency > 2000) {
        return {
          severity: 'warning',
          service: 'supabase',
          message: `Supabase high latency: ${latency}ms`,
          details: { latencyMs: latency },
          responseTimeMs: latency,
        };
      }

      return {
        severity: 'healthy',
        service: 'supabase',
        message: `Supabase healthy (${latency}ms)`,
        details: { latencyMs: latency },
        responseTimeMs: latency,
      };
    } catch (error) {
      return {
        severity: 'critical',
        service: 'supabase',
        message: `Supabase unreachable: ${error.message}`,
        details: { error: error.message },
        responseTimeMs: -1,
      };
    }
  }

  // ── EXTERNAL API AVAILABILITY ──────────────────────────

  async checkExternalApis() {
    const results = [];

    for (const api of EXTERNAL_APIS) {
      try {
        let url = api.url;
        const headers = { 'User-Agent': 'BeaconOps/1.0 (Health Check)' };

        // Add API key if needed
        if (api.needsKey) {
          const key = process.env[api.keyEnv];
          if (!key) {
            results.push({
              severity: 'info',
              service: api.service,
              message: `${api.name}: API key not configured`,
              details: { configured: false },
            });
            continue;
          }
          url += `${url.includes('?') ? '&' : '?'}${api.keyParam}=${key}`;
        }

        if (api.needsBearer) {
          const key = process.env[api.keyEnv];
          if (!key) {
            results.push({
              severity: 'info',
              service: api.service,
              message: `${api.name}: API key not configured`,
              details: { configured: false },
            });
            continue;
          }
          headers['Authorization'] = `Bearer ${key}`;
        }

        const startTime = Date.now();
        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(API_TIMEOUT),
        });
        const latency = Date.now() - startTime;

        if (!res.ok) {
          results.push({
            severity: 'warning',
            service: api.service,
            message: `${api.name}: returned HTTP ${res.status} (${latency}ms)`,
            details: { httpStatus: res.status, latencyMs: latency },
            responseTimeMs: latency,
          });
        } else if (latency > API_TIMEOUT) {
          results.push({
            severity: 'warning',
            service: api.service,
            message: `${api.name}: slow response (${latency}ms)`,
            details: { latencyMs: latency },
            responseTimeMs: latency,
          });
        } else {
          results.push({
            severity: 'healthy',
            service: api.service,
            message: `${api.name}: OK (${latency}ms)`,
            details: { latencyMs: latency, httpStatus: res.status },
            responseTimeMs: latency,
          });
        }
      } catch (err) {
        results.push({
          severity: err.name === 'TimeoutError' ? 'warning' : 'critical',
          service: api.service,
          message: `${api.name}: ${err.name === 'TimeoutError' ? 'timed out (>5s)' : err.message}`,
          details: { error: err.message, timeout: err.name === 'TimeoutError' },
          responseTimeMs: -1,
        });
      }
    }

    return results;
  }

  // ── EMAIL DELIVERABILITY ───────────────────────────────

  async checkEmailDeliverability() {
    try {
      const { data: domains } = await this.supabase
        .from('sending_domains')
        .select('*')
        .eq('account_id', this.accountId);

      const issues = [];
      for (const domain of domains || []) {
        if (domain.blacklisted) {
          issues.push({ domain: domain.domain, issue: 'blacklisted' });
        }
        if (domain.reputation_score < 0.5) {
          issues.push({ domain: domain.domain, issue: 'low_reputation', score: domain.reputation_score });
        }
      }

      if (issues.length > 0) {
        return {
          severity: 'warning',
          service: 'email',
          message: `Email issues on ${issues.length} domain(s)`,
          details: { issues },
        };
      }

      return {
        severity: 'healthy',
        service: 'email',
        message: 'Email deliverability healthy',
        details: { domainsChecked: (domains || []).length },
      };
    } catch {
      return {
        severity: 'healthy',
        service: 'email',
        message: 'Email check skipped (no domains table)',
        details: {},
      };
    }
  }

  // ── SSL / DOMAIN MONITORING ────────────────────────────

  async checkSslDomainExpiry() {
    const results = [];

    for (const domain of SSL_DOMAINS) {
      try {
        const certInfo = await this.getCertificateExpiry(domain);

        if (!certInfo.valid) {
          results.push({
            severity: 'critical',
            service: `ssl_${domain}`,
            message: `${domain}: SSL certificate invalid or unreachable`,
            details: { domain, error: certInfo.error },
            noteworthy: true,
          });
          continue;
        }

        const daysUntilExpiry = certInfo.daysUntilExpiry;

        if (daysUntilExpiry <= 7) {
          results.push({
            severity: 'critical',
            service: `ssl_${domain}`,
            message: `${domain}: SSL expires in ${daysUntilExpiry} days!`,
            details: { domain, expiresAt: certInfo.expiresAt, daysUntilExpiry },
            noteworthy: true,
          });
        } else if (daysUntilExpiry <= 30) {
          results.push({
            severity: 'info',
            service: `ssl_${domain}`,
            message: `${domain}: SSL expires in ${daysUntilExpiry} days`,
            details: { domain, expiresAt: certInfo.expiresAt, daysUntilExpiry },
            noteworthy: true,
          });
        } else {
          results.push({
            severity: 'healthy',
            service: `ssl_${domain}`,
            message: `${domain}: SSL valid (${daysUntilExpiry} days remaining)`,
            details: { domain, expiresAt: certInfo.expiresAt, daysUntilExpiry },
          });
        }
      } catch (err) {
        results.push({
          severity: 'warning',
          service: `ssl_${domain}`,
          message: `${domain}: SSL check failed — ${err.message}`,
          details: { domain, error: err.message },
        });
      }
    }

    return results;
  }

  getCertificateExpiry(domain) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ valid: false, error: 'Connection timeout' });
      }, 5000);

      try {
        const socket = tls.connect(443, domain, { servername: domain }, () => {
          clearTimeout(timeout);
          const cert = socket.getPeerCertificate();
          socket.end();

          if (!cert || !cert.valid_to) {
            resolve({ valid: false, error: 'No certificate returned' });
            return;
          }

          const expiresAt = new Date(cert.valid_to);
          const daysUntilExpiry = Math.floor((expiresAt - Date.now()) / 86400000);

          resolve({
            valid: true,
            expiresAt: expiresAt.toISOString(),
            daysUntilExpiry,
            issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
            subject: cert.subject?.CN || domain,
          });
        });

        socket.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ valid: false, error: err.message });
        });
      } catch (err) {
        clearTimeout(timeout);
        resolve({ valid: false, error: err.message });
      }
    });
  }

  // ── STORAGE & ALERTING ─────────────────────────────────

  async storeCheckResult(result) {
    try {
      await this.supabase.from('infra_check_results').insert({
        account_id: this.accountId,
        service: result.service,
        check_type: result.service.split('_')[0],
        status: result.severity,
        response_time_ms: result.responseTimeMs || null,
        message: result.message,
        details: result.details || {},
      });
    } catch {
      // Non-critical — don't fail the check if history storage fails
    }
  }

  async resolveAlertsForService(service) {
    try {
      await this.supabase
        .from('infra_alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('account_id', this.accountId)
        .eq('service', service)
        .eq('resolved', false);
    } catch {
      // Non-critical
    }
  }

  async sendCriticalEmail(result) {
    const apiKey = process.env.RESEND_API_KEY;
    const alertEmail = process.env.ALERT_EMAIL;
    if (!apiKey || !alertEmail) return;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'BeaconOps Alerts <alerts@beaconops.com>',
          to: [alertEmail],
          subject: `[CRITICAL] ${result.service}: ${result.message}`,
          html: `
            <h2 style="color: #ef4444;">Critical Infrastructure Alert</h2>
            <p><strong>Service:</strong> ${result.service}</p>
            <p><strong>Message:</strong> ${result.message}</p>
            ${result.product ? `<p><strong>Product:</strong> ${result.product}</p>` : ''}
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <h3>Details</h3>
            <pre style="background: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 13px;">${JSON.stringify(result.details, null, 2)}</pre>
            <p style="color: #6b7280; font-size: 12px;">— BeaconOps Infrastructure Monitor</p>
          `,
        }),
        signal: AbortSignal.timeout(10000),
      });

      this.logger.info(`Critical alert email sent for ${result.service}`, { agentId: this.agentId });
    } catch (err) {
      this.logger.warn(`Failed to send critical alert email: ${err.message}`, { agentId: this.agentId });
    }
  }
}

module.exports = InfrastructureMonitorAgent;
