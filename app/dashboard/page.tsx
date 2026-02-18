"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import type { Team, GameState } from "@/lib/types";
import Navbar from "@/components/Navbar";
import TeamCard from "@/components/TeamCard";
import Leaderboard from "@/components/Leaderboard";
import StandingsChart from "@/components/StandingsChart";
import GameStatusBadge from "@/components/GameStatusBadge";
import ConfettiWinner from "@/components/ConfettiWinner";
import { User, Mail } from "lucide-react";

export default function DashboardPage() {
    const { user, isLoaded } = useUser();
    const [teams, setTeams] = useState<Team[]>([]);
    const [myTeam, setMyTeam] = useState<Team | null>(null);
    const [gameStatus, setGameStatus] = useState<GameState["status"]>("waiting");
    const [showWinner, setShowWinner] = useState(false);
    const prevRanksRef = useRef<Record<string, number>>({});

    // Check for test user
    const isTestUser =
        typeof document !== "undefined" &&
        document.cookie.includes("survivor_test_user=authenticated");
    const currentUserId = isTestUser ? "test-user-bypass" : user?.id;
    const currentName = isTestUser ? "Test Player" : user?.fullName || user?.firstName || "Player";
    const currentEmail = isTestUser ? "test@gmail.com" : user?.emailAddresses?.[0]?.emailAddress || "";
    const currentAvatar = isTestUser ? null : user?.imageUrl;

    // Fetch teams
    const fetchTeams = useCallback(async () => {
        const { data } = await supabase
            .from("teams")
            .select("*")
            .order("rank", { ascending: true });

        if (data) {
            // Save previous ranks for animation
            const prev: Record<string, number> = {};
            teams.forEach((t) => (prev[t.team_id] = t.rank));
            prevRanksRef.current = prev;

            setTeams(data);

            // Find my team
            if (currentUserId) {
                const mine = data.find((t) =>
                    t.members.some(
                        (m: { userId: string }) => m.userId === currentUserId
                    )
                );
                setMyTeam(mine || null);
            }
        }
    }, [currentUserId, teams]);

    // Fetch game state
    const fetchGameState = useCallback(async () => {
        const { data } = await supabase
            .from("game_state")
            .select("*")
            .single();
        if (data) {
            setGameStatus(data.status);
            if (data.status === "finished") {
                setShowWinner(true);
            }
        }
    }, []);

    // Initialize
    useEffect(() => {
        if (isLoaded || isTestUser) {
            fetchTeams();
            fetchGameState();
        }
    }, [isLoaded, isTestUser, fetchTeams, fetchGameState]);

    // Realtime subscriptions
    useEffect(() => {
        const teamsSub = supabase
            .channel("teams-dashboard")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "teams" },
                () => fetchTeams()
            )
            .subscribe();

        const gameSub = supabase
            .channel("game-state-dashboard")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "game_state" },
                (payload) => {
                    const newStatus = (payload.new as GameState).status;
                    setGameStatus(newStatus);
                    if (newStatus === "finished") {
                        setShowWinner(true);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(teamsSub);
            supabase.removeChannel(gameSub);
        };
    }, [fetchTeams]);

    if (!isLoaded && !isTestUser) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
        );
    }

    const winner = teams.find((t) => t.rank === 1) || null;

    return (
        <div className="min-h-screen">
            <Navbar />

            {/* Winner overlay */}
            {showWinner && gameStatus === "finished" && (
                <ConfettiWinner
                    winner={winner}
                    standings={[...teams].sort((a, b) => a.rank - b.rank)}
                />
            )}

            <div className="pt-24 px-4 max-w-7xl mx-auto pb-12">
                {/* User Profile Card */}
                <div className="glass-card-elevated p-6 mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {currentAvatar ? (
                                <img
                                    src={currentAvatar}
                                    alt={currentName}
                                    className="w-14 h-14 rounded-2xl border-2 border-orange-500/30 object-cover"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/30 border border-orange-500/20 flex items-center justify-center">
                                    <User className="w-7 h-7 text-orange-400" />
                                </div>
                            )}
                            <div>
                                <h1
                                    className="text-xl sm:text-2xl font-bold text-white"
                                    style={{ fontFamily: "var(--font-display)" }}
                                >
                                    {currentName}
                                    {isTestUser && (
                                        <span className="text-green-400 text-sm font-normal ml-2">🧪</span>
                                    )}
                                </h1>
                                <div className="flex items-center gap-2 text-gray-400 text-sm mt-0.5">
                                    <Mail className="w-3.5 h-3.5" />
                                    {currentEmail}
                                </div>
                                {myTeam && (
                                    <p className="text-orange-400 text-sm mt-1 font-medium">
                                        {myTeam.name} • Rank #{myTeam.rank}
                                    </p>
                                )}
                            </div>
                        </div>
                        <GameStatusBadge status={gameStatus} />
                    </div>
                </div>

                {/* Dashboard Grid */}
                {gameStatus === "waiting" ? (
                    <div className="glass-card p-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⏳</span>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Waiting for Game to Start
                        </h2>
                        <p className="text-gray-400 max-w-md mx-auto">
                            Head to the{" "}
                            <a href="/lobby" className="text-orange-400 hover:underline">
                                lobby
                            </a>{" "}
                            and wait for the admin to start the game. Teams will be
                            formed automatically.
                        </p>
                    </div>
                ) : (
                    <div className="dashboard-grid">
                        {/* Team Info */}
                        <TeamCard team={myTeam} />

                        {/* Leaderboard */}
                        <Leaderboard
                            teams={teams}
                            previousRanks={prevRanksRef.current}
                        />

                        {/* Chart — full width */}
                        <div className="col-span-1 md:col-span-2 xl:col-span-1">
                            <StandingsChart teams={teams} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
