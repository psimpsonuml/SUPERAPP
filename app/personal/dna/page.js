'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchDnaAtlas, fetchDnaPersonal, importDnaData, fetchDnaAnalysis,
  generateDnaReport, fetchDnaReports, seedDnaAtlas, deleteDnaData,
  fetchDnaHealthCrossref,
} from '../../../lib/api';

const DISCLAIMER = 'This analysis is for informational and educational purposes only. It is not medical advice. Genetic predisposition does not guarantee any outcome. Always consult a qualified healthcare provider before making health decisions based on genetic information.';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'health', label: 'Health' },
  { id: 'traits', label: 'Traits' },
  { id: 'pharmacogenomics', label: 'Pharma' },
  { id: 'ancestry', label: 'Ancestry' },
  { id: 'athletic', label: 'Athletic' },
  { id: 'nutrition', label: 'Nutrition' },
];

const RISK_COLORS = {
  typical: { bg: '#dcfce7', color: '#16a34a', label: 'Typical' },
  slightly_elevated: { bg: '#fef3c7', color: '#d97706', label: 'Slightly Elevated' },
  elevated: { bg: '#fee2e2', color: '#dc2626', label: 'Elevated' },
  unknown: { bg: '#f3f4f6', color: '#6b7280', label: 'Unknown' },
};

const REPORT_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'health', label: 'Health' },
  { id: 'traits', label: 'Traits' },
  { id: 'pharmacogenomics', label: 'Pharma' },
  { id: 'ancestry', label: 'Ancestry' },
  { id: 'athletic', label: 'Athletic' },
  { id: 'nutrition', label: 'Nutrition' },
];

// ── DNA File Parsers (client-side) ─────────────────────────────

function detectService(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headerLine = lines.find(l => !l.startsWith('#') && !l.startsWith('##')) || '';
  const header = headerLine.toLowerCase();
  if (lines[0]?.startsWith('##fileformat=VCF')) return 'vcf';
  if (header.includes('allele1') && header.includes('allele2')) return 'ancestrydna';
  if (header.includes('rsid') && header.includes('result') && header.includes(',')) return 'myheritage';
  if (header.includes('rsid') && header.includes('genotype')) return '23andme';
  if (headerLine.includes('\t') && lines.some(l => l.match(/^rs\d+/))) return '23andme';
  if (headerLine.includes(',') && lines.some(l => l.match(/rs\d+/))) return 'myheritage';
  return null;
}

function parseDnaFile(text, serviceId) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const snps = [];
  const delimiter = ['myheritage', 'familytreedna', 'livingdna', 'tellmegen'].includes(serviceId) ? ',' : '\t';

  if (serviceId === 'vcf') {
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const cols = line.split('\t');
      if (cols.length < 5) continue;
      const [chrom, pos, id, ref, alt] = cols;
      if (!id.startsWith('rs')) continue;
      let genotype = ref + (alt === '.' ? ref : alt);
      if (cols.length > 9) {
        const gt = cols[9]?.split(':')[0] || '';
        if (gt === '0/0' || gt === '0|0') genotype = ref + ref;
        else if (gt === '0/1' || gt === '0|1' || gt === '1/0') genotype = ref + alt;
        else if (gt === '1/1' || gt === '1|1') genotype = alt + alt;
      }
      snps.push({ snp_id: id, chromosome: chrom.replace('chr', ''), position: pos, genotype });
    }
    return snps;
  }

  const dataLines = lines.slice(1);
  const headerCols = lines[0].split(delimiter).map(c => c.trim().toLowerCase().replace(/"/g, ''));
  const rsIdx = headerCols.findIndex(c => c === 'rsid' || c === 'snp' || c === 'snp_id');
  const chrIdx = headerCols.findIndex(c => c === 'chromosome' || c === 'chr');
  const posIdx = headerCols.findIndex(c => c === 'position' || c === 'pos');
  const genoIdx = headerCols.findIndex(c => c === 'genotype' || c === 'result');
  const a1Idx = headerCols.findIndex(c => c === 'allele1');
  const a2Idx = headerCols.findIndex(c => c === 'allele2');

  for (const line of dataLines) {
    const cols = line.split(delimiter).map(c => c.trim().replace(/"/g, ''));
    const snpId = cols[rsIdx >= 0 ? rsIdx : 0];
    if (!snpId || !snpId.startsWith('rs')) continue;
    let genotype;
    if (a1Idx >= 0 && a2Idx >= 0) genotype = (cols[a1Idx] || '') + (cols[a2Idx] || '');
    else if (genoIdx >= 0) genotype = cols[genoIdx] || '';
    else genotype = cols[3] || '';
    genotype = genotype.replace(/[^ACGTID0-]/gi, '');
    if (!genotype || genotype === '--' || genotype === '00') continue;
    snps.push({ snp_id: snpId, chromosome: cols[chrIdx >= 0 ? chrIdx : 1] || '', position: cols[posIdx >= 0 ? posIdx : 2] || '', genotype: genotype.toUpperCase() });
  }
  return snps;
}

// ── Atlas Entry Card ───────────────────────────────────────────

function AtlasCard({ entry, personalGenotype }) {
  const [expanded, setExpanded] = useState(false);
  const genotypes = entry.genotypes_json || {};
  const match = personalGenotype ? (genotypes[personalGenotype] || genotypes[personalGenotype?.split('').reverse().join('')]) : null;
  const riskCfg = RISK_COLORS[match?.risk || 'unknown'];

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <code style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{entry.snp_id}</code>
            {entry.gene && <span className="text-xs text-muted">{entry.gene}</span>}
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--bg)', color: 'var(--text-muted)' }}>{entry.category}</span>
            {entry.magnitude >= 3 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: entry.magnitude >= 4 ? '#fee2e2' : '#fef3c7', color: entry.magnitude >= 4 ? '#dc2626' : '#d97706' }}>Mag {entry.magnitude}</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{entry.trait_name}</div>
        </div>
        {personalGenotype && match && (
          <div style={{ textAlign: 'right', marginLeft: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{personalGenotype}</div>
            <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 8, background: riskCfg.bg, color: riskCfg.color, fontWeight: 600 }}>{riskCfg.label}</span>
          </div>
        )}
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <p className="text-sm" style={{ margin: '0 0 12px', lineHeight: 1.6 }}>{entry.description}</p>
          {personalGenotype && match && (
            <div style={{ padding: 10, background: riskCfg.bg, borderRadius: 8, marginBottom: 12, fontSize: 13, color: riskCfg.color }}>
              <strong>Your genotype ({personalGenotype}):</strong> {match.meaning}
            </div>
          )}
          <div className="text-xs font-semibold text-muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>All Genotypes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {Object.entries(genotypes).map(([geno, info]) => {
              const rc = RISK_COLORS[info.risk || 'unknown'];
              const isYours = personalGenotype === geno;
              return (
                <div key={geno} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 8px', background: isYours ? rc.bg : 'transparent', borderRadius: 4, border: isYours ? `1px solid ${rc.color}` : 'none' }}>
                  <code style={{ fontWeight: 700, minWidth: 30 }}>{geno}</code>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: rc.bg, color: rc.color }}>{rc.label}</span>
                  <span className="text-muted">{info.meaning}</span>
                </div>
              );
            })}
          </div>
          {entry.sources_json?.length > 0 && (
            <div className="text-xs text-muted">Sources: {entry.sources_json.map((s, i) => <span key={i}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}{i < entry.sources_json.length - 1 ? ', ' : ''}</span>)}</div>
          )}
          {entry.chromosome && <div className="text-xs text-muted" style={{ marginTop: 4 }}>Location: Chr{entry.chromosome}{entry.position ? `:${entry.position}` : ''}</div>}
        </div>
      )}
    </div>
  );
}

// ── Report Viewer ──────────────────────────────────────────────

function ReportView({ report }) {
  if (!report) return null;
  const content = report.content_json || {};
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{content.title || report.report_type}</h3>
      {content.summary && <p className="text-sm" style={{ margin: '0 0 16px', lineHeight: 1.6, color: 'var(--text-muted)' }}>{content.summary}</p>}
      {content.findings?.map((finding, i) => {
        const rc = RISK_COLORS[finding.risk_level || 'typical'];
        return (
          <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 8, borderLeft: `4px solid ${rc.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{finding.title || finding.category}</span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: rc.bg, color: rc.color, fontWeight: 600 }}>{rc.label}</span>
            </div>
            <p className="text-sm" style={{ margin: '0 0 6px', lineHeight: 1.5 }}>{finding.detail}</p>
            {finding.actionable && <p className="text-sm" style={{ margin: 0, color: '#16a34a', fontStyle: 'italic' }}>{finding.actionable}</p>}
          </div>
        );
      })}
      {content.key_takeaways?.length > 0 && (
        <div style={{ marginTop: 16, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
          <div className="text-xs font-semibold" style={{ marginBottom: 8 }}>Key Takeaways</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>{content.key_takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      <div style={{ marginTop: 16, padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: 11, lineHeight: 1.5, color: '#92400e' }}>{content.disclaimer || DISCLAIMER}</div>
      <div className="text-xs text-muted" style={{ marginTop: 8 }}>Generated {report.generated_at ? new Date(report.generated_at).toLocaleString() : ''}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────

export default function DnaPage() {
  const [mainTab, setMainTab] = useState('atlas');
  const [loading, setLoading] = useState(true);
  const [atlasEntries, setAtlasEntries] = useState([]);
  const [atlasTotal, setAtlasTotal] = useState(0);
  const [atlasCategory, setAtlasCategory] = useState('all');
  const [atlasSearch, setAtlasSearch] = useState('');
  const [atlasPage, setAtlasPage] = useState(1);
  const [atlasCats, setAtlasCats] = useState({});
  const [seeding, setSeeding] = useState(false);
  const [personal, setPersonal] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisCategory, setAnalysisCategory] = useState('all');
  const [reports, setReports] = useState([]);
  const [reportTab, setReportTab] = useState('overview');
  const [generating, setGenerating] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [detectedService, setDetectedService] = useState(null);
  const [parsedSnps, setParsedSnps] = useState(null);
  const [healthCrossref, setHealthCrossref] = useState(null);
  const [showDelete, setShowDelete] = useState(false);

  const loadAtlas = useCallback(async () => {
    try {
      const cat = atlasCategory === 'all' ? undefined : atlasCategory;
      const r = await fetchDnaAtlas({ category: cat, search: atlasSearch || undefined, page: atlasPage });
      setAtlasEntries(r.entries || []); setAtlasTotal(r.total || 0);
      if (r.categories) setAtlasCats(r.categories);
    } catch { /* noop */ }
  }, [atlasCategory, atlasSearch, atlasPage]);

  const loadPersonal = useCallback(async () => {
    try {
      const [p, r, hc] = await Promise.allSettled([fetchDnaPersonal(), fetchDnaReports(), fetchDnaHealthCrossref()]);
      if (p.status === 'fulfilled') setPersonal(p.value);
      if (r.status === 'fulfilled') setReports(r.value?.reports || []);
      if (hc.status === 'fulfilled') setHealthCrossref(hc.value);
    } catch { /* noop */ }
  }, []);

  const loadAnalysis = useCallback(async () => {
    try {
      const cat = analysisCategory === 'all' ? undefined : analysisCategory;
      const r = await fetchDnaAnalysis(cat);
      setAnalysis(r);
    } catch { /* noop */ }
  }, [analysisCategory]);

  useEffect(() => { setLoading(true); Promise.all([loadAtlas(), loadPersonal()]).finally(() => setLoading(false)); }, [loadAtlas, loadPersonal]);
  useEffect(() => { if (personal?.hasData) loadAnalysis(); }, [personal?.hasData, loadAnalysis]);

  const handleSeedAtlas = async () => { setSeeding(true); try { await seedDnaAtlas(); await loadAtlas(); } catch {} setSeeding(false); };

  const handleFileSelect = async (file) => {
    setUploadResult(null); setDetectedService(null); setParsedSnps(null);
    try {
      let text;
      if (file.name.endsWith('.zip')) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(file);
        const dataFile = Object.keys(zip.files).find(f => f.endsWith('.txt') || f.endsWith('.csv') || f.endsWith('.vcf'));
        if (!dataFile) { setUploadResult({ error: 'No .txt, .csv, or .vcf file found in ZIP' }); return; }
        text = await zip.files[dataFile].async('text');
      } else { text = await file.text(); }
      const service = detectService(text);
      if (!service) { setUploadResult({ error: 'Could not auto-detect file format. Supported: 23andMe, AncestryDNA, MyHeritage, FamilyTreeDNA, VCF files.' }); return; }
      const snps = parseDnaFile(text, service);
      setDetectedService(service); setParsedSnps(snps);
    } catch (e) { setUploadResult({ error: e.message }); }
  };

  const handleConfirmUpload = async () => {
    if (!parsedSnps || !detectedService) return;
    setUploading(true);
    try {
      const result = await importDnaData({ sourceService: detectedService, fileName: 'upload', snps: parsedSnps });
      setUploadResult({ success: true, ...result }); setParsedSnps(null); setDetectedService(null);
      await loadPersonal(); await loadAnalysis();
    } catch (e) { setUploadResult({ error: e.message }); }
    setUploading(false);
  };

  const handleGenerateReport = async (type) => {
    setGenerating(type);
    try {
      const r = await generateDnaReport(type);
      if (r.report) setReports(prev => [{ report_type: type, content_json: r.report, generated_at: new Date().toISOString() }, ...prev.filter(p => p.report_type !== type)]);
      if (r.message) setUploadResult({ info: r.message });
    } catch {} setGenerating(null);
  };

  const handleDelete = async () => { try { await deleteDnaData(); setPersonal(null); setAnalysis(null); setReports([]); setShowDelete(false); await loadPersonal(); } catch {} };

  if (loading) return <div className="loading"><div className="spinner" />Loading DNA Analyst...</div>;

  const MAIN_TABS = [{ id: 'atlas', label: 'Public Atlas' }, { id: 'upload', label: 'Upload DNA' }, { id: 'analysis', label: 'My Analysis' }, { id: 'reports', label: 'Reports' }];
  const personalMap = {};
  if (analysis?.findings) for (const f of analysis.findings) personalMap[f.snp_id] = f.genotype;

  return (
    <>
      <div className="page-header"><h1>DNA Analyst</h1><p>Personal genetics analysis with public knowledge atlas</p></div>
      <div style={{ padding: '8px 14px', background: '#fef3c7', borderRadius: 8, fontSize: 11, lineHeight: 1.4, color: '#92400e', marginBottom: 16 }}>{DISCLAIMER}</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {MAIN_TABS.map(t => (
          <button key={t.id} className={`btn btn-sm ${mainTab === t.id ? 'btn-primary' : ''}`} onClick={() => setMainTab(t.id)}>
            {t.label}{t.id === 'analysis' && personal?.hasData && <span style={{ marginLeft: 4, fontSize: 10 }}>({personal.matchedAtlas})</span>}
          </button>
        ))}
      </div>

      {/* ═══ PUBLIC ATLAS ═══ */}
      {mainTab === 'atlas' && (<>
        {atlasTotal === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <p className="text-sm text-muted" style={{ marginBottom: 12 }}>Atlas database is empty. Seed it with 244 curated SNPs from SNPedia, ClinVar, and GWAS Catalog.</p>
            <button className="btn btn-primary" onClick={handleSeedAtlas} disabled={seeding}>{seeding ? 'Seeding...' : 'Seed Atlas Database'}</button>
          </div>
        )}
        {atlasTotal > 0 && (<>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" className="input" placeholder="Search SNP, gene, trait..." value={atlasSearch} onChange={e => { setAtlasSearch(e.target.value); setAtlasPage(1); }} style={{ flex: 1, minWidth: 200 }} />
            {CATEGORIES.map(c => (
              <button key={c.id} className={`btn btn-sm ${atlasCategory === c.id ? 'btn-primary' : ''}`} onClick={() => { setAtlasCategory(c.id); setAtlasPage(1); }}>
                {c.label}{c.id !== 'all' && atlasCats[c.id] ? ` (${atlasCats[c.id]})` : ''}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted" style={{ marginBottom: 8 }}>Showing {atlasEntries.length} of {atlasTotal} entries</div>
          {atlasEntries.map(entry => <AtlasCard key={entry.snp_id || entry.id} entry={entry} personalGenotype={personalMap[entry.snp_id]} />)}
          {atlasTotal > 50 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn btn-sm" disabled={atlasPage <= 1} onClick={() => setAtlasPage(p => p - 1)}>Previous</button>
              <span className="text-sm" style={{ lineHeight: '32px' }}>Page {atlasPage} of {Math.ceil(atlasTotal / 50)}</span>
              <button className="btn btn-sm" disabled={atlasPage >= Math.ceil(atlasTotal / 50)} onClick={() => setAtlasPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>)}
      </>)}

      {/* ═══ UPLOAD DNA ═══ */}
      {mainTab === 'upload' && (<>
        <div style={{ padding: 14, background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Privacy Notice</div>
          <p className="text-sm text-muted" style={{ margin: 0, lineHeight: 1.6 }}>Your DNA data is stored encrypted, never shared with anyone, never used for any purpose other than generating your personal reports, and is permanently deletable at any time.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
          {(personal?.supportedServices || []).map(svc => (
            <div key={svc.id} style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--border)', padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{svc.name}</div>
              <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Format: {svc.format.toUpperCase()} {svc.wgs && <span style={{ color: '#8b5cf6' }}>WGS</span>} &bull; ~{(svc.snpCount / 1000).toFixed(0)}K SNPs</div>
              <div className="text-xs text-muted" style={{ marginBottom: 10 }}>{svc.instructions}</div>
              <label className="btn btn-sm btn-primary" style={{ cursor: 'pointer', display: 'inline-block' }}>Upload File
                <input type="file" accept=".txt,.csv,.zip,.vcf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
              </label>
            </div>
          ))}
        </div>
        {detectedService && parsedSnps && (
          <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 10, border: '2px solid #22c55e', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#16a34a', marginBottom: 8 }}>Detected: {personal?.supportedServices?.find(s => s.id === detectedService)?.name || detectedService}</div>
            <p className="text-sm" style={{ margin: '0 0 12px' }}>Found <strong>{parsedSnps.length.toLocaleString()}</strong> SNPs. Confirm to import.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-primary" onClick={handleConfirmUpload} disabled={uploading}>{uploading ? 'Importing...' : 'Confirm & Import'}</button>
              <button className="btn btn-sm" onClick={() => { setParsedSnps(null); setDetectedService(null); }}>Cancel</button>
            </div>
          </div>
        )}
        {uploadResult?.success && (
          <div style={{ padding: 14, background: '#dcfce7', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>Import Successful</div>
            <p className="text-sm" style={{ margin: '4px 0 0' }}>Imported {uploadResult.imported?.toLocaleString()} SNPs &bull; {uploadResult.matched} matched atlas entries{uploadResult.coverage && ` &bull; ${uploadResult.coverage}`}</p>
            {uploadResult.recommendation && <p className="text-xs text-muted" style={{ margin: '6px 0 0' }}>{uploadResult.recommendation}</p>}
          </div>
        )}
        {uploadResult?.error && <div style={{ padding: 14, background: '#fee2e2', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#dc2626' }}>Error: {uploadResult.error}</div>}
        {personal?.imports?.length > 0 && (
          <div className="card card-compact">
            <div className="card-header"><h2>Import History</h2></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Service</th><th>File</th><th>SNPs</th><th>Matches</th><th>Date</th></tr></thead>
              <tbody>{personal.imports.map((imp, i) => (
                <tr key={imp.id || i}><td className="text-sm font-semibold">{imp.source_service}</td><td className="text-sm text-muted">{imp.file_name}</td><td className="text-sm">{imp.snps_imported?.toLocaleString()}</td><td className="text-sm">{imp.snps_matched}</td><td className="text-sm text-muted">{imp.imported_at ? new Date(imp.imported_at).toLocaleDateString() : ''}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
        )}
        {personal?.hasData && (
          <div style={{ marginTop: 24 }}>
            {!showDelete ? (
              <button className="btn btn-sm" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={() => setShowDelete(true)}>Delete My DNA Data</button>
            ) : (
              <div style={{ padding: 16, border: '2px solid #ef4444', borderRadius: 8, background: '#fef2f2' }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#dc2626' }}>This will permanently delete all your DNA data, reports, and analysis.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none' }} onClick={handleDelete}>Yes, Delete Everything</button>
                  <button className="btn btn-sm" onClick={() => setShowDelete(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </>)}

      {/* ═══ MY ANALYSIS ═══ */}
      {mainTab === 'analysis' && (<>
        {!personal?.hasData ? (
          <div className="card"><div className="empty-state"><p>No DNA data uploaded yet.</p><p className="text-muted text-sm" style={{ marginTop: 8 }}>Go to Upload DNA tab to import your genetic data.</p></div></div>
        ) : (<>
          <div className="stats-row" style={{ marginBottom: 16 }}>
            <div className="stat-card"><div className="stat-value">{personal.totalSnps?.toLocaleString()}</div><div className="stat-label">Total SNPs</div></div>
            <div className="stat-card"><div className="stat-value">{personal.matchedAtlas}</div><div className="stat-label">Atlas Matches</div></div>
            <div className="stat-card"><div className="stat-value">{personal.services?.length || 0}</div><div className="stat-label">Data Sources</div></div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c.id} className={`btn btn-sm ${analysisCategory === c.id ? 'btn-primary' : ''}`} onClick={() => setAnalysisCategory(c.id)}>
                {c.label}{c.id !== 'all' && analysis?.byCategory?.[c.id] ? ` (${analysis.byCategory[c.id]})` : ''}
              </button>
            ))}
          </div>
          {analysis?.findings?.length > 0 ? analysis.findings.map(f => <AtlasCard key={f.snp_id} entry={f} personalGenotype={f.genotype} />) : (
            <div className="text-sm text-muted" style={{ textAlign: 'center', padding: 24 }}>No matching findings. Try seeding the atlas first.</div>
          )}
          {healthCrossref?.available && healthCrossref.dnaFindings?.length > 0 && (
            <div style={{ marginTop: 24, background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', borderLeft: '4px solid #ec4899' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Health Dashboard Cross-Reference</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {healthCrossref.dnaFindings.map((f, i) => {
                  const rc = RISK_COLORS[f.risk || 'unknown'];
                  return <div key={i} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}><span style={{ fontWeight: 600 }}>{f.trait}</span><span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 6, background: rc.bg, color: rc.color }}>{rc.label}</span><span className="text-muted" style={{ marginLeft: 6 }}>{f.meaning}</span></div>;
                })}
              </div>
            </div>
          )}
        </>)}
      </>)}

      {/* ═══ REPORTS ═══ */}
      {mainTab === 'reports' && (<>
        {!personal?.hasData ? (
          <div className="card"><div className="empty-state"><p>Upload DNA data first to generate reports.</p></div></div>
        ) : (<>
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            {REPORT_TABS.map(t => (
              <button key={t.id} className={`btn btn-sm ${reportTab === t.id ? 'btn-primary' : ''}`} onClick={() => setReportTab(t.id)}>
                {t.label}{reports.find(r => r.report_type === t.id) && <span style={{ marginLeft: 4, color: '#22c55e' }}>&#10003;</span>}
              </button>
            ))}
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setReportTab('wellness')}>Wellness Summary</button>
          </div>
          {reportTab === 'overview' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 24 }}>
              {['health', 'traits', 'pharmacogenomics', 'ancestry', 'athletic', 'nutrition', 'wellness'].map(type => {
                const existing = reports.find(r => r.report_type === type);
                return (
                  <div key={type} style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{type}</span>
                      {existing && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Generated</span>}
                    </div>
                    <div className="text-xs text-muted" style={{ marginBottom: 8 }}>{analysis?.byCategory?.[type] || 0} matching variants</div>
                    <button className="btn btn-sm btn-primary" onClick={() => { setReportTab(type); handleGenerateReport(type); }} disabled={generating === type}>
                      {generating === type ? 'Generating...' : existing ? 'Regenerate' : 'Generate Report'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: 'var(--card-bg)', borderRadius: 10, padding: 20, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="btn btn-sm" onClick={() => handleGenerateReport(reportTab)} disabled={generating === reportTab}>
                  {generating === reportTab ? 'Generating...' : reports.find(r => r.report_type === reportTab) ? 'Regenerate' : 'Generate'}
                </button>
              </div>
              {reports.find(r => r.report_type === reportTab) ? <ReportView report={reports.find(r => r.report_type === reportTab)} /> : (
                <div className="empty-state"><p>No {reportTab} report generated yet.</p><p className="text-muted text-sm" style={{ marginTop: 8 }}>Click Generate to create your personalized {reportTab} report.</p></div>
              )}
            </div>
          )}
        </>)}
      </>)}
    </>
  );
}
