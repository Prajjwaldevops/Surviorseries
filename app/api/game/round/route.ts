import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TOTAL_ROUNDS } from "@/lib/constants";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/round
 * Manage rounds: start, end, next
 * Body: { action: "start" | "end" | "next" }
 */
export async function POST(req: NextRequest) {
    try {
        const { action } = await req.json();

        const { data: gs } = await supabase.from("game_state").select("*").single();
        if (!gs) return NextResponse.json({ error: "Game state not found" }, { status: 404 });

        if (action === "start") {
            // Start the current round — move to "playing"
            const { error } = await supabase
                .from("game_state")
                .update({
                    status: "playing",
                    round_status: "playing",
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", gs.id);

            if (error) throw error;

            // Start timer
            await supabase
                .from("game_timer")
                .update({
                    started_at: new Date().toISOString(),
                    running: true,
                })
                .neq("id", "00000000-0000-0000-0000-000000000000");

            // Auto-start team timers for ALL teams in this round
            const { data: allTeams } = await supabase.from("teams").select("team_id");
            if (allTeams && allTeams.length > 0) {
                const timerRecords = allTeams.map((t) => ({
                    team_id: t.team_id,
                    round: gs.current_round,
                    started_at: new Date().toISOString(),
                    stopped_at: null,
                    elapsed_seconds: 0,
                }));
                await supabase.from("team_timers").upsert(timerRecords, { onConflict: "team_id,round" });
            }

            return NextResponse.json({ success: true, round: gs.current_round, action: "started" });
        }

        if (action === "end") {
            // End the current round
            const { error } = await supabase
                .from("game_state")
                .update({
                    status: "round_complete",
                    round_status: "round_complete",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", gs.id);

            if (error) throw error;

            // Stop timer
            const { data: timer } = await supabase.from("game_timer").select("*").single();
            if (timer && timer.running && timer.started_at) {
                const elapsed = timer.elapsed_seconds + Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000);
                await supabase
                    .from("game_timer")
                    .update({ running: false, elapsed_seconds: elapsed })
                    .eq("id", timer.id);
            }

            // Auto-record: Stop all running team timers for the current round
            const { data: runningTimers } = await supabase
                .from("team_timers")
                .select("*")
                .eq("round", gs.current_round)
                .is("stopped_at", null)
                .not("started_at", "is", null);

            if (runningTimers && runningTimers.length > 0) {
                for (const tt of runningTimers) {
                    const elapsedSec = Math.floor((Date.now() - new Date(tt.started_at).getTime()) / 1000);
                    // Stop timer
                    await supabase
                        .from("team_timers")
                        .update({ stopped_at: new Date().toISOString(), elapsed_seconds: elapsedSec })
                        .eq("team_id", tt.team_id)
                        .eq("round", gs.current_round);

                    // Update team round_times
                    const { data: teamData } = await supabase
                        .from("teams")
                        .select("round_times")
                        .eq("team_id", tt.team_id)
                        .single();
                    if (teamData) {
                        const roundTimes: Record<string, number> = teamData.round_times || {};
                        roundTimes[`r${gs.current_round}`] = elapsedSec;
                        await supabase.from("teams").update({ round_times: roundTimes }).eq("team_id", tt.team_id);
                    }
                }
            }

            return NextResponse.json({ success: true, round: gs.current_round, action: "ended" });
        }

        if (action === "next") {
            const nextRound = gs.current_round + 1;

            if (nextRound > TOTAL_ROUNDS) {
                return NextResponse.json({ error: `Maximum ${TOTAL_ROUNDS} rounds reached. Finish the game instead.` }, { status: 400 });
            }



            // Move to team_formation for next round
            const { error } = await supabase
                .from("game_state")
                .update({
                    current_round: nextRound,
                    status: "team_formation",
                    round_status: "team_formation",
                    teams_locked: false,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", gs.id);

            if (error) throw error;

            // Reset timer for next round
            await supabase
                .from("game_timer")
                .update({ started_at: null, elapsed_seconds: 0, running: false })
                .neq("id", "00000000-0000-0000-0000-000000000000");

            return NextResponse.json({ success: true, round: nextRound, action: "next" });
        }

        return NextResponse.json({ error: "Invalid action. Use start, end, or next." }, { status: 400 });
    } catch (err) {
        console.error("Round error:", err);
        return NextResponse.json({ error: "Failed to manage round" }, { status: 500 });
    }
}
