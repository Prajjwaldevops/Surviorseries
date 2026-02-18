/** A member within a team */
export interface TeamMember {
    name: string;
    email: string;
    userId: string;
    eliminated: boolean;
}

/** Team record from Supabase */
export interface Team {
    id: string;
    team_id: string;
    name: string;
    members: TeamMember[];
    points: number;
    rank: number;
    approved: boolean;
    image_url: string | null;
    image_data: TeamImageData | null;
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
}

/** Game state record from Supabase */
export interface GameState {
    id: string;
    status: 'waiting' | 'live' | 'finished';
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

/** Test user credentials */
export const TEST_USER = {
    email: 'test@gmail.com',
    password: 'test',
    userId: 'test-user-bypass',
    name: 'Test Player',
} as const;
