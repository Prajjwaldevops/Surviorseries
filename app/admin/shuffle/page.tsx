"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Shuffle,
    ArrowLeftRight,
    Check,
    ArrowLeft,
    Users,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, TeamMember } from "@/lib/types";

export default function AdminShufflePage() {
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState("");
    const [message, setMessage] = useState("");
    const [shuffleCount, setShuffleCount] = useState(0);

    // Swap state
    const [selectedMember1, setSelectedMember1] = useState<{ teamId: string; userId: string; name: string } | null>(null);
    const [selectedMember2, setSelectedMember2] = useState<{ teamId: string; userId: string; name: string } | null>(null);

    const fetchTeams = useCallback(async () => {
        const { data } = await supabase
            .from("teams")
            .select("*")
            .order("rank", { ascending: true });
        if (data) setTeams(data);
    }, []);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    // Realtime
    useEffect(() => {
        const sub = supabase
            .channel("admin-shuffle-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchTeams())
            .subscribe();

        return () => { supabase.removeChannel(sub); };
    }, [fetchTeams]);

    const handleShuffle = async () => {
        setLoading("shuffle");
        setMessage("");
        try {
            const res = await fetch("/api/game/shuffle", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setShuffleCount((c) => c + 1);
                setMessage(`🔀 Shuffle #${shuffleCount + 1} — ${data.teamsCreated} teams with ${data.totalPlayers} players.`);
                setSelectedMember1(null);
                setSelectedMember2(null);
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Network error");
        }
        setLoading("");
    };

    const handleSwap = async () => {
        if (!selectedMember1 || !selectedMember2) return;
        if (selectedMember1.teamId === selectedMember2.teamId) {
            setMessage("❌ Both members are in the same team. Select from different teams.");
            return;
        }

        setLoading("swap");
        setMessage("");
        try {
            const res = await fetch("/api/game/swap-members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fromTeamId: selectedMember1.teamId,
                    toTeamId: selectedMember2.teamId,
                    userId1: selectedMember1.userId,
                    userId2: selectedMember2.userId,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(`✅ ${data.message}`);
                setSelectedMember1(null);
                setSelectedMember2(null);
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Network error");
        }
        setLoading("");
    };

    const handleFinalize = async () => {
        setLoading("finalize");
        setMessage("");
        try {
            const res = await fetch("/api/game/finalize-teams", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setMessage("✅ Teams finalized! Users can now proceed.");
                setTimeout(() => router.push("/admin"), 1500);
            } else {
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Network error");
        }
        setLoading("");
    };

    const handleMemberClick = (teamId: string, member: TeamMember) => {
        const info = { teamId, userId: member.userId, name: member.name };

        if (!selectedMember1) {
            setSelectedMember1(info);
        } else if (!selectedMember2) {
            if (selectedMember1.userId === member.userId) {
                setSelectedMember1(null);
                return;
            }
            setSelectedMember2(info);
        } else {
            // Reset and start new selection
            setSelectedMember1(info);
            setSelectedMember2(null);
        }
    };

    const isSelected = (userId: string) =>
        selectedMember1?.userId === userId || selectedMember2?.userId === userId;

    return (
        <div className="min-h-screen">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push("/admin")}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-orange-600 flex items-center justify-center">
                                <Shuffle className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                                <span className="text-orange-500">SHUFFLE</span>{" "}
                                <span className="text-white">TEAMS</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                                Shuffles: {shuffleCount}
                            </span>
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

                {/* Controls */}
                <div className="glass-card-elevated p-6 mb-8">
                    <h2 className="text-lg font-bold text-white mb-4">Team Management</h2>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleShuffle}
                            disabled={loading === "shuffle"}
                            className="btn-secondary flex items-center gap-2 disabled:opacity-40"
                        >
                            {loading === "shuffle" ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Shuffle className="w-4 h-4" />
                            )}
                            Shuffle All Teams
                        </button>

                        <button
                            onClick={handleSwap}
                            disabled={!selectedMember1 || !selectedMember2 || loading === "swap"}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {loading === "swap" ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <ArrowLeftRight className="w-4 h-4" />
                            )}
                            Swap Selected
                            {selectedMember1 && selectedMember2 && (
                                <span className="text-xs opacity-70">
                                    ({selectedMember1.name} ↔ {selectedMember2.name})
                                </span>
                            )}
                        </button>

                        <div className="w-px h-8 bg-white/10 mx-2 hidden sm:block" />

                        <button
                            onClick={handleFinalize}
                            disabled={loading === "finalize"}
                            className="btn-primary flex items-center gap-2 disabled:opacity-40"
                        >
                            {loading === "finalize" ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Check className="w-4 h-4" />
                            )}
                            Finalize & Proceed
                        </button>
                    </div>

                    {(selectedMember1 || selectedMember2) && (
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="text-gray-400">Selected:</span>
                            {selectedMember1 && (
                                <span className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
                                    {selectedMember1.name}
                                </span>
                            )}
                            {selectedMember1 && selectedMember2 && (
                                <ArrowLeftRight className="w-3 h-3 text-gray-500" />
                            )}
                            {selectedMember2 && (
                                <span className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
                                    {selectedMember2.name}
                                </span>
                            )}
                            <button
                                onClick={() => { setSelectedMember1(null); setSelectedMember2(null); }}
                                className="text-xs text-gray-500 hover:text-white ml-2"
                            >
                                Clear
                            </button>
                        </div>
                    )}

                    <p className="text-gray-500 text-xs mt-3">
                        💡 Click on two members from different teams to swap them. Or shuffle all teams at once.
                    </p>
                </div>

                {/* Teams Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {teams.map((team) => (
                        <motion.div
                            key={team.team_id}
                            layout
                            className="glass-card p-5"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/30 to-orange-700/30 flex items-center justify-center">
                                        <Users className="w-4 h-4 text-orange-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">{team.name}</h3>
                                        <p className="text-gray-500 text-xs font-mono">{team.team_id}</p>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500">{team.members.length} members</span>
                            </div>

                            <div className="space-y-2">
                                {team.members.map((member) => (
                                    <button
                                        key={member.userId}
                                        onClick={() => handleMemberClick(team.team_id, member)}
                                        className={`w-full flex items-center gap-2 p-3 rounded-xl text-left transition-all border ${isSelected(member.userId)
                                            ? "bg-blue-500/15 border-blue-500/30 ring-1 ring-blue-500/20"
                                            : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
                                            }`}
                                    >
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isSelected(member.userId)
                                                ? "bg-blue-500/20 text-blue-400"
                                                : "bg-orange-500/10 text-orange-400"
                                                }`}
                                        >
                                            {member.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{member.name}</p>
                                            <p className="text-gray-500 text-xs truncate">{member.email}</p>
                                        </div>
                                        {isSelected(member.userId) && (
                                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {teams.length === 0 && (
                    <div className="glass-card p-12 text-center text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No teams formed yet. Go back and start the game first.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
