import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/game/export
 * Export game data as an Excel file (.xlsx)
 */
export async function GET() {
    try {
        const { data: teams } = await supabase.from("teams").select("*").order("rank", { ascending: true });
        const { data: scoreLogs } = await supabase.from("score_log").select("*").order("created_at", { ascending: true });
        const { data: gameState } = await supabase.from("game_state").select("*").single();
        const { data: timer } = await supabase.from("game_timer").select("*").single();

        const wb = XLSX.utils.book_new();

        // Sheet 1: Standings
        const standingsData = (teams || []).map((t) => ({
            Rank: t.rank,
            "Team Name": t.name,
            "Team ID": t.team_id,
            "Total Points": t.points,
            "R1 Points": t.round_points?.r1 || 0,
            "R2 Points": t.round_points?.r2 || 0,
            "R3 Points": t.round_points?.r3 || 0,
            "R4 Points": t.round_points?.r4 || 0,
            Members: t.members.map((m: { name: string; eliminated: boolean }) => `${m.name}${m.eliminated ? " ❌" : ""}`).join(", "),
            "Image URL": t.image_url || "N/A",
            "Image Approved": t.image_approved ? "Yes" : "No",
        }));
        const ws1 = XLSX.utils.json_to_sheet(standingsData);
        XLSX.utils.book_append_sheet(wb, ws1, "Standings");

        // Sheet 2: Score Log
        const logData = (scoreLogs || []).map((log) => ({
            Time: new Date(log.created_at).toLocaleString(),
            Round: log.round,
            "Team ID": log.team_id,
            Delta: log.delta,
            "New Total": log.new_total,
            Description: log.description,
        }));
        const ws2 = XLSX.utils.json_to_sheet(logData);
        XLSX.utils.book_append_sheet(wb, ws2, "Score Log");

        // Sheet 3: Team Members
        const memberData: Record<string, string | boolean>[] = [];
        (teams || []).forEach((t) => {
            t.members.forEach((m: { name: string; email: string; userId: string; eliminated: boolean }) => {
                memberData.push({
                    "Team Name": t.name,
                    "Team ID": t.team_id,
                    "Member Name": m.name,
                    Email: m.email,
                    "User ID": m.userId,
                    Eliminated: m.eliminated ? "Yes" : "No",
                });
            });
        });
        const ws3 = XLSX.utils.json_to_sheet(memberData);
        XLSX.utils.book_append_sheet(wb, ws3, "Team Members");

        // Sheet 4: Game Info
        const infoData = [
            { Key: "Status", Value: gameState?.status || "N/A" },
            { Key: "Current Round", Value: gameState?.current_round || 0 },
            { Key: "Timer (seconds)", Value: timer?.elapsed_seconds || 0 },
            { Key: "Timer Running", Value: timer?.running ? "Yes" : "No" },
            { Key: "Total Teams", Value: teams?.length || 0 },
            { Key: "Total Log Entries", Value: scoreLogs?.length || 0 },
            { Key: "Export Date", Value: new Date().toLocaleString() },
        ];
        const ws4 = XLSX.utils.json_to_sheet(infoData);
        XLSX.utils.book_append_sheet(wb, ws4, "Game Info");

        // Generate buffer
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="survivor-series-export-${Date.now()}.xlsx"`,
            },
        });
    } catch (err) {
        console.error("Export error:", err);
        return NextResponse.json({ error: "Failed to export" }, { status: 500 });
    }
}
