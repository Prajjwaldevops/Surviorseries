import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/score
 * Update a team's score with description and round logging.
 * Body: { teamId: string, delta: number, round?: number, description?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { teamId, delta, round, description } = await req.json();

        if (!teamId || typeof delta !== "number") {
            return NextResponse.json({ error: "teamId and delta are required" }, { status: 400 });
        }

        // Check game state
        const { data: gameState } = await supabase.from("game_state").select("*").single();
        if (gameState?.status !== "playing") {
            return NextResponse.json({ error: "Scoring only allowed while playing" }, { status: 403 });
        }

        const currentRound = round || gameState.current_round || 1;

        // Get current team
        const { data: team, error: fetchError } = await supabase
            .from("teams")
            .select("points, round_points")
            .eq("team_id", teamId)
            .single();

        if (fetchError || !team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const newPoints = Math.max(0, team.points + delta);

        // Update round_points
        const roundPoints: Record<string, number> = team.round_points || { r1: 0, r2: 0, r3: 0, r4: 0 };
        const roundKey = `r${currentRound}`;
        roundPoints[roundKey] = (roundPoints[roundKey] || 0) + delta;

        // Update points
        const { error: updateError } = await supabase
            .from("teams")
            .update({ points: newPoints, round_points: roundPoints })
            .eq("team_id", teamId);

        if (updateError) throw updateError;

        // Log score change
        await supabase.from("score_log").insert({
            team_id: teamId,
            round: currentRound,
            delta,
            new_total: newPoints,
            description: description || (delta > 0 ? "Points added" : "Points deducted"),
        });

        // Recompute ranks
        const { data: allTeams } = await supabase
            .from("teams")
            .select("team_id, points")
            .order("points", { ascending: false });

        if (allTeams) {
            for (let i = 0; i < allTeams.length; i++) {
                await supabase.from("teams").update({ rank: i + 1 }).eq("team_id", allTeams[i].team_id);
            }
        }

        return NextResponse.json({ success: true, teamId, newPoints, round: currentRound });
    } catch (err) {
        console.error("Score update error:", err);
        return NextResponse.json({ error: "Failed to update score" }, { status: 500 });
    }
}
