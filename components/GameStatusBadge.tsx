"use client";

import { clsx } from "clsx";
import { Radio, Clock, CheckCircle2 } from "lucide-react";

interface GameStatusBadgeProps {
    status: "waiting" | "live" | "finished";
    variant?: "admin" | "user";
}

export default function GameStatusBadge({ status, variant = "user" }: GameStatusBadgeProps) {
    return (
        <div
            className={clsx(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                status === "waiting" && "badge-waiting",
                status === "live" && "badge-live",
                status === "finished" && "badge-finished"
            )}
        >
            {status === "waiting" && (
                <>
                    <Clock className="w-4 h-4 animate-pulse" />
                    {variant === "admin" ? "🟡 Lobby Open" : "🟡 Waiting for Game"}
                </>
            )}
            {status === "live" && (
                <>
                    <Radio className="w-4 h-4 animate-pulse" />
                    🟢 Game is LIVE
                </>
            )}
            {status === "finished" && (
                <>
                    <CheckCircle2 className="w-4 h-4" />
                    🏆 Game Finished
                </>
            )}
        </div>
    );
}
