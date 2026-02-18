import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { TEAM_SIZE } from "@/lib/constants";
import type { LobbyUser } from "@/lib/types";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function generateTeamId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return `SRV-${code}`;
}

function generateUniqueTeamIds(count: number): string[] {
    const ids = new Set<string>();
    while (ids.size < count) {
        ids.add(generateTeamId());
    }
    return Array.from(ids);
}

/**
 * POST /api/game/approve
 * Admin starts the game → forms teams from lobby, sets status to 'team_formation'.
 * Max 10 teams. Teams of 4 first, remainder gets 3, 2, or 1.
 */
export async function POST() {
    try {
        const { data: gameState } = await supabase
            .from("game_state")
            .select("*")
            .single();

        if (gameState?.status !== "waiting") {
            return NextResponse.json(
                { error: "Game can only be started from waiting state" },
                { status: 400 }
            );
        }

        const { data: lobbyUsers, error: lobbyError } = await supabase
            .from("lobby")
            .select("*")
            .order("joined_at", { ascending: true });

        if (lobbyError) throw lobbyError;

        const players = lobbyUsers as LobbyUser[];

        if (players.length < 1) {
            return NextResponse.json(
                { error: "Need at least 1 player to start the game" },
                { status: 400 }
            );
        }

        // Shuffle players (Fisher-Yates)
        const shuffled = [...players];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Calculate teams: max 10 teams, fill teams of 4 first
        const maxTeams = 10;
        const teamCount = Math.min(maxTeams, Math.ceil(shuffled.length / TEAM_SIZE));
        const teamIds = generateUniqueTeamIds(teamCount);

        // Distribute players round-robin for balanced teams
        const teamMembers: typeof shuffled[0][][] = Array.from({ length: teamCount }, () => []);
        for (let i = 0; i < shuffled.length; i++) {
            teamMembers[i % teamCount].push(shuffled[i]);
        }

        const teams = teamMembers.map((members, idx) => ({
            team_id: teamIds[idx],
            name: `Team ${idx + 1}`,
            members: members.map((p) => ({
                name: p.name,
                email: p.email,
                userId: p.user_id,
                eliminated: false,
            })),
            points: 0,
            round_points: { r1: 0, r2: 0, r3: 0, r4: 0 },
            rank: idx + 1,
            approved: false,
            image_approved: false,
            image_url: null,
            image_data: null,
            round_image_urls: {},
        }));

        // Clear existing teams and insert new
        await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        const { error: insertError } = await supabase.from("teams").insert(teams);
        if (insertError) throw insertError;

        // Update game state to "team_formation"
        const { error: updateError } = await supabase
            .from("game_state")
            .update({
                status: "team_formation",
                current_round: 1,
                round_status: "team_formation",
                teams_locked: false,
                updated_at: new Date().toISOString(),
            })
            .eq("id", gameState!.id);

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            teamsCreated: teams.length,
            totalPlayers: players.length,
            teams,
        });
    } catch (err) {
        console.error("Game approve error:", err);
        return NextResponse.json(
            { error: "Failed to start game" },
            { status: 500 }
        );
    }
}
