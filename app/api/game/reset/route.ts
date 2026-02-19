import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/reset
 * Archives current game to game_history, then resets all tables.
 */
export async function POST() {
    try {
        // 1. Gather all current game data for archival
        const { data: gameState } = await supabase.from("game_state").select("*").single();
        const { data: teams } = await supabase.from("teams").select("*").order("rank", { ascending: true });
        const { data: scoreLogs } = await supabase.from("score_log").select("*").order("created_at", { ascending: true });
        const { data: timer } = await supabase.from("game_timer").select("*").single();
        const { data: players } = await supabase.from("players").select("*");
        const { data: playerScoreLogs } = await supabase.from("player_score_log").select("*").order("created_at", { ascending: true });
        const { data: teamTimers } = await supabase.from("team_timers").select("*");

        const winner = teams?.find((t) => t.rank === 1);

        // 2. Archive to game_history
        if (teams && teams.length > 0) {
            await supabase.from("game_history").insert({
                game_data: {
                    game_state: gameState,
                    teams,
                    score_logs: scoreLogs || [],
                    timer,
                    players: players || [],
                    player_score_logs: playerScoreLogs || [],
                    team_timers: teamTimers || [],
                    archived_at: new Date().toISOString(),
                },
                winner_team_id: winner?.team_id || null,
                total_rounds: gameState?.current_round || 0,
            });
        }

        // 3. Clear all tables
        await supabase.from("player_score_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("team_timers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("score_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("lobby").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("players").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        // 4. Reset game state
        await supabase.from("game_state").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("game_state").insert({
            status: "waiting",
            current_round: 0,
            round_status: "idle",
            teams_locked: false,
        });

        // 5. Reset timer
        await supabase.from("game_timer").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("game_timer").insert({
            elapsed_seconds: 0,
            running: false,
        });

        return NextResponse.json({ success: true, message: "Game reset. Data archived to history." });
    } catch (err) {
        console.error("Reset error:", err);
        return NextResponse.json({ error: "Failed to reset game" }, { status: 500 });
    }
}
