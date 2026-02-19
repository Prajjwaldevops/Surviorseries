"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Trophy, BarChart3, Timer, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState, GameTimer, ScoreLog } from "@/lib/types";
import Leaderboard from "@/components/Leaderboard";
import StandingsChart from "@/components/StandingsChart";
import TimeChart from "@/components/TimeChart";
import PlayerProfile from "@/components/PlayerProfile";

export default function StandingsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [timer, setTimer] = useState<GameTimer | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [scoreLogs, setScoreLogs] = useState<ScoreLog[]>([]);
    const [selectedPlayerUserId, setSelectedPlayerUserId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        const { data: t } = await supabase.from("teams").select("*").order("rank", { ascending: true });
        if (t) setTeams(t);

        const { data: p } = await supabase.from("players").select("*");
        if (p) setPlayers(p);

        const { data: gs } = await supabase.from("game_state").select("*").single();
        if (gs) setGameState(gs);

        const { data: tm } = await supabase.from("game_timer").select("*").single();
        if (tm) setTimer(tm);
    }, []);

    const fetchTeamLogs = useCallback(async (teamId: string) => {
        const { data } = await supabase
            .from("score_log")
            .select("*")
            .eq("team_id", teamId)
            .order("created_at", { ascending: false })
            .limit(100);
        if (data) setScoreLogs(data);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Realtime
    useEffect(() => {
        const sub = supabase
            .channel("standings-public")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_timer" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "score_log" }, () => {
                if (selectedTeam) fetchTeamLogs(selectedTeam);
            })
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [fetchData, fetchTeamLogs, selectedTeam]);

    // Timer display
    const [displayTime, setDisplayTime] = useState(0);
    useEffect(() => {
        if (!timer) return;
        if (!timer.running) { setDisplayTime(timer.elapsed_seconds); return; }
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

    const statusLabels: Record<string, string> = {
        waiting: "⏳ Waiting to Start",
        team_formation: "📋 Forming Teams",
        image_upload: "📸 Image Upload",
        playing: "🎮 Live — Playing",
        round_complete: "⏹️ Round Complete",
        finished: "🏆 Game Finished",
    };

    return (
        <div className="min-h-screen">
            {selectedPlayerUserId && (
                <PlayerProfile
                    userId={selectedPlayerUserId}
                    onClose={() => setSelectedPlayerUserId(null)}
                />
            )}
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                                <Trophy className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                                <span className="text-orange-500">LIVE</span>{" "}
                                <span className="text-white">STANDINGS</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-full">
                                {statusLabels[gameState?.status || "waiting"]}
                            </span>
                            {gameState && gameState.current_round > 0 && (
                                <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full">
                                    R{gameState.current_round}
                                </span>
                            )}
                            {timer && (
                                <div className="flex items-center gap-1.5 text-xs bg-black/30 px-3 py-1 rounded-full border border-white/10">
                                    <Timer className={`w-3 h-3 ${timer.running ? "text-green-400 animate-pulse" : "text-gray-500"}`} />
                                    <span className="text-white font-mono">{formatTime(displayTime)}</span>
                                </div>
                            )}
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Public View
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-24 px-4 max-w-7xl mx-auto pb-12">
                {/* Game Info Banner */}
                {gameState?.status === "finished" && teams.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card-elevated p-6 text-center mb-8">
                        <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                        <h2 className="text-2xl font-bold text-white mb-1">
                            🏆 Winner: {teams.find((t) => t.rank === 1)?.name}
                        </h2>
                        <p className="text-orange-400 font-bold text-lg">
                            {teams.find((t) => t.rank === 1)?.points} points
                        </p>
                        <p className="text-gray-500 text-sm mt-1">
                            Time: {formatTime(displayTime)}
                        </p>
                    </motion.div>
                )}

                {/* Main Content */}
                {teams.length === 0 ? (
                    <div className="glass-card p-12 text-center text-gray-500">
                        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No teams yet. The game hasn&apos;t started.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <Leaderboard teams={teams} />
                            <StandingsChart teams={teams} />
                        </div>
                        <div className="mb-8">
                            <TimeChart teams={teams} />
                        </div>
                    </>
                )}

                {/* Team Detail View */}
                {teams.length > 0 && (
                    <div className="glass-card-elevated p-6">
                        <h3 className="text-lg font-bold text-white mb-4">
                            📋 Team Details — Click team to view
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {teams.map((t) => (
                                <button
                                    key={t.team_id}
                                    onClick={() => { setSelectedTeam(t.team_id); fetchTeamLogs(t.team_id); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedTeam === t.team_id
                                        ? "bg-orange-500/20 border border-orange-500/30 text-orange-400"
                                        : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                                        }`}
                                >
                                    #{t.rank} {t.name} ({t.points} pts)
                                </button>
                            ))}
                        </div>

                        {selectedTeam && (() => {
                            const team = teams.find((t) => t.team_id === selectedTeam);
                            if (!team) return null;
                            return (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <h4 className="text-white font-bold">{team.name}</h4>
                                            <p className="text-gray-500 text-xs font-mono">{team.team_id}</p>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <p className="text-2xl font-bold text-orange-400">{team.points}</p>
                                            <p className="text-gray-500 text-xs">Total Points</p>
                                        </div>
                                    </div>

                                    {/* Round breakdown (points + times) */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {[1, 2, 3, 4].map((r) => {
                                            const rk = `r${r}` as keyof typeof team.round_points;
                                            const timeKey = `r${r}`;
                                            const roundTime = team.round_times?.[timeKey] || 0;
                                            return (
                                                <div key={r} className={`text-center p-2 rounded-lg border ${r === (gameState?.current_round || 0) ? "bg-orange-500/10 border-orange-500/20" : "bg-white/[0.02] border-white/5"}`}>
                                                    <p className="text-gray-500 text-xs">R{r}</p>
                                                    <p className="text-white font-bold">{team.round_points?.[rk] || 0}</p>
                                                    {roundTime > 0 && (
                                                        <p className="text-gray-500 text-[10px]">⏱ {formatTime(roundTime)}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Members */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {team.members.map((m) => {
                                            const pInfo = players.find(p => p.user_id === m.userId);
                                            return (
                                                <div key={m.userId} className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${m.eliminated ? "bg-red-500/5 border-red-500/20" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"}`}>
                                                    <button
                                                        onClick={() => setSelectedPlayerUserId(m.userId)}
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${m.eliminated ? "bg-red-500/20 text-red-400" : "bg-orange-500/10 text-orange-400 hover:ring-2 hover:ring-orange-500/50"}`}
                                                    >
                                                        {m.eliminated ? "💀" : m.name.charAt(0).toUpperCase()}
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <button
                                                            onClick={() => setSelectedPlayerUserId(m.userId)}
                                                            className={`truncate text-left w-full hover:text-orange-400 transition-colors ${m.eliminated ? "text-red-300 line-through" : "text-white"}`}
                                                        >
                                                            {m.name}
                                                        </button>
                                                        {pInfo && (
                                                            <div className="text-[10px] text-gray-400">{pInfo.points} pts</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Team Image */}
                                    {team.image_url && (
                                        <div className="mt-2">
                                            <p className="text-gray-500 text-xs mb-2">Team Photo:</p>
                                            <img src={team.image_url} alt={`Team ${team.team_id}`} className="max-h-48 rounded-xl border border-white/10" />
                                        </div>
                                    )}

                                    {/* Point Log */}
                                    <div>
                                        <p className="text-gray-400 text-xs font-bold mb-2">Point History:</p>
                                        <div className="max-h-64 overflow-y-auto border border-white/5 rounded-lg p-3 bg-black/20">
                                            {scoreLogs.length === 0 ? (
                                                <p className="text-gray-600 text-xs text-center">No entries yet.</p>
                                            ) : (
                                                scoreLogs.map((log) => (
                                                    <div key={log.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-white/3 last:border-0">
                                                        <span className={`font-mono font-bold w-12 text-right ${log.delta > 0 ? "text-green-400" : "text-red-400"}`}>
                                                            {log.delta > 0 ? "+" : ""}{log.delta}
                                                        </span>
                                                        <span className="text-gray-500 w-8">R{log.round}</span>
                                                        <span className="text-gray-300 flex-1 truncate">{log.description}</span>
                                                        <span className="text-gray-600 text-[10px]">{new Date(log.created_at).toLocaleTimeString()}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}
