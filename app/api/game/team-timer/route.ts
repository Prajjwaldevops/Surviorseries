import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/team-timer
 * Per-team timer control: start or stop timer for a specific team/round.
 * Body: { action: "start" | "stop", teamId, round }
 */
export async function POST(req: NextRequest) {
    try {
        const { action, teamId, round } = await req.json();

        if (!teamId || !round || !action) {
            return NextResponse.json({ error: "teamId, round, and action are required" }, { status: 400 });
        }

        if (action === "start") {
            // Upsert timer for this team/round
            const { error } = await supabase.from("team_timers").upsert(
                {
                    team_id: teamId,
                    round,
                    started_at: new Date().toISOString(),
                    stopped_at: null,
                    elapsed_seconds: 0,
                },
                { onConflict: "team_id,round" }
            );
            if (error) throw error;
            return NextResponse.json({ success: true, action: "started", teamId, round });
        }

        if (action === "stop") {
            // Find the timer
            const { data: timer, error: fetchErr } = await supabase
                .from("team_timers")
                .select("*")
                .eq("team_id", teamId)
                .eq("round", round)
                .single();

            if (fetchErr || !timer) {
                return NextResponse.json({ error: "Timer not found for this team/round" }, { status: 404 });
            }

            if (!timer.started_at) {
                return NextResponse.json({ error: "Timer was not started" }, { status: 400 });
            }

            const elapsed = Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000);
            const { error: updateErr } = await supabase
                .from("team_timers")
                .update({
                    stopped_at: new Date().toISOString(),
                    elapsed_seconds: elapsed,
                })
                .eq("team_id", teamId)
                .eq("round", round);

            if (updateErr) throw updateErr;

            // Also update the team's round_times JSONB
            const { data: team } = await supabase
                .from("teams")
                .select("round_times")
                .eq("team_id", teamId)
                .single();

            if (team) {
                const roundTimes: Record<string, number> = team.round_times || {};
                roundTimes[`r${round}`] = elapsed;
                await supabase
                    .from("teams")
                    .update({ round_times: roundTimes })
                    .eq("team_id", teamId);
            }



            return NextResponse.json({ success: true, action: "stopped", teamId, round, elapsed });
        }

        return NextResponse.json({ error: "Invalid action. Use 'start' or 'stop'" }, { status: 400 });
    } catch (err) {
        console.error("Team timer error:", err);
        return NextResponse.json({ error: "Failed to manage team timer" }, { status: 500 });
    }
}

/**
 * GET /api/game/team-timer?teamId=xxx
 * Fetch all timer records for a team (or all teams if no teamId).
 */
export async function GET(req: NextRequest) {
    try {
        const teamId = req.nextUrl.searchParams.get("teamId");
        let query = supabase.from("team_timers").select("*").order("round", { ascending: true });
        if (teamId) query = query.eq("team_id", teamId);
        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ timers: data || [] });
    } catch (err) {
        console.error("Team timer fetch error:", err);
        return NextResponse.json({ error: "Failed to fetch team timers" }, { status: 500 });
    }
}
