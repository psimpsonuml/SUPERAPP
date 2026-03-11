CREATE TABLE IF NOT EXISTS sports_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  team_name TEXT NOT NULL,
  league TEXT NOT NULL,
  team_id TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, team_name, league)
);

CREATE TABLE IF NOT EXISTS sports_game_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  game_id TEXT DEFAULT '',
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  game_date DATE NOT NULL,
  score INTEGER CHECK (score >= 1 AND score <= 10),
  game_type TEXT DEFAULT 'regular' CHECK (game_type IN ('regular','playoff','championship','rivalry')),
  players_tagged_json JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  rated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sports_cascade_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  team TEXT DEFAULT '',
  league TEXT DEFAULT '',
  position TEXT DEFAULT '',
  composite_score NUMERIC(5,2) DEFAULT 0,
  games_rated INTEGER DEFAULT 0,
  avg_score NUMERIC(3,1) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, player_name, team)
);

CREATE INDEX IF NOT EXISTS idx_sports_teams_account ON sports_teams(account_id);
CREATE INDEX IF NOT EXISTS idx_sports_ratings_account ON sports_game_ratings(account_id);
CREATE INDEX IF NOT EXISTS idx_sports_cascade_account ON sports_cascade_scores(account_id);
