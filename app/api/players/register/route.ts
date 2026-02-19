import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/players/register
 * Register player with basic details before entering lobby.
 * Body: { userId, name, rollNo, branch, gender }
 */
export async function POST(req: NextRequest) {
    try {
        const { userId, name, rollNo, branch, gender } = await req.json();

        if (!userId || !name || !rollNo || !branch || !gender) {
            return NextResponse.json(
                { error: "All fields are required: userId, name, rollNo, branch, gender" },
                { status: 400 }
            );
        }

        if (!["male", "female"].includes(gender)) {
            return NextResponse.json(
                { error: "Gender must be 'male' or 'female'" },
                { status: 400 }
            );
        }

        // Upsert player
        const { error } = await supabase.from("players").upsert(
            {
                user_id: userId,
                name,
                roll_no: rollNo,
                branch,
                gender,
            },
            { onConflict: "user_id" }
        );

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Player register error:", err);
        return NextResponse.json(
            { error: "Failed to register player" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/players/register?userId=xxx
 * Check if a player is registered.
 */
export async function GET(req: NextRequest) {
    try {
        const userId = req.nextUrl.searchParams.get("userId");
        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("players")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error && error.code !== "PGRST116") throw error;

        return NextResponse.json({ registered: !!data, player: data || null });
    } catch (err) {
        console.error("Player check error:", err);
        return NextResponse.json({ error: "Failed to check registration" }, { status: 500 });
    }
}
