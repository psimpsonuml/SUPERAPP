CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  partner_type TEXT DEFAULT 'affiliate' CHECK (partner_type IN ('affiliate','integration_partner','reseller','white_label')),
  products JSONB DEFAULT '[]',
  commission_structure_json JSONB DEFAULT '{}',
  payment_terms TEXT DEFAULT '',
  agreement_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
  tracking_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  partner_id UUID NOT NULL REFERENCES partners(id),
  referred_email TEXT DEFAULT '',
  product TEXT NOT NULL,
  signup_date DATE,
  subscription_value NUMERIC(10,2) DEFAULT 0,
  commission_amount NUMERIC(10,2) DEFAULT 0,
  commission_status TEXT DEFAULT 'owed' CHECK (commission_status IN ('owed','invoiced','paid')),
  stripe_customer_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  partner_id UUID NOT NULL REFERENCES partners(id),
  amount NUMERIC(10,2) NOT NULL,
  period TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_account ON partners(account_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner ON partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_payments_partner ON partner_payments(partner_id);
