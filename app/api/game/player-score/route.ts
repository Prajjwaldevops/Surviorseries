import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/player-score
 * Give/deduct points to an individual player. Adds to team points too.
 * Body: { userId, teamId, delta, round, description }
 */
export async function POST(req: NextRequest) {
    try {
        const { userId, teamId, delta, round, description, skipLog } = await req.json();

        if (!userId || !teamId || typeof delta !== "number") {
            return NextResponse.json(
                { error: "userId, teamId, and delta are required" },
                { status: 400 }
            );
        }

        // Check game state
        const { data: gameState } = await supabase.from("game_state").select("*").single();
        if (gameState?.status !== "playing") {
            return NextResponse.json({ error: "Scoring only allowed while playing" }, { status: 403 });
        }

        const currentRound = round || gameState.current_round || 1;

        // 1. Update player points
        const { data: player, error: playerFetchErr } = await supabase
            .from("players")
            .select("points")
            .eq("user_id", userId)
            .single();

        if (playerFetchErr || !player) {
            return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }

        const newPlayerPoints = Math.max(0, player.points + delta);
        await supabase
            .from("players")
            .update({ points: newPlayerPoints })
            .eq("user_id", userId);

        // 2. Log to player_score_log (ALWAYS log for player stats)
        await supabase.from("player_score_log").insert({
            user_id: userId,
            team_id: teamId,
            round: currentRound,
            delta,
            new_total: newPlayerPoints,
            description: description || (delta > 0 ? "Points added" : "Points deducted"),
        });

        // 3. Update team points
        const { data: team, error: teamFetchErr } = await supabase
            .from("teams")
            .select("points, round_points")
            .eq("team_id", teamId)
            .single();

        if (teamFetchErr || !team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const newTeamPoints = Math.max(0, team.points + delta);
        const roundPoints: Record<string, number> = team.round_points || { r1: 0, r2: 0, r3: 0, r4: 0 };
        const roundKey = `r${currentRound}`;
        roundPoints[roundKey] = (roundPoints[roundKey] || 0) + delta;

        await supabase
            .from("teams")
            .update({ points: newTeamPoints, round_points: roundPoints })
            .eq("team_id", teamId);

        // 4. Log to score_log (with player reference) (ALWAYS log for team history)
        await supabase.from("score_log").insert({
            team_id: teamId,
            round: currentRound,
            delta,
            new_total: newTeamPoints,
            description: description || (delta > 0 ? "Points added" : "Points deducted"),
            player_user_id: userId,
        });

        // 5. Recompute ranks
        const { data: allTeams } = await supabase
            .from("teams")
            .select("team_id, points")
            .order("points", { ascending: false });

        if (allTeams) {
            for (let i = 0; i < allTeams.length; i++) {
                await supabase.from("teams").update({ rank: i + 1 }).eq("team_id", allTeams[i].team_id);
            }
        }

        return NextResponse.json({
            success: true,
            userId,
            teamId,
            newPlayerPoints,
            newTeamPoints,
            round: currentRound,
        });
    } catch (err) {
        console.error("Player score error:", err);
        return NextResponse.json({ error: "Failed to update player score" }, { status: 500 });
    }
}
