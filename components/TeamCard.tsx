"use client";

import { motion } from "framer-motion";
import { Users, Hash, Mail, Skull, ShieldCheck } from "lucide-react";
import type { Team } from "@/lib/types";

interface TeamCardProps {
    team: Team | null;
}

export default function TeamCard({ team }: TeamCardProps) {
    if (!team) {
        return (
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-orange-500" />
                    <h2
                        className="text-xl font-bold text-white"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Your Team
                    </h2>
                </div>
                <div className="text-center py-8 text-gray-500">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>You haven&apos;t been assigned to a team yet.</p>
                    <p className="text-sm mt-1">Wait for the admin to start the game.</p>
                </div>
            </div>
        );
    }

    const activeCount = team.members.filter((m) => !m.eliminated).length;
    const eliminatedCount = team.members.filter((m) => m.eliminated).length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card-elevated p-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2
                            className="text-xl font-bold text-white"
                            style={{ fontFamily: "var(--font-display)" }}
                        >
                            {team.name}
                        </h2>
                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                            <Hash className="w-3 h-3" />
                            {team.team_id}
                        </div>
                    </div>
                </div>

                {/* Rank badge */}
                <div className="text-center">
                    <div className="text-2xl font-bold text-orange-400">#{team.rank}</div>
                    <div className="text-xs text-gray-500">Rank</div>
                </div>
            </div>

            {/* Points */}
            <div className="glass-card p-4 mb-4 text-center">
                <p className="text-3xl font-bold text-white">{team.points}</p>
                <p className="text-sm text-gray-400">Total Points</p>
            </div>

            {/* Team Status Dots — shows active/eliminated members */}
            <div className="flex items-center justify-center gap-3 mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Status</span>
                <div className="flex items-center gap-2">
                    {team.members.map((m, idx) => (
                        <div
                            key={idx}
                            className={`w-4 h-4 rounded-full transition-all ${m.eliminated
                                    ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                    : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                                }`}
                            title={`${m.name} — ${m.eliminated ? "Eliminated" : "Active"}`}
                        />
                    ))}
                </div>
                <span className="text-xs text-gray-500">
                    {activeCount} active
                    {eliminatedCount > 0 && <>, <span className="text-red-400">{eliminatedCount} out</span></>}
                </span>
            </div>

            {/* Approval status */}
            {!team.approved && (
                <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                    <p className="text-yellow-400 text-sm font-medium">
                        ⏳ Pending Approval — Upload team photo
                    </p>
                </div>
            )}

            {/* Members */}
            <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
                    Team Members
                </h3>
                <div className="space-y-2">
                    {team.members.map((member, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${member.eliminated
                                    ? "bg-red-500/5 border-red-500/20 opacity-60"
                                    : "bg-white/[0.02] border-white/5"
                                }`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${member.eliminated
                                        ? "bg-red-500/20 text-red-400"
                                        : "bg-gradient-to-br from-orange-500/20 to-orange-600/20 text-orange-400"
                                    }`}
                            >
                                {member.eliminated ? (
                                    <Skull className="w-4 h-4" />
                                ) : (
                                    member.name.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p
                                    className={`text-sm font-medium truncate ${member.eliminated ? "text-red-300 line-through" : "text-white"
                                        }`}
                                >
                                    {member.name}
                                </p>
                                <p className="text-gray-500 text-xs truncate flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {member.email}
                                </p>
                            </div>
                            {member.eliminated ? (
                                <span className="text-xs text-red-400 flex items-center gap-1 font-medium">
                                    <Skull className="w-3 h-3" />
                                    Eliminated
                                </span>
                            ) : (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    Active
                                </span>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Team image if uploaded */}
            {team.image_url && (
                <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-xs text-gray-500 mb-2">📷 Team Photo</p>
                    <div className="text-xs text-green-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Verified & Approved
                    </div>
                </div>
            )}
        </motion.div>
    );
}
