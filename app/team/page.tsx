"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Users, Lock, Unlock, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState } from "@/lib/types";
import Navbar from "@/components/Navbar";

export default function TeamPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [myTeam, setMyTeam] = useState<Team | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);

    const isTestUser =
        typeof document !== "undefined" &&
        document.cookie.includes("survivor_test_user=authenticated");
    const currentUserId = isTestUser ? "test-user-bypass" : user?.id;

    const fetchData = useCallback(async () => {
        if (!currentUserId) return;

        // Fetch game state
        const { data: gs } = await supabase.from("game_state").select("*").single();
        if (gs) setGameState(gs);

        // Fetch all teams, find mine
        const { data: teams } = await supabase.from("teams").select("*").order("rank", { ascending: true });
        if (teams) {
            const mine = teams.find((t: Team) =>
                t.members.some((m) => m.userId === currentUserId)
            );
            setMyTeam(mine || null);
        }
    }, [currentUserId]);

    useEffect(() => {
        if (isLoaded || isTestUser) {
            fetchData();
        }
    }, [isLoaded, isTestUser, fetchData]);

    // Realtime subscriptions for live updates
    useEffect(() => {
        const sub = supabase
            .channel("team-page-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchData())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [fetchData]);

    // Redirect based on game state
    useEffect(() => {
        if (!gameState) return;
        if (gameState.status === "waiting") {
            router.push("/lobby");
        }
    }, [gameState, router]);

    if (!isLoaded && !isTestUser) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
        );
    }

    const isLocked = !gameState?.teams_locked;
    const canProceed = gameState?.teams_locked && (gameState?.status === "image_upload" || gameState?.status === "playing");

    return (
        <div className="min-h-screen">
            <Navbar />
            <div className="pt-24 px-4 max-w-2xl mx-auto pb-12">
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-4"
                    >
                        {isLocked ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Admin is shuffling teams...
                            </>
                        ) : (
                            <>
                                <Unlock className="w-4 h-4" />
                                Teams finalized!
                            </>
                        )}
                    </motion.div>

                    <h1
                        className="text-3xl sm:text-4xl font-bold text-white mb-2"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Your Team
                    </h1>
                    <p className="text-gray-400">
                        {isLocked
                            ? "Wait while the admin finalizes team assignments. Teams may change."
                            : "Your team is ready! Click Proceed to continue."}
                    </p>
                </div>

                {!myTeam ? (
                    <div className="glass-card p-12 text-center">
                        <RefreshCw className="w-12 h-12 text-yellow-400 mx-auto mb-4 animate-spin" />
                        <h2 className="text-xl font-bold text-white mb-2">
                            Assigning you to a team...
                        </h2>
                        <p className="text-gray-400">
                            Please wait while teams are being formed.
                        </p>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Team ID Card */}
                        <div className="glass-card-elevated p-8 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-1">{myTeam.name}</h2>
                            <p className="text-orange-400 font-mono text-lg tracking-wider">{myTeam.team_id}</p>
                            <p className="text-gray-500 text-sm mt-2">Your unique team identifier</p>
                        </div>

                        {/* Team Members */}
                        <div className="glass-card p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-orange-500" />
                                Team Members ({myTeam.members.length})
                            </h3>
                            <div className="space-y-3">
                                {myTeam.members.map((m, idx) => (
                                    <motion.div
                                        key={m.userId}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${m.userId === currentUserId
                                            ? "bg-orange-500/10 border-orange-500/20"
                                            : "bg-white/[0.02] border-white/5"
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center text-orange-400 font-bold text-lg">
                                            {m.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">
                                                {m.name}
                                                {m.userId === currentUserId && (
                                                    <span className="text-orange-400 text-xs ml-2">(You)</span>
                                                )}
                                            </p>
                                            <p className="text-gray-500 text-sm truncate">{m.email}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Proceed Button */}
                        <button
                            onClick={() => router.push("/team-photo")}
                            disabled={!canProceed}
                            className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl font-bold text-lg transition-all ${canProceed
                                ? "btn-primary"
                                : "bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed"
                                }`}
                        >
                            {canProceed ? (
                                <>
                                    Proceed to Team Photo
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            ) : (
                                <>
                                    <Lock className="w-5 h-5" />
                                    Waiting for Admin to Finalize Teams
                                </>
                            )}
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
