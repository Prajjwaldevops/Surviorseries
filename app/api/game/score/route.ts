import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/score
 * Update a team's score (increment or decrement).
 * Body: { teamId: string, delta: number }
 */
export async function POST(req: NextRequest) {
    try {
        const { teamId, delta } = await req.json();

        if (!teamId || typeof delta !== "number") {
            return NextResponse.json(
                { error: "teamId and delta are required" },
                { status: 400 }
            );
        }

        // Check game state — scoring only allowed during "live"
        const { data: gameState } = await supabase
            .from("game_state")
            .select("status")
            .single();

        if (gameState?.status !== "live") {
            return NextResponse.json(
                { error: "Scoring is only allowed while the game is live" },
                { status: 403 }
            );
        }

        // Get current team
        const { data: team, error: fetchError } = await supabase
            .from("teams")
            .select("points")
            .eq("team_id", teamId)
            .single();

        if (fetchError || !team) {
            return NextResponse.json(
                { error: "Team not found" },
                { status: 404 }
            );
        }

        const newPoints = Math.max(0, team.points + delta);

        // Update points
        const { error: updateError } = await supabase
            .from("teams")
            .update({ points: newPoints })
            .eq("team_id", teamId);

        if (updateError) throw updateError;

        // Recompute all ranks (highest points = rank 1)
        const { data: allTeams } = await supabase
            .from("teams")
            .select("team_id, points")
            .order("points", { ascending: false });

        if (allTeams) {
            for (let i = 0; i < allTeams.length; i++) {
                await supabase
                    .from("teams")
                    .update({ rank: i + 1 })
                    .eq("team_id", allTeams[i].team_id);
            }
        }

        return NextResponse.json({ success: true, teamId, newPoints });
    } catch (err) {
        console.error("Score update error:", err);
        return NextResponse.json(
            { error: "Failed to update score" },
            { status: 500 }
        );
    }
}
