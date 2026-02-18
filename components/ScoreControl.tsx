"use client";

import { motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import type { Team } from "@/lib/types";
import { useState } from "react";

interface ScoreControlProps {
    teams: Team[];
    onScoreChange: (teamId: string, delta: number) => Promise<void>;
    disabled?: boolean;
}

export default function ScoreControl({ teams, onScoreChange, disabled }: ScoreControlProps) {
    const [loadingTeam, setLoadingTeam] = useState<string | null>(null);
    const sorted = [...teams].sort((a, b) => a.rank - b.rank);

    const handleChange = async (teamId: string, delta: number) => {
        setLoadingTeam(teamId);
        await onScoreChange(teamId, delta);
        setLoadingTeam(null);
    };

    return (
        <div className="glass-card-elevated p-6">
            <h2
                className="text-xl font-bold text-white mb-6"
                style={{ fontFamily: "var(--font-display)" }}
            >
                🎮 Score Control
            </h2>

            {disabled && (
                <div className="badge-finished inline-block mb-4">
                    Scoring locked — game is not live
                </div>
            )}

            <div className="space-y-3">
                {sorted.map((team) => (
                    <motion.div
                        key={team.team_id}
                        layout
                        className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-orange-500/20 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 font-bold text-sm">
                                #{team.rank}
                            </div>
                            <div>
                                <p className="text-white font-semibold text-sm">{team.name}</p>
                                <p className="text-gray-500 text-xs">{team.team_id}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Decrement */}
                            <button
                                onClick={() => handleChange(team.team_id, -1)}
                                disabled={disabled || loadingTeam === team.team_id}
                                className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Minus className="w-4 h-4" />
                            </button>

                            {/* Points display */}
                            <motion.span
                                key={team.points}
                                initial={{ scale: 1.2 }}
                                animate={{ scale: 1 }}
                                className="text-lg font-bold text-white min-w-[48px] text-center tabular-nums"
                            >
                                {team.points}
                            </motion.span>

                            {/* Increment */}
                            <button
                                onClick={() => handleChange(team.team_id, 1)}
                                disabled={disabled || loadingTeam === team.team_id}
                                className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                ))}

                {sorted.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        <p>No teams created yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
