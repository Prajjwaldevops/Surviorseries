"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Eye, EyeOff, AlertCircle } from "lucide-react";

/**
 * Test login page — bypasses Clerk entirely.
 * Credentials: test@gmail.com / test
 */
export default function TestLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("test@gmail.com");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/test-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (res.ok) {
                // Also join the lobby as test user
                await fetch("/api/lobby/join", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: "test-user-bypass",
                        name: "Test Player",
                        email: "test@gmail.com",
                    }),
                });
                router.push("/lobby");
            } else {
                const data = await res.json();
                setError(data.error || "Invalid credentials");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-green-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-orange-600/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 mb-4">
                        <FlaskConical className="w-8 h-8 text-green-500" />
                    </div>
                    <h1
                        className="text-2xl font-bold text-white"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Test User Login
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm">
                        Quick access — bypasses Clerk auth
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="glass-card-elevated p-8 space-y-6"
                >
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-all"
                            placeholder="test@gmail.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 transition-all pr-12"
                                placeholder="Enter password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-400 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-lg hover:shadow-green-500/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <FlaskConical className="w-5 h-5" />
                                Login as Test User
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center text-gray-500 text-xs mt-6">
                    <a href="/sign-in" className="text-orange-400 hover:text-orange-300">
                        Use Clerk login instead
                    </a>
                    {" · "}
                    <a href="/" className="text-gray-400 hover:text-white">
                        Home
                    </a>
                </p>
            </div>
        </div>
    );
}
