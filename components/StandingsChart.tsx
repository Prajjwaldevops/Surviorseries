"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { Team } from "@/lib/types";

interface StandingsChartProps {
    teams: Team[];
}

const CHART_COLORS = [
    "#f97316",
    "#fb923c",
    "#fdba74",
    "#fed7aa",
    "#ffedd5",
    "#c2410c",
    "#ea580c",
    "#9a3412",
    "#7c2d12",
    "#431407",
];

/* Custom tooltip */
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; points: number; rank: number; activeCount: number; eliminatedCount: number } }> }) {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
        <div className="glass-card p-3 border border-orange-500/20">
            <p className="text-white font-bold text-sm">{data.name}</p>
            <p className="text-orange-400 text-sm">{data.points} points</p>
            <p className="text-gray-400 text-xs">Rank #{data.rank}</p>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-green-400 text-xs">{data.activeCount} active</span>
                {data.eliminatedCount > 0 && (
                    <span className="text-red-400 text-xs">{data.eliminatedCount} eliminated</span>
                )}
            </div>
        </div>
    );
}

export default function StandingsChart({ teams }: StandingsChartProps) {
    const data = [...teams]
        .sort((a, b) => a.rank - b.rank)
        .map((t) => ({
            name: t.name,
            points: t.points,
            rank: t.rank,
            team_id: t.team_id,
            members: t.members,
            activeCount: t.members.filter((m) => !m.eliminated).length,
            eliminatedCount: t.members.filter((m) => m.eliminated).length,
        }));

    return (
        <div className="glass-card-elevated p-6">
            <h2
                className="text-xl font-bold text-white mb-6 flex items-center gap-3"
                style={{ fontFamily: "var(--font-display)" }}
            >
                <BarChart3 className="w-6 h-6 text-orange-500" />
                Standings
            </h2>

            {data.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No data yet. Waiting for game to start.</p>
                </div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="name"
                                tick={{ fill: "#9ca3af", fontSize: 12 }}
                                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                            />
                            <YAxis
                                tick={{ fill: "#9ca3af", fontSize: 12 }}
                                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(249, 115, 22, 0.05)" }} />
                            <Bar dataKey="points" radius={[8, 8, 0, 0]} animationDuration={800}>
                                {data.map((_, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Member Status Dots — 4 circles per team below chart */}
                    <div className="mt-4 border-t border-white/5 pt-4">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                <span className="text-xs text-gray-400">Active</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                <span className="text-xs text-gray-400">Eliminated</span>
                            </div>
                        </div>
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
                            {data.map((team) => (
                                <div key={team.team_id} className="flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-1.5">
                                        {team.members.map((member, mIdx) => (
                                            <div
                                                key={mIdx}
                                                className={`w-3.5 h-3.5 rounded-full transition-all ${member.eliminated
                                                        ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse"
                                                        : "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]"
                                                    }`}
                                                title={`${member.name} — ${member.eliminated ? "Eliminated" : "Active"}`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-gray-500 truncate max-w-full">
                                        {team.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
