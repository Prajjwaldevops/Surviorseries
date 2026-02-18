import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/adminx/approve-image
 * AdminX approves or disapproves a team's uploaded image.
 * Body: { teamId: string, action: "approve" | "disapprove" }
 */
export async function POST(req: NextRequest) {
    try {
        const { teamId, action } = await req.json();

        if (!teamId || !["approve", "disapprove"].includes(action)) {
            return NextResponse.json(
                { error: "teamId and action (approve/disapprove) are required" },
                { status: 400 }
            );
        }

        const { data: team, error: fetchError } = await supabase
            .from("teams")
            .select("*")
            .eq("team_id", teamId)
            .single();

        if (fetchError || !team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        if (action === "approve") {
            const { error } = await supabase
                .from("teams")
                .update({ image_approved: true, approved: true })
                .eq("team_id", teamId);

            if (error) throw error;

            return NextResponse.json({ success: true, message: `Team ${teamId} image approved` });
        } else {
            // Disapprove — clear image so team must re-upload
            const { error } = await supabase
                .from("teams")
                .update({
                    image_approved: false,
                    image_url: null,
                    image_data: null,
                })
                .eq("team_id", teamId);

            if (error) throw error;

            return NextResponse.json({ success: true, message: `Team ${teamId} image disapproved. Must re-upload.` });
        }
    } catch (err) {
        console.error("AdminX approve error:", err);
        return NextResponse.json({ error: "Failed to process approval" }, { status: 500 });
    }
}
