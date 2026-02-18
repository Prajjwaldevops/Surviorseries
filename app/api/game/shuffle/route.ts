import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { TEAM_SIZE } from "@/lib/constants";

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

function generateUniqueTeamIds(count: number, existing: Set<string> = new Set()): string[] {
    const ids = new Set<string>(existing);
    const newIds: string[] = [];
    while (newIds.length < count) {
        const id = generateTeamId();
        if (!ids.has(id)) {
            ids.add(id);
            newIds.push(id);
        }
    }
    return newIds;
}

/**
 * Distribute players into teams:
 * - Max 10 teams, team size 4 preferred
 * - Fill teams of 4 first, then remainder fills teams of 3, 2, or 1
 * - e.g. 5 players → 2 teams (4+1), 9 players → 3 teams (4+4+1), etc.
 */
function distributeIntoTeams(players: { name: string; email: string; userId: string }[]) {
    const maxTeams = 10;
    const teamCount = Math.min(maxTeams, Math.ceil(players.length / TEAM_SIZE));

    // Distribute players round-robin style for balanced teams
    const teamMembers: { name: string; email: string; userId: string }[][] = Array.from(
        { length: teamCount },
        () => []
    );

    for (let i = 0; i < players.length; i++) {
        teamMembers[i % teamCount].push(players[i]);
    }

    return teamMembers;
}

/**
 * Check if two member arrays have the same members (order independent)
 */
function sameMemberSet(
    a: { userId: string }[],
    b: { userId: string }[]
): boolean {
    if (a.length !== b.length) return false;
    const setA = new Set(a.map((m) => m.userId));
    return b.every((m) => setA.has(m.userId));
}

/**
 * POST /api/game/shuffle
 * Admin shuffles teams — re-randomizes all existing players into new teams.
 * - If only 1 team exists → shuffle is not allowed
 * - Keeps same team_id if team composition hasn't changed
 * - Works during team_formation or round_complete phases
 */
export async function POST() {
    try {
        const { data: gameState } = await supabase
            .from("game_state")
            .select("*")
            .single();

        if (!gameState || !["team_formation", "round_complete"].includes(gameState.status)) {
            return NextResponse.json(
                { error: "Shuffle only allowed during team formation or between rounds" },
                { status: 400 }
            );
        }

        // Fetch current teams
        const { data: currentTeams, error: fetchError } = await supabase
            .from("teams")
            .select("*")
            .order("rank", { ascending: true });

        if (fetchError) throw fetchError;

        // Collect all non-eliminated members
        const allMembers: { name: string; email: string; userId: string }[] = [];

        if (!currentTeams || currentTeams.length === 0) {
            // Pull from lobby
            const { data: lobbyUsers, error: lobbyError } = await supabase
                .from("lobby")
                .select("*")
                .order("joined_at", { ascending: true });

            if (lobbyError) throw lobbyError;
            if (!lobbyUsers || lobbyUsers.length < 1) {
                return NextResponse.json({ error: "No players available" }, { status: 400 });
            }

            for (const p of lobbyUsers) {
                allMembers.push({ name: p.name, email: p.email, userId: p.user_id });
            }
        } else {
            // If only 1 team, shuffle is not possible
            if (currentTeams.length <= 1) {
                return NextResponse.json(
                    { error: "Cannot shuffle — only 1 team exists. Need at least 2 teams." },
                    { status: 400 }
                );
            }

            for (const team of currentTeams) {
                for (const member of team.members) {
                    if (!member.eliminated) {
                        allMembers.push({
                            name: member.name,
                            email: member.email,
                            userId: member.userId,
                        });
                    }
                }
            }
        }

        // Shuffle (Fisher-Yates)
        const shuffled = [...allMembers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Distribute into teams
        const teamMembersList = distributeIntoTeams(shuffled);

        // Build old team lookup: map sorted userId list → team object
        const oldTeamByMembers = new Map<string, typeof currentTeams[0]>();
        if (currentTeams) {
            for (const t of currentTeams) {
                const key = t.members
                    .filter((m: { eliminated: boolean }) => !m.eliminated)
                    .map((m: { userId: string }) => m.userId)
                    .sort()
                    .join(",");
                oldTeamByMembers.set(key, t);
            }
        }

        // Generate new teams — reuse team_id if member composition hasn't changed
        const usedTeamIds = new Set<string>();
        const newTeams = teamMembersList.map((members, idx) => {
            const memberKey = members.map((m) => m.userId).sort().join(",");
            const existingTeam = oldTeamByMembers.get(memberKey);

            let teamId: string;
            if (existingTeam && !usedTeamIds.has(existingTeam.team_id)) {
                // Same composition → keep the same team_id
                teamId = existingTeam.team_id;
                usedTeamIds.add(teamId);
            } else {
                // New composition → generate new team_id
                teamId = generateUniqueTeamIds(1, usedTeamIds)[0];
                usedTeamIds.add(teamId);
            }

            const isUnchanged = existingTeam && existingTeam.team_id === teamId;

            return {
                team_id: teamId,
                name: `Team ${idx + 1}`,
                members: members.map((p) => ({ ...p, eliminated: false })),
                points: isUnchanged ? existingTeam.points : 0,
                round_points: isUnchanged ? existingTeam.round_points : { r1: 0, r2: 0, r3: 0, r4: 0 },
                rank: idx + 1,
                approved: false,
                // Keep image data if team hasn't changed
                image_approved: isUnchanged ? existingTeam.image_approved : false,
                image_url: isUnchanged ? existingTeam.image_url : null,
                image_data: isUnchanged ? existingTeam.image_data : null,
                round_image_urls: isUnchanged ? existingTeam.round_image_urls : {},
            };
        });

        // Delete old teams and insert new ones
        await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        const { error: insertError } = await supabase.from("teams").insert(newTeams);
        if (insertError) throw insertError;

        // Update game state — keep in current status, unlock teams
        await supabase
            .from("game_state")
            .update({
                teams_locked: false,
                updated_at: new Date().toISOString(),
            })
            .eq("id", gameState.id);

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
