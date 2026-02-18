-- ============================================
-- Survivor Series — Supabase Database Schema
-- v3: + Multi-Round, Score Log, Timer, Game History, AdminX
-- ============================================

-- 1. Game State (singleton row)
CREATE TABLE IF NOT EXISTS game_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'team_formation', 'image_upload', 'playing', 'round_complete', 'finished')),
  current_round INTEGER NOT NULL DEFAULT 0,
  round_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (round_status IN ('idle', 'team_formation', 'image_upload', 'playing', 'round_complete')),
  teams_locked BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert initial waiting state
INSERT INTO game_state (status, current_round, round_status, teams_locked) VALUES ('waiting', 0, 'idle', false);

-- 2. Teams (updated with approval + image + round points)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- members JSONB format:
  -- [{ "name": "...", "email": "...", "userId": "...", "eliminated": false }]
  points INTEGER NOT NULL DEFAULT 0,
  round_points JSONB NOT NULL DEFAULT '{"r1":0,"r2":0,"r3":0,"r4":0}'::jsonb,
  rank INTEGER NOT NULL DEFAULT 0,
  approved BOOLEAN NOT NULL DEFAULT false,
  image_approved BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT DEFAULT NULL,
  -- image_data stores: team_id, members info, emails, and cloudflare URL in one cell
  image_data JSONB DEFAULT NULL,
  -- round_image_urls stores image URLs for each round: {"r1":"url","r2":"url",...}
  round_image_urls JSONB NOT NULL DEFAULT '{}'::jsonb,
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

-- 4. Score Log (tracks every point change with description)
CREATE TABLE IF NOT EXISTS score_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  new_total INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  admin_note TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Game Timer (singleton for tiebreaker tracking)
CREATE TABLE IF NOT EXISTS game_timer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NULL,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  running BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO game_timer (elapsed_seconds, running) VALUES (0, false);

-- 6. Game History (archives completed games)
CREATE TABLE IF NOT EXISTS game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  winner_team_id TEXT DEFAULT NULL,
  total_rounds INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Enable Realtime on all tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE lobby;
ALTER PUBLICATION supabase_realtime ADD TABLE score_log;
ALTER PUBLICATION supabase_realtime ADD TABLE game_timer;
ALTER PUBLICATION supabase_realtime ADD TABLE game_history;

-- 8. Row Level Security (permissive for MVP)
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_timer ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on game_state" ON game_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on teams" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on lobby" ON lobby FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on score_log" ON score_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on game_timer" ON game_timer FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on game_history" ON game_history FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- MIGRATION SQL (run this if upgrading from v2)
-- ============================================
-- -- game_state changes
-- ALTER TABLE game_state DROP CONSTRAINT IF EXISTS game_state_status_check;
-- ALTER TABLE game_state ADD CONSTRAINT game_state_status_check CHECK (status IN ('waiting', 'team_formation', 'image_upload', 'playing', 'round_complete', 'finished'));
-- ALTER TABLE game_state ADD COLUMN IF NOT EXISTS current_round INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE game_state ADD COLUMN IF NOT EXISTS round_status TEXT NOT NULL DEFAULT 'idle';
-- ALTER TABLE game_state ADD COLUMN IF NOT EXISTS teams_locked BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE game_state ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL;
--
-- -- teams changes
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS round_points JSONB NOT NULL DEFAULT '{"r1":0,"r2":0,"r3":0,"r4":0}'::jsonb;
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS image_approved BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS round_image_urls JSONB NOT NULL DEFAULT '{}'::jsonb;
--
-- -- new tables
-- CREATE TABLE IF NOT EXISTS score_log ( ... );  -- see above
-- CREATE TABLE IF NOT EXISTS game_timer ( ... );  -- see above
-- CREATE TABLE IF NOT EXISTS game_history ( ... ); -- see above
--
-- -- realtime for new tables
-- ALTER PUBLICATION supabase_realtime ADD TABLE score_log;
-- ALTER PUBLICATION supabase_realtime ADD TABLE game_timer;
-- ALTER PUBLICATION supabase_realtime ADD TABLE game_history;
