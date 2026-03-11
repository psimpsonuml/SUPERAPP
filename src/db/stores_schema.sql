CREATE TABLE IF NOT EXISTS user_stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  platform TEXT NOT NULL,
  store_name TEXT NOT NULL,
  store_url TEXT DEFAULT '',
  api_credentials_encrypted TEXT DEFAULT '',
  mode TEXT DEFAULT 'seller' CHECK (mode IN ('seller','tracker')),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES user_stores(id) ON DELETE CASCADE,
  order_id TEXT DEFAULT '',
  item_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  platform TEXT NOT NULL,
  order_date DATE NOT NULL,
  buyer_name TEXT DEFAULT '',
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES user_stores(id) ON DELETE CASCADE,
  listing_id TEXT DEFAULT '',
  title TEXT NOT NULL,
  price NUMERIC(10,2),
  status TEXT DEFAULT 'active',
  quantity INTEGER DEFAULT 1,
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracked_stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  platform TEXT NOT NULL,
  store_url TEXT NOT NULL,
  store_name TEXT DEFAULT '',
  last_checked TIMESTAMPTZ,
  notification_prefs_json JSONB DEFAULT '{"new_listings":true,"price_drops":true,"sold":false}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  tracked_store_id UUID REFERENCES tracked_stores(id) ON DELETE CASCADE,
  listing_url TEXT DEFAULT '',
  title TEXT NOT NULL,
  current_price NUMERIC(10,2),
  price_history_json JSONB DEFAULT '[]',
  alert_threshold NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stores_account ON user_stores(account_id);
CREATE INDEX IF NOT EXISTS idx_store_sales_store ON store_sales(store_id);
CREATE INDEX IF NOT EXISTS idx_store_listings_store ON store_listings(store_id);
CREATE INDEX IF NOT EXISTS idx_tracked_stores_account ON tracked_stores(account_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_account ON wishlist_items(account_id);
