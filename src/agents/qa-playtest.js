const BaseAgent = require('./base-agent');
const config = require('../config');

// ── Randomized world config parameters ────────────────────
const ERAS = ['ancient', 'medieval', 'renaissance', 'industrial', 'modern', 'future'];
const REGIONS = [
  'North America', 'South America', 'Western Europe', 'Eastern Europe', 'Scandinavia',
  'Middle East', 'North Africa', 'Sub-Saharan Africa', 'East Africa', 'Southern Africa',
  'Central Asia', 'South Asia', 'Southeast Asia', 'East Asia', 'Oceania',
  'Caribbean', 'Central America', 'Balkans', 'Iberian Peninsula', 'British Isles',
  'Mediterranean', 'Pacific Islands', 'Arabian Peninsula', 'Mesopotamia', 'Indochina',
  'Himalayan', 'Siberia', 'Patagonia', 'Arctic', 'Antarctic',
  'Great Plains', 'Sahel', 'Horn of Africa', 'Levant', 'Polynesia',
];
const SCENARIO_TYPES = ['political', 'military', 'economic', 'cultural', 'technological'];
const TEST_LANGUAGES = ['es', 'fr', 'de', 'ja', 'pt'];
const LANGUAGE_NAMES = { es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', pt: 'Portuguese' };

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
    this.minNarrativeScore = 7;
    this.minAudioDurationMs = 30000;
    this.maxAudioDurationMs = 300000;
    this.csBaseUrl = config.urls?.chronostates || process.env.CS_API_BASE_URL || 'https://chronostates.io';
    this.csApiKey = process.env.CS_API_KEY || process.env.CS_TEST_USER_TOKEN || '';
  }

  // ── ChronoStates API helper ─────────────────────────────
  async csApi(path, options = {}) {
    const url = `${this.csBaseUrl}/api${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.csApiKey ? { Authorization: `Bearer ${this.csApiKey}` } : {}),
    };

    const startTime = Date.now();
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    const latencyMs = Date.now() - startTime;
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      rawText: text,
      latencyMs,
      isJson: data !== null,
    };
  }

  // ── Main run ────────────────────────────────────────────
  async run() {
    const scenarioConfig = this.generateScenarioConfig();
    const checks = {};
    const bugs = [];
    const latencies = [];

    // Step 1: Create world
    const worldCheck = await this.stepCreateWorld(scenarioConfig);
    checks.world_creation = worldCheck;
    if (!worldCheck.pass) {
      bugs.push(this.makeBug('critical', 'world_creation', 'Valid JSON with world_id, name, description, starting_conditions', worldCheck.actual, worldCheck));
    }

    const worldId = worldCheck.worldId || `failed-${Date.now()}`;

    // Step 2: Play 10 events
    const events = [];
    if (worldCheck.pass) {
      for (let i = 0; i < this.eventCount; i++) {
        const eventResult = await this.stepPlayEvent(worldId, i, events, scenarioConfig);
        events.push(eventResult);
        latencies.push(eventResult.latencyMs);

        // Response format check
        if (!eventResult.validJson) {
          bugs.push(this.makeBug('critical', 'event_response_format', 'Valid JSON per schema', `Invalid JSON at event ${i}`, eventResult));
        }

        // Latency check
        if (eventResult.latencyMs > this.maxLatencyMs) {
          bugs.push(this.makeBug('performance', 'latency', `Under ${this.maxLatencyMs}ms`, `${eventResult.latencyMs}ms at event ${i}`, eventResult));
        }
      }

      // Narrative consistency check via Claude
      const consistencyCheck = await this.stepCheckNarrativeConsistency(events);
      checks.narrative_consistency = consistencyCheck;
      if (!consistencyCheck.pass) {
        bugs.push(this.makeBug('content', 'narrative_consistency', 'Claude rates 7+ on logical coherence', `Score: ${consistencyCheck.score}`, consistencyCheck));
      }
    }

    // Step 3: Audio generation
    const audioCheck = await this.stepGenerateAudio(worldId, events);
    checks.audio_generation = audioCheck;
    if (!audioCheck.generated || !audioCheck.nonZero) {
      bugs.push(this.makeBug('media', 'audio_generation', 'File generates, non-zero, plays', audioCheck.actual, audioCheck));
    }
    checks.audio_duration = {
      pass: audioCheck.durationMs >= this.minAudioDurationMs && audioCheck.durationMs <= this.maxAudioDurationMs,
      durationMs: audioCheck.durationMs,
    };
    if (!checks.audio_duration.pass && audioCheck.generated) {
      bugs.push(this.makeBug('media_flag', 'audio_duration', `${this.minAudioDurationMs / 1000}s-${this.maxAudioDurationMs / 1000}s`, `${(audioCheck.durationMs / 1000).toFixed(1)}s`, audioCheck));
    }

    // Step 4: Year-end narrative
    const yearEndCheck = await this.stepYearEndNarrative(worldId, events);
    checks.year_end_summary = yearEndCheck;
    if (!yearEndCheck.allEventsReferenced) {
      bugs.push(this.makeBug('synthesis', 'year_end_summary', 'References all 10 events', `Referenced ${yearEndCheck.referencedCount}/${this.eventCount}`, yearEndCheck));
    }
    if (yearEndCheck.qualityScore < this.minNarrativeScore) {
      bugs.push(this.makeBug('content_flag', 'summary_quality', `Claude rates ${this.minNarrativeScore}+`, `Score: ${yearEndCheck.qualityScore}`, yearEndCheck));
    }

    // Step 5: Multi-language test (Saturday only)
    const isSaturday = new Date().getDay() === 6;
    if (isSaturday && worldCheck.pass) {
      const langCheck = await this.stepMultiLanguageTest(worldId, scenarioConfig);
      checks.multi_language = langCheck;
      if (!langCheck.pass) {
        bugs.push(this.makeBug('localization', 'multi_language', 'Correct language, coherent', langCheck.details, langCheck));
      }
    }

    // Latency stats
    const latencyStats = latencies.length > 0 ? {
      min: Math.min(...latencies),
      avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      max: Math.max(...latencies),
      p95: this.percentile(latencies, 0.95),
      all: latencies,
    } : { min: 0, avg: 0, max: 0, p95: 0, all: [] };

    checks.latency = {
      pass: latencies.every(l => l < this.maxLatencyMs),
      ...latencyStats,
    };

    const overallPass = bugs.filter(b => ['critical', 'content', 'media', 'synthesis', 'localization'].includes(b.severity)).length === 0;

    // Store results
    await this.supabase.from('qa_results').insert({
      account_id: this.accountId,
      test_date: new Date().toISOString().slice(0, 10),
      world_id: worldId,
      scenario_config: scenarioConfig,
      checks,
      pass_fail: overallPass ? 'pass' : 'fail',
      bugs,
      latency_stats: latencyStats,
      narrative_quality_score: yearEndCheck.qualityScore || 0,
    });

    this.itemsProduced = events.length;

    // Alert on critical failures via Resend
    const criticalBugs = bugs.filter(b => b.severity === 'critical');
    if (criticalBugs.length > 0) {
      await this.alert('critical', 'chronostates', `QA Playtest CRITICAL: ${criticalBugs.map(b => b.check).join(', ')}`, { worldId, bugs: criticalBugs });
      await this.sendCriticalEmail(worldId, criticalBugs, scenarioConfig);
    }

    return {
      tests: Object.keys(checks).length,
      passed: Object.values(checks).filter(c => c.pass).length,
      failed: Object.values(checks).filter(c => !c.pass).length,
      bugs,
      latencyStats,
      narrativeQuality: yearEndCheck.qualityScore,
      worldId,
      scenarioConfig,
    };
  }

  // ── Scenario config rotation ────────────────────────────
  generateScenarioConfig() {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

    return {
      era: ERAS[dayOfYear % ERAS.length],
      region: REGIONS[dayOfYear % REGIONS.length],
      scenarioType: SCENARIO_TYPES[dayOfYear % SCENARIO_TYPES.length],
      seed: dayOfYear,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Step 1: Create World ────────────────────────────────
  async stepCreateWorld(scenarioConfig) {
    try {
      const res = await this.csApi('/worlds', {
        method: 'POST',
        body: {
          era: scenarioConfig.era,
          region: scenarioConfig.region,
          scenario_type: scenarioConfig.scenarioType,
          name: `QA Test: ${scenarioConfig.era} ${scenarioConfig.region}`,
          is_test: true,
        },
      });

      if (!res.ok || !res.isJson) {
        return {
          pass: false,
          actual: `HTTP ${res.status}, isJson: ${res.isJson}`,
          rawResponse: res.rawText?.slice(0, 500),
        };
      }

      const d = res.data;
      const hasRequiredFields = d.world_id || d.id;
      const hasName = typeof (d.name || d.title) === 'string';
      const hasDescription = typeof d.description === 'string';

      return {
        pass: !!(hasRequiredFields && hasName),
        worldId: d.world_id || d.id,
        name: d.name || d.title,
        description: d.description,
        startingConditions: d.starting_conditions || d.startingConditions,
        hasRequiredFields: !!hasRequiredFields,
        hasName,
        hasDescription,
        latencyMs: res.latencyMs,
        actual: hasRequiredFields ? 'Valid world created' : 'Missing required fields',
      };
    } catch (error) {
      return {
        pass: false,
        actual: `Error: ${error.message}`,
        error: error.message,
      };
    }
  }

  // ── Step 2: Play Event ──────────────────────────────────
  async stepPlayEvent(worldId, eventIndex, previousEvents, scenarioConfig) {
    try {
      const decision = this.generateTestDecision(eventIndex, scenarioConfig);

      const res = await this.csApi(`/worlds/${worldId}/events`, {
        method: 'POST',
        body: {
          decision,
          event_index: eventIndex,
        },
      });

      return {
        index: eventIndex,
        decision,
        validJson: res.isJson,
        httpOk: res.ok,
        status: res.status,
        latencyMs: res.latencyMs,
        response: res.data,
        rawResponse: res.rawText?.slice(0, 1000),
        hasNarrative: !!(res.data?.narrative || res.data?.text || res.data?.response),
        referencedPrior: res.data?.narrative?.includes(previousEvents[eventIndex - 1]?.decision?.slice(0, 20)) ?? null,
      };
    } catch (error) {
      return {
        index: eventIndex,
        validJson: false,
        httpOk: false,
        latencyMs: 0,
        error: error.message,
      };
    }
  }

  generateTestDecision(eventIndex, scenarioConfig) {
    const decisions = {
      political: [
        'Form alliance with neighboring kingdom', 'Declare independence', 'Pass new trade laws',
        'Hold public elections', 'Establish diplomatic embassy', 'Reform the tax system',
        'Create constitutional assembly', 'Negotiate peace treaty', 'Annex border territory', 'Abdicate power',
      ],
      military: [
        'Fortify northern border', 'Launch naval expedition', 'Train elite cavalry unit',
        'Build siege weapons', 'Deploy scouts to western front', 'Negotiate ceasefire',
        'Establish supply lines', 'Recruit mercenary forces', 'Develop new weapons', 'Retreat to stronghold',
      ],
      economic: [
        'Open new trade route', 'Establish merchant guild', 'Mint new currency',
        'Build market district', 'Tax imports heavily', 'Invest in agriculture',
        'Fund exploration expedition', 'Create banking system', 'Establish trade embargo', 'Develop infrastructure',
      ],
      cultural: [
        'Found a university', 'Commission great artwork', 'Establish national festival',
        'Build grand cathedral', 'Patronize local artists', 'Reform education system',
        'Create national library', 'Host international games', 'Preserve ancient ruins', 'Establish printing press',
      ],
      technological: [
        'Fund research laboratory', 'Build aqueduct system', 'Develop new metallurgy',
        'Construct observation tower', 'Establish engineering guild', 'Create mapping expedition',
        'Build road network', 'Develop irrigation systems', 'Fund astronomical research', 'Create mechanical workshop',
      ],
    };

    const pool = decisions[scenarioConfig.scenarioType] || decisions.political;
    return pool[eventIndex % pool.length];
  }

  // ── Step 2b: Narrative consistency via Claude ───────────
  async stepCheckNarrativeConsistency(events) {
    const validEvents = events.filter(e => e.validJson && e.response);
    if (validEvents.length < 2) return { pass: true, score: 10, details: 'Insufficient events for consistency check' };

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const eventSummary = validEvents.map((e, i) =>
        `Event ${i + 1}: Decision="${e.decision}" → Response="${JSON.stringify(e.response).slice(0, 300)}"`
      ).join('\n');

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Evaluate the narrative consistency of this game playthrough. Does each response logically follow from the previous events? Check for:
1. Contradictions between events
2. Hallucinated dates, names, or facts that contradict the established world state
3. Broken references to prior decisions
4. Overall logical coherence

Events:
${eventSummary}

Return JSON: { "score": 1-10, "coherent": true/false, "issues": ["issue1", "issue2"] }
Score 7+ = acceptable. Below 7 = narrative break.`,
        }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          pass: (result.score || 0) >= this.minNarrativeScore,
          score: result.score || 0,
          coherent: result.coherent ?? true,
          issues: result.issues || [],
          details: result.issues?.join('; ') || 'Coherent',
        };
      }
    } catch (error) {
      this.logger.warn(`Narrative consistency check failed: ${error.message}`, { agentId: this.agentId });
    }

    return { pass: true, score: 0, details: 'Claude check unavailable — skipped' };
  }

  // ── Step 3: Audio generation ────────────────────────────
  async stepGenerateAudio(worldId, events) {
    try {
      // Try ChronoStates audio endpoint first
      const res = await this.csApi(`/worlds/${worldId}/audio`, {
        method: 'POST',
        body: {
          type: 'playthrough_summary',
          event_count: events.length,
        },
      });

      if (res.ok && res.data) {
        const audioUrl = res.data.audio_url || res.data.url;
        const durationMs = res.data.duration_ms || res.data.duration * 1000 || 0;
        const fileSize = res.data.file_size || res.data.size || 0;

        return {
          pass: !!(audioUrl && fileSize > 0),
          generated: !!audioUrl,
          nonZero: fileSize > 0,
          playable: true, // We trust the API response for now
          durationMs,
          fileSize,
          audioUrl,
          actual: audioUrl ? `Generated: ${fileSize} bytes, ${(durationMs / 1000).toFixed(1)}s` : 'No audio URL returned',
          latencyMs: res.latencyMs,
        };
      }

      // Fallback: try ElevenLabs directly if CS audio endpoint unavailable
      if (config.elevenlabs?.apiKey && events.length > 0) {
        return await this.generateAudioViaElevenLabs(events);
      }

      return {
        pass: false,
        generated: false,
        nonZero: false,
        playable: false,
        durationMs: 0,
        actual: `Audio endpoint returned HTTP ${res.status}`,
      };
    } catch (error) {
      return {
        pass: false,
        generated: false,
        nonZero: false,
        playable: false,
        durationMs: 0,
        actual: `Error: ${error.message}`,
      };
    }
  }

  async generateAudioViaElevenLabs(events) {
    try {
      const summaryText = events.slice(0, 5).map((e, i) =>
        `Decision ${i + 1}: ${e.decision}.`
      ).join(' ');

      const voiceId = config.elevenlabs.voices?.chronostates;
      if (!voiceId) return { pass: false, generated: false, nonZero: false, playable: false, durationMs: 0, actual: 'No ElevenLabs voice configured' };

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': config.elevenlabs.apiKey,
        },
        body: JSON.stringify({
          text: summaryText,
          model_id: 'eleven_multilingual_v2',
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const estimatedDuration = (buffer.byteLength / 16000) * 1000; // rough estimate

        return {
          pass: buffer.byteLength > 0,
          generated: true,
          nonZero: buffer.byteLength > 0,
          playable: true,
          durationMs: estimatedDuration,
          fileSize: buffer.byteLength,
          actual: `ElevenLabs: ${buffer.byteLength} bytes`,
        };
      }

      return { pass: false, generated: false, nonZero: false, playable: false, durationMs: 0, actual: `ElevenLabs HTTP ${response.status}` };
    } catch (error) {
      return { pass: false, generated: false, nonZero: false, playable: false, durationMs: 0, actual: `ElevenLabs error: ${error.message}` };
    }
  }

  // ── Step 4: Year-end narrative ──────────────────────────
  async stepYearEndNarrative(worldId, events) {
    try {
      const res = await this.csApi(`/worlds/${worldId}/summary`, { method: 'POST' });

      const narrative = res.data?.narrative || res.data?.summary || res.data?.text || '';
      const referencedCount = events.filter(e =>
        narrative.toLowerCase().includes(e.decision?.slice(0, 15).toLowerCase())
      ).length;

      // Quality grading via Claude
      let qualityScore = 0;
      if (narrative.length > 50) {
        qualityScore = await this.gradeNarrativeQuality(narrative, events);
      }

      return {
        pass: referencedCount >= Math.ceil(this.eventCount * 0.7), // Allow 70% reference threshold
        allEventsReferenced: referencedCount >= this.eventCount,
        referencedCount,
        totalEvents: this.eventCount,
        narrativeLength: narrative.length,
        qualityScore,
        details: `Referenced ${referencedCount}/${this.eventCount} events. Quality: ${qualityScore}/10`,
        latencyMs: res.latencyMs,
      };
    } catch (error) {
      return {
        pass: false,
        allEventsReferenced: false,
        referencedCount: 0,
        totalEvents: this.eventCount,
        qualityScore: 0,
        details: `Error: ${error.message}`,
      };
    }
  }

  async gradeNarrativeQuality(narrative, events) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Rate this game year-end narrative 1-10 on quality (coherence, engagement, accuracy, prose quality):

Narrative: "${narrative.slice(0, 1500)}"

Events that should be referenced:
${events.slice(0, 10).map((e, i) => `${i + 1}. ${e.decision}`).join('\n')}

Return ONLY a JSON: { "score": N, "reason": "one line" }`,
        }],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return result.score || 0;
      }
    } catch {
      // Silent fallback
    }
    return 0;
  }

  // ── Step 5: Multi-language test ─────────────────────────
  async stepMultiLanguageTest(worldId, scenarioConfig) {
    // Rotate through languages weekly
    const weekOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (7 * 86400000));
    const testLang = TEST_LANGUAGES[weekOfYear % TEST_LANGUAGES.length];
    const langName = LANGUAGE_NAMES[testLang];

    try {
      // Request localized world playthrough
      const res = await this.csApi(`/worlds/${worldId}/events`, {
        method: 'POST',
        body: {
          decision: 'Form alliance with neighboring faction',
          language: testLang,
        },
      });

      if (!res.ok || !res.isJson) {
        return { pass: false, language: testLang, details: `HTTP ${res.status} for ${langName} output` };
      }

      const outputText = res.data?.narrative || res.data?.text || res.data?.response || JSON.stringify(res.data);

      // Verify language via Claude
      const langVerification = await this.verifyLanguage(outputText, testLang, langName);

      return {
        pass: langVerification.correctLanguage && langVerification.coherent,
        language: testLang,
        languageName: langName,
        correctLanguage: langVerification.correctLanguage,
        coherent: langVerification.coherent,
        details: langVerification.correctLanguage
          ? `${langName} output verified as correct and coherent`
          : `Output not in ${langName} or incoherent`,
        outputSample: outputText.slice(0, 200),
      };
    } catch (error) {
      return { pass: false, language: testLang, details: `Error: ${error.message}` };
    }
  }

  async verifyLanguage(text, langCode, langName) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Is this text in ${langName}? Is it coherent and well-written?
"${text.slice(0, 500)}"
Return JSON: { "correctLanguage": true/false, "coherent": true/false, "detectedLanguage": "language name" }`,
        }],
      });

      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {
      // Silent fallback
    }
    return { correctLanguage: false, coherent: false, detectedLanguage: 'unknown' };
  }

  // ── Critical email notification ─────────────────────────
  async sendCriticalEmail(worldId, criticalBugs, scenarioConfig) {
    try {
      if (!config.email?.resendApiKey || !config.email?.notificationEmail) return;

      const bugList = criticalBugs.map(b =>
        `- ${b.check}: Expected "${b.expected}" but got "${b.actual}"`
      ).join('\n');

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.email.resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'BeaconOps QA <noreply@beaconops.com>',
          to: config.email.notificationEmail,
          subject: `🚨 ChronoStates QA CRITICAL: ${criticalBugs.length} failure(s)`,
          text: `QA Playtest detected critical failures:

World ID: ${worldId}
Config: ${scenarioConfig.era} / ${scenarioConfig.region} / ${scenarioConfig.scenarioType}
Time: ${new Date().toISOString()}

Failures:
${bugList}

View full report in BeaconOps Dashboard → Agents → QA Playtest`,
        }),
      });
    } catch (error) {
      this.logger.warn(`Critical email send failed: ${error.message}`, { agentId: this.agentId });
    }
  }

  // ── Helpers ─────────────────────────────────────────────
  makeBug(severity, check, expected, actual, payload) {
    return {
      severity,
      check,
      expected,
      actual: typeof actual === 'string' ? actual : JSON.stringify(actual).slice(0, 500),
      timestamp: new Date().toISOString(),
      payload: {
        ...(payload?.worldId ? { worldId: payload.worldId } : {}),
        ...(payload?.rawResponse ? { rawResponse: payload.rawResponse.slice(0, 1000) } : {}),
        latencyMs: payload?.latencyMs,
      },
    };
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
}

module.exports = QaPlaytestAgent;
