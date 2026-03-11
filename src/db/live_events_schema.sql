CREATE TABLE IF NOT EXISTS live_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  event_type TEXT DEFAULT 'concert' CHECK (event_type IN ('concert','sports','theater','comedy','convention','festival','other')),
  venue TEXT DEFAULT '',
  city TEXT DEFAULT '',
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  event_date DATE NOT NULL,
  companions TEXT DEFAULT '',
  cost NUMERIC(10,2),
  rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  notes TEXT DEFAULT '',
  photos_json JSONB DEFAULT '[]',
  source_cascade_type TEXT DEFAULT '',
  cascade_person TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_events_account ON live_events(account_id);
CREATE INDEX IF NOT EXISTS idx_live_events_date ON live_events(account_id, event_date);
CREATE INDEX IF NOT EXISTS idx_live_events_type ON live_events(account_id, event_type);
