/** A member within a team */
export interface TeamMember {
    name: string;
    email: string;
    userId: string;
    eliminated: boolean;
}

/** Per-round points tracking */
export interface RoundPoints {
    r1: number;
    r2: number;
    r3: number;
    r4: number;
}

/** Team record from Supabase */
export interface Team {
    id: string;
    team_id: string;
    name: string;
    members: TeamMember[];
    points: number;
    round_points: RoundPoints;
    rank: number;
    approved: boolean;
    image_approved: boolean;
    image_url: string | null;
    image_data: TeamImageData | null;
    round_image_urls: Record<string, string>;
    round_times: Record<string, number>;
    eliminated: boolean;
    created_at: string;
}

/** Image data stored per team (Cloudflare URL + team details) */
export interface TeamImageData {
    cloudflare_url: string;
    team_id: string;
    team_name: string;
    members: Array<{
        name: string;
        email: string;
        userId: string;
    }>;
    uploaded_at: string;
    round?: number;
}

/** Game state record from Supabase */
export interface GameState {
    id: string;
    status: 'waiting' | 'team_formation' | 'image_upload' | 'playing' | 'round_complete' | 'finished';
    current_round: number;
    round_status: 'idle' | 'team_formation' | 'image_upload' | 'playing' | 'round_complete';
    teams_locked: boolean;
    started_at: string | null;
    updated_at: string;
}

/** Lobby user record */
export interface LobbyUser {
    id: string;
    user_id: string;
    name: string;
    email: string;
    joined_at: string;
    last_active: string;
}

/** Score log entry */
export interface ScoreLog {
    id: string;
    team_id: string;
    round: number;
    delta: number;
    new_total: number;
    description: string;
    admin_note: string | null;
    player_user_id: string | null;
    created_at: string;
}

/** Game timer record */
export interface GameTimer {
    id: string;
    started_at: string | null;
    elapsed_seconds: number;
    running: boolean;
}

/** Game history record */
export interface GameHistory {
    id: string;
    game_data: Record<string, unknown>;
    winner_team_id: string | null;
    total_rounds: number;
    created_at: string;
}

/** Player registration record */
export interface Player {
    id: string;
    user_id: string;
    name: string;
    roll_no: string;
    branch: string;
    gender: 'male' | 'female';
    points: number;
    created_at: string;
}

/** Player score log entry */
export interface PlayerScoreLog {
    id: string;
    user_id: string;
    team_id: string;
    round: number;
    delta: number;
    new_total: number;
    description: string;
    created_at: string;
}

/** Team timer record (per-team per-round) */
export interface TeamTimerRecord {
    id: string;
    team_id: string;
    round: number;
    started_at: string | null;
    stopped_at: string | null;
    elapsed_seconds: number;
    created_at: string;
}

/** Test user credentials */
export const TEST_USER = {
    email: 'test@gmail.com',
    password: 'test',
    userId: 'test-user-bypass',
    name: 'Test Player',
} as const;
