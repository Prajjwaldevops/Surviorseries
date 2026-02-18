import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MAX_PLAYERS } from "@/lib/constants";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/lobby/join
 * Add user to the lobby. Enforces max 40 players.
 * Body: { userId, name, email }
 */
export async function POST(req: NextRequest) {
    try {
        const { userId, name, email } = await req.json();

        if (!userId || !name || !email) {
            return NextResponse.json(
                { error: "userId, name, and email are required" },
                { status: 400 }
            );
        }

        // Check current lobby count
        const { count } = await supabase
            .from("lobby")
            .select("*", { count: "exact", head: true });

        if (count !== null && count >= MAX_PLAYERS) {
            return NextResponse.json(
                { error: "Lobby is full (max 40 players)" },
                { status: 403 }
            );
        }

        // Upsert user into lobby
        const { error } = await supabase.from("lobby").upsert(
            {
                user_id: userId,
                name,
                email,
                last_active: new Date().toISOString(),
            },
            { onConflict: "user_id" }
        );

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Lobby join error:", err);
        return NextResponse.json(
            { error: "Failed to join lobby" },
            { status: 500 }
        );
    }
}
