const BaseAgent = require('./base-agent');
const GrowthContentService = require('../shared/growth/content');
const GrowthCostService = require('../shared/growth/cost');
const { searchOrEmpty, isSearchConfigured } = require('../shared/search');
const { SIGNAL_COLUMNS, withSignalText } = require('../shared/pain-points');
const llm = require('../shared/llm');

// ══════════════════════════════════════════════════════════════════
// Worker 1 — Content Research (spec §20)
//
// Identifies worthwhile Payroll Beacon topics and creates
// content_sources rows. It does NOT generate content — that is Worker 2.
//
// Everything it creates carries provenance (spec §32). A topic it
// cannot substantiate is stored as source_confidence='needs_research',
// which excludes it from generation until a human verifies it.
// ══════════════════════════════════════════════════════════════════

// Regulatory beats worth a weekly sweep.
const RESEARCH_QUERIES = [
  'state minimum wage increase effective date payroll',
  'local minimum wage ordinance change city county',
  'state payroll tax rate change employers',
  'new hire reporting requirement change state',
  'pay transparency law effective employers',
  'paid leave law employer payroll requirement',
  'multi-state payroll compliance change',
];

const MAX_SOURCES_PER_RUN = 6;

class GrowthContentResearchAgent extends BaseAgent {
  static agentId = 'growth-content-research';
  static agentName = 'Growth Content Research';

  constructor(accountId) {
    super(accountId, {
      agentId: 'growth-content-research',
      agentName: 'Growth Content Research',
      cycle: 'weekly',
      defaultTier: 2,
    });

    this.content = new GrowthContentService(accountId);
    this.cost = new GrowthCostService(accountId);
  }

  async run() {
    const results = {
      searchesRun: 0,
      candidatesFound: 0,
      sourcesCreated: 0,
      needsResearch: 0,
      fromPainPoints: 0,
      searchAvailable: isSearchConfigured(),
    };

    // 1. Regulatory sweep — only if a real search provider exists.
    if (results.searchAvailable) {
      const candidates = await this.sweepRegulatorySources(results);
      results.candidatesFound = candidates.length;
      await this.storeCandidates(candidates, results);
    } else {
      this.logger.warn(
        'No search provider configured — skipping the regulatory sweep. '
        + 'Set BRAVE_SEARCH_API_KEY, SERPER_API_KEY, or GOOGLE_SEARCH_API_KEY.',
        { agentId: this.agentId }
      );
    }

    // 2. Pain points already collected by pain-point-hunter become
    //    source candidates — no extra scraping needed.
    await this.sourcesFromPainPoints(results);

    this.itemsProduced = results.sourcesCreated;
    return results;
  }

  async sweepRegulatorySources(results) {
    const seen = new Set();
    const candidates = [];

    for (const query of RESEARCH_QUERIES) {
      const hits = await searchOrEmpty(query, { limit: 5 }, this.logger);
      results.searchesRun++;

      for (const hit of hits) {
        if (!hit.url || seen.has(hit.url)) continue;
        seen.add(hit.url);
        candidates.push({ ...hit, query });
      }

      await this.sleep(800);
    }

    return candidates;
  }

  async storeCandidates(candidates, results) {
    if (candidates.length === 0) return;

    const classified = await this.classifyCandidates(candidates);

    for (const item of classified.slice(0, MAX_SOURCES_PER_RUN)) {
      if (await this.isDuplicateSource(item.source_url)) continue;

      // §32 — a candidate we cannot substantiate is stored for a human
      // to verify, not fed to the generator.
      const confidence = item.confidence === 'verified' ? 'likely' : 'needs_research';
      if (confidence === 'needs_research') results.needsResearch++;

      await this.content.createSource({
        title: item.title,
        sourceType: item.source_type || 'regulatory_change',
        sourceUrl: item.source_url,
        summary: item.summary,
        topic: item.topic,
        category: item.category,
        targetAudience: 'Payroll managers and multi-state employers',
        states: item.states || [],
        jurisdictions: item.jurisdictions || [],
        effectiveDate: item.effective_date || null,
        sourceConfidence: confidence,
        originAgent: this.agentId,
        status: confidence === 'needs_research' ? 'needs_research' : 'ready',
        metadata: { discoveredVia: item.query, relevance: item.relevance },
      });

      results.sourcesCreated++;
    }
  }

  /**
   * Ask the model to judge relevance and extract structure.
   * Returns [] on failure — a research sweep that cannot classify
   * should produce nothing, not guesses.
   */
  async classifyCandidates(candidates) {
    if (!llm.isConfigured()) {
      this.logger.warn('No LLM configured — cannot classify research candidates', {
        agentId: this.agentId,
      });
      return [];
    }

    const list = candidates.slice(0, 25).map((c, i) =>
      `[${i}] ${c.title}\n    ${c.url}\n    ${(c.snippet || '').slice(0, 220)}`
    ).join('\n');

    try {
      const { data, usage, model } = await llm.completeJson({
        prompt: `Below are search results about US payroll and wage regulation.

Identify which are genuinely useful source material for a payroll
compliance publication aimed at multi-state employers.

For each one worth keeping, extract what the snippet actually supports.
Do NOT invent effective dates, rates, or jurisdictions — use null when
the snippet does not state them.

Set confidence to "verified" ONLY when the result is from a government
or official source AND states a specific change. Otherwise "unclear".

Discard marketing pages, vendor blogs, and generic explainers.

${list}

Return: {"items": [{
  "index": 0,
  "title": "clear descriptive title",
  "source_url": "...",
  "summary": "2-3 sentences on what changed and who it affects",
  "topic": "...",
  "category": "compliance | wage | tax | reporting | leave",
  "source_type": "state_wage_update | local_wage_update | local_tax_update | regulatory_change | compliance_update",
  "states": ["CA"],
  "jurisdictions": ["Los Angeles County"],
  "effective_date": "YYYY-MM-DD or null",
  "confidence": "verified | unclear",
  "relevance": 1-10
}]}`,
        model: llm.MODELS.fast,
        maxTokens: 4000,
      });

      await this.cost.recordLlm({ model, usage, operation: 'research:classify' });

      const items = (data.items || [])
        .filter(i => (i.relevance || 0) >= 6)
        .sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

      // Carry the originating query through for provenance
      return items.map(i => ({
        ...i,
        query: candidates[i.index]?.query || null,
      }));
    } catch (err) {
      this.logger.warn(`Failed to classify research candidates: ${err.message}`, {
        agentId: this.agentId,
      });
      return [];
    }
  }

  /** Reuse pain-point-hunter output rather than scanning again. */
  async sourcesFromPainPoints(results) {
    try {
      const { data } = await this.supabase
        .from('pain_points')
        .select(SIGNAL_COLUMNS)
        .eq('account_id', this.accountId)
        .or('product.eq.payroll_beacon,product_relevance.eq.payroll_beacon')
        .gte('score', 7)
        .order('score', { ascending: false })
        .limit(5);

      const painPoints = withSignalText(data);

      for (const pp of painPoints) {
        if (!pp.signalText) continue;
        if (await this.isDuplicateSource(pp.source_url)) continue;

        await this.content.createSource({
          title: pp.signalText.slice(0, 140),
          sourceType: 'pain_point',
          sourceUrl: pp.source_url,
          summary: pp.signalText,
          topic: pp.category || 'payroll pain point',
          category: pp.category,
          targetAudience: 'Payroll managers',
          // A user complaint is real, but it is not a regulatory citation.
          sourceConfidence: 'likely',
          originAgent: this.agentId,
          status: 'ready',
          metadata: { painPointId: pp.id, painPointScore: pp.score },
        });

        results.sourcesCreated++;
        results.fromPainPoints++;
      }
    } catch (err) {
      this.logger.warn(`Failed to build sources from pain points: ${err.message}`, {
        agentId: this.agentId,
      });
    }
  }

  async isDuplicateSource(url) {
    if (!url) return false;
    const { data } = await this.supabase
      .from('content_sources')
      .select('id')
      .eq('account_id', this.accountId)
      .eq('source_url', url)
      .limit(1);
    return (data || []).length > 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GrowthContentResearchAgent;
module.exports.RESEARCH_QUERIES = RESEARCH_QUERIES;
