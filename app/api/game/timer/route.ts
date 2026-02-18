import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/timer
 * Timer control: start, stop, reset
 * Body: { action: "start" | "stop" | "reset" }
 */
export async function POST(req: NextRequest) {
    try {
        const { action } = await req.json();

        const { data: timer } = await supabase.from("game_timer").select("*").single();
        if (!timer) {
            // Create timer if doesn't exist
            await supabase.from("game_timer").insert({ elapsed_seconds: 0, running: false });
            return NextResponse.json({ success: true, action });
        }

        if (action === "start") {
            const { error } = await supabase
                .from("game_timer")
                .update({
                    started_at: new Date().toISOString(),
                    running: true,
                })
                .eq("id", timer.id);

            if (error) throw error;
            return NextResponse.json({ success: true, action: "started" });
        }

        if (action === "stop") {
            if (timer.running && timer.started_at) {
                const elapsed = timer.elapsed_seconds + Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000);
                const { error } = await supabase
                    .from("game_timer")
                    .update({ running: false, elapsed_seconds: elapsed })
                    .eq("id", timer.id);
                if (error) throw error;
            }
            return NextResponse.json({ success: true, action: "stopped" });
        }

        if (action === "reset") {
            const { error } = await supabase
                .from("game_timer")
                .update({ started_at: null, elapsed_seconds: 0, running: false })
                .eq("id", timer.id);
            if (error) throw error;
            return NextResponse.json({ success: true, action: "reset" });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (err) {
        console.error("Timer error:", err);
        return NextResponse.json({ error: "Failed to manage timer" }, { status: 500 });
    }
}
