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
    Legend,
} from "recharts";
import { Timer } from "lucide-react";
import type { Team } from "@/lib/types";

interface TimeChartProps {
    teams: Team[];
}

const ROUND_COLORS: Record<string, string> = {
    r1: "#f97316",
    r2: "#3b82f6",
    r3: "#10b981",
    r4: "#8b5cf6",
};

function TimeTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }> }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass-card p-3 border border-orange-500/20">
            {payload.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-300">{entry.name}:</span>
                    <span className="text-white font-bold">
                        {Math.floor(entry.value / 60)}m {entry.value % 60}s
                    </span>
                </div>
            ))}
        </div>
    );
}

export default function TimeChart({ teams }: TimeChartProps) {
    // Build data: each team has r1, r2, r3, r4 time values
    const data = [...teams]
        .sort((a, b) => a.rank - b.rank)
        .map((t) => ({
            name: t.name,
            team_id: t.team_id,
            r1: t.round_times?.r1 || 0,
            r2: t.round_times?.r2 || 0,
            r3: t.round_times?.r3 || 0,
            r4: t.round_times?.r4 || 0,
        }));

    // Check if any team has any time data
    const hasData = data.some((d) => d.r1 > 0 || d.r2 > 0 || d.r3 > 0 || d.r4 > 0);

    if (!hasData) return null;

    // Determine which rounds have data
    const activeRounds = ["r1", "r2", "r3", "r4"].filter((rk) =>
        data.some((d) => (d as unknown as Record<string, number>)[rk] > 0)
    );

    return (
        <div className="glass-card-elevated p-6">
            <h2
                className="text-xl font-bold text-white mb-6 flex items-center gap-3"
                style={{ fontFamily: "var(--font-display)" }}
            >
                <Timer className="w-6 h-6 text-orange-500" />
                Time Taken
            </h2>

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
                        tickFormatter={(v) => `${Math.floor(v / 60)}m`}
                    />
                    <Tooltip content={<TimeTooltip />} cursor={{ fill: "rgba(249, 115, 22, 0.05)" }} />
                    <Legend
                        wrapperStyle={{ color: "#9ca3af", fontSize: 12 }}
                    />
                    {activeRounds.map((rk) => (
                        <Bar
                            key={rk}
                            dataKey={rk}
                            name={`Round ${rk.slice(1)}`}
                            fill={ROUND_COLORS[rk]}
                            radius={[4, 4, 0, 0]}
                            animationDuration={800}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
