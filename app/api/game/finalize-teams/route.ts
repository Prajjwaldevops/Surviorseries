import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/finalize-teams
 * Admin finalizes teams → sets teams_locked = true, allowing users to proceed.
 * Teams that already have an image_url (unchanged after shuffle) get auto-approved.
 */
export async function POST() {
    try {
        const { data: gameState } = await supabase
            .from("game_state")
            .select("*")
            .single();

        if (!gameState) {
            return NextResponse.json({ error: "Game state not found" }, { status: 404 });
        }

        if (gameState.status !== "team_formation") {
            return NextResponse.json(
                { error: "Teams can only be finalized during team formation phase" },
                { status: 400 }
            );
        }

        // Auto-approve teams that already have an image (unchanged after shuffle)
        await supabase
            .from("teams")
            .update({ image_approved: true, approved: true })
            .not("image_url", "is", null);

        // Lock teams and move to image upload phase
        const { error } = await supabase
            .from("game_state")
            .update({
                teams_locked: true,
                status: "image_upload",
                round_status: "image_upload",
                updated_at: new Date().toISOString(),
            })
            .eq("id", gameState.id);

        if (error) throw error;

        return NextResponse.json({ success: true, message: "Teams finalized. Unchanged teams auto-approved. Others need image upload." });
    } catch (err) {
        console.error("Finalize teams error:", err);
        return NextResponse.json({ error: "Failed to finalize teams" }, { status: 500 });
    }
}
