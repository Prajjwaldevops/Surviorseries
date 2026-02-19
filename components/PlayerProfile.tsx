"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Hash, GraduationCap, Users2, TrendingUp, TrendingDown, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Player, PlayerScoreLog } from "@/lib/types";

interface PlayerProfileProps {
    userId: string;
    onClose: () => void;
}

export default function PlayerProfile({ userId, onClose }: PlayerProfileProps) {
    const [player, setPlayer] = useState<Player | null>(null);
    const [scoreLogs, setScoreLogs] = useState<PlayerScoreLog[]>([]);
    const [teams, setTeams] = useState<Array<{ team_id: string; name: string; round: string }>>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);

        // Fetch player info
        const { data: p } = await supabase
            .from("players")
            .select("*")
            .eq("user_id", userId)
            .single();
        if (p) setPlayer(p);

        // Fetch player score logs
        const { data: logs } = await supabase
            .from("player_score_log")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (logs) setScoreLogs(logs);

        // Fetch teams this player is a member of
        const { data: allTeams } = await supabase.from("teams").select("team_id, name, members");
        if (allTeams) {
            const playerTeams = allTeams
                .filter((t) => {
                    const members = t.members as Array<{ userId: string }>;
                    return members?.some((m) => m.userId === userId);
                })
                .map((t) => ({
                    team_id: t.team_id,
                    name: t.name,
                    round: "Current",
                }));
            setTeams(playerTeams);
        }

        setLoading(false);
    }, [userId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Calculate totals
    const totalGiven = scoreLogs.filter((l) => l.delta > 0).reduce((sum, l) => sum + l.delta, 0);
    const totalDeducted = scoreLogs.filter((l) => l.delta < 0).reduce((sum, l) => sum + Math.abs(l.delta), 0);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="glass-card-elevated w-full max-w-md max-h-[85vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/5 bg-inherit backdrop-blur-xl">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-orange-500" />
                            Player Profile
                        </h3>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                        </div>
                    ) : player ? (
                        <div className="p-4 space-y-4">
                            {/* Player Info Card */}
                            <div className="rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-lg font-bold">
                                        {player.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-lg">{player.name}</p>
                                        <p className="text-orange-400 text-2xl font-bold">{player.points} pts</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 text-gray-300">
                                        <Hash className="w-3 h-3 text-orange-400" />
                                        {player.roll_no}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-300">
                                        <GraduationCap className="w-3 h-3 text-orange-400" />
                                        {player.branch}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-300">
                                        <Users2 className="w-3 h-3 text-orange-400" />
                                        {player.gender === "male" ? "♂ Male" : "♀ Female"}
                                    </div>
                                </div>
                            </div>

                            {/* Points Summary */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                    <p className="text-green-400 font-bold text-lg">+{totalGiven}</p>
                                    <p className="text-gray-500 text-xs">Earned</p>
                                </div>
                                <div className="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                    <p className="text-red-400 font-bold text-lg">-{totalDeducted}</p>
                                    <p className="text-gray-500 text-xs">Deducted</p>
                                </div>
                                <div className="text-center p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                    <p className="text-orange-400 font-bold text-lg">{player.points}</p>
                                    <p className="text-gray-500 text-xs">Net Total</p>
                                </div>
                            </div>

                            {/* Teams Joined */}
                            {teams.length > 0 && (
                                <div>
                                    <p className="text-gray-400 text-xs font-bold mb-2 flex items-center gap-1">
                                        <Trophy className="w-3 h-3" />
                                        Teams Joined
                                    </p>
                                    <div className="space-y-1">
                                        {teams.map((t) => (
                                            <div key={t.team_id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                                                <span className="text-white font-medium">{t.name}</span>
                                                <span className="text-gray-500 font-mono">{t.team_id}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Score History */}
                            <div>
                                <p className="text-gray-400 text-xs font-bold mb-2">Points History</p>
                                <div className="max-h-48 overflow-y-auto border border-white/5 rounded-lg bg-black/20 p-2">
                                    {scoreLogs.length === 0 ? (
                                        <p className="text-gray-600 text-xs text-center py-4">No point entries yet.</p>
                                    ) : (
                                        scoreLogs.map((log) => (
                                            <div key={log.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-white/3 last:border-0">
                                                {log.delta > 0 ? (
                                                    <TrendingUp className="w-3 h-3 text-green-400 flex-shrink-0" />
                                                ) : (
                                                    <TrendingDown className="w-3 h-3 text-red-400 flex-shrink-0" />
                                                )}
                                                <span className={`font-mono font-bold w-10 text-right ${log.delta > 0 ? "text-green-400" : "text-red-400"}`}>
                                                    {log.delta > 0 ? "+" : ""}{log.delta}
                                                </span>
                                                <span className="text-gray-500 w-6">R{log.round}</span>
                                                <span className="text-gray-300 flex-1 truncate">{log.description}</span>
                                                <span className="text-gray-600 text-[10px] flex-shrink-0">
                                                    {new Date(log.created_at).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>Player not found.</p>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
