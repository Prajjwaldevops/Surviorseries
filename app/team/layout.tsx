import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Your Team — Survivor Series",
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
    return children;
}
