"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Team } from "@/lib/types";

interface LeaderboardProps {
    teams: Team[];
    previousRanks?: Record<string, number>;
}

export default function Leaderboard({ teams, previousRanks = {} }: LeaderboardProps) {
    const sorted = [...teams].sort((a, b) => a.rank - b.rank);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
        if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
        if (rank === 3) return <Medal className="w-5 h-5 text-orange-600" />;
        return <span className="text-gray-400 font-bold text-sm">#{rank}</span>;
    };

    const getRankChange = (team: Team) => {
        const prev = previousRanks[team.team_id];
        if (prev === undefined) return null;
        const diff = prev - team.rank;
        if (diff > 0) return { direction: "up" as const, amount: diff };
        if (diff < 0) return { direction: "down" as const, amount: Math.abs(diff) };
        return { direction: "same" as const, amount: 0 };
    };

    return (
        <div className="glass-card-elevated p-6">
            <h2
                className="text-xl font-bold text-white mb-6 flex items-center gap-3"
                style={{ fontFamily: "var(--font-display)" }}
            >
                <Trophy className="w-6 h-6 text-orange-500" />
                Leaderboard
            </h2>

            <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                    {sorted.map((team, index) => {
                        const change = getRankChange(team);
                        return (
                            <motion.div
                                key={team.team_id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{
                                    layout: { type: "spring", stiffness: 300, damping: 30 },
                                    delay: index * 0.05,
                                }}
                                className={`flex items-center justify-between p-4 rounded-xl transition-all ${team.rank === 1
                                    ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20"
                                    : team.rank === 2
                                        ? "bg-white/[0.03] border border-white/5"
                                        : team.rank === 3
                                            ? "bg-white/[0.02] border border-white/5"
                                            : "bg-white/[0.01] border border-white/5"
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Team avatar or rank badge */}
                                    {team.image_url && team.image_approved ? (
                                        <img
                                            src={team.image_url}
                                            alt={team.name}
                                            className="w-10 h-10 rounded-full object-cover border-2 border-orange-500/30"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                            {getRankIcon(team.rank)}
                                        </div>
                                    )}

                                    {/* Team info */}
                                    <div>
                                        <p className="text-white font-semibold text-sm">
                                            {team.name}
                                        </p>
                                        <p className="text-gray-500 text-xs">
                                            {team.members.length} members
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Rank change indicator */}
                                    {change && (
                                        <div className="flex items-center gap-1 text-xs">
                                            {change.direction === "up" && (
                                                <span className="flex items-center text-green-400">
                                                    <TrendingUp className="w-3 h-3 mr-1" />
                                                    +{change.amount}
                                                </span>
                                            )}
                                            {change.direction === "down" && (
                                                <span className="flex items-center text-red-400">
                                                    <TrendingDown className="w-3 h-3 mr-1" />
                                                    -{change.amount}
                                                </span>
                                            )}
                                            {change.direction === "same" && (
                                                <Minus className="w-3 h-3 text-gray-500" />
                                            )}
                                        </div>
                                    )}

                                    {/* Points */}
                                    <div className="text-right">
                                        <motion.p
                                            key={team.points}
                                            initial={{ scale: 1.3, color: "#f97316" }}
                                            animate={{ scale: 1, color: "#ffffff" }}
                                            className="text-lg font-bold"
                                        >
                                            {team.points}
                                        </motion.p>
                                        <p className="text-gray-500 text-xs">pts</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {sorted.length === 0 && (
                    <div className="text-center text-gray-500 py-12">
                        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>No teams yet. Waiting for game to start.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
