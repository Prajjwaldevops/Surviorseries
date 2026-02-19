import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BRANCHES = ["CSE", "IT", "ECE", "EE", "ME", "CIVIL"];

// Helper to generate random item
const randomItem = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export async function GET() {
    try {
        const users = [];
        const lobbyEntries = [];

        // Generate 40 dummy users
        for (let i = 1; i <= 40; i++) {
            const userId = `test-user-${i}`;
            const name = `Test Player ${i}`;
            const rollNo = `24000${i.toString().padStart(2, "0")}`;
            const branch = randomItem(BRANCHES);
            const gender = i % 2 === 0 ? "female" : "male";

            users.push({
                user_id: userId,
                name,
                roll_no: rollNo,
                branch,
                gender,
            });

            lobbyEntries.push({
                user_id: userId,
                name,
                email: `test${i}@example.com`,
                joined_at: new Date().toISOString(),
            });
        }

        // 1. Upsert Players
        const { error: playersError } = await supabase
            .from("players")
            .upsert(users, { onConflict: "user_id" });

        if (playersError) throw playersError;

        // 2. Upsert Lobby (Clear existing test users from lobby first? Or just upsert)
        // Lobby usually doesn't have a unique constraint on user_id except maybe PK?
        // Let's check if we can just insert/upsert.
        // Assuming user_id is PK or Unique in lobby.
        const { error: lobbyError } = await supabase
            .from("lobby")
            .upsert(lobbyEntries, { onConflict: "user_id" });

        if (lobbyError) throw lobbyError;

        return NextResponse.json({
            success: true,
            message: "Seeded 40 test users into players and lobby.",
            count: users.length,
        });
    } catch (err) {
        console.error("Seeding error:", err);
        return NextResponse.json(
            { error: "Failed to seed data", details: err },
            { status: 500 }
        );
    }
}
