"use client";

import { useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Trophy, Star } from "lucide-react";
import type { Team } from "@/lib/types";

interface ConfettiWinnerProps {
    winner: Team | null;
    standings: Team[];
}

export default function ConfettiWinner({ winner, standings }: ConfettiWinnerProps) {
    const fireConfetti = useCallback(() => {
        const duration = 4000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ["#f97316", "#fbbf24", "#fb923c", "#ffffff"],
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ["#f97316", "#fbbf24", "#fb923c", "#ffffff"],
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();
    }, []);

    useEffect(() => {
        if (winner) {
            fireConfetti();
        }
    }, [winner, fireConfetti]);

    if (!winner) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="glass-card-elevated p-8 max-w-lg w-full text-center"
            >
                {/* Trophy animation */}
                <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/30 mb-6"
                >
                    <Trophy className="w-12 h-12 text-yellow-400" />
                </motion.div>

                <h1
                    className="text-4xl font-black text-white mb-2"
                    style={{ fontFamily: "var(--font-display)" }}
                >
                    🏆 CHAMPION 🏆
                </h1>
                <p className="text-orange-400 text-xl font-bold mb-1">{winner.name}</p>
                <p className="text-gray-400 mb-6">{winner.points} points</p>

                {/* Stars */}
                <div className="flex justify-center gap-1 mb-8">
                    {[...Array(5)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                        >
                            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                        </motion.div>
                    ))}
                </div>

                {/* Final Rankings */}
                <div className="text-left space-y-2">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                        Final Standings
                    </h3>
                    {standings.slice(0, 5).map((team, idx) => (
                        <motion.div
                            key={team.team_id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1 + idx * 0.1 }}
                            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-orange-400 font-bold">#{idx + 1}</span>
                                <span className="text-white text-sm">{team.name}</span>
                            </div>
                            <span className="text-gray-300 font-semibold">{team.points} pts</span>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
}
