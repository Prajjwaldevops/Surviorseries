"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
    Home,
    Users,
    LayoutDashboard,
    BarChart3,
    Menu,
    X,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/lobby", label: "Lobby", icon: Users },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/standings", label: "Standings", icon: BarChart3 },
];

export default function Navbar() {
    const pathname = usePathname();
    const { isSignedIn } = useUser();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50">
            <div className="glass-card border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-bold text-sm group-hover:scale-110 transition-transform">
                                SS
                            </div>
                            <span
                                className="text-lg font-bold hidden sm:block"
                                style={{ fontFamily: "var(--font-display)" }}
                            >
                                <span className="text-orange-500">SURVIVOR</span>{" "}
                                <span className="text-white">SERIES</span>
                            </span>
                        </Link>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={clsx(
                                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                            isActive
                                                ? "bg-orange-500/15 text-orange-400 border border-orange-500/20"
                                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <link.icon className="w-4 h-4" />
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-3">
                            {isSignedIn ? (
                                <UserButton
                                    afterSignOutUrl="/"
                                    appearance={{
                                        elements: {
                                            avatarBox: "w-9 h-9 ring-2 ring-orange-500/30",
                                        },
                                    }}
                                />
                            ) : (
                                <Link href="/sign-in" className="btn-primary text-sm py-2 px-5">
                                    Sign In
                                </Link>
                            )}

                            {/* Mobile menu toggle */}
                            <button
                                onClick={() => setMobileOpen(!mobileOpen)}
                                className="md:hidden text-gray-400 hover:text-white p-2"
                            >
                                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Nav */}
                    {mobileOpen && (
                        <div className="md:hidden pb-4 border-t border-white/5 mt-2 pt-4 space-y-1">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={clsx(
                                            "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                                            isActive
                                                ? "bg-orange-500/15 text-orange-400"
                                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <link.icon className="w-5 h-5" />
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
