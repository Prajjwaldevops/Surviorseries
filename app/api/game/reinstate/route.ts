import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { TeamMember } from "@/lib/types";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/reinstate
 * Admin reinstates (un-eliminates) a player.
 * Body: { teamId: string, userId: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { teamId, userId } = await req.json();

        if (!teamId || !userId) {
            return NextResponse.json(
                { error: "teamId and userId are required" },
                { status: 400 }
            );
        }

        const { data: team, error: fetchError } = await supabase
            .from("teams")
            .select("members")
            .eq("team_id", teamId)
            .single();

        if (fetchError || !team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const updatedMembers = (team.members as TeamMember[]).map((m) => {
            if (m.userId === userId) {
                return { ...m, eliminated: false };
            }
            return m;
        });

        const { error: updateError } = await supabase
            .from("teams")
            .update({ members: updatedMembers })
            .eq("team_id", teamId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, teamId, userId });
    } catch (err) {
        console.error("Reinstate error:", err);
        return NextResponse.json(
            { error: "Failed to reinstate player" },
            { status: 500 }
        );
    }
}
