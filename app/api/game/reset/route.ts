import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/reset
 * Admin resets the game — clears ALL teams, lobby, deletes old game_state row, and inserts a fresh one.
 */
export async function POST() {
    try {
        // 1. Clear teams
        await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        // 2. Clear lobby
        await supabase.from("lobby").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        // 3. Delete old game_state row and insert a fresh one
        await supabase.from("game_state").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        const { error } = await supabase.from("game_state").insert({
            status: "waiting",
            updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        return NextResponse.json({ success: true, message: "All data cleared, fresh game state created" });
    } catch (err) {
        console.error("Game reset error:", err);
        return NextResponse.json(
            { error: "Failed to reset game" },
            { status: 500 }
        );
    }
}
