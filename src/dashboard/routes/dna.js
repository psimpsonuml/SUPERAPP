const express = require('express');
const { getSupabase, isSupabaseConfigured } = require('../../db/supabase');

const router = express.Router();

async function safeQuery(queryFn) {
  if (!isSupabaseConfigured()) return { data: [], error: null };
  try {
    return await queryFn(getSupabase());
  } catch (err) {
    return { data: [], error: err };
  }
}

// ── DNA Testing Services Config ─────────────────────────────────

const DNA_SERVICES = [
  { id: '23andme', name: '23andMe', format: 'tab', columns: ['rsid','chromosome','position','genotype'], snpCount: 600000, instructions: 'Settings > 23andMe Data > Download Raw Data' },
  { id: 'ancestrydna', name: 'AncestryDNA', format: 'tab', columns: ['rsid','chromosome','position','allele1','allele2'], snpCount: 680000, instructions: 'Settings > Download DNA Data' },
  { id: 'myheritage', name: 'MyHeritage', format: 'csv', columns: ['RSID','chromosome','position','result'], snpCount: 700000, instructions: 'DNA > Manage DNA kits > Download raw DNA data' },
  { id: 'familytreedna', name: 'FamilyTreeDNA', format: 'csv', columns: ['RSID','chromosome','position','result'], snpCount: 700000, instructions: 'myFTDNA > Download Raw Data' },
  { id: 'livingdna', name: 'LivingDNA', format: 'csv', columns: ['rsid','chromosome','position','genotype'], snpCount: 600000, instructions: 'Account settings > Download' },
  { id: 'nebula', name: 'Nebula Genomics', format: 'vcf', columns: ['CHROM','POS','ID','REF','ALT','QUAL'], snpCount: 3000000, instructions: 'Account dashboard > Download', wgs: true },
  { id: 'dantelabs', name: 'Dante Labs', format: 'vcf', columns: ['CHROM','POS','ID','REF','ALT','QUAL'], snpCount: 3000000, instructions: 'Account dashboard > Download', wgs: true },
  { id: 'homedna', name: 'HomeDNA', format: 'tab', columns: ['rsid','chromosome','position','genotype'], snpCount: 500000, instructions: 'Account settings' },
  { id: 'tellmegen', name: 'TellMeGen', format: 'csv', columns: ['rsid','chromosome','position','genotype'], snpCount: 700000, instructions: 'Account settings > Download' },
  { id: 'wegene', name: 'WeGene', format: 'tab', columns: ['rsid','chromosome','position','genotype'], snpCount: 600000, instructions: 'Account settings' },
  { id: '23mofang', name: '23Mofang', format: 'tab', columns: ['rsid','chromosome','position','genotype'], snpCount: 600000, instructions: 'Account settings' },
];

const REPORT_TYPES = ['health', 'traits', 'pharmacogenomics', 'ancestry', 'athletic', 'nutrition', 'wellness'];

// ═══════════════════════════════════════════════════════════════
// PHASE 1: PUBLIC ATLAS
// ═══════════════════════════════════════════════════════════════

// GET /atlas — browse/search atlas entries
router.get('/atlas', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = getSupabase().from('dna_atlas').select('*', { count: 'exact' });

    if (category) query = query.eq('category', category);
    if (search) {
      query = query.or(`snp_id.ilike.%${search}%,gene.ilike.%${search}%,trait_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    query = query.order('magnitude', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Category counts
    const { data: catCounts } = await safeQuery(sb =>
      sb.from('dna_atlas').select('category').then(r => r)
    );
    const categories = {};
    (catCounts || []).forEach(r => {
      categories[r.category] = (categories[r.category] || 0) + 1;
    });

    res.json({ entries: data || [], total: count || 0, categories, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /atlas/:snpId — single atlas entry
router.get('/atlas/:snpId', async (req, res) => {
  try {
    const { data, error } = await safeQuery(sb =>
      sb.from('dna_atlas').select('*').eq('snp_id', req.params.snpId).single()
    );
    if (error || !data) return res.status(404).json({ error: 'SNP not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /atlas/seed — seed atlas with curated data (idempotent)
router.post('/atlas/seed', async (req, res) => {
  try {
    const ATLAS_DATA = require('../../db/dna_atlas_seed');

    let inserted = 0;
    const batchSize = 50;
    for (let i = 0; i < ATLAS_DATA.length; i += batchSize) {
      const batch = ATLAS_DATA.slice(i, i + batchSize);
      const { error } = await safeQuery(sb =>
        sb.from('dna_atlas').upsert(batch, { onConflict: 'snp_id', ignoreDuplicates: true })
      );
      if (!error) inserted += batch.length;
    }

    res.json({ seeded: inserted, total: ATLAS_DATA.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PHASE 2: PERSONAL DNA
// ═══════════════════════════════════════════════════════════════

// GET /personal — personal DNA overview (imports, coverage, service list)
router.get('/personal', async (req, res) => {
  try {
    const [importsResult, countResult, servicesResult] = await Promise.all([
      safeQuery(sb => sb.from('dna_imports').select('*').eq('account_id', req.accountId).order('imported_at', { ascending: false })),
      safeQuery(sb => sb.from('dna_personal').select('snp_id', { count: 'exact', head: true }).eq('account_id', req.accountId)),
      safeQuery(sb => sb.from('dna_personal').select('source_service').eq('account_id', req.accountId)),
    ]);

    const imports = importsResult.data || [];
    const totalSnps = countResult.data?.length || 0;
    const services = [...new Set((servicesResult.data || []).map(r => r.source_service))];

    // Atlas overlap
    const { data: atlasSnps } = await safeQuery(sb =>
      sb.from('dna_atlas').select('snp_id')
    );
    const atlasSet = new Set((atlasSnps || []).map(a => a.snp_id));

    let matchedCount = 0;
    if (totalSnps > 0 && atlasSet.size > 0) {
      const { data: personalSnps } = await safeQuery(sb =>
        sb.from('dna_personal').select('snp_id').eq('account_id', req.accountId)
      );
      matchedCount = (personalSnps || []).filter(p => atlasSet.has(p.snp_id)).length;
    }

    res.json({
      hasData: totalSnps > 0,
      totalSnps,
      matchedAtlas: matchedCount,
      atlasSize: atlasSet.size,
      services,
      imports,
      supportedServices: DNA_SERVICES,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /personal/import — import parsed DNA data
router.post('/personal/import', async (req, res) => {
  try {
    const { sourceService, fileName, snps } = req.body;
    if (!sourceService || !snps?.length) {
      return res.status(400).json({ error: 'sourceService and snps array required' });
    }

    let imported = 0;
    const batchSize = 500;
    for (let i = 0; i < snps.length; i += batchSize) {
      const batch = snps.slice(i, i + batchSize)
        .filter(s => s.snp_id && s.genotype && s.genotype !== '--' && s.genotype !== '00')
        .map(s => ({
          account_id: req.accountId,
          snp_id: s.snp_id,
          chromosome: s.chromosome || null,
          position: s.position ? parseInt(s.position) : null,
          genotype: s.genotype,
          source_service: sourceService,
        }));

      const { error } = await safeQuery(sb =>
        sb.from('dna_personal').upsert(batch, { onConflict: 'account_id,snp_id,source_service' })
      );
      if (!error) imported += batch.length;
    }

    // Atlas match count
    const { data: atlasSnps } = await safeQuery(sb => sb.from('dna_atlas').select('snp_id'));
    const atlasSet = new Set((atlasSnps || []).map(a => a.snp_id));
    const matched = snps.filter(s => atlasSet.has(s.snp_id)).length;

    // Record import
    await safeQuery(sb =>
      sb.from('dna_imports').insert({
        account_id: req.accountId,
        source_service: sourceService,
        file_name: fileName || `${sourceService}-upload`,
        snps_imported: imported,
        snps_matched: matched,
        detected_format: sourceService,
      })
    );

    const service = DNA_SERVICES.find(s => s.id === sourceService);
    res.json({
      imported,
      matched,
      atlasSize: atlasSet.size,
      coverage: service ? `${((imported / service.snpCount) * 100).toFixed(0)}% of typical ${service.name} coverage` : null,
      recommendation: matched < 100 ? 'For more comprehensive analysis, consider Whole Genome Sequencing services like Nebula Genomics.' : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /personal/analysis — cross-reference personal data with atlas
router.get('/personal/analysis', async (req, res) => {
  try {
    const category = req.query.category;

    // Get all personal SNPs
    const { data: personalData } = await safeQuery(sb =>
      sb.from('dna_personal').select('snp_id, genotype, source_service').eq('account_id', req.accountId)
    );
    if (!personalData?.length) {
      return res.json({ findings: [], message: 'No DNA data uploaded yet' });
    }

    // Group by snp_id (handle multiple services)
    const personalMap = {};
    for (const p of personalData) {
      if (!personalMap[p.snp_id]) personalMap[p.snp_id] = [];
      personalMap[p.snp_id].push(p);
    }

    // Get matching atlas entries
    let atlasQuery = getSupabase().from('dna_atlas').select('*');
    if (category) atlasQuery = atlasQuery.eq('category', category);

    const { data: atlasEntries } = await atlasQuery;
    if (!atlasEntries?.length) {
      return res.json({ findings: [], message: 'Atlas not seeded yet' });
    }

    // Cross-reference
    const findings = [];
    for (const atlas of atlasEntries) {
      const personal = personalMap[atlas.snp_id];
      if (!personal) continue;

      const genotype = personal[0].genotype;
      const genotypes = atlas.genotypes_json || {};
      const match = genotypes[genotype] || genotypes[genotype.split('').reverse().join('')]; // Try reverse complement

      // Check for conflicts between services
      const services = personal.map(p => ({ service: p.source_service, genotype: p.genotype }));
      const conflict = services.length > 1 && new Set(services.map(s => s.genotype)).size > 1;

      findings.push({
        snp_id: atlas.snp_id,
        gene: atlas.gene,
        chromosome: atlas.chromosome,
        category: atlas.category,
        trait_name: atlas.trait_name,
        description: atlas.description,
        genotype,
        genotypeInfo: match || { risk: 'unknown', meaning: 'Genotype not in atlas for this variant' },
        allGenotypes: genotypes,
        confidence: atlas.confidence,
        magnitude: atlas.magnitude,
        sources: atlas.sources_json,
        services: services.map(s => s.service),
        conflict,
      });
    }

    // Sort by magnitude descending
    findings.sort((a, b) => (b.magnitude || 0) - (a.magnitude || 0));

    res.json({
      findings,
      total: findings.length,
      byCategory: findings.reduce((acc, f) => { acc[f.category] = (acc[f.category] || 0) + 1; return acc; }, {}),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /personal/report — generate a report using Claude API
router.post('/personal/report', async (req, res) => {
  try {
    const { reportType } = req.body;
    if (!REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({ error: `Invalid report type. Must be one of: ${REPORT_TYPES.join(', ')}` });
    }

    // Get analysis findings for this category
    const category = reportType === 'wellness' ? null : reportType;
    const { data: personalData } = await safeQuery(sb =>
      sb.from('dna_personal').select('snp_id, genotype').eq('account_id', req.accountId)
    );
    if (!personalData?.length) {
      return res.json({ report: null, message: 'No DNA data — upload first' });
    }

    const personalMap = {};
    for (const p of personalData) personalMap[p.snp_id] = p.genotype;

    let atlasQuery = getSupabase().from('dna_atlas').select('*');
    if (category) atlasQuery = atlasQuery.eq('category', category);
    const { data: atlasEntries } = await atlasQuery;

    const matched = (atlasEntries || []).filter(a => personalMap[a.snp_id]).map(a => {
      const genotype = personalMap[a.snp_id];
      const info = a.genotypes_json?.[genotype] || a.genotypes_json?.[genotype.split('').reverse().join('')] || {};
      return { snp: a.snp_id, gene: a.gene, trait: a.trait_name, genotype, risk: info.risk || 'unknown', meaning: info.meaning || '', magnitude: a.magnitude };
    });

    if (matched.length < 3) {
      return res.json({ report: null, message: `Only ${matched.length} matching SNPs found for ${reportType}. Need at least 3 for a meaningful report.` });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const prompts = {
      health: `Generate a personal health predispositions report. For each finding, explain the risk level in plain language, provide population context (e.g., "your baseline risk is X% vs population average Y%"), and include actionable lifestyle factors. Emphasize these are predispositions, NOT diagnoses.`,
      traits: `Generate a fun and insightful personal traits report. Cover physical traits, sensory perceptions, and behavioral tendencies. Be conversational: "You likely metabolize caffeine slowly, which explains why that afternoon coffee keeps you up."`,
      pharmacogenomics: `Generate a pharmacogenomics drug response report. Include specific drug names affected by each variant. STRONGLY emphasize consulting a healthcare provider before making any medication changes. Flag critical drug interactions.`,
      ancestry: `Generate an ancestry and population genetics report. Cover haplogroup implications, population-specific markers, and historical migration context.`,
      athletic: `Generate an athletic potential report. Cover sprint vs endurance tendency, injury susceptibility, recovery characteristics, and optimal training style based on genetics.`,
      nutrition: `Generate a nutrition genetics report. Cover nutrient processing (lactose, gluten, folate, caffeine, vitamins), with practical dietary recommendations based on each variant.`,
      wellness: `Generate a holistic wellness summary connecting findings across ALL categories — health, traits, nutrition, athletic, and pharmacogenomics. Create a narrative connecting the dots between different genetic findings.`,
    };

    const findingsSummary = matched.slice(0, 40).map(m =>
      `${m.snp} (${m.gene}) — ${m.trait}: ${m.genotype} = ${m.risk}. ${m.meaning}`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `${prompts[reportType]}

Genetic findings (${matched.length} variants):
${findingsSummary}

Generate a structured JSON report:
{
  "title": "report title",
  "summary": "2-3 sentence overview",
  "findings": [
    {
      "category": "subcategory name",
      "title": "finding title",
      "risk_level": "typical|slightly_elevated|elevated",
      "detail": "detailed explanation in plain language",
      "actionable": "what they can do about it (if applicable)",
      "snps_involved": ["rs..."]
    }
  ],
  "key_takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "disclaimer": "appropriate medical disclaimer"
}

IMPORTANT: Always include this disclaimer: "This analysis is for informational and educational purposes only. It is not medical advice. Genetic predisposition does not guarantee any outcome. Always consult a qualified healthcare provider before making health decisions based on genetic information."

JSON only, no markdown fences.`,
      }],
    });

    let report;
    try {
      const text = response.content[0]?.text || '{}';
      report = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      report = { title: reportType, summary: response.content[0]?.text || '', findings: [], disclaimer: 'This analysis is for informational and educational purposes only.' };
    }

    // Store report
    await safeQuery(sb =>
      sb.from('dna_reports').upsert({
        account_id: req.accountId,
        report_type: reportType,
        content_json: report,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,report_type' }).select()
    );

    res.json({ report, reportType, snpsAnalyzed: matched.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /personal/reports — get all stored reports
router.get('/personal/reports', async (req, res) => {
  try {
    const { data } = await safeQuery(sb =>
      sb.from('dna_reports').select('*')
        .eq('account_id', req.accountId)
        .order('generated_at', { ascending: false })
    );
    res.json({ reports: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /personal/health-crossref — cross-reference DNA with Health Dashboard
router.get('/personal/health-crossref', async (req, res) => {
  try {
    // Check for DNA data
    const { data: dnaData } = await safeQuery(sb =>
      sb.from('dna_personal').select('snp_id, genotype')
        .eq('account_id', req.accountId)
        .limit(1)
    );
    if (!dnaData?.length) {
      return res.json({ available: false, insights: [] });
    }

    // Get relevant DNA findings
    const { data: personalSnps } = await safeQuery(sb =>
      sb.from('dna_personal').select('snp_id, genotype').eq('account_id', req.accountId)
    );
    const personalMap = {};
    for (const p of (personalSnps || [])) personalMap[p.snp_id] = p.genotype;

    // Get health-relevant atlas entries
    const { data: healthAtlas } = await safeQuery(sb =>
      sb.from('dna_atlas').select('snp_id, gene, trait_name, genotypes_json, category')
        .in('category', ['health', 'nutrition', 'athletic'])
    );

    const healthFindings = (healthAtlas || [])
      .filter(a => personalMap[a.snp_id])
      .map(a => {
        const genotype = personalMap[a.snp_id];
        const info = a.genotypes_json?.[genotype] || {};
        return { trait: a.trait_name, gene: a.gene, risk: info.risk, meaning: info.meaning, category: a.category };
      })
      .filter(f => f.risk === 'slightly_elevated' || f.risk === 'elevated');

    // Get recent health metrics
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: metrics } = await safeQuery(sb =>
      sb.from('health_metrics').select('metric_type, value, date')
        .eq('account_id', req.accountId)
        .gte('date', since)
        .order('date', { ascending: false })
        .limit(100)
    );

    res.json({
      available: true,
      dnaFindings: healthFindings.slice(0, 10),
      healthMetrics: [...new Set((metrics || []).map(m => m.metric_type))],
      metricsData: metrics || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /personal — delete all personal DNA data
router.delete('/personal', async (req, res) => {
  try {
    await safeQuery(sb => sb.from('dna_personal').delete().eq('account_id', req.accountId));
    await safeQuery(sb => sb.from('dna_reports').delete().eq('account_id', req.accountId));
    await safeQuery(sb => sb.from('dna_imports').delete().eq('account_id', req.accountId));
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
