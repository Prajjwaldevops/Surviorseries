"use client";

import { clsx } from "clsx";
import { Radio, Clock, CheckCircle2, Users, Camera, Shuffle } from "lucide-react";

interface GameStatusBadgeProps {
    status: string;
    variant?: "admin" | "user";
}

export default function GameStatusBadge({ status, variant = "user" }: GameStatusBadgeProps) {
    const config: Record<string, { class: string; icon: React.ReactNode; label: string }> = {
        waiting: {
            class: "badge-waiting",
            icon: <Clock className="w-4 h-4 animate-pulse" />,
            label: variant === "admin" ? "🟡 Lobby Open" : "🟡 Waiting for Game",
        },
        team_formation: {
            class: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
            icon: <Shuffle className="w-4 h-4 animate-pulse" />,
            label: "📋 Team Formation",
        },
        image_upload: {
            class: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
            icon: <Camera className="w-4 h-4" />,
            label: "📸 Image Upload",
        },
        playing: {
            class: "badge-live",
            icon: <Radio className="w-4 h-4 animate-pulse" />,
            label: "🟢 Game is LIVE",
        },
        round_complete: {
            class: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
            icon: <Users className="w-4 h-4" />,
            label: "⏹️ Round Complete",
        },
        finished: {
            class: "badge-finished",
            icon: <CheckCircle2 className="w-4 h-4" />,
            label: "🏆 Game Finished",
        },
    };

    const c = config[status] || config.waiting;

    return (
        <div className={clsx("inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium", c.class)}>
            {c.icon}
            {c.label}
        </div>
    );
}
