import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/finish
 * Admin finishes the game — sets state to "finished" and locks scoring.
 */
export async function POST() {
    try {
        const { data: gameState } = await supabase
            .from("game_state")
            .select("*")
            .single();

        if (!gameState) {
            return NextResponse.json(
                { error: "Game state not found" },
                { status: 404 }
            );
        }

        if (gameState.status === "finished") {
            return NextResponse.json(
                { error: "Game is already finished" },
                { status: 400 }
            );
        }

        // Update game state to finished
        const { error } = await supabase
            .from("game_state")
            .update({ status: "finished", updated_at: new Date().toISOString() })
            .eq("id", gameState.id);

        if (error) throw error;

        // Fetch final standings
        const { data: teams } = await supabase
            .from("teams")
            .select("*")
            .order("rank", { ascending: true });

        return NextResponse.json({
            success: true,
            winner: teams?.[0] || null,
            standings: teams,
        });
    } catch (err) {
        console.error("Game finish error:", err);
        return NextResponse.json(
            { error: "Failed to finish game" },
            { status: 500 }
        );
    }
}
