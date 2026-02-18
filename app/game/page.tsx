"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Trophy, Timer, Target, Users, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState, GameTimer, ScoreLog } from "@/lib/types";
import Navbar from "@/components/Navbar";
import Leaderboard from "@/components/Leaderboard";
import StandingsChart from "@/components/StandingsChart";

export default function GamePage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [myTeam, setMyTeam] = useState<Team | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [timer, setTimer] = useState<GameTimer | null>(null);
    const [scoreLogs, setScoreLogs] = useState<ScoreLog[]>([]);
    const [viewingTeamLogs, setViewingTeamLogs] = useState<string | null>(null);

    const isTestUser =
        typeof document !== "undefined" &&
        document.cookie.includes("survivor_test_user=authenticated");
    const currentUserId = isTestUser ? "test-user-bypass" : user?.id;

    const fetchData = useCallback(async () => {
        if (!currentUserId) return;

        const { data: gs } = await supabase.from("game_state").select("*").single();
        if (gs) setGameState(gs);

        const { data: t } = await supabase.from("teams").select("*").order("rank", { ascending: true });
        if (t) {
            setTeams(t);
            const mine = t.find((team: Team) => team.members.some((m) => m.userId === currentUserId));
            setMyTeam(mine || null);
        }

        const { data: tm } = await supabase.from("game_timer").select("*").single();
        if (tm) setTimer(tm);
    }, [currentUserId]);

    const fetchTeamLogs = useCallback(async (teamId: string) => {
        const { data } = await supabase
            .from("score_log")
            .select("*")
            .eq("team_id", teamId)
            .order("created_at", { ascending: false })
            .limit(50);
        if (data) setScoreLogs(data);
    }, []);

    useEffect(() => {
        if (isLoaded || isTestUser) fetchData();
    }, [isLoaded, isTestUser, fetchData]);

    // Realtime
    useEffect(() => {
        const sub = supabase
            .channel("game-page-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_timer" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "score_log" }, () => {
                if (viewingTeamLogs) fetchTeamLogs(viewingTeamLogs);
            })
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [fetchData, fetchTeamLogs, viewingTeamLogs]);

    // Redirect if game enters team_formation (between rounds)
    useEffect(() => {
        if (!gameState) return;
        if (gameState.status === "team_formation") {
            router.push("/team");
        } else if (gameState.status === "image_upload") {
            router.push("/team-photo");
        }
    }, [gameState, router]);

    // Timer display
    const [displayTime, setDisplayTime] = useState(0);
    useEffect(() => {
        if (!timer) return;
        if (!timer.running) {
            setDisplayTime(timer.elapsed_seconds);
            return;
        }
        const startedAt = new Date(timer.started_at!).getTime();
        const interval = setInterval(() => {
            setDisplayTime(timer.elapsed_seconds + Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [timer]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    };

    if (!isLoaded && !isTestUser) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
        );
    }

    const currentRound = gameState?.current_round || 1;

    return (
        <div className="min-h-screen">
            <Navbar />
            <div className="pt-24 px-4 max-w-7xl mx-auto pb-12">
                {/* Round Header */}
                <div className="text-center mb-8">
                    {/* Round Progress */}
                    <div className="flex items-center justify-center gap-2 mb-6">
                        {[1, 2, 3, 4].map((r) => (
                            <div key={r} className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${r === currentRound
                                        ? "bg-orange-500 text-white scale-110 shadow-lg shadow-orange-500/30"
                                        : r < currentRound
                                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                            : "bg-white/5 text-gray-500 border border-white/10"
                                    }`}>
                                    {r < currentRound ? "✓" : r}
                                </div>
                                {r < 4 && (
                                    <div className={`w-8 h-0.5 ${r < currentRound ? "bg-green-500/50" : "bg-white/10"}`} />
                                )}
                            </div>
                        ))}
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
                        <Target className="inline w-8 h-8 text-orange-500 mr-2 -mt-1" />
                        Round {currentRound}
                    </h1>

                    {/* Timer */}
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-black/40 border border-white/10 mt-4">
                        <Timer className={`w-5 h-5 ${timer?.running ? "text-green-400 animate-pulse" : "text-gray-500"}`} />
                        <span className="text-white font-mono text-2xl">{formatTime(displayTime)}</span>
                    </div>

                    {gameState?.status === "round_complete" && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                            <span className="px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium">
                                ⏹️ Round Complete — Waiting for admin
                            </span>
                        </motion.div>
                    )}

                    {gameState?.status === "finished" && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-4">
                            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                                <Trophy className="w-6 h-6 text-yellow-400" />
                                <span className="text-yellow-400 font-bold text-lg">Game Finished!</span>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* My Team Card */}
                {myTeam && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card-elevated p-6 mb-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
                                <Shield className="w-7 h-7 text-white" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-white">{myTeam.name}</h2>
                                <p className="text-gray-500 font-mono text-sm">{myTeam.team_id} • Rank #{myTeam.rank}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-bold text-orange-400">{myTeam.points}</p>
                                <p className="text-gray-500 text-xs">Total Points</p>
                            </div>
                        </div>

                        {/* Round Points Breakdown */}
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {[1, 2, 3, 4].map((r) => {
                                const rk = `r${r}` as keyof typeof myTeam.round_points;
                                return (
                                    <div key={r} className={`text-center p-2 rounded-lg border ${r === currentRound ? "bg-orange-500/10 border-orange-500/20" : "bg-white/[0.02] border-white/5"}`}>
                                        <p className="text-gray-500 text-xs">R{r}</p>
                                        <p className="text-white font-bold">{myTeam.round_points?.[rk] || 0}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Team Members */}
                        <div className="grid grid-cols-2 gap-2">
                            {myTeam.members.map((m) => (
                                <div key={m.userId} className={`flex items-center gap-2 p-2 rounded-lg border ${m.eliminated
                                        ? "bg-red-500/5 border-red-500/20"
                                        : m.userId === currentUserId
                                            ? "bg-orange-500/10 border-orange-500/20"
                                            : "bg-white/[0.02] border-white/5"
                                    }`}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${m.eliminated ? "bg-red-500/20 text-red-400" : "bg-orange-500/10 text-orange-400"
                                        }`}>
                                        {m.eliminated ? "💀" : m.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm truncate ${m.eliminated ? "text-red-300 line-through" : "text-white"}`}>
                                            {m.name}
                                            {m.userId === currentUserId && <span className="text-orange-400 text-xs ml-1">(You)</span>}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Leaderboard + Chart Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div>
                        <Leaderboard teams={teams} />
                        {/* Click to view team details */}
                        <div className="mt-4 glass-card p-4">
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-orange-500" />
                                Team Details — Click team to view point log
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {teams.map((t) => (
                                    <button
                                        key={t.team_id}
                                        onClick={() => { setViewingTeamLogs(t.team_id); fetchTeamLogs(t.team_id); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewingTeamLogs === t.team_id
                                                ? "bg-orange-500/20 border border-orange-500/30 text-orange-400"
                                                : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"
                                            }`}
                                    >
                                        {t.name} ({t.points})
                                    </button>
                                ))}
                            </div>
                            {viewingTeamLogs && (
                                <div className="mt-3 max-h-48 overflow-y-auto border-t border-white/5 pt-3">
                                    {scoreLogs.length === 0 ? (
                                        <p className="text-xs text-gray-600">No point entries yet.</p>
                                    ) : (
                                        scoreLogs.map((log) => (
                                            <div key={log.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-white/3">
                                                <span className={`font-mono font-bold w-12 text-right ${log.delta > 0 ? "text-green-400" : "text-red-400"}`}>
                                                    {log.delta > 0 ? "+" : ""}{log.delta}
                                                </span>
                                                <span className="text-gray-500">R{log.round}</span>
                                                <span className="text-gray-300 flex-1 truncate">{log.description}</span>
                                                <span className="text-gray-600 text-[10px]">{new Date(log.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <StandingsChart teams={teams} />
                </div>
            </div>
        </div>
    );
}
