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
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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
 * POST /api/game/shuffle
 * Admin shuffles teams — re-randomizes all existing players into new teams with unique IDs.
 * Can be called any number of times.
 */
export async function POST() {
    try {
        // 1. Check game state
        const { data: gameState } = await supabase
            .from("game_state")
            .select("*")
            .single();

        if (!gameState || gameState.status !== "live") {
            return NextResponse.json(
                { error: "Game must be live to shuffle teams" },
                { status: 400 }
            );
        }

        // 2. Fetch current teams and collect all members
        const { data: currentTeams, error: fetchError } = await supabase
            .from("teams")
            .select("*");

        if (fetchError) throw fetchError;

        // Collect all members from teams or lobby
        const allMembers: { name: string; email: string; userId: string }[] = [];

        if (!currentTeams || currentTeams.length === 0) {
            // No teams yet — pull from lobby
            const { data: lobbyUsers, error: lobbyError } = await supabase
                .from("lobby")
                .select("*")
                .order("joined_at", { ascending: true });

            if (lobbyError) throw lobbyError;
            const players = lobbyUsers as LobbyUser[];

            if (players.length < 1) {
                return NextResponse.json(
                    { error: "No players available to form teams" },
                    { status: 400 }
                );
            }

            for (const p of players) {
                allMembers.push({
                    name: p.name,
                    email: p.email,
                    userId: p.user_id,
                });
            }
        } else {
            for (const team of currentTeams) {
                for (const member of team.members) {
                    allMembers.push({
                        name: member.name,
                        email: member.email,
                        userId: member.userId,
                    });
                }
            }
        }

        // 3. Shuffle all members (Fisher-Yates)
        const shuffled = [...allMembers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // 4. Generate unique team IDs
        const teamCount = Math.ceil(shuffled.length / TEAM_SIZE);
        const teamIds = generateUniqueTeamIds(teamCount);

        // 5. Create new teams
        const newTeams = [];
        let teamIndex = 0;

        for (let i = 0; i < shuffled.length; i += TEAM_SIZE) {
            const members = shuffled.slice(i, i + TEAM_SIZE).map((p) => ({
                ...p,
                eliminated: false,
            }));

            newTeams.push({
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

        // 6. Delete old teams and insert new ones
        await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        const { error: insertError } = await supabase.from("teams").insert(newTeams);
        if (insertError) throw insertError;

        return NextResponse.json({
            success: true,
            teamsCreated: newTeams.length,
            totalPlayers: allMembers.length,
            teams: newTeams,
        });
    } catch (err) {
        console.error("Shuffle error:", err);
        return NextResponse.json(
            { error: "Failed to shuffle teams" },
            { status: 500 }
        );
    }
}
