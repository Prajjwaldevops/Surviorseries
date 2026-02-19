"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield, CheckCircle2, XCircle, LogOut, ImageIcon, Users, RefreshCw,
    BarChart3, GraduationCap, Users2, Hash, Timer
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from "recharts";
import { supabase } from "@/lib/supabase";
import type { Team, Player, GameState, TeamTimerRecord } from "@/lib/types";
import PlayerProfile from "@/components/PlayerProfile";

const PIE_COLORS = ["#3b82f6", "#ec4899"];
const BAR_COLORS = [
    "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#f43f5e",
    "#06b6d4", "#eab308", "#a855f7", "#14b8a6", "#f472b6",
    "#22d3ee", "#84cc16", "#e879f9"
];

export default function AdminXPage() {
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState<string>("");
    const [message, setMessage] = useState("");
    const [activeTab, setActiveTab] = useState<"images" | "stats" | "timers">("images");
    const [selectedPlayerUserId, setSelectedPlayerUserId] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [teamTimers, setTeamTimers] = useState<TeamTimerRecord[]>([]);

    const fetchTeams = useCallback(async () => {
        const { data } = await supabase.from("teams").select("*").order("rank", { ascending: true });
        if (data) setTeams(data);
    }, []);

    const fetchPlayers = useCallback(async () => {
        const { data } = await supabase.from("players").select("*").order("name", { ascending: true });
        if (data) setPlayers(data);
    }, []);

    const fetchGameState = useCallback(async () => {
        const { data } = await supabase.from("game_state").select("*").single();
        if (data) setGameState(data);
    }, []);

    const fetchTeamTimers = useCallback(async () => {
        const { data } = await supabase.from("team_timers").select("*").order("round", { ascending: true });
        if (data) setTeamTimers(data);
    }, []);

    useEffect(() => {
        fetchTeams();
        fetchPlayers();
        fetchGameState();
        fetchTeamTimers();
    }, [fetchTeams, fetchPlayers, fetchGameState, fetchTeamTimers]);

    useEffect(() => {
        const sub = supabase
            .channel("adminx-realtime-v3")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchTeams())
            .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchPlayers())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, () => fetchGameState())
            .on("postgres_changes", { event: "*", schema: "public", table: "team_timers" }, () => fetchTeamTimers())
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [fetchTeams, fetchPlayers, fetchGameState, fetchTeamTimers]);

    const approveImage = async (teamId: string) => {
        setLoading(teamId);
        setMessage("");
        try {
            const res = await fetch("/api/adminx/approve-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, action: "approve" }),
            });
            const data = await res.json();
            if (res.ok) setMessage(`✅ ${teamId} approved!`);
            else setMessage(`❌ ${data.error}`);
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    const disapproveImage = async (teamId: string) => {
        setLoading(teamId);
        setMessage("");
        try {
            const res = await fetch("/api/adminx/approve-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, action: "disapprove" }),
            });
            const data = await res.json();
            if (res.ok) setMessage(`🚫 ${teamId} disapproved. Team must re-upload.`);
            else setMessage(`❌ ${data.error}`);
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    const logout = () => {
        document.cookie = "survivor_adminx_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push("/adminx-login");
    };

    // Separate teams into pending and approved
    const pendingTeams = teams.filter((t) => t.image_url && !t.image_approved);
    const approvedTeams = teams.filter((t) => t.image_approved);
    const noImageTeams = teams.filter((t) => !t.image_url);

    // Timer helpers
    const currentRound = gameState?.current_round || 1;

    const getTeamTimerForRound = (teamId: string, round: number) => {
        return teamTimers.find((t) => t.team_id === teamId && t.round === round);
    };

    const isTeamTimerRunning = (teamId: string, round: number) => {
        const tt = getTeamTimerForRound(teamId, round);
        return tt?.started_at && !tt?.stopped_at;
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    };

    const stopTeamTimer = async (teamId: string) => {
        setLoading(teamId);
        setMessage("");
        try {
            const res = await fetch("/api/game/team-timer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "stop", teamId, round: currentRound }),
            });
            const data = await res.json();
            if (res.ok) setMessage(`⏱️ Time recorded for ${teamId}: ${formatTime(data.elapsed)}`);
            else setMessage(`❌ ${data.error}`);
        } catch { setMessage("❌ Network error"); }
        setLoading("");
    };

    // Live timer component
    const LiveTimer = ({ startedAt }: { startedAt: string }) => {
        const [elapsed, setElapsed] = useState(0);
        useEffect(() => {
            const start = new Date(startedAt).getTime();
            const interval = setInterval(() => {
                setElapsed(Math.floor((Date.now() - start) / 1000));
            }, 1000);
            return () => clearInterval(interval);
        }, [startedAt]);
        return <span className="font-mono text-xl text-green-400">{formatTime(elapsed)}</span>;
    };

    // Stats computations
    const branchData = (() => {
        const counts: Record<string, number> = {};
        players.forEach((p) => {
            counts[p.branch] = (counts[p.branch] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    })();

    const genderData = (() => {
        const male = players.filter((p) => p.gender === "male").length;
        const female = players.filter((p) => p.gender === "female").length;
        return [
            { name: "Male", value: male },
            { name: "Female", value: female },
        ];
    })();

    return (
        <div className="min-h-screen">
            {/* Player Profile Modal */}
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
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                                <Shield className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                                <span className="text-purple-400">ADMIN</span>
                                <span className="text-white">X</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Tabs */}
                            <div className="flex gap-1 bg-black/30 rounded-lg p-0.5 border border-white/10">
                                <button
                                    onClick={() => setActiveTab("images")}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "images" ? "bg-purple-500/20 text-purple-400" : "text-gray-400 hover:text-white"}`}
                                >
                                    <ImageIcon className="w-3 h-3 inline mr-1" />
                                    Images
                                </button>
                                <button
                                    onClick={() => setActiveTab("stats")}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "stats" ? "bg-purple-500/20 text-purple-400" : "text-gray-400 hover:text-white"}`}
                                >
                                    <BarChart3 className="w-3 h-3 inline mr-1" />
                                    Stats
                                </button>
                                <button
                                    onClick={() => setActiveTab("timers")}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "timers" ? "bg-purple-500/20 text-purple-400" : "text-gray-400 hover:text-white"}`}
                                >
                                    <Timer className="w-3 h-3 inline mr-1" />
                                    Timers
                                </button>
                            </div>
                            <span className="text-xs text-gray-400">
                                {activeTab === "images"
                                    ? `Pending: ${pendingTeams.length} • Approved: ${approvedTeams.length}`
                                    : activeTab === "timers"
                                        ? `Round ${currentRound} • ${teams.length} teams`
                                        : `${players.length} players registered`
                                }
                            </span>
                            <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors text-sm">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-24 px-4 max-w-7xl mx-auto pb-12">
                {message && (
                    <div className="glass-card p-4 mb-6 text-sm text-white border-l-4 border-purple-500">
                        {message}
                    </div>
                )}

                {/* ===== IMAGES TAB ===== */}
                {activeTab === "images" && (
                    <>
                        {/* Pending Approvals */}
                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-yellow-400" />
                                Pending Approval ({pendingTeams.length})
                            </h2>
                            {pendingTeams.length === 0 ? (
                                <div className="glass-card p-8 text-center text-gray-500">
                                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p>No pending images. All caught up! 🎉</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    <AnimatePresence>
                                        {pendingTeams.map((team) => (
                                            <motion.div
                                                key={team.team_id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="glass-card-elevated overflow-hidden"
                                            >
                                                {team.image_url && (
                                                    <div className="aspect-video bg-black/30 border-b border-white/5">
                                                        <img
                                                            src={team.image_url}
                                                            alt={`Team ${team.team_id}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                )}
                                                <div className="p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div>
                                                            <h3 className="text-white font-bold">{team.name}</h3>
                                                            <p className="text-gray-500 text-xs font-mono">{team.team_id}</p>
                                                        </div>
                                                        <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-full animate-pulse">
                                                            Pending
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1 mb-4">
                                                        {team.members.map((m, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                                                                <div className="w-4 h-4 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 text-[8px] font-bold">
                                                                    {m.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="truncate">{m.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => approveImage(team.team_id)}
                                                            disabled={loading === team.team_id}
                                                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors text-sm font-medium disabled:opacity-40"
                                                        >
                                                            {loading === team.team_id ? (
                                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            )}
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => disapproveImage(team.team_id)}
                                                            disabled={loading === team.team_id}
                                                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium disabled:opacity-40"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                            Disapprove
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        {/* Approved */}
                        {approvedTeams.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                    Approved ({approvedTeams.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                    {approvedTeams.map((team) => (
                                        <div key={team.team_id} className="glass-card overflow-hidden opacity-70">
                                            {team.image_url && (
                                                <div className="aspect-video bg-black/30 border-b border-white/5">
                                                    <img src={team.image_url} alt={`Team ${team.team_id}`} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className="p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-white font-bold text-sm">{team.name}</p>
                                                        <p className="text-gray-500 text-xs font-mono">{team.team_id}</p>
                                                    </div>
                                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* No Image */}
                        {noImageTeams.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-gray-500" />
                                    No Image Yet ({noImageTeams.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                    {noImageTeams.map((team) => (
                                        <div key={team.team_id} className="glass-card p-3 opacity-50">
                                            <p className="text-white text-sm font-bold">{team.name}</p>
                                            <p className="text-gray-500 text-xs font-mono">{team.team_id}</p>
                                            <p className="text-gray-600 text-xs mt-1">{team.members.length} members</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ===== STATS TAB ===== */}
                {activeTab === "stats" && (
                    <>
                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Branch Distribution */}
                            <div className="glass-card-elevated p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <GraduationCap className="w-5 h-5 text-orange-500" />
                                    Branch Distribution
                                </h2>
                                {branchData.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-8">No player data yet.</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={branchData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
                                            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, color: "#fff", fontSize: 12 }}
                                            />
                                            <Bar dataKey="count" name="Players" radius={[6, 6, 0, 0]} animationDuration={800}>
                                                {branchData.map((_, idx) => (
                                                    <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Gender Distribution */}
                            <div className="glass-card-elevated p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Users2 className="w-5 h-5 text-pink-500" />
                                    Gender Distribution
                                </h2>
                                {players.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-8">No player data yet.</p>
                                ) : (
                                    <div className="flex items-center justify-center">
                                        <ResponsiveContainer width="100%" height={250}>
                                            <PieChart>
                                                <Pie
                                                    data={genderData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={90}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    label={({ name, value }) => `${name}: ${value}`}
                                                    animationDuration={800}
                                                >
                                                    {genderData.map((_, idx) => (
                                                        <Cell key={idx} fill={PIE_COLORS[idx]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                                                <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                                <div className="flex justify-center gap-6 mt-2">
                                    <div className="text-center">
                                        <p className="text-blue-400 font-bold text-xl">{genderData[0].value}</p>
                                        <p className="text-gray-500 text-xs">♂ Male</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-pink-400 font-bold text-xl">{genderData[1].value}</p>
                                        <p className="text-gray-500 text-xs">♀ Female</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* All Players Table */}
                        <div className="glass-card-elevated p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-400" />
                                All Registered Players ({players.length})
                            </h2>
                            {players.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No players registered yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-400 border-b border-white/10">
                                                <th className="text-left py-2 px-3">#</th>
                                                <th className="text-left py-2 px-3">Name</th>
                                                <th className="text-left py-2 px-3">Roll No</th>
                                                <th className="text-left py-2 px-3">Branch</th>
                                                <th className="text-left py-2 px-3">Gender</th>
                                                <th className="text-right py-2 px-3">Points</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {players.map((p, idx) => (
                                                <tr
                                                    key={p.id}
                                                    onClick={() => setSelectedPlayerUserId(p.user_id)}
                                                    className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                                                >
                                                    <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                                                    <td className="py-2 px-3 text-white font-medium">{p.name}</td>
                                                    <td className="py-2 px-3 text-gray-400 font-mono">{p.roll_no}</td>
                                                    <td className="py-2 px-3">
                                                        <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full">
                                                            {p.branch}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-gray-400">
                                                        {p.gender === "male" ? "♂ Male" : "♀ Female"}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-orange-400 font-bold">{p.points}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ===== TIMERS TAB ===== */}
                {activeTab === "timers" && (
                    <>
                        <div className="glass-card-elevated p-6 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Timer className="w-5 h-5 text-green-400" />
                                    Round {currentRound} Timers
                                </h2>
                                <span className={`text-xs px-3 py-1 rounded-full font-medium ${gameState?.status === "playing"
                                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                        : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                                    }`}>
                                    {gameState?.status === "playing" ? "⏱️ Round Active" : `📋 ${gameState?.status || "waiting"}`}
                                </span>
                            </div>
                            <p className="text-gray-400 text-sm">
                                Timers auto-start when a round begins. Click &quot;Initialize Time&quot; to record a team&apos;s completion time.
                            </p>
                        </div>

                        {teams.length === 0 ? (
                            <div className="glass-card p-8 text-center text-gray-500">
                                <Timer className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p>No teams yet. Start the game first.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {teams.map((team) => {
                                    const tt = getTeamTimerForRound(team.team_id, currentRound);
                                    const running = isTeamTimerRunning(team.team_id, currentRound);
                                    const stopped = tt?.stopped_at;

                                    return (
                                        <div key={team.team_id} className={`glass-card-elevated p-4 border-l-4 ${running ? "border-l-green-500" : stopped ? "border-l-blue-500" : "border-l-gray-600"
                                            }`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    {team.image_url && team.image_approved ? (
                                                        <img src={team.image_url} alt="" className="w-8 h-8 rounded-full object-cover border border-purple-500/30" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 text-xs font-bold">
                                                            {team.name.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-white font-bold text-sm">{team.name}</p>
                                                        <p className="text-gray-500 text-xs">{team.team_id}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${running ? "bg-green-500/10 text-green-400" : stopped ? "bg-blue-500/10 text-blue-400" : "bg-gray-500/10 text-gray-500"
                                                    }`}>
                                                    {running ? "Running" : stopped ? "Recorded" : "Not Started"}
                                                </span>
                                            </div>

                                            {/* Timer display */}
                                            <div className="text-center py-4">
                                                {running && tt?.started_at ? (
                                                    <LiveTimer startedAt={tt.started_at} />
                                                ) : stopped && tt?.elapsed_seconds !== undefined ? (
                                                    <span className="font-mono text-xl text-blue-400">{formatTime(tt.elapsed_seconds)}</span>
                                                ) : (
                                                    <span className="font-mono text-xl text-gray-600">00:00</span>
                                                )}
                                            </div>

                                            {/* Action button */}
                                            {running ? (
                                                <button
                                                    onClick={() => stopTeamTimer(team.team_id)}
                                                    disabled={loading === team.team_id}
                                                    className="w-full py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
                                                >
                                                    {loading === team.team_id ? (
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Timer className="w-4 h-4" />
                                                    )}
                                                    Initialize Time
                                                </button>
                                            ) : stopped ? (
                                                <div className="w-full py-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-blue-400 text-sm text-center">
                                                    ✅ Time Recorded
                                                </div>
                                            ) : (
                                                <div className="w-full py-2 rounded-lg bg-gray-500/5 border border-gray-500/10 text-gray-500 text-sm text-center">
                                                    Waiting for round start
                                                </div>
                                            )}

                                            {/* Show all round times */}
                                            {team.round_times && Object.keys(team.round_times).length > 0 && (
                                                <div className="flex gap-2 mt-3 flex-wrap border-t border-white/5 pt-3">
                                                    {Object.entries(team.round_times).map(([rk, sec]) => (
                                                        <span key={rk} className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                                                            {rk.toUpperCase()}: {formatTime(sec as number)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
