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
        const { teamId, odaPlayerUserId } = await req.json();

        // Validate input — accept both 'userId' and 'odaPlayerUserId' for flexibility
        const playerUserId = odaPlayerUserId;

        if (!teamId || !playerUserId) {
            return NextResponse.json(
                { error: "teamId and userId are required" },
                { status: 400 }
            );
        }

        // Check game state — elimination only during "live"
        const { data: gameState } = await supabase
            .from("game_state")
            .select("status")
            .single();

        if (gameState?.status !== "live") {
            return NextResponse.json(
                { error: "Elimination is only allowed while the game is live" },
                { status: 403 }
            );
        }

        // Fetch the team
        const { data: team, error: fetchError } = await supabase
            .from("teams")
            .select("members")
            .eq("team_id", teamId)
            .single();

        if (fetchError || !team) {
            return NextResponse.json(
                { error: "Team not found" },
                { status: 404 }
            );
        }

        // Update the member's eliminated status
        const updatedMembers = (team.members as TeamMember[]).map((m) => {
            if (m.userId === playerUserId) {
                return { ...m, eliminated: true };
            }
            return m;
        });

        const { error: updateError } = await supabase
            .from("teams")
            .update({ members: updatedMembers })
            .eq("team_id", teamId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, teamId, playerUserId });
    } catch (err) {
        console.error("Eliminate error:", err);
        return NextResponse.json(
            { error: "Failed to eliminate player" },
            { status: 500 }
        );
    }
}
