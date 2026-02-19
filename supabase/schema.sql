-- ============================================
-- Survivor Series — Supabase Database Schema
-- v4: + Players Registration, Player Scoring, Team Timers
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
  -- round_times stores per-round elapsed seconds: {"r1":120,"r2":95,...}
  round_times JSONB NOT NULL DEFAULT '{}'::jsonb,
  eliminated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration for existing teams table:
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS eliminated BOOLEAN NOT NULL DEFAULT false;

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
  player_user_id TEXT DEFAULT NULL,
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

-- 7. Players (pre-lobby registration)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  branch TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Player Score Log (per-player point tracking)
CREATE TABLE IF NOT EXISTS player_score_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  new_total INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Team Timers (per-team per-round time snapshots)
CREATE TABLE IF NOT EXISTS team_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NULL,
  stopped_at TIMESTAMPTZ DEFAULT NULL,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, round)
);

-- 10. Enable Realtime on all tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE lobby;
ALTER PUBLICATION supabase_realtime ADD TABLE score_log;
ALTER PUBLICATION supabase_realtime ADD TABLE game_timer;
ALTER PUBLICATION supabase_realtime ADD TABLE game_history;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE player_score_log;
ALTER PUBLICATION supabase_realtime ADD TABLE team_timers;

-- 11. Row Level Security (permissive for MVP)
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_timer ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_score_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on game_state" ON game_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on teams" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on lobby" ON lobby FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on score_log" ON score_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on game_timer" ON game_timer FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on game_history" ON game_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on player_score_log" ON player_score_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on team_timers" ON team_timers FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- MIGRATION SQL (run this if upgrading from v3)
-- ============================================
-- -- teams: add round_times column
-- ALTER TABLE teams ADD COLUMN IF NOT EXISTS round_times JSONB NOT NULL DEFAULT '{}'::jsonb;
--
-- -- score_log: add player reference
-- ALTER TABLE score_log ADD COLUMN IF NOT EXISTS player_user_id TEXT DEFAULT NULL;
--
-- -- new tables
-- CREATE TABLE IF NOT EXISTS players (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id TEXT UNIQUE NOT NULL,
--   name TEXT NOT NULL,
--   roll_no TEXT NOT NULL,
--   branch TEXT NOT NULL,
--   gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
--   points INTEGER NOT NULL DEFAULT 0,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
--
-- CREATE TABLE IF NOT EXISTS player_score_log (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id TEXT NOT NULL,
--   team_id TEXT NOT NULL,
--   round INTEGER NOT NULL,
--   delta INTEGER NOT NULL,
--   new_total INTEGER NOT NULL DEFAULT 0,
--   description TEXT NOT NULL DEFAULT '',
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
--
-- CREATE TABLE IF NOT EXISTS team_timers (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   team_id TEXT NOT NULL,
--   round INTEGER NOT NULL,
--   started_at TIMESTAMPTZ DEFAULT NULL,
--   stopped_at TIMESTAMPTZ DEFAULT NULL,
--   elapsed_seconds INTEGER NOT NULL DEFAULT 0,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--   UNIQUE(team_id, round)
-- );
--
-- -- realtime for new tables
-- ALTER PUBLICATION supabase_realtime ADD TABLE players;
-- ALTER PUBLICATION supabase_realtime ADD TABLE player_score_log;
-- ALTER PUBLICATION supabase_realtime ADD TABLE team_timers;
--
-- -- RLS for new tables
-- ALTER TABLE players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE player_score_log ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE team_timers ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all on players" ON players FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all on player_score_log" ON player_score_log FOR ALL USING (true) WITH CHECK (true);
-- 12. Performance Indexes (Phase 10 Optimization)
CREATE INDEX IF NOT EXISTS teams_points_idx ON teams (points DESC);
CREATE INDEX IF NOT EXISTS teams_rank_idx ON teams (rank ASC);
CREATE INDEX IF NOT EXISTS score_log_team_idx ON score_log (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS player_score_log_user_idx ON player_score_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS team_timers_round_idx ON team_timers (team_id, round);
