CREATE TABLE IF NOT EXISTS pets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  species TEXT DEFAULT 'dog',
  breed TEXT DEFAULT '',
  birthday DATE,
  weight NUMERIC(6,2),
  photo_url TEXT DEFAULT '',
  vet_info_json JSONB DEFAULT '{}',
  microchip TEXT DEFAULT '',
  insurance_json JSONB DEFAULT '{}',
  emergency_vet_phone TEXT DEFAULT '',
  allergies JSONB DEFAULT '[]',
  dietary_restrictions TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_health_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('vaccination','medication','vet_visit','weight','grooming','allergy')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT DEFAULT '',
  cost NUMERIC(10,2),
  next_due DATE,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  entry_text TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT DEFAULT 'memory' CHECK (category IN ('memory','milestone','funny','first','trick')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pets_account ON pets(account_id);
CREATE INDEX IF NOT EXISTS idx_pet_health_pet ON pet_health_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_memories_pet ON pet_memories(pet_id);
