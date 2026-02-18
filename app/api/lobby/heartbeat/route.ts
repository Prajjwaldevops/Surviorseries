import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/lobby/heartbeat
 * Updates the user's last_active timestamp to prevent timeout.
 * Body: { userId }
 */
export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json(
                { error: "userId is required" },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from("lobby")
            .update({ last_active: new Date().toISOString() })
            .eq("user_id", userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Heartbeat error:", err);
        return NextResponse.json(
            { error: "Failed to update heartbeat" },
            { status: 500 }
        );
    }
}
