"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Users, UserCheck, Clock, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState } from "@/lib/types";
import Navbar from "@/components/Navbar";
import GameStatusBadge from "@/components/GameStatusBadge";

export default function TeamFormationPage() {
    const { user, isLoaded } = useUser();
    const [teams, setTeams] = useState<Team[]>([]);
    const [myTeam, setMyTeam] = useState<Team | null>(null);
    const [gameStatus, setGameStatus] = useState<GameState["status"]>("waiting");

    const isTestUser =
        typeof document !== "undefined" &&
        document.cookie.includes("survivor_test_user=authenticated");
    const currentUserId = isTestUser ? "test-user-bypass" : user?.id;

    const fetchTeams = useCallback(async () => {
        const { data } = await supabase
            .from("teams")
            .select("*")
            .order("rank", { ascending: true });
        if (data) {
            setTeams(data);
            if (currentUserId) {
                const mine = data.find((t: Team) =>
                    t.members.some((m) => m.userId === currentUserId)
                );
                setMyTeam(mine || null);
            }
        }
    }, [currentUserId]);

    const fetchGameState = useCallback(async () => {
        const { data } = await supabase
            .from("game_state")
            .select("status")
            .single();
        if (data) setGameStatus(data.status);
    }, []);

    useEffect(() => {
        if (isLoaded || isTestUser) {
            fetchTeams();
            fetchGameState();
        }
    }, [isLoaded, isTestUser, fetchTeams, fetchGameState]);

    // Realtime
    useEffect(() => {
        const teamsSub = supabase
            .channel("teams-formation")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchTeams())
            .subscribe();
        const gameSub = supabase
            .channel("game-formation")
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, (payload) => {
                setGameStatus((payload.new as GameState).status);
            })
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

    return (
        <div className="min-h-screen">
            <Navbar />
            <div className="pt-24 px-4 max-w-4xl mx-auto pb-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1
                            className="text-2xl sm:text-3xl font-bold text-white"
                            style={{ fontFamily: "var(--font-display)" }}
                        >
                            ⚔️ Team Formation
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Your team and all teams formed from the player pool
                        </p>
                    </div>
                    <GameStatusBadge status={gameStatus} />
                </div>

                {/* No teams yet */}
                {teams.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4 animate-pulse" />
                        <h2 className="text-xl font-bold text-white mb-2">
                            No Teams Yet
                        </h2>
                        <p className="text-gray-400 max-w-md mx-auto">
                            Teams will appear here once the admin starts the game. Head to the{" "}
                            <a href="/lobby" className="text-orange-400 hover:underline">lobby</a>{" "}
                            to join.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* My Team - Highlighted */}
                        {myTeam && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-card-elevated p-6 border-orange-500/20"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
                                            <Shield className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">
                                                {myTeam.name}
                                            </h2>
                                            <p className="text-gray-500 text-sm font-mono">
                                                {myTeam.team_id} • Your Team
                                            </p>
                                        </div>
                                    </div>
                                    {myTeam.approved ? (
                                        <span className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1.5 rounded-full flex items-center gap-1">
                                            <UserCheck className="w-3 h-3" /> Confirmed
                                        </span>
                                    ) : (
                                        <span className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-full animate-pulse">
                                            ⏳ Awaiting Photo
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {myTeam.members.map((m, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${m.userId === currentUserId
                                                    ? "bg-orange-500/10 border-orange-500/20"
                                                    : "bg-white/[0.02] border-white/5"
                                                }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/30 flex items-center justify-center text-orange-400 font-bold">
                                                {m.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-medium truncate">
                                                    {m.name}
                                                    {m.userId === currentUserId && (
                                                        <span className="text-orange-400 text-xs ml-1">(You)</span>
                                                    )}
                                                </p>
                                                <p className="text-gray-500 text-xs truncate">{m.email}</p>
                                            </div>
                                            {m.eliminated ? (
                                                <span className="text-red-400 text-xs">💀</span>
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-green-400" />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {!myTeam.approved && (
                                    <a
                                        href="/team-approval"
                                        className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
                                    >
                                        📸 Upload Team Photo to Confirm
                                    </a>
                                )}
                            </motion.div>
                        )}

                        {/* All teams */}
                        <div>
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-orange-500" />
                                All Teams ({teams.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {teams
                                    .filter((t) => t.team_id !== myTeam?.team_id)
                                    .map((team, idx) => (
                                        <motion.div
                                            key={team.team_id}
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="glass-card p-5"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h3 className="text-white font-bold">{team.name}</h3>
                                                    <p className="text-gray-600 text-xs font-mono">{team.team_id}</p>
                                                </div>
                                                {team.approved ? (
                                                    <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                                        Confirmed
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                                                        Awaiting Photo
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                {team.members.map((m, mIdx) => (
                                                    <div key={mIdx} className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 text-[10px] font-bold">
                                                            {m.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className={`text-sm truncate ${m.eliminated
                                                                ? "text-red-400 line-through"
                                                                : "text-gray-300"
                                                            }`}>
                                                            {m.name}
                                                        </span>
                                                        {m.eliminated && <span className="text-xs">💀</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
