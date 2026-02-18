"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle2, XCircle, LogOut, ImageIcon, Users, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team } from "@/lib/types";

export default function AdminXPage() {
    const router = useRouter();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState<string>("");
    const [message, setMessage] = useState("");

    const fetchTeams = useCallback(async () => {
        const { data } = await supabase.from("teams").select("*").order("rank", { ascending: true });
        if (data) setTeams(data);
    }, []);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    // Realtime
    useEffect(() => {
        const sub = supabase
            .channel("adminx-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchTeams())
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [fetchTeams]);

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

    return (
        <div className="min-h-screen">
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
                                <span className="text-gray-500 text-sm ml-2">Image Approval</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">
                                Pending: {pendingTeams.length} • Approved: {approvedTeams.length}
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
                                        {/* Image */}
                                        {team.image_url && (
                                            <div className="aspect-video bg-black/30 border-b border-white/5">
                                                <img
                                                    src={team.image_url}
                                                    alt={`Team ${team.team_id}`}
                                                    className="w-full h-full object-cover"
                                                    crossOrigin="anonymous"
                                                    referrerPolicy="no-referrer"
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

                                            {/* Members */}
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

                                            {/* Actions */}
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
                                            <img src={team.image_url} alt={`Team ${team.team_id}`} className="w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" />
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
            </div>
        </div>
    );
}
