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
    User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState, LobbyUser, ScoreLog, GameTimer, Player } from "@/lib/types";
import Leaderboard from "@/components/Leaderboard";
import StandingsChart from "@/components/StandingsChart";
import TimeChart from "@/components/TimeChart";
import GameStatusBadge from "@/components/GameStatusBadge";
import PlayerProfile from "@/components/PlayerProfile";

export default function AdminPage() {
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [lobbyUsers, setLobbyUsers] = useState<LobbyUser[]>([]);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [timer, setTimer] = useState<GameTimer | null>(null);
    const [loading, setLoading] = useState("");
    const [message, setMessage] = useState("");

    // Score input state
    const [scoreInputs, setScoreInputs] = useState<Record<string, { delta: string }>>({});
    const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
    const [scoreLogs, setScoreLogs] = useState<ScoreLog[]>([]);

    // Player scoring state
    const [playerScoreInputs, setPlayerScoreInputs] = useState<Record<string, { delta: string; desc: string }>>({});

    // Player profile modal
    const [selectedPlayerUserId, setSelectedPlayerUserId] = useState<string | null>(null);



    // Players data
    const [players, setPlayers] = useState<Player[]>([]);

    // Fetch functions
    const fetchTeams = useCallback(async () => {
        // Optimization: Select only necessary columns
        const { data } = await supabase
            .from("teams")
            .select("team_id, name, rank, points, round_points, round_times, members, image_url, eliminated, approved, image_approved")
            .order("rank", { ascending: true });
        if (data) setTeams(data as Team[]);
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

    const fetchPlayers = useCallback(async () => {
        const { data } = await supabase.from("players").select("*");
        if (data) setPlayers(data);
    }, []);

    useEffect(() => {
        fetchTeams();
        fetchLobby();
        fetchGameState();
        fetchTimer();
        fetchPlayers();
    }, [fetchTeams, fetchLobby, fetchGameState, fetchTimer, fetchPlayers]);

    // Realtime
    useEffect(() => {
        const sub = supabase
            .channel("admin-realtime-v3")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchTeams())
            .on("postgres_changes", { event: "*", schema: "public", table: "lobby" }, () => fetchLobby())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, () => fetchGameState())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_timer" }, () => fetchTimer())
            .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchPlayers())
            .on("postgres_changes", { event: "*", schema: "public", table: "score_log" }, () => {
                if (expandedTeam) fetchScoreLogs(expandedTeam);
            })
            .subscribe();

        return () => { supabase.removeChannel(sub); };
    }, [fetchTeams, fetchLobby, fetchGameState, fetchTimer, fetchPlayers, fetchScoreLogs, expandedTeam]);

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

    // Timer controls
    const startTimer = async () => {
        if (!timer) return;
        if (timer.elapsed_seconds > 0) {
            alert("Round finished! Reset the timer to start a new round.");
            return;
        }
        setLoading("timer");
        await apiCall("/api/game/timer", { action: "start" });
        setLoading("");
    };

    const stopTimer = async () => {
        setLoading("timer");
        await apiCall("/api/game/timer", { action: "stop" });
        setLoading("");
    };

    const resetTimer = async () => {
        if (!confirm("Reset timer for the next round?")) return;
        setLoading("timer");
        await apiCall("/api/game/timer", { action: "reset" });
        setLoading("");
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

    const handleScoreChange = async (teamId: string, delta: number) => {
        await apiCall("/api/game/score", {
            teamId,
            delta,
            round: gameState?.current_round || 1,
            description: delta > 0 ? "Points added" : "Points deducted",
        });
    };

    const handlePlayerScoreChange = async (userId: string, teamId: string, delta: number, description: string) => {
        await apiCall("/api/game/player-score", {
            userId,
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
        } catch { setMessage("❌ Network error"); }
    };

    const eliminateTeam = async (teamId: string, eliminated: boolean) => {
        if (!confirm(`Are you sure you want to ${eliminated ? "eliminate" : "reinstate"} this team?`)) return;
        try {
            const res = await apiCall("/api/game/team-eliminate", { teamId, eliminated });
            if (res.ok) setMessage(`✅ Team ${eliminated ? "eliminated" : "reinstated"}!`);
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
    const currentRound = gameState?.current_round || 1;

    // Helper: find player info for a member
    const getPlayerInfo = (userId: string) => players.find((p) => p.user_id === userId);

    return (
        <div className="min-h-screen">
            {/* Player Profile Modal */}
            {selectedPlayerUserId && (
                <PlayerProfile
                    userId={selectedPlayerUserId}
                    onClose={() => setSelectedPlayerUserId(null)}
                />
            )}

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
                            {/* Main Timer Display */}
                            <div className="flex items-center gap-1.5 text-xs bg-black/30 px-3 py-1 rounded-full border border-white/10">
                                <Timer className={`w-3 h-3 ${timer?.running ? "text-green-400 animate-pulse" : "text-gray-500"}`} />
                                <span className="text-white font-mono">{formatTime(displayTime)}</span>
                            </div>
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
                                {lobbyUsers.map((u) => {
                                    const pInfo = getPlayerInfo(u.user_id);
                                    return (
                                        <div key={u.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-sm">
                                            <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 text-xs font-bold">
                                                {u.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-white truncate text-xs">{u.name}</p>
                                                {pInfo && (
                                                    <p className="text-gray-500 truncate text-[10px]">
                                                        {pInfo.roll_no} • {pInfo.branch} • {pInfo.gender === "male" ? "♂" : "♀"}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
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
                                        🎮 Round {currentRound} — Playing
                                    </h2>
                                    <p className="text-gray-400 text-sm">Teams: {teams.length} • Click player name for profile</p>

                                    {/* Round Overview Stats */}
                                    <div className="flex gap-4 mt-2 text-xs font-mono text-gray-500">
                                        <span>Total: {teams.length}</span>
                                        <span className="text-red-400">Eliminated: {teams.filter(t => t.eliminated).length}</span>
                                        <span className="text-green-400">Active: {teams.filter(t => !t.eliminated).length}</span>
                                    </div>
                                </div>
                                {/* Timer */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 bg-black/30 rounded-xl px-4 py-2 border border-white/10">
                                        <Timer className="w-4 h-4 text-orange-400" />
                                        <span className="text-white font-mono text-xl">{formatTime(displayTime)}</span>
                                    </div>
                                    <button
                                        onClick={timer?.running ? stopTimer : startTimer}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium ${timer?.running ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}
                                    >
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
                                    End Round {currentRound}
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

                        {/* Per-Team Scoring & Player Controls */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Per-team scoring + per-player scoring */}
                            <div className="glass-card-elevated p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    🎯 Score & Player Control
                                </h3>
                                <div className="space-y-4">
                                    {teams.map((team) => (
                                        <div key={team.team_id} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] overflow-hidden">
                                            {/* Team header with gradient accent */}
                                            <div className="relative px-4 py-3 border-b border-white/5">
                                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-purple-500/5" />
                                                <div className="relative flex items-center justify-between">
                                                    <button onClick={() => { setExpandedTeam(expandedTeam === team.team_id ? null : team.team_id); if (expandedTeam !== team.team_id) fetchScoreLogs(team.team_id); }} className="text-left flex items-center gap-3">
                                                        {team.image_url && team.image_approved ? (
                                                            <img src={team.image_url} alt="" className="w-10 h-10 rounded-xl object-cover border-2 border-orange-500/20 shadow-lg shadow-orange-500/5" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center text-orange-400 text-sm font-bold border border-orange-500/20">
                                                                {team.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-white font-bold">{team.name}</p>
                                                            <p className="text-gray-500 text-[10px] font-mono">{team.team_id}</p>
                                                        </div>
                                                    </button>
                                                    <div className="flex items-center gap-2">
                                                        <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500/15 to-yellow-500/10 border border-orange-500/20">
                                                            <span className="text-orange-400 font-bold text-xl tabular-nums">{team.points}</span>
                                                            <span className="text-orange-400/50 text-[10px] ml-1">pts</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-3">
                                                {/* Team Actions */}
                                                <div className="flex gap-2">
                                                    {team.eliminated ? (
                                                        <button onClick={() => eliminateTeam(team.team_id, false)} className="px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/20">
                                                            Reinstate Team
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => eliminateTeam(team.team_id, true)} className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all ml-auto">
                                                            Eliminate Team
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Per-round time taken */}
                                                {team.round_times && Object.keys(team.round_times).length > 0 && (
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {Object.entries(team.round_times).map(([rk, sec]) => (
                                                            <span key={rk} className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                                                {rk.toUpperCase()}: {formatTime(sec as number)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Per-player listing */}
                                                <div className="space-y-1 border-t border-white/5 pt-3">
                                                    {team.members.map((member) => {
                                                        const pInfo = getPlayerInfo(member.userId);
                                                        const inputKey = `${team.team_id}_${member.userId}`;
                                                        return (
                                                            <div key={member.userId} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${member.eliminated ? "bg-red-500/5 border border-red-500/15" : "bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]"}`}>
                                                                <button
                                                                    onClick={() => setSelectedPlayerUserId(member.userId)}
                                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold cursor-pointer hover:ring-2 hover:ring-orange-500/50 transition-all ${member.eliminated ? "bg-red-500/20 text-red-400" : "bg-gradient-to-br from-orange-500/15 to-orange-600/10 text-orange-400"}`}
                                                                >
                                                                    {member.eliminated ? <Skull className="w-3 h-3" /> : member.name.charAt(0).toUpperCase()}
                                                                </button>
                                                                <button
                                                                    onClick={() => setSelectedPlayerUserId(member.userId)}
                                                                    className={`min-w-0 flex-shrink truncate cursor-pointer hover:text-orange-400 transition-colors ${member.eliminated ? "text-red-300 line-through" : "text-white"}`}
                                                                >
                                                                    {member.name}
                                                                </button>
                                                                {pInfo && (
                                                                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full ml-auto mr-1">{pInfo.points}pts</span>
                                                                )}

                                                                {/* Player point controls */}
                                                                {!member.eliminated && (
                                                                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                                                                        {/* Quick player actions */}
                                                                        <button
                                                                            onClick={() => handlePlayerScoreChange(member.userId, team.team_id, 5, "Quick +5")}
                                                                            className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 text-[10px] font-mono transition-all font-bold"
                                                                        >
                                                                            +5
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handlePlayerScoreChange(member.userId, team.team_id, -5, "Quick -5")}
                                                                            className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[10px] font-mono transition-all font-bold"
                                                                        >
                                                                            -5
                                                                        </button>

                                                                        <div className="h-4 w-px bg-white/10 mx-1" />

                                                                        <div className="flex items-center gap-1 bg-black/30 rounded-lg border border-white/10 p-0.5">
                                                                            <input
                                                                                type="number"
                                                                                placeholder="±"
                                                                                value={playerScoreInputs[inputKey]?.delta || ""}
                                                                                onChange={(e) => setPlayerScoreInputs({ ...playerScoreInputs, [inputKey]: { ...playerScoreInputs[inputKey], delta: e.target.value } })}
                                                                                className="w-10 px-1 py-0.5 bg-transparent text-white text-[10px] text-center focus:outline-none"
                                                                            />
                                                                            <button
                                                                                onClick={() => {
                                                                                    const d = parseInt(playerScoreInputs[inputKey]?.delta || "0");
                                                                                    if (d !== 0) {
                                                                                        handlePlayerScoreChange(member.userId, team.team_id, d, playerScoreInputs[inputKey]?.desc || `Points for ${member.name}`);
                                                                                        setPlayerScoreInputs({ ...playerScoreInputs, [inputKey]: { delta: "", desc: "" } });
                                                                                    }
                                                                                }}
                                                                                className="p-1 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/40 transition-all"
                                                                            >
                                                                                <Plus className="w-3 h-3" />
                                                                            </button>
                                                                        </div>

                                                                        {member.eliminated ? (
                                                                            <button onClick={() => reinstatePlayer(team.team_id, member.userId)} className="p-1 rounded bg-green-500/10 border border-green-500/20 text-green-400 transition-all">
                                                                                <ShieldCheck className="w-3 h-3" />
                                                                            </button>
                                                                        ) : (
                                                                            <button onClick={() => eliminatePlayer(team.team_id, member.userId)} className="p-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">
                                                                                <Skull className="w-3 h-3" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {member.eliminated && (
                                                                    <button onClick={() => reinstatePlayer(team.team_id, member.userId)} className="ml-auto px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] hover:bg-green-500/20 transition-all">
                                                                        Reinstate
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
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
                                                                    <span className="text-gray-400 flex-1 truncate">
                                                                        R{log.round}: {log.description}
                                                                        {log.player_user_id && (
                                                                            <button
                                                                                onClick={() => setSelectedPlayerUserId(log.player_user_id!)}
                                                                                className="ml-1 text-orange-400 hover:underline"
                                                                            >
                                                                                👤
                                                                            </button>
                                                                        )}
                                                                    </span>
                                                                    <span className="text-gray-600">{new Date(log.created_at).toLocaleTimeString()}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Leaderboard teams={teams} />
                        </div>

                        {/* Charts */}
                        {teams.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <StandingsChart teams={teams} />
                                <TimeChart teams={teams} />
                            </div>
                        )}
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
                            {(gameState?.current_round || 1) < 4 && (
                                <button onClick={nextRound} disabled={loading === "round"} className="btn-primary flex items-center gap-2 disabled:opacity-40">
                                    <ArrowRight className="w-4 h-4" />
                                    Advance to Round {(gameState?.current_round || 1) + 1}
                                </button>
                            )}
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
                                            {team.image_url && team.image_approved ? (
                                                <img src={team.image_url} alt="" className="w-8 h-8 rounded-full object-cover border border-orange-500/30" />
                                            ) : null}
                                            <h4 className="text-white font-bold text-sm">{team.name}</h4>
                                            <span className="text-gray-500 text-xs">{team.team_id}</span>
                                            <span className="text-orange-400 text-xs ml-auto font-bold">{team.points} pts</span>
                                        </div>
                                        {/* Round times */}
                                        {team.round_times && Object.keys(team.round_times).length > 0 && (
                                            <div className="flex gap-2 mb-2 flex-wrap">
                                                {Object.entries(team.round_times).map(([rk, sec]) => (
                                                    <span key={rk} className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                                                        {rk.toUpperCase()}: {formatTime(sec as number)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            {team.members.map((member) => (
                                                <div key={member.userId} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${member.eliminated ? "bg-red-500/5 border border-red-500/20" : "bg-white/[0.02] border border-white/5"}`}>
                                                    <button
                                                        onClick={() => setSelectedPlayerUserId(member.userId)}
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer hover:ring-2 hover:ring-orange-500/50 ${member.eliminated ? "bg-red-500/20 text-red-400" : "bg-orange-500/10 text-orange-400"}`}
                                                    >
                                                        {member.eliminated ? <Skull className="w-3 h-3" /> : member.name.charAt(0).toUpperCase()}
                                                    </button>
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
                        {teams.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                <StandingsChart teams={teams} />
                                <TimeChart teams={teams} />
                            </div>
                        )}
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
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <StandingsChart teams={teams} />
                            <TimeChart teams={teams} />
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
