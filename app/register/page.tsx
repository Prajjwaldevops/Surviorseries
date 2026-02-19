"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus, GraduationCap, Hash, Users2 } from "lucide-react";
import Navbar from "@/components/Navbar";

const BRANCHES = [
    "CSE", "CSE-CY", "IT", "ECE", "EE", "ME", "MT", "MIN", "CHE", "CIVIL",
    "PROD."
];

export default function RegisterPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [name, setName] = useState("");
    const [rollNo, setRollNo] = useState("");
    const [branch, setBranch] = useState("");
    const [gender, setGender] = useState<"male" | "female" | "">("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Check for test user
    const isTestUser =
        typeof document !== "undefined" &&
        document.cookie.includes("survivor_test_user=authenticated");
    const currentUserId = isTestUser ? "test-user-bypass" : user?.id;
    const currentName = isTestUser ? "Test Player" : user?.fullName || user?.firstName || "";

    // Pre-fill name from auth
    useState(() => {
        if (currentName && !name) setName(currentName);
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUserId) return;
        if (!name.trim() || !rollNo.trim() || !branch || !gender) {
            setError("Please fill all fields");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/players/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUserId,
                    name: name.trim(),
                    rollNo: rollNo.trim(),
                    branch,
                    gender,
                }),
            });

            const data = await res.json();
            if (res.ok) {
                router.push("/lobby");
            } else {
                setError(data.error || "Registration failed");
            }
        } catch {
            setError("Network error. Please try again.");
        }
        setLoading(false);
    };

    if (!isLoaded && !isTestUser) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Navbar />
            <div className="pt-24 px-4 max-w-lg mx-auto pb-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <UserPlus className="w-8 h-8 text-white" />
                    </div>
                    <h1
                        className="text-3xl font-bold text-white mb-2"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Player Registration
                    </h1>
                    <p className="text-gray-400 text-sm">
                        Enter your details to join the game lobby
                    </p>
                </motion.div>

                <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onSubmit={handleSubmit}
                    className="glass-card-elevated p-6 space-y-5"
                >
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                            <UserPlus className="w-4 h-4 text-orange-400" />
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-600 focus:border-orange-500/50 focus:outline-none transition-colors"
                            required
                        />
                    </div>

                    {/* Roll No */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                            <Hash className="w-4 h-4 text-orange-400" />
                            Roll Number
                        </label>
                        <input
                            type="text"
                            value={rollNo}
                            onChange={(e) => setRollNo(e.target.value)}
                            placeholder="e.g. 2404075"
                            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-gray-600 focus:border-orange-500/50 focus:outline-none transition-colors"
                            required
                        />
                    </div>

                    {/* Branch */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                            <GraduationCap className="w-4 h-4 text-orange-400" />
                            Branch
                        </label>
                        <select
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:border-orange-500/50 focus:outline-none transition-colors appearance-none cursor-pointer"
                            required
                        >
                            <option value="" disabled className="bg-gray-900">
                                Select your branch
                            </option>
                            {BRANCHES.map((b) => (
                                <option key={b} value={b} className="bg-gray-900">
                                    {b}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                            <Users2 className="w-4 h-4 text-orange-400" />
                            Gender
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setGender("male")}
                                className={`py-3 rounded-xl border text-sm font-medium transition-all ${gender === "male"
                                    ? "bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                                    : "bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                ♂ Male
                            </button>
                            <button
                                type="button"
                                onClick={() => setGender("female")}
                                className={`py-3 rounded-xl border text-sm font-medium transition-all ${gender === "female"
                                    ? "bg-pink-500/20 border-pink-500/40 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.15)]"
                                    : "bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                ♀ Female
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || !name.trim() || !rollNo.trim() || !branch || !gender}
                        className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-base font-semibold"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <UserPlus className="w-5 h-5" />
                                Enter Game Lobby
                            </>
                        )}
                    </button>
                </motion.form>

                {isTestUser && (
                    <p className="text-center text-xs text-green-400 mt-4">
                        🧪 Test User Mode
                    </p>
                )}
            </div>
        </div>
    );
}
