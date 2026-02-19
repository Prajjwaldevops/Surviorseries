import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/finish
 * Finish the game — set status to "finished", recompute ranks, stop timer.
 */
export async function POST() {
    try {
        const { data: gameState } = await supabase.from("game_state").select("*").single();

        if (!gameState || !["playing", "round_complete"].includes(gameState.status)) {
            return NextResponse.json({ error: "Game can only be finished from playing or round_complete" }, { status: 400 });
        }

        // Stop timer
        const { data: timer } = await supabase.from("game_timer").select("*").single();
        if (timer && timer.running && timer.started_at) {
            const elapsed = timer.elapsed_seconds + Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000);
            await supabase.from("game_timer").update({ running: false, elapsed_seconds: elapsed }).eq("id", timer.id);
        }

        // Stop all running team timers for the current round
        const currentRound = gameState.current_round || 1;
        const { data: runningTimers } = await supabase
            .from("team_timers")
            .select("*")
            .eq("round", currentRound)
            .is("stopped_at", null)
            .not("started_at", "is", null);

        if (runningTimers && runningTimers.length > 0) {
            for (const tt of runningTimers) {
                const elapsedSec = Math.floor((Date.now() - new Date(tt.started_at).getTime()) / 1000);
                await supabase
                    .from("team_timers")
                    .update({ stopped_at: new Date().toISOString(), elapsed_seconds: elapsedSec })
                    .eq("team_id", tt.team_id)
                    .eq("round", currentRound);

                // Update team round_times
                const { data: teamData } = await supabase
                    .from("teams")
                    .select("round_times")
                    .eq("team_id", tt.team_id)
                    .single();
                if (teamData) {
                    const roundTimes: Record<string, number> = teamData.round_times || {};
                    roundTimes[`r${currentRound}`] = elapsedSec;
                    await supabase.from("teams").update({ round_times: roundTimes }).eq("team_id", tt.team_id);
                }
            }
        }

        // Recompute final ranks
        const { data: teams } = await supabase
            .from("teams")
            .select("team_id, points")
            .order("points", { ascending: false });

        if (teams) {
            for (let i = 0; i < teams.length; i++) {
                await supabase.from("teams").update({ rank: i + 1 }).eq("team_id", teams[i].team_id);
            }
        }

        // Update game state
        const { error } = await supabase
            .from("game_state")
            .update({
                status: "finished",
                round_status: "round_complete",
                updated_at: new Date().toISOString(),
            })
            .eq("id", gameState.id);

        if (error) throw error;

        // Get winner
        const { data: winner } = await supabase
            .from("teams")
            .select("*")
            .eq("rank", 1)
            .single();

        return NextResponse.json({
            success: true,
            winner: winner ? { name: winner.name, team_id: winner.team_id, points: winner.points } : null,
        });
    } catch (err) {
        console.error("Finish error:", err);
        return NextResponse.json({ error: "Failed to finish game" }, { status: 500 });
    }
}
