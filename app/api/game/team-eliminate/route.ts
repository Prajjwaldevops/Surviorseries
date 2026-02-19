import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/team-eliminate
 * Eliminate or reinstate a team.
 * Body: { teamId, eliminated: boolean }
 */
export async function POST(req: NextRequest) {
    try {
        const { teamId, eliminated } = await req.json();

        if (!teamId || typeof eliminated !== "boolean") {
            return NextResponse.json({ error: "teamId and eliminated boolean required" }, { status: 400 });
        }

        // 1. Update team status (This requires 'eliminated' column in 'teams' table)
        const { error } = await supabase
            .from("teams")
            .update({ eliminated })
            .eq("team_id", teamId);

        if (error) throw error;

        // 2. If eliminating, stop their timer and record time
        if (eliminated) {
            const { data: gameState } = await supabase.from("game_state").select("current_round").single();
            const currentRound = gameState?.current_round || 1;

            // Find running timer for this team/round
            const { data: timer } = await supabase
                .from("team_timers")
                .select("*")
                .eq("team_id", teamId)
                .eq("round", currentRound)
                .is("stopped_at", null)
                .single();

            if (timer) {
                const now = new Date();
                const start = new Date(timer.started_at!);
                const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000) + (timer.elapsed_seconds || 0);

                // Stop timer
                await supabase
                    .from("team_timers")
                    .update({
                        stopped_at: now.toISOString(),
                        elapsed_seconds: elapsed
                    })
                    .eq("id", timer.id);

                // Update team's round_times
                const { data: team } = await supabase.from("teams").select("round_times").eq("team_id", teamId).single();
                if (team) {
                    const roundTimes = team.round_times || {};
                    roundTimes[`r${currentRound}`] = elapsed;
                    await supabase
                        .from("teams")
                        .update({ round_times: roundTimes })
                        .eq("team_id", teamId);
                }
            }
        }

        return NextResponse.json({ success: true, teamId, eliminated });
    } catch (err) {
        console.error("Team eliminate error:", err);
        return NextResponse.json({ error: "Failed to update team status. Ensure 'eliminated' column exists." }, { status: 500 });
    }
}
