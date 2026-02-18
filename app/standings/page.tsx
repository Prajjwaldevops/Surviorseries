"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState } from "@/lib/types";
import Navbar from "@/components/Navbar";
import Leaderboard from "@/components/Leaderboard";
import StandingsChart from "@/components/StandingsChart";
import GameStatusBadge from "@/components/GameStatusBadge";

export default function StandingsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [gameStatus, setGameStatus] = useState<GameState["status"]>("waiting");

    const fetchTeams = useCallback(async () => {
        const { data } = await supabase
            .from("teams")
            .select("*")
            .order("rank", { ascending: true });
        if (data) setTeams(data);
    }, []);

    const fetchGameState = useCallback(async () => {
        const { data } = await supabase
            .from("game_state")
            .select("status")
            .single();
        if (data) setGameStatus(data.status);
    }, []);

    useEffect(() => {
        fetchTeams();
        fetchGameState();
    }, [fetchTeams, fetchGameState]);

    // Realtime
    useEffect(() => {
        const sub = supabase
            .channel("standings-realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "teams" },
                () => fetchTeams()
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "game_state" },
                (payload) => {
                    setGameStatus((payload.new as GameState).status);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [fetchTeams]);

    return (
        <div className="min-h-screen">
            <Navbar />
            <div className="pt-24 px-4 max-w-5xl mx-auto pb-12">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                    <h1
                        className="text-2xl sm:text-3xl font-bold text-white"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        📊 Live Standings
                    </h1>
                    <GameStatusBadge status={gameStatus} />
                </div>

                <div className="space-y-6">
                    <Leaderboard teams={teams} />
                    <StandingsChart teams={teams} />
                </div>
            </div>
        </div>
    );
}
