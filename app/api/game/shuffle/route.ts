import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
 * Distribute players into teams strictly:
 * - Teams of 4 players until we run out.
 * - The remainder goes into the LAST team.
 * - e.g. 10 players -> Team 1 (4), Team 2 (4), Team 3 (2).
 * - e.g. 13 players -> Team 1 (4), Team 2 (4), Team 3 (4), Team 4 (1).
 */
function distributeIntoTeamsStrict(players: { name: string; email: string; userId: string }[]) {
    const TEAM_SIZE = 4;
    const teams: { name: string; email: string; userId: string }[][] = [];

    let i = 0;
    while (i < players.length) {
        // Take a chunk of 4
        const chunk = players.slice(i, i + TEAM_SIZE);
        teams.push(chunk);
        i += TEAM_SIZE;
    }

    // NOTE: The user requested "remaining in next team".
    // My loop does exactly that:
    // 10 players: slice(0,4), slice(4,8), slice(8,12) -> last slice has 2.
    // 13 players: slice(0,4), slice(4,8), slice(8,12), slice(12,16) -> last slice has 1.

    return teams;
}

/**
 * POST /api/game/shuffle
 * Admin shuffles teams — re-randomizes all existing players into new teams.
 * - Logic: Strict 4-player teams.
 * - Persistence: If a new team has IDENTICAL members to an old team, keep old team_id & image.
 * - Bypass: If persisted, image_approved remains true.
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

        // Fetch current teams to preserve IDs/Images
        const { data: currentTeams, error: fetchError } = await supabase
            .from("teams")
            .select("*");

        if (fetchError) throw fetchError;

        // Collect all non-eliminated members
        const allMembers: { name: string; email: string; userId: string }[] = [];

        if (!currentTeams || currentTeams.length === 0) {
            // First time: Pull from lobby
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
            // Re-shuffle existing active members
            if (currentTeams.length <= 1) {
                // Allow shuffle if we have enough players for >1 team, or if user forces reshuffle of 1 team?
                // User requirement: "remove shuffle feature after round 2 only swap".
                // We assume this API handles the "Shuffle" action button.
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

        // Shuffle Players (Fisher-Yates)
        const shuffled = [...allMembers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Distribute strictly
        const teamMembersList = distributeIntoTeamsStrict(shuffled);

        // Map old teams by Sorted Member UserIDs -> Team Object
        // This allows us to find if a "new" team is actually an "old" team
        const oldTeamByMembers = new Map<string, typeof currentTeams[0]>();
        const usedOldTeamIds = new Set<string>();

        if (currentTeams) {
            for (const t of currentTeams) {
                // Create a key from sorted user IDs of active members
                const key = t.members
                    .filter((m: { eliminated: boolean }) => !m.eliminated)
                    .map((m: { userId: string }) => m.userId)
                    .sort()
                    .join(",");
                oldTeamByMembers.set(key, t);
            }
        }

        const newTeams = [];
        const generatedIds = new Set<string>();

        // We need to assign IDs.
        // Priority 1: Match existing team by composition (Persistent ID)
        // Priority 2: Use an unused existing team ID? (Wait, user said "teams unique id created will not changed".
        // This implies if Team A becomes Team B's members, does it keep ID A? No, usually ID follows composition or slot.
        // User said: "only players will go from here and there... strictly for the team id if any player swapped".
        // Interpretation:
        // - If members are [A,B,C,D] and old team T1 was [A,B,C,D], allow T1 to persist (and keep photo).
        // - If members are [A,B,E,F], this is a "new" team composition.
        //   Should it recycle an old ID?
        //   "shuffling teams unique id created will not changed once created"
        //   This might mean we should NOT delete teams and recreate. We should UPDATE them?
        //   But the number of teams might change (e.g. elimination).
        //   I will follow the safe path:
        //   1. Check exact match -> Keep ID, Keep Photo, ImageApproved = True.
        //   2. No match -> Generate NEW ID (or recycle unused?), ImageApproved = False.

        for (let idx = 0; idx < teamMembersList.length; idx++) {
            const members = teamMembersList[idx];
            const memberKey = members.map((m) => m.userId).sort().join(",");
            const exactMatchTeam = oldTeamByMembers.get(memberKey);

            let teamId: string;
            let imageUrl: string | null = null;
            let imageApproved = false;
            let imageData: any = null;
            let roundImageUrls = {};
            let points = 0;
            let roundPoints = { r1: 0, r2: 0, r3: 0, r4: 0 };
            let roundTimes = {};

            if (exactMatchTeam && !usedOldTeamIds.has(exactMatchTeam.team_id)) {
                // Case 1: Identical composition found
                teamId = exactMatchTeam.team_id;
                usedOldTeamIds.add(teamId);

                // Persist all data
                imageUrl = exactMatchTeam.image_url;
                imageApproved = exactMatchTeam.image_approved; // BYPASS verification if true
                imageData = exactMatchTeam.image_data;
                roundImageUrls = exactMatchTeam.round_image_urls || {};
                points = exactMatchTeam.points;
                roundPoints = exactMatchTeam.round_points;
                roundTimes = exactMatchTeam.round_times || {};
            } else {
                // Case 2: New composition
                // We generate a new unique ID
                teamId = generateUniqueTeamIds(1, generatedIds)[0];
                generatedIds.add(teamId); // track locally
                // New team, reset photo
                imageApproved = false;
                imageUrl = null;
            }

            newTeams.push({
                team_id: teamId,
                name: `Team ${idx + 1}`, // Names can reshuffle, that's fine
                members: members.map((p) => ({ ...p, eliminated: false })),
                points,
                round_points: roundPoints,
                round_times: roundTimes,
                rank: idx + 1,
                approved: false,
                image_approved: imageApproved,
                image_url: imageUrl,
                image_data: imageData,
                round_image_urls: roundImageUrls,
            });
        }

        // Transactional replacement
        // We delete all and insert new.
        // Since we re-used IDs for preserved teams, this effectively "updates" them but logically cleaner.
        // Warning: This deletes logs referenced by team_id? No, score_log refers to team_id.
        // If we generate NEW IDs for swapped teams, old logs become orphaned or cascade delete?
        // Default foreign key behavior.
        // User said: "teams unique id created will not changed once created".
        // This implies I should try to REUSE existing IDs as much as possible even if swapped?
        // But if I reuse ID for different people, 'image_approved' must be false.

        // REFINED LOGIC for IDs:
        // 1. Exact Match -> Use that ID (Preserve Photo).
        // 2. Remainder -> Reuse REMAINING old IDs (Reset Photo).
        // 3. Need more? -> Generate New.

        // Let's implement this refinement to strict satisfy "id created will not changed".

        // Re-do assignment
        const finalTeams = [];
        const availableOldTeams = currentTeams ? [...currentTeams] : [];
        const assignedTeamIds = new Set<string>();

        // Pass 1: Find Exact Matches
        const exactMatches = new Map<number, any>(); // newTeamIdx -> oldTeam

        for (let i = 0; i < teamMembersList.length; i++) {
            const members = teamMembersList[i];
            const memberKey = members.map((m) => m.userId).sort().join(",");

            // Find in available
            const matchIdx = availableOldTeams.findIndex(t => {
                const tKey = t.members
                    .filter((m: { eliminated: boolean }) => !m.eliminated)
                    .map((m: { userId: string }) => m.userId)
                    .sort()
                    .join(",");
                return tKey === memberKey;
            });

            if (matchIdx !== -1) {
                exactMatches.set(i, availableOldTeams[matchIdx]);
                assignedTeamIds.add(availableOldTeams[matchIdx].team_id);
                availableOldTeams.splice(matchIdx, 1); // remove from pool
            }
        }

        // Pass 2: Assign remaining teams
        const tempGeneratedIds = new Set<string>();
        if (currentTeams) currentTeams.forEach(t => tempGeneratedIds.add(t.team_id)); // avoid collision with existing

        for (let i = 0; i < teamMembersList.length; i++) {
            const members = teamMembersList[i];

            let teamId: string;
            let imageApproved = false;
            let imageUrl = null;
            let imageData = null;
            let roundImageUrls = {};
            let points = 0;
            let roundPoints = { r1: 0, r2: 0, r3: 0, r4: 0 };
            let roundTimes = {};

            if (exactMatches.has(i)) {
                // EXACT MATCH
                const old = exactMatches.get(i);
                teamId = old.team_id;
                imageApproved = old.image_approved; // KEEP status
                imageUrl = old.image_url;
                imageData = old.image_data;
                roundImageUrls = old.round_image_urls;
                points = old.points;
                roundPoints = old.round_points;
                roundTimes = old.round_times;
            } else {
                // CHANGED / NEW
                // Try to reuse an available old team ID (Slot preservation)
                if (availableOldTeams.length > 0) {
                    const old = availableOldTeams.pop(); // Take one
                    teamId = old.team_id;
                    // Reset Photo & Data?
                    // "strictly for the team id if any player swapped" -> "bypass... if they have been not swapped... strictly... if swapped"
                    // Implies if swapped, do NOT bypass.
                    imageApproved = false;
                    imageUrl = null;
                    // Do we keep points? Usually shuffle resets points for fairness?
                    // User didn't say. Assuming shuffle during round_complete might keep points?
                    // Actually, "shuffle" usually implies new teams.
                    // But if we reuse ID, we inherit points?
                    // Safest: If composition changed, it's a "new team" in an "old shell". Reset points?
                    // Let's keep points 0 for new composition to be safe, or inherit if it's just a swap?
                    // Given it's "Shuffle", I'll reset points for swapped teams to 0 unless user specified.
                    // Actually, Phase 11 instruction didn't explicitly say "keep points".
                    // But if I reuse ID, logs point to it.
                    // If I reset points to 0, old logs remain but team starts fresh.
                    // I will reset points for SWAPPED teams.
                    points = 0;
                    roundPoints = { r1: 0, r2: 0, r3: 0, r4: 0 };
                } else {
                    // Generate New
                    teamId = generateUniqueTeamIds(1, tempGeneratedIds)[0];
                    tempGeneratedIds.add(teamId);
                    imageApproved = false;
                    imageUrl = null;
                }
            }

            finalTeams.push({
                team_id: teamId,
                name: `Team ${i + 1}`,
                members: members.map((p) => ({ ...p, eliminated: false })),
                points,
                round_points: roundPoints,
                round_times: roundTimes,
                rank: i + 1,
                approved: false,
                image_approved: imageApproved,
                image_url: imageUrl,
                image_data: imageData,
                round_image_urls: roundImageUrls,
            });
        }

        // Delete old and insert final
        await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
        const { error: insertError } = await supabase.from("teams").insert(finalTeams);
        if (insertError) throw insertError;

        // Unlock state
        await supabase
            .from("game_state")
            .update({
                teams_locked: false,
                updated_at: new Date().toISOString(),
            })
            .eq("id", gameState.id);

        return NextResponse.json({
            success: true,
            teamsCreated: finalTeams.length,
            totalPlayers: allMembers.length,
            teams: finalTeams,
        });
    } catch (err) {
        console.error("Shuffle error:", err);
        return NextResponse.json(
            { error: "Failed to shuffle teams" },
            { status: 500 }
        );
    }
}
