const BaseAgent = require('./base-agent');

class QaPlaytestAgent extends BaseAgent {
  static agentId = 'qa-playtest';
  static agentName = 'QA Playtest Agent';

  constructor(accountId) {
    super(accountId, {
      agentId: 'qa-playtest',
      agentName: 'QA Playtest Agent',
      cycle: 'daily',
      defaultTier: 2,
    });

    this.eventCount = 10;
    this.maxLatencyMs = 5000;
    this.minCaptionAccuracy = 0.95;

    this.qualityChecks = [
      'response_format',
      'narrative_consistency',
      'latency',
      'audio_generation',
      'year_end_summary',
      'multi_language_output',
    ];
  }

  async run() {
    const results = { tests: 0, passed: 0, failed: 0, bugs: [] };

    // Create custom world
    const world = await this.createTestWorld();

    // Play 10 events
    const events = [];
    const latencies = [];
    for (let i = 0; i < this.eventCount; i++) {
      const startTime = Date.now();
      const event = await this.playEvent(world, i, events);
      const latency = Date.now() - startTime;
      latencies.push(latency);
      events.push(event);
    }

    // Generate audio and year-end narrative
    const audio = await this.generateAudio(world, events);
    const yearEnd = await this.generateYearEndNarrative(world, events);

    // Run quality checks
    const checks = {};
    const bugs = [];

    // Response format check
    checks.response_format = this.checkResponseFormat(events);
    if (!checks.response_format.pass) bugs.push({ type: 'critical', check: 'response_format', details: checks.response_format.details });

    // Narrative consistency check
    checks.narrative_consistency = this.checkNarrativeConsistency(events);
    if (!checks.narrative_consistency.pass) bugs.push({ type: 'content', check: 'narrative_consistency', details: checks.narrative_consistency.details });

    // Latency check
    checks.latency = {
      pass: latencies.every(l => l < this.maxLatencyMs),
      avgMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      maxMs: Math.max(...latencies),
      details: latencies,
    };
    if (!checks.latency.pass) bugs.push({ type: 'performance', check: 'latency', details: checks.latency });

    // Audio generation check
    checks.audio_generation = { pass: audio.generated && audio.playable, details: audio };
    if (!checks.audio_generation.pass) bugs.push({ type: 'media', check: 'audio_generation', details: audio });

    // Year-end summary check
    checks.year_end_summary = this.checkYearEndSummary(yearEnd, events);
    if (!checks.year_end_summary.pass) bugs.push({ type: 'synthesis', check: 'year_end_summary', details: checks.year_end_summary.details });

    const overallPass = bugs.length === 0;

    // Store results
    await this.supabase.from('qa_results').insert({
      account_id: this.accountId,
      scenario_id: world.id,
      checks,
      pass_fail: overallPass ? 'pass' : 'fail',
      bugs,
      latency_stats: {
        avg: checks.latency.avgMs,
        max: checks.latency.maxMs,
        p95: this.percentile(latencies, 0.95),
      },
    });

    results.tests = this.qualityChecks.length;
    results.passed = this.qualityChecks.filter(c => checks[c]?.pass).length;
    results.failed = results.tests - results.passed;
    results.bugs = bugs;

    // Alert on critical failures
    if (bugs.some(b => b.type === 'critical')) {
      await this.alert('critical', 'chronostates', `QA Playtest critical failure: ${bugs.filter(b => b.type === 'critical').map(b => b.check).join(', ')}`, { bugs });
    }

    return results;
  }

  async createTestWorld() {
    // TODO: ChronoStates API integration
    return { id: `test-${Date.now()}`, name: 'QA Test World', created: true };
  }

  async playEvent(world, eventIndex, previousEvents) {
    // TODO: ChronoStates API integration
    return {
      index: eventIndex,
      decision: `[Test decision ${eventIndex}]`,
      response: { valid: true, format: 'json' },
      referencedPriorDecisions: eventIndex > 0,
    };
  }

  async generateAudio(world, events) {
    // TODO: ChronoStates audio API
    return { generated: true, playable: true, durationMs: 0 };
  }

  async generateYearEndNarrative(world, events) {
    // TODO: ChronoStates narrative API
    return {
      text: '[Year-end narrative]',
      referencedEvents: events.map((_, i) => i),
    };
  }

  checkResponseFormat(events) {
    const valid = events.every(e => e.response?.valid);
    return { pass: valid, details: valid ? 'All responses valid' : 'Invalid response format detected' };
  }

  checkNarrativeConsistency(events) {
    const consistent = events.slice(1).every(e => e.referencedPriorDecisions);
    return { pass: consistent, details: consistent ? 'Consistent' : 'Narrative breaks detected' };
  }

  checkYearEndSummary(yearEnd, events) {
    const allReferenced = events.every((_, i) => yearEnd.referencedEvents.includes(i));
    return { pass: allReferenced, details: allReferenced ? 'All events referenced' : 'Missing event references' };
  }

  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
}

module.exports = QaPlaytestAgent;
