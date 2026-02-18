import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { TEAM_SIZE } from "@/lib/constants";
import type { LobbyUser } from "@/lib/types";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Generate a random unique team ID like "SRV-A3X7" */
function generateTeamId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
    let code = "";
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return `SRV-${code}`;
}

/** Generate multiple unique team IDs */
function generateUniqueTeamIds(count: number): string[] {
    const ids = new Set<string>();
    while (ids.size < count) {
        ids.add(generateTeamId());
    }
    return Array.from(ids);
}

/**
 * POST /api/game/approve
 * Admin approves game → fetch lobby users, generate teams with unique IDs, set game to "live".
 */
export async function POST() {
    try {
        // 1. Check current game state
        const { data: gameState } = await supabase
            .from("game_state")
            .select("*")
            .single();

        if (gameState?.status === "live") {
            return NextResponse.json(
                { error: "Game is already live" },
                { status: 400 }
            );
        }

        // 2. Fetch all lobby users
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

        // 3. Shuffle players (Fisher-Yates)
        const shuffled = [...players];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // 4. Calculate team count and generate unique IDs
        const teamCount = Math.ceil(shuffled.length / TEAM_SIZE);
        const teamIds = generateUniqueTeamIds(teamCount);

        // 5. Generate teams with unique IDs
        const teams = [];
        let teamIndex = 0;

        for (let i = 0; i < shuffled.length; i += TEAM_SIZE) {
            const members = shuffled.slice(i, i + TEAM_SIZE).map((p) => ({
                name: p.name,
                email: p.email,
                userId: p.user_id,
                eliminated: false,
            }));

            teams.push({
                team_id: teamIds[teamIndex],
                name: `Team ${teamIndex + 1}`,
                members,
                points: 0,
                rank: teamIndex + 1,
                approved: false,
                image_url: null,
                image_data: null,
            });

            teamIndex++;
        }

        // 6. Clear existing teams and insert new ones
        await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        const { error: insertError } = await supabase.from("teams").insert(teams);
        if (insertError) throw insertError;

        // 7. Update game state to "live"
        const { error: updateError } = await supabase
            .from("game_state")
            .update({ status: "live", updated_at: new Date().toISOString() })
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
            { error: "Failed to approve game" },
            { status: 500 }
        );
    }
}
