-- DNA Analyst: Public atlas, personal genotypes, and generated reports

-- Phase 1: Public genetics atlas (shared data, not per-account)
CREATE TABLE IF NOT EXISTS dna_atlas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snp_id TEXT NOT NULL UNIQUE,
  gene TEXT,
  chromosome TEXT,
  position INTEGER,
  category TEXT NOT NULL,
  trait_name TEXT NOT NULL,
  description TEXT NOT NULL,
  genotypes_json JSONB NOT NULL DEFAULT '{}',
  sources_json JSONB DEFAULT '[]',
  confidence TEXT DEFAULT 'moderate',
  magnitude INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dna_atlas_category ON dna_atlas(category);
CREATE INDEX IF NOT EXISTS idx_dna_atlas_snp ON dna_atlas(snp_id);
CREATE INDEX IF NOT EXISTS idx_dna_atlas_gene ON dna_atlas(gene);

-- Phase 2: Personal DNA data
CREATE TABLE IF NOT EXISTS dna_personal (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  snp_id TEXT NOT NULL,
  chromosome TEXT,
  position INTEGER,
  genotype TEXT NOT NULL,
  source_service TEXT NOT NULL,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, snp_id, source_service)
);

CREATE INDEX IF NOT EXISTS idx_dna_personal_snp ON dna_personal(account_id, snp_id);
CREATE INDEX IF NOT EXISTS idx_dna_personal_source ON dna_personal(account_id, source_service);

-- Reports generated from cross-referencing personal data with atlas
CREATE TABLE IF NOT EXISTS dna_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  report_type TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dna_reports_account ON dna_reports(account_id, report_type);

-- Import tracking
CREATE TABLE IF NOT EXISTS dna_imports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  source_service TEXT NOT NULL,
  file_name TEXT NOT NULL,
  snps_imported INTEGER DEFAULT 0,
  snps_matched INTEGER DEFAULT 0,
  detected_format TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dna_imports_account ON dna_imports(account_id);
