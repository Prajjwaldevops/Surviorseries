"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Play,
    Square,
    RotateCcw,
    Users,
    LogOut,
    LayoutDashboard,
    Skull,
    ShieldCheck,
    ImageIcon,
    CheckCircle2,
    XCircle,
    Timer,
    Plus,
    Minus,
    Trophy,
    Shuffle,
    ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState, LobbyUser, ScoreLog, GameTimer } from "@/lib/types";
import Leaderboard from "@/components/Leaderboard";
import StandingsChart from "@/components/StandingsChart";
import GameStatusBadge from "@/components/GameStatusBadge";

export default function AdminPage() {
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [lobbyUsers, setLobbyUsers] = useState<LobbyUser[]>([]);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [timer, setTimer] = useState<GameTimer | null>(null);
    const [loading, setLoading] = useState("");
    const [message, setMessage] = useState("");

    // Score input state
    const [scoreInputs, setScoreInputs] = useState<Record<string, { delta: string; desc: string }>>({});
    const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
    const [scoreLogs, setScoreLogs] = useState<ScoreLog[]>([]);

    // Fetch functions
    const fetchTeams = useCallback(async () => {
        const { data } = await supabase.from("teams").select("*").order("rank", { ascending: true });
        if (data) setTeams(data);
    }, []);

    const fetchLobby = useCallback(async () => {
        const { data } = await supabase.from("lobby").select("*").order("joined_at", { ascending: true });
        if (data) setLobbyUsers(data);
    }, []);

    const fetchGameState = useCallback(async () => {
        const { data } = await supabase.from("game_state").select("*").single();
        if (data) setGameState(data);
    }, []);

    const fetchTimer = useCallback(async () => {
        const { data } = await supabase.from("game_timer").select("*").single();
        if (data) setTimer(data);
    }, []);

    const fetchScoreLogs = useCallback(async (teamId?: string) => {
        let query = supabase.from("score_log").select("*").order("created_at", { ascending: false }).limit(50);
        if (teamId) query = query.eq("team_id", teamId);
        const { data } = await query;
        if (data) setScoreLogs(data);
    }, []);

    useEffect(() => {
        fetchTeams();
        fetchLobby();
        fetchGameState();
        fetchTimer();
    }, [fetchTeams, fetchLobby, fetchGameState, fetchTimer]);

    // Realtime
    useEffect(() => {
        const sub = supabase
            .channel("admin-realtime-v2")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchTeams())
            .on("postgres_changes", { event: "*", schema: "public", table: "lobby" }, () => fetchLobby())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, () => fetchGameState())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_timer" }, () => fetchTimer())
            .on("postgres_changes", { event: "*", schema: "public", table: "score_log" }, () => {
                if (expandedTeam) fetchScoreLogs(expandedTeam);
            })
            .subscribe();

        return () => { supabase.removeChannel(sub); };
    }, [fetchTeams, fetchLobby, fetchGameState, fetchTimer, fetchScoreLogs, expandedTeam]);

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
            const now = Date.now();
            const elapsed = timer.elapsed_seconds + Math.floor((now - startedAt) / 1000);
            setDisplayTime(elapsed);
        }, 1000);
        return () => clearInterval(interval);
    }, [timer]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    };

    // Actions
    const apiCall = async (url: string, body?: Record<string, unknown>) => {
        const res = await fetch(url, {
            method: "POST",
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        return res;
    };

    const approveGame = async () => {
        setLoading("approve"); setMessage("");
        try {
            const res = await apiCall("/api/game/approve");
            const data = await res.json();
            if (res.ok) {
                setMessage(`✅ Game started! ${data.teamsCreated} teams created. Go to shuffle page.`);
            } else setMessage(`❌ ${data.error}`);
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    const finishGame = async () => {
        if (!confirm("Finish the game and declare standings?")) return;
        setLoading("finish"); setMessage("");
        try {
            const res = await apiCall("/api/game/finish");
            const data = await res.json();
            if (res.ok) setMessage(`🏆 Game finished! Winner: ${data.winner?.name || "N/A"}`);
            else setMessage(`❌ ${data.error}`);
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    const resetGame = async () => {
        if (!confirm("This will save game data and clear ALL data. Are you sure?")) return;
        setLoading("reset"); setMessage("");
        try {
            const res = await apiCall("/api/game/reset");
            if (res.ok) setMessage("🔄 Game reset. Data archived.");
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    const handleScoreChange = async (teamId: string, delta: number, description: string) => {
        await apiCall("/api/game/score", {
            teamId,
            delta,
            round: gameState?.current_round || 1,
            description: description || (delta > 0 ? "Points added" : "Points deducted"),
        });
    };

    const startRound = async () => {
        setLoading("round"); setMessage("");
        try {
            const res = await apiCall("/api/game/round", { action: "start" });
            const data = await res.json();
            if (res.ok) setMessage(`▶️ Round ${data.round} started!`);
            else setMessage(`❌ ${data.error}`);
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    const endRound = async () => {
        setLoading("round"); setMessage("");
        try {
            const res = await apiCall("/api/game/round", { action: "end" });
            const data = await res.json();
            if (res.ok) setMessage(`⏹️ Round ${data.round} ended!`);
            else setMessage(`❌ ${data.error}`);
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    const nextRound = async () => {
        setLoading("round"); setMessage("");
        try {
            const res = await apiCall("/api/game/round", { action: "next" });
            const data = await res.json();
            if (res.ok) setMessage(`➡️ Moving to Round ${data.round}!`);
            else setMessage(`❌ ${data.error}`);
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    const toggleTimer = async () => {
        const action = timer?.running ? "stop" : "start";
        await apiCall("/api/game/timer", { action });
    };

    const resetTimer = async () => {
        await apiCall("/api/game/timer", { action: "reset" });
    };

    const eliminatePlayer = async (teamId: string, userId: string) => {
        try {
            const res = await apiCall("/api/game/eliminate", { teamId, userId });
            if (res.ok) setMessage("💀 Player eliminated!");
            else { const d = await res.json(); setMessage(`❌ ${d.error}`); }
        } catch { setMessage("❌ Network error"); }
    };

    const reinstatePlayer = async (teamId: string, userId: string) => {
        try {
            const res = await apiCall("/api/game/reinstate", { teamId, userId });
            if (res.ok) setMessage("✅ Player reinstated!");
            else { const d = await res.json(); setMessage(`❌ ${d.error}`); }
        } catch { setMessage("❌ Network error"); }
    };

    const exportGame = async () => {
        setLoading("export"); setMessage("");
        try {
            const res = await fetch("/api/game/export");
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `survivor-series-export-${Date.now()}.xlsx`;
                a.click();
                URL.revokeObjectURL(url);
                setMessage("📥 Excel exported!");
            } else {
                const d = await res.json();
                setMessage(`❌ ${d.error}`);
            }
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    const logout = () => {
        document.cookie = "survivor_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push("/admin-login");
    };

    const gameStatus = gameState?.status || "waiting";

    return (
        <div className="min-h-screen">
            {/* Admin Header */}
            <div className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                                <LayoutDashboard className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                                <span className="text-orange-500">ADMIN</span>{" "}
                                <span className="text-white">PANEL</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <GameStatusBadge status={gameStatus} variant="admin" />
                            {gameState && gameState.current_round > 0 && (
                                <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full">
                                    Round {gameState.current_round}
                                </span>
                            )}
                            <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors text-sm">
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:block">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-24 px-4 max-w-7xl mx-auto pb-12">
                {/* Status Message */}
                {message && (
                    <div className="glass-card p-4 mb-6 text-sm text-white border-l-4 border-orange-500">
                        {message}
                    </div>
                )}

                {/* ===== PHASE: WAITING ===== */}
                {gameStatus === "waiting" && (
                    <>
                        <div className="glass-card-elevated p-6 mb-8">
                            <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
                                🎮 Game Controls
                            </h2>
                            <p className="text-gray-400 text-sm mb-4">Lobby: {lobbyUsers.length} players online</p>
                            <button
                                onClick={approveGame}
                                disabled={loading === "approve" || lobbyUsers.length < 1}
                                className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {loading === "approve" ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4" />
                                )}
                                Start Game & Form Teams
                            </button>
                        </div>

                        {/* Lobby Preview */}
                        <div className="glass-card p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-orange-500" />
                                Lobby Players ({lobbyUsers.length}/40)
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {lobbyUsers.map((u) => (
                                    <div key={u.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-sm">
                                        <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 text-xs font-bold">
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white truncate text-xs">{u.name}</p>
                                            <p className="text-gray-500 truncate text-[10px]">{u.email}</p>
                                        </div>
                                    </div>
                                ))}
                                {lobbyUsers.length === 0 && (
                                    <p className="text-gray-500 col-span-full text-center py-4">No players in lobby yet.</p>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ===== PHASE: TEAM FORMATION ===== */}
                {gameStatus === "team_formation" && (
                    <div className="glass-card-elevated p-6 mb-8">
                        <h2 className="text-xl font-bold text-white mb-2">📋 Team Formation Phase</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            Teams created. Shuffle or swap members, then finalize.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => router.push("/admin/shuffle")}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Shuffle className="w-4 h-4" />
                                Manage & Shuffle Teams
                            </button>
                        </div>
                    </div>
                )}

                {/* ===== PHASE: IMAGE UPLOAD ===== */}
                {gameStatus === "image_upload" && (
                    <div className="glass-card-elevated p-6 mb-8">
                        <h2 className="text-xl font-bold text-white mb-2">📸 Image Upload Phase</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            Teams are uploading photos. AdminX will approve images.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={startRound} disabled={loading === "round"} className="btn-primary flex items-center gap-2 disabled:opacity-40">
                                <Play className="w-4 h-4" />
                                Start Round {gameState?.current_round || 1}
                            </button>
                        </div>
                    </div>
                )}

                {/* ===== PHASE: PLAYING ===== */}
                {gameStatus === "playing" && (
                    <>
                        {/* Round Controls */}
                        <div className="glass-card-elevated p-6 mb-8">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                                        🎮 Round {gameState?.current_round || 1} — Playing
                                    </h2>
                                    <p className="text-gray-400 text-sm">Teams: {teams.length} • Click team for point details</p>
                                </div>
                                {/* Timer */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 bg-black/30 rounded-xl px-4 py-2 border border-white/10">
                                        <Timer className="w-4 h-4 text-orange-400" />
                                        <span className="text-white font-mono text-xl">{formatTime(displayTime)}</span>
                                    </div>
                                    <button onClick={toggleTimer} className={`px-3 py-2 rounded-lg text-sm font-medium ${timer?.running ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
                                        {timer?.running ? "Stop" : "Start"}
                                    </button>
                                    <button onClick={resetTimer} className="px-3 py-2 rounded-lg text-sm bg-white/5 text-gray-400 border border-white/10 hover:text-white">
                                        Reset
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button onClick={endRound} disabled={loading === "round"} className="btn-danger flex items-center gap-2 disabled:opacity-40">
                                    <Square className="w-4 h-4" />
                                    End Round {gameState?.current_round}
                                </button>
                                <button onClick={finishGame} disabled={loading === "finish"} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20">
                                    <Trophy className="w-4 h-4" />
                                    Finish Game
                                </button>
                                <button onClick={resetGame} disabled={loading === "reset"} className="btn-secondary flex items-center gap-2 disabled:opacity-40">
                                    <RotateCcw className="w-4 h-4" />
                                    Reset
                                </button>
                                <button onClick={exportGame} disabled={loading === "export"} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20">
                                    📥 Export Excel
                                </button>
                            </div>
                        </div>

                        {/* Score Controls + Details */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Per-team scoring */}
                            <div className="glass-card-elevated p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    🎯 Score Control
                                </h3>
                                <div className="space-y-3">
                                    {teams.map((team) => (
                                        <div key={team.team_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <button onClick={() => { setExpandedTeam(expandedTeam === team.team_id ? null : team.team_id); if (expandedTeam !== team.team_id) fetchScoreLogs(team.team_id); }} className="text-left">
                                                    <p className="text-white font-bold text-sm">{team.name}</p>
                                                    <p className="text-gray-500 text-xs">{team.team_id} • {team.points} pts</p>
                                                </button>
                                                <span className="text-orange-400 font-bold text-lg">{team.points}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="±pts"
                                                    value={scoreInputs[team.team_id]?.delta || ""}
                                                    onChange={(e) => setScoreInputs({ ...scoreInputs, [team.team_id]: { ...scoreInputs[team.team_id], delta: e.target.value } })}
                                                    className="w-20 px-2 py-1.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm text-center"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Description..."
                                                    value={scoreInputs[team.team_id]?.desc || ""}
                                                    onChange={(e) => setScoreInputs({ ...scoreInputs, [team.team_id]: { ...scoreInputs[team.team_id], desc: e.target.value } })}
                                                    className="flex-1 px-2 py-1.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const d = parseInt(scoreInputs[team.team_id]?.delta || "0");
                                                        if (d !== 0) {
                                                            handleScoreChange(team.team_id, d, scoreInputs[team.team_id]?.desc || "");
                                                            setScoreInputs({ ...scoreInputs, [team.team_id]: { delta: "", desc: "" } });
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 text-sm font-bold"
                                                >
                                                    <Plus className="w-4 h-4 inline" /> Apply
                                                </button>
                                            </div>

                                            {/* Expanded score log */}
                                            {expandedTeam === team.team_id && (
                                                <div className="mt-3 border-t border-white/5 pt-3 max-h-48 overflow-y-auto">
                                                    <p className="text-xs text-gray-400 mb-2 font-bold">Point History:</p>
                                                    {scoreLogs.filter(l => l.team_id === team.team_id).length === 0 ? (
                                                        <p className="text-xs text-gray-600">No entries yet.</p>
                                                    ) : (
                                                        scoreLogs.filter(l => l.team_id === team.team_id).map((log) => (
                                                            <div key={log.id} className="flex items-center gap-2 text-xs py-1 border-b border-white/3">
                                                                <span className={`font-mono font-bold ${log.delta > 0 ? "text-green-400" : "text-red-400"}`}>
                                                                    {log.delta > 0 ? "+" : ""}{log.delta}
                                                                </span>
                                                                <span className="text-gray-400 flex-1 truncate">R{log.round}: {log.description}</span>
                                                                <span className="text-gray-600">{new Date(log.created_at).toLocaleTimeString()}</span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Leaderboard teams={teams} />
                        </div>

                        {/* Elimination Panel */}
                        <div className="glass-card-elevated p-6 mb-8">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3" style={{ fontFamily: "var(--font-display)" }}>
                                <Skull className="w-6 h-6 text-red-500" />
                                Elimination Control
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {teams.map((team) => (
                                    <div key={team.team_id} className="glass-card p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-white font-bold text-sm">{team.name}</h3>
                                                <span className="text-gray-500 text-xs">{team.team_id}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {team.members.map((m, idx) => (
                                                    <div key={idx} className={`w-2.5 h-2.5 rounded-full ${m.eliminated ? "bg-red-500" : "bg-green-500"}`} title={m.name} />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mb-3">
                                            {team.image_approved ? (
                                                <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</span>
                                            ) : (
                                                <span className="text-xs text-yellow-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Pending</span>
                                            )}
                                            {team.image_url && <span className="text-xs text-blue-400 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Photo</span>}
                                        </div>
                                        <div className="space-y-2">
                                            {team.members.map((member) => (
                                                <div key={member.userId} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${member.eliminated ? "bg-red-500/5 border border-red-500/20" : "bg-white/[0.02] border border-white/5"}`}>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${member.eliminated ? "bg-red-500/20 text-red-400" : "bg-orange-500/10 text-orange-400"}`}>
                                                        {member.eliminated ? <Skull className="w-3 h-3" /> : member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`truncate ${member.eliminated ? "text-red-300 line-through" : "text-white"}`}>{member.name}</p>
                                                    </div>
                                                    {member.eliminated ? (
                                                        <button onClick={() => reinstatePlayer(team.team_id, member.userId)} className="px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors flex items-center gap-1">
                                                            <ShieldCheck className="w-3 h-3" /> Reinstate
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => eliminatePlayer(team.team_id, member.userId)} className="px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1">
                                                            <Skull className="w-3 h-3" /> Eliminate
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Chart */}
                        {teams.length > 0 && <StandingsChart teams={teams} />}
                    </>
                )}

                {/* ===== PHASE: ROUND COMPLETE ===== */}
                {gameStatus === "round_complete" && (
                    <div className="glass-card-elevated p-6 mb-8">
                        <h2 className="text-xl font-bold text-white mb-2">⏹️ Round {gameState?.current_round} Complete</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            Eliminate players, shuffle teams, then advance to next round.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => router.push("/admin/shuffle")}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
                            >
                                <Shuffle className="w-4 h-4" />
                                Shuffle Teams for Next Round
                            </button>
                            <button onClick={nextRound} disabled={loading === "round"} className="btn-primary flex items-center gap-2 disabled:opacity-40">
                                <ArrowRight className="w-4 h-4" />
                                Advance to Round {(gameState?.current_round || 1) + 1}
                            </button>
                            <button onClick={finishGame} disabled={loading === "finish"} className="btn-danger flex items-center gap-2 disabled:opacity-40">
                                <Trophy className="w-4 h-4" />
                                Finish Game
                            </button>
                            <button onClick={exportGame} disabled={loading === "export"} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20">
                                📥 Export Excel
                            </button>
                        </div>

                        {/* Elimination Panel in round_complete */}
                        <div className="mt-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Skull className="w-5 h-5 text-red-500" />
                                Eliminate Players Before Next Round
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {teams.map((team) => (
                                    <div key={team.team_id} className="glass-card p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <h4 className="text-white font-bold text-sm">{team.name}</h4>
                                            <span className="text-gray-500 text-xs">{team.team_id}</span>
                                            <span className="text-orange-400 text-xs ml-auto font-bold">{team.points} pts</span>
                                        </div>
                                        <div className="space-y-2">
                                            {team.members.map((member) => (
                                                <div key={member.userId} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${member.eliminated ? "bg-red-500/5 border border-red-500/20" : "bg-white/[0.02] border border-white/5"}`}>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${member.eliminated ? "bg-red-500/20 text-red-400" : "bg-orange-500/10 text-orange-400"}`}>
                                                        {member.eliminated ? <Skull className="w-3 h-3" /> : member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className={`flex-1 truncate ${member.eliminated ? "text-red-300 line-through" : "text-white"}`}>{member.name}</span>
                                                    {member.eliminated ? (
                                                        <button onClick={() => reinstatePlayer(team.team_id, member.userId)} className="px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]">Reinstate</button>
                                                    ) : (
                                                        <button onClick={() => eliminatePlayer(team.team_id, member.userId)} className="px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[10px]">Eliminate</button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {teams.length > 0 && <div className="mt-6"><Leaderboard teams={teams} /></div>}
                    </div>
                )}

                {/* ===== PHASE: FINISHED ===== */}
                {gameStatus === "finished" && (
                    <div className="space-y-6">
                        <div className="glass-card-elevated p-6 text-center">
                            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-2">🏆 Game Finished!</h2>
                            <p className="text-gray-400 mb-4">
                                Winner: <span className="text-orange-400 font-bold">{teams.find(t => t.rank === 1)?.name || "N/A"}</span> with {teams.find(t => t.rank === 1)?.points || 0} points
                            </p>
                            <div className="flex flex-wrap gap-3 justify-center">
                                <button onClick={exportGame} disabled={loading === "export"} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20">
                                    📥 Export Excel
                                </button>
                                <button onClick={resetGame} disabled={loading === "reset"} className="btn-secondary flex items-center gap-2 disabled:opacity-40">
                                    <RotateCcw className="w-4 h-4" /> Reset Game
                                </button>
                            </div>
                        </div>
                        <Leaderboard teams={teams} />
                        <StandingsChart teams={teams} />
                    </div>
                )}
            </div>
        </div>
    );
}
