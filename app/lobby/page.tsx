"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Wifi, WifiOff, Clock, Gamepad2, Shield, UserCheck, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { HEARTBEAT_INTERVAL_MS, INACTIVITY_TIMEOUT_MS } from "@/lib/constants";
import type { LobbyUser, GameState, Team } from "@/lib/types";
import Navbar from "@/components/Navbar";
import GameStatusBadge from "@/components/GameStatusBadge";

export default function LobbyPage() {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const router = useRouter();
    const [lobbyUsers, setLobbyUsers] = useState<LobbyUser[]>([]);
    const [gameStatus, setGameStatus] = useState<GameState["status"]>("waiting");
    const [teams, setTeams] = useState<Team[]>([]);
    const [joined, setJoined] = useState(false);
    const lastActivityRef = useRef(Date.now());

    // Check for test user
    const isTestUser =
        typeof document !== "undefined" &&
        document.cookie.includes("survivor_test_user=authenticated");
    const currentUserId = isTestUser ? "test-user-bypass" : user?.id;
    const currentName = isTestUser ? "Test Player" : user?.fullName || user?.firstName || "Player";
    const currentEmail = isTestUser ? "test@gmail.com" : user?.emailAddresses?.[0]?.emailAddress || "";

    // Join lobby
    const joinLobby = useCallback(async () => {
        if (!currentUserId) return;
        try {
            await fetch("/api/lobby/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUserId,
                    name: currentName,
                    email: currentEmail,
                }),
            });
            setJoined(true);
        } catch (err) {
            console.error("Failed to join lobby:", err);
        }
    }, [currentUserId, currentName, currentEmail]);

    // Fetch lobby users
    const fetchLobby = useCallback(async () => {
        const { data } = await supabase
            .from("lobby")
            .select("*")
            .order("joined_at", { ascending: true });
        if (data) setLobbyUsers(data);
    }, []);

    // Fetch game state
    const fetchGameState = useCallback(async () => {
        const { data } = await supabase
            .from("game_state")
            .select("status")
            .single();
        if (data) setGameStatus(data.status);
    }, []);

    // Fetch teams
    const fetchTeams = useCallback(async () => {
        const { data } = await supabase
            .from("teams")
            .select("*")
            .order("rank", { ascending: true });
        if (data) setTeams(data);
    }, []);

    // Initialize
    useEffect(() => {
        if ((isLoaded && user) || isTestUser) {
            joinLobby();
            fetchLobby();
            fetchGameState();
            fetchTeams();
        }
    }, [isLoaded, user, isTestUser, joinLobby, fetchLobby, fetchGameState, fetchTeams]);

    // Realtime subscriptions
    useEffect(() => {
        const lobbySub = supabase
            .channel("lobby-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "lobby" },
                () => fetchLobby()
            )
            .subscribe();

        const gameSub = supabase
            .channel("game-state-lobby")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "game_state" },
                (payload) => {
                    const newStatus = (payload.new as GameState).status;
                    setGameStatus(newStatus);
                    if (newStatus === "live") {
                        fetchTeams();
                    }
                }
            )
            .subscribe();

        const teamsSub = supabase
            .channel("teams-lobby")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "teams" },
                () => fetchTeams()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(lobbySub);
            supabase.removeChannel(gameSub);
            supabase.removeChannel(teamsSub);
        };
    }, [fetchLobby, fetchTeams, router, isTestUser]);

    // Heartbeat + inactivity timeout
    useEffect(() => {
        if (!currentUserId) return;

        const onActivity = () => {
            lastActivityRef.current = Date.now();
        };
        window.addEventListener("mousemove", onActivity);
        window.addEventListener("keydown", onActivity);
        window.addEventListener("click", onActivity);

        const heartbeat = setInterval(async () => {
            if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT_MS) {
                clearInterval(heartbeat);
                if (!isTestUser) {
                    await signOut();
                } else {
                    document.cookie = "survivor_test_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                    router.push("/");
                }
                return;
            }

            await fetch("/api/lobby/heartbeat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: currentUserId }),
            });
        }, HEARTBEAT_INTERVAL_MS);

        return () => {
            clearInterval(heartbeat);
            window.removeEventListener("mousemove", onActivity);
            window.removeEventListener("keydown", onActivity);
            window.removeEventListener("click", onActivity);
        };
    }, [currentUserId, signOut, isTestUser, router]);

    if (!isLoaded && !isTestUser) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
        );
    }

    // Find the current user's team
    const myTeam = teams.find((t) =>
        t.members.some((m) => m.userId === currentUserId)
    );

    // Logout handler
    const handleLogout = async () => {
        if (isTestUser) {
            document.cookie = "survivor_test_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            router.push("/");
        } else {
            await signOut();
            router.push("/");
        }
    };

    return (
        <div className="min-h-screen">
            <Navbar />
            <div className="pt-24 px-4 max-w-4xl mx-auto pb-12">
                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <GameStatusBadge status={gameStatus} />
                    </motion.div>

                    <h1
                        className="text-3xl sm:text-4xl font-bold text-white mt-6 mb-2"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        <Gamepad2 className="inline w-8 h-8 text-orange-500 mr-2 -mt-1" />
                        Game Lobby
                    </h1>
                    <p className="text-gray-400">
                        {gameStatus === "live"
                            ? "Teams are formed! Upload your team photo to get approved."
                            : "Wait here until the admin approves the game."}
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-3">
                        {isTestUser && (
                            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
                                🧪 Test User Mode
                            </span>
                        )}
                        <button
                            onClick={handleLogout}
                            className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1.5 bg-white/[0.03] border border-white/10 hover:border-red-500/20 px-3 py-1.5 rounded-full"
                        >
                            <LogOut className="w-3 h-3" />
                            Logout
                        </button>
                    </div>
                </div>

                {/* Team Assignments - shown when game is live and teams exist */}
                {gameStatus === "live" && teams.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        {/* My team highlight */}
                        {myTeam && (
                            <div className="glass-card-elevated p-6 mb-4 border-orange-500/20">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-white">{myTeam.name}</h2>
                                            <p className="text-gray-500 text-sm">{myTeam.team_id} • Your team</p>
                                        </div>
                                    </div>
                                    {myTeam.approved ? (
                                        <span className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1 rounded-full">
                                            ✅ Approved
                                        </span>
                                    ) : (
                                        <span className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full animate-pulse">
                                            ⏳ Waiting to Confirm
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                    {myTeam.members.map((m, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-3 p-3 rounded-xl border ${m.userId === currentUserId
                                                ? "bg-orange-500/10 border-orange-500/20"
                                                : "bg-white/[0.02] border-white/5"
                                                }`}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center text-orange-400 font-bold text-sm">
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
                                            <UserCheck className="w-4 h-4 text-yellow-400" />
                                        </div>
                                    ))}
                                </div>
                                {!myTeam.approved && (
                                    <a
                                        href="/team-approval"
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                    >
                                        📸 Upload Team Photo to Confirm
                                    </a>
                                )}
                            </div>
                        )}

                        {/* All teams overview */}
                        <div className="glass-card p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-orange-500" />
                                All Teams ({teams.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {teams.map((team) => (
                                    <div
                                        key={team.team_id}
                                        className={`rounded-xl p-4 border ${team.team_id === myTeam?.team_id
                                            ? "bg-orange-500/5 border-orange-500/20"
                                            : "bg-white/[0.02] border-white/5"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-white font-bold text-sm">{team.name}</h3>
                                            {team.approved ? (
                                                <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                                    Confirmed
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                                                    Waiting to Confirm
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            {team.members.map((m, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-2 text-xs"
                                                >
                                                    <div className="w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 text-[10px] font-bold">
                                                        {m.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className={`truncate ${m.userId === currentUserId ? "text-orange-400 font-medium" : "text-gray-300"
                                                        }`}>
                                                        {m.name}
                                                        {m.userId === currentUserId && " (You)"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="glass-card p-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-green-400 mb-1">
                            <Wifi className="w-4 h-4" />
                            <span className="text-sm font-medium">Online</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{lobbyUsers.length}</p>
                        <p className="text-gray-500 text-xs">/ 40 max</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-orange-400 mb-1">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">Timeout</span>
                        </div>
                        <p className="text-3xl font-bold text-white">10</p>
                        <p className="text-gray-500 text-xs">min inactivity</p>
                    </div>
                </div>

                {/* User List */}
                <div className="glass-card-elevated p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-orange-500" />
                            Players ({lobbyUsers.length})
                        </h2>
                        {joined && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                                <Wifi className="w-3 h-3" />
                                Connected
                            </span>
                        )}
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        <AnimatePresence>
                            {lobbyUsers.map((u, idx) => (
                                <motion.div
                                    key={u.user_id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${u.user_id === currentUserId
                                        ? "bg-orange-500/10 border-orange-500/20"
                                        : "bg-white/[0.02] border-white/5"
                                        }`}
                                >
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center text-orange-400 font-bold text-sm">
                                        {u.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium truncate">
                                            {u.name}{" "}
                                            {u.user_id === currentUserId && (
                                                <span className="text-orange-400 text-xs">(You)</span>
                                            )}
                                        </p>
                                        <p className="text-gray-500 text-xs truncate">{u.email}</p>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {lobbyUsers.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <WifiOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p>No players online yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
