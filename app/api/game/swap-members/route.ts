import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/game/swap-members
 * Admin swaps two members between teams.
 * Body: { fromTeamId, toTeamId, userId1, userId2 }
 * userId1 is in fromTeamId, userId2 is in toTeamId. They swap places.
 */
export async function POST(req: NextRequest) {
    try {
        const { fromTeamId, toTeamId, userId1, userId2 } = await req.json();

        if (!fromTeamId || !toTeamId || !userId1 || !userId2) {
            return NextResponse.json(
                { error: "fromTeamId, toTeamId, userId1, and userId2 are required" },
                { status: 400 }
            );
        }

        // Fetch both teams
        const { data: fromTeam } = await supabase
            .from("teams")
            .select("*")
            .eq("team_id", fromTeamId)
            .single();

        const { data: toTeam } = await supabase
            .from("teams")
            .select("*")
            .eq("team_id", toTeamId)
            .single();

        if (!fromTeam || !toTeam) {
            return NextResponse.json({ error: "One or both teams not found" }, { status: 404 });
        }

        // Find the members to swap
        const member1 = fromTeam.members.find((m: { userId: string }) => m.userId === userId1);
        const member2 = toTeam.members.find((m: { userId: string }) => m.userId === userId2);

        if (!member1 || !member2) {
            return NextResponse.json({ error: "One or both members not found in their teams" }, { status: 404 });
        }

        // Swap: remove member1 from fromTeam, add member2; and vice versa
        const newFromMembers = fromTeam.members.map((m: { userId: string }) =>
            m.userId === userId1 ? { ...member2 } : m
        );
        const newToMembers = toTeam.members.map((m: { userId: string }) =>
            m.userId === userId2 ? { ...member1 } : m
        );

        // Update both teams
        const { error: err1 } = await supabase
            .from("teams")
            .update({ members: newFromMembers })
            .eq("team_id", fromTeamId);

        const { error: err2 } = await supabase
            .from("teams")
            .update({ members: newToMembers })
            .eq("team_id", toTeamId);

        if (err1 || err2) throw err1 || err2;

        return NextResponse.json({
            success: true,
            message: `Swapped ${member1.name} ↔ ${member2.name}`,
        });
    } catch (err) {
        console.error("Swap members error:", err);
        return NextResponse.json({ error: "Failed to swap members" }, { status: 500 });
    }
}
