"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Users,
    Shuffle,
    UserCheck,
    ArrowLeft,
    CheckCircle2,
    XCircle,
    ImageIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState } from "@/lib/types";
import GameStatusBadge from "@/components/GameStatusBadge";

export default function AdminTeamFormationPage() {
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [gameStatus, setGameStatus] = useState<GameState["status"]>("waiting");
    const [loading, setLoading] = useState("");
    const [message, setMessage] = useState("");
    const [shuffleCount, setShuffleCount] = useState(0);

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
        const teamsSub = supabase
            .channel("admin-team-formation")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchTeams())
            .subscribe();
        const gameSub = supabase
            .channel("admin-game-formation")
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, (payload) => {
                setGameStatus((payload.new as GameState).status);
            })
            .subscribe();
        return () => {
            supabase.removeChannel(teamsSub);
            supabase.removeChannel(gameSub);
        };
    }, [fetchTeams]);

    // Shuffle teams
    const shuffleTeams = async () => {
        setLoading("shuffle");
        setMessage("");
        try {
            const res = await fetch("/api/game/shuffle", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setShuffleCount((c) => c + 1);
                setMessage(
                    `🔀 Teams reshuffled! (Shuffle #${shuffleCount + 1}) — ${data.teamsCreated} teams, ${data.totalPlayers} players`
                );
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Network error");
        }
        setLoading("");
    };

    const allApproved = teams.length > 0 && teams.every((t) => t.approved);
    const approvedCount = teams.filter((t) => t.approved).length;

    return (
        <div className="min-h-screen">
            {/* Admin Header */}
            <div className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push("/admin")}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <span
                                className="text-lg font-bold"
                                style={{ fontFamily: "var(--font-display)" }}
                            >
                                <span className="text-orange-500">TEAM</span>{" "}
                                <span className="text-white">FORMATION</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <GameStatusBadge status={gameStatus} variant="admin" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-24 px-4 max-w-6xl mx-auto pb-12">
                {/* Controls */}
                <div className="glass-card-elevated p-6 mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Users className="w-6 h-6 text-orange-500" />
                                Team Management
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">
                                {teams.length} teams • {approvedCount}/{teams.length} confirmed
                                {shuffleCount > 0 && ` • ${shuffleCount} shuffles`}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={shuffleTeams}
                                disabled={loading === "shuffle" || teams.length === 0}
                                className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
                            >
                                {loading === "shuffle" ? (
                                    <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                                ) : (
                                    <Shuffle className="w-4 h-4" />
                                )}
                                Shuffle Teams
                            </button>
                        </div>
                    </div>

                    {/* Approval status bar */}
                    {teams.length > 0 && (
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                                <span>Team Photo Confirmation Progress</span>
                                <span>{approvedCount}/{teams.length}</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all duration-500 ${allApproved ? "bg-green-500" : "bg-orange-500"
                                        }`}
                                    style={{ width: `${(approvedCount / teams.length) * 100}%` }}
                                />
                            </div>
                            {allApproved && (
                                <p className="text-green-400 text-xs mt-2 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    All teams confirmed! You can manage the game from the admin panel.
                                </p>
                            )}
                        </div>
                    )}

                    {message && (
                        <p className="mt-3 text-sm text-white bg-white/5 rounded-lg px-4 py-2">
                            {message}
                        </p>
                    )}
                </div>

                {/* Teams Grid */}
                {teams.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">
                            No Teams Formed Yet
                        </h2>
                        <p className="text-gray-400 max-w-md mx-auto">
                            Start the game from the{" "}
                            <a href="/admin" className="text-orange-400 hover:underline">
                                admin panel
                            </a>{" "}
                            to form teams from lobby players.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {teams.map((team, idx) => (
                            <motion.div
                                key={team.team_id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className={`glass-card p-5 border ${team.approved
                                        ? "border-green-500/10"
                                        : "border-yellow-500/10"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-white font-bold text-lg">{team.name}</h3>
                                        <p className="text-gray-600 text-xs font-mono">{team.team_id}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {team.image_url && (
                                            <ImageIcon className="w-4 h-4 text-blue-400" />
                                        )}
                                        {team.approved ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-yellow-400" />
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {team.members.map((m, mIdx) => (
                                        <div
                                            key={mIdx}
                                            className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/5"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 font-bold text-sm">
                                                {m.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm truncate ${m.eliminated
                                                        ? "text-red-400 line-through"
                                                        : "text-white"
                                                    }`}>
                                                    {m.name}
                                                </p>
                                                <p className="text-gray-500 text-xs truncate">{m.email}</p>
                                            </div>
                                            {m.eliminated ? (
                                                <span className="text-red-400 text-xs">💀</span>
                                            ) : (
                                                <UserCheck className="w-4 h-4 text-green-400/50" />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                                    <span>{team.members.length} members</span>
                                    <span>{team.points} pts</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
