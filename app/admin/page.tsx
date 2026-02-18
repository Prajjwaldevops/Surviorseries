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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState, LobbyUser } from "@/lib/types";
import Leaderboard from "@/components/Leaderboard";
import ScoreControl from "@/components/ScoreControl";
import StandingsChart from "@/components/StandingsChart";
import GameStatusBadge from "@/components/GameStatusBadge";

export default function AdminPage() {
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [lobbyUsers, setLobbyUsers] = useState<LobbyUser[]>([]);
    const [gameStatus, setGameStatus] = useState<GameState["status"]>("waiting");
    const [loading, setLoading] = useState("");
    const [message, setMessage] = useState("");
    const [shuffleCount, setShuffleCount] = useState(0);

    // Fetch all data
    const fetchTeams = useCallback(async () => {
        const { data } = await supabase
            .from("teams")
            .select("*")
            .order("rank", { ascending: true });
        if (data) setTeams(data);
    }, []);

    const fetchLobby = useCallback(async () => {
        const { data } = await supabase
            .from("lobby")
            .select("*")
            .order("joined_at", { ascending: true });
        if (data) setLobbyUsers(data);
    }, []);

    const fetchGameState = useCallback(async () => {
        const { data } = await supabase
            .from("game_state")
            .select("*")
            .single();
        if (data) setGameStatus(data.status);
    }, []);

    useEffect(() => {
        fetchTeams();
        fetchLobby();
        fetchGameState();
    }, [fetchTeams, fetchLobby, fetchGameState]);

    // Realtime subscriptions
    useEffect(() => {
        const sub = supabase
            .channel("admin-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchTeams())
            .on("postgres_changes", { event: "*", schema: "public", table: "lobby" }, () => fetchLobby())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, (payload) => {
                setGameStatus((payload.new as GameState).status);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [fetchTeams, fetchLobby]);

    // Actions
    const approveGame = async () => {
        setLoading("approve");
        setMessage("");
        try {
            const res = await fetch("/api/game/approve", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setMessage(
                    `✅ Game started! ${data.teamsCreated} teams created with ${data.totalPlayers} players.`
                );
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Network error");
        }
        setLoading("");
    };

    const finishGame = async () => {
        if (!confirm("Are you sure you want to finish the game?")) return;
        setLoading("finish");
        setMessage("");
        try {
            const res = await fetch("/api/game/finish", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setMessage(`🏆 Game finished! Winner: ${data.winner?.name || "N/A"}`);
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Network error");
        }
        setLoading("");
    };

    const resetGame = async () => {
        if (!confirm("This will clear ALL data. Are you sure?")) return;
        setLoading("reset");
        setMessage("");
        try {
            const res = await fetch("/api/game/reset", { method: "POST" });
            if (res.ok) {
                setMessage("🔄 Game reset successfully.");
            }
        } catch {
            setMessage("❌ Network error");
        }
        setLoading("");
    };

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
                    `🔀 Teams shuffled! (Shuffle #${shuffleCount + 1}) — ${data.teamsCreated} teams with ${data.totalPlayers} players.`
                );
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Network error");
        }
        setLoading("");
    };

    const handleScoreChange = async (teamId: string, delta: number) => {
        await fetch("/api/game/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, delta }),
        });
    };

    // Eliminate a player
    const eliminatePlayer = async (teamId: string, userId: string) => {
        try {
            const res = await fetch("/api/game/eliminate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, odaPlayerUserId: userId }),
            });
            if (res.ok) {
                setMessage(`💀 Player eliminated!`);
            } else {
                const data = await res.json();
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Network error");
        }
    };

    // Reinstate a player
    const reinstatePlayer = async (teamId: string, userId: string) => {
        try {
            const res = await fetch("/api/game/reinstate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, userId }),
            });
            if (res.ok) {
                setMessage(`✅ Player reinstated!`);
            } else {
                const data = await res.json();
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Network error");
        }
    };

    const logout = async () => {
        document.cookie =
            "survivor_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push("/admin-login");
    };

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
                            <span
                                className="text-lg font-bold"
                                style={{ fontFamily: "var(--font-display)" }}
                            >
                                <span className="text-orange-500">ADMIN</span>{" "}
                                <span className="text-white">PANEL</span>
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <GameStatusBadge status={gameStatus} variant="admin" />
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors text-sm"
                            >
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

                {/* Control Bar */}
                <div className="glass-card-elevated p-6 mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                        <div>
                            <h2
                                className="text-xl font-bold text-white"
                                style={{ fontFamily: "var(--font-display)" }}
                            >
                                🎮 Game Controls
                            </h2>
                            <p className="text-gray-400 text-sm mt-1">
                                Lobby: {lobbyUsers.length} players • Teams: {teams.length}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={approveGame}
                            disabled={
                                loading === "approve" ||
                                gameStatus === "live" ||
                                gameStatus === "finished"
                            }
                            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading === "approve" ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Play className="w-4 h-4" />
                            )}
                            Approve & Start Game
                        </button>

                        <button
                            onClick={finishGame}
                            disabled={loading === "finish" || gameStatus !== "live"}
                            className="btn-danger flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading === "finish" ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Square className="w-4 h-4" />
                            )}
                            Finish Game
                        </button>

                        <button
                            onClick={resetGame}
                            disabled={loading === "reset"}
                            className="btn-secondary flex items-center gap-2 disabled:opacity-40"
                        >
                            {loading === "reset" ? (
                                <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                            ) : (
                                <RotateCcw className="w-4 h-4" />
                            )}
                            Reset Game
                        </button>

                        <div className="w-px h-8 bg-white/10 mx-2 hidden sm:block" />

                        <button
                            onClick={() => router.push("/admin/team-formation")}
                            className="flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors border border-orange-500/30 hover:border-orange-500/50 rounded-lg px-4 py-2 bg-orange-500/5"
                        >
                            <Users className="w-4 h-4" />
                            Manage & Shuffle Teams
                        </button>
                    </div>
                </div>

                {/* Lobby preview */}
                {gameStatus === "waiting" && (
                    <div className="glass-card p-6 mb-8">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-orange-500" />
                            Lobby Players ({lobbyUsers.length}/40)
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {lobbyUsers.map((u) => (
                                <div
                                    key={u.user_id}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-sm"
                                >
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
                                <p className="text-gray-500 col-span-full text-center py-4">
                                    No players in lobby yet.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Score control + Leaderboard */}
                {teams.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <ScoreControl
                            teams={teams}
                            onScoreChange={handleScoreChange}
                            disabled={gameStatus !== "live"}
                        />
                        <Leaderboard teams={teams} />
                    </div>
                )}

                {/* Elimination Control Panel */}
                {teams.length > 0 && gameStatus === "live" && (
                    <div className="glass-card-elevated p-6 mb-8">
                        <h2
                            className="text-xl font-bold text-white mb-6 flex items-center gap-3"
                            style={{ fontFamily: "var(--font-display)" }}
                        >
                            <Skull className="w-6 h-6 text-red-500" />
                            Elimination Control
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {teams.map((team) => (
                                <div
                                    key={team.team_id}
                                    className="glass-card p-4"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-white font-bold text-sm">{team.name}</h3>
                                            <span className="text-gray-500 text-xs">{team.team_id}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {/* Status dots */}
                                            {team.members.map((m, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`w-2.5 h-2.5 rounded-full ${m.eliminated ? "bg-red-500" : "bg-green-500"
                                                        }`}
                                                    title={m.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    {/* Approval status */}
                                    <div className="flex items-center gap-2 mb-3">
                                        {team.approved ? (
                                            <span className="text-xs text-green-400 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Approved
                                            </span>
                                        ) : (
                                            <span className="text-xs text-yellow-400 flex items-center gap-1">
                                                <XCircle className="w-3 h-3" /> Pending
                                            </span>
                                        )}
                                        {team.image_url && (
                                            <span className="text-xs text-blue-400 flex items-center gap-1">
                                                <ImageIcon className="w-3 h-3" /> Photo
                                            </span>
                                        )}
                                    </div>
                                    {/* Member list with eliminate/reinstate buttons */}
                                    <div className="space-y-2">
                                        {team.members.map((member) => (
                                            <div
                                                key={member.userId}
                                                className={`flex items-center gap-2 p-2 rounded-lg text-xs ${member.eliminated
                                                    ? "bg-red-500/5 border border-red-500/20"
                                                    : "bg-white/[0.02] border border-white/5"
                                                    }`}
                                            >
                                                <div
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${member.eliminated
                                                        ? "bg-red-500/20 text-red-400"
                                                        : "bg-orange-500/10 text-orange-400"
                                                        }`}
                                                >
                                                    {member.eliminated ? (
                                                        <Skull className="w-3 h-3" />
                                                    ) : (
                                                        member.name.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p
                                                        className={`truncate ${member.eliminated
                                                            ? "text-red-300 line-through"
                                                            : "text-white"
                                                            }`}
                                                    >
                                                        {member.name}
                                                    </p>
                                                </div>
                                                {member.eliminated ? (
                                                    <button
                                                        onClick={() =>
                                                            reinstatePlayer(team.team_id, member.userId)
                                                        }
                                                        className="px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors flex items-center gap-1"
                                                    >
                                                        <ShieldCheck className="w-3 h-3" />
                                                        Reinstate
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            eliminatePlayer(team.team_id, member.userId)
                                                        }
                                                        className="px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1"
                                                    >
                                                        <Skull className="w-3 h-3" />
                                                        Eliminate
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Chart */}
                {teams.length > 0 && <StandingsChart teams={teams} />}
            </div>
        </div >
    );
}
