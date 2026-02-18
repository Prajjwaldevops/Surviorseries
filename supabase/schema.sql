-- ============================================
-- Survivor Series — Supabase Database Schema
-- v2: + Elimination, Team Approval, Image Upload
-- ============================================

-- 1. Game State (singleton row)
CREATE TABLE IF NOT EXISTS game_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'live', 'finished')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert initial waiting state
INSERT INTO game_state (status) VALUES ('waiting');

-- 2. Teams (updated with approval + image)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- members JSONB format:
  -- [{ "name": "...", "email": "...", "userId": "...", "eliminated": false }]
  points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  approved BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT DEFAULT NULL,
  -- image_data stores: team_id, members info, emails, and cloudflare URL in one cell
  image_data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Lobby (online presence tracking)
CREATE TABLE IF NOT EXISTS lobby (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable Realtime on all tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE lobby;

-- 5. Row Level Security (permissive for MVP)
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on game_state" ON game_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on teams" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on lobby" ON lobby FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- MIGRATION SQL (run this if upgrading from v1)
-- ============================================
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS image_data JSONB DEFAULT NULL;
-- UPDATE teams SET members = (
--   SELECT jsonb_agg(
--     CASE WHEN elem ? 'eliminated' THEN elem
--     ELSE elem || '{"eliminated": false}'::jsonb END
--   ) FROM jsonb_array_elements(members) AS elem
-- );
