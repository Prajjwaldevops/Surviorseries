import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { TeamMember } from "@/lib/types";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/eliminate
 * Admin eliminates a player from a team.
 * Body: { teamId: string, userId: string }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const teamId = body.teamId;
        const userId = body.userId || body.odaPlayerUserId;

        if (!teamId || !userId) {
            return NextResponse.json({ error: "teamId and userId are required" }, { status: 400 });
        }

        // Check game state — allow during playing or round_complete
        const { data: gameState } = await supabase.from("game_state").select("status").single();
        if (!gameState || !["playing", "round_complete"].includes(gameState.status)) {
            return NextResponse.json({ error: "Elimination only allowed during playing or round_complete" }, { status: 403 });
        }

        const { data: team, error: fetchError } = await supabase.from("teams").select("members").eq("team_id", teamId).single();
        if (fetchError || !team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const updatedMembers = (team.members as TeamMember[]).map((m) =>
            m.userId === userId ? { ...m, eliminated: true } : m
        );

        const { error: updateError } = await supabase.from("teams").update({ members: updatedMembers }).eq("team_id", teamId);
        if (updateError) throw updateError;

        return NextResponse.json({ success: true, teamId, userId });
    } catch (err) {
        console.error("Eliminate error:", err);
        return NextResponse.json({ error: "Failed to eliminate player" }, { status: 500 });
    }
}
