"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Upload,
    Camera,
    CheckCircle2,
    Clock,
    Users,
    ImageIcon,
    X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team } from "@/lib/types";
import Navbar from "@/components/Navbar";

export default function TeamApprovalPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [myTeam, setMyTeam] = useState<Team | null>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [cameraActive, setCameraActive] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Check for test user
    const isTestUser =
        typeof document !== "undefined" &&
        document.cookie.includes("survivor_test_user=authenticated");
    const currentUserId = isTestUser ? "test-user-bypass" : user?.id;

    // Fetch team for current user
    const fetchMyTeam = useCallback(async () => {
        if (!currentUserId) return;

        const { data: teams } = await supabase
            .from("teams")
            .select("*")
            .order("rank", { ascending: true });

        if (teams) {
            const mine = teams.find((t: Team) =>
                t.members.some((m) => m.userId === currentUserId)
            );
            setMyTeam(mine || null);

            // If team is already approved, redirect to dashboard
            if (mine?.approved) {
                router.push("/dashboard");
            }
        }
    }, [currentUserId, router]);

    useEffect(() => {
        if (isLoaded || isTestUser) {
            fetchMyTeam();
        }
    }, [isLoaded, isTestUser, fetchMyTeam]);

    // Realtime subscription for team updates
    useEffect(() => {
        const sub = supabase
            .channel("team-approval")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "teams" },
                () => fetchMyTeam()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [fetchMyTeam]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            stopCameraStream();
        };
    }, []);

    const stopCameraStream = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    const startCamera = async () => {
        setMessage("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            setCameraActive(true);
            // Needs a slight delay for the video element to be ready in DOM if conditionally rendered
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error("Camera error:", err);
            setMessage("❌ Camera access denied. Please allow permissions.");
            setCameraActive(false);
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
                    setSelectedFile(file);
                    setPreviewUrl(URL.createObjectURL(file));
                    stopCameraStream();
                }
            }, "image/jpeg", 0.8);
        }
    };

    // Handle file selection for preview
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            stopCameraStream(); // Ensure camera is off if file selected
        }
    };

    // Handle upload — sends actual file to R2 via API
    const handleUpload = async () => {
        if (!myTeam || !selectedFile) return;

        setUploading(true);
        setMessage("");

        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("teamId", myTeam.team_id);

            const res = await fetch("/api/team/upload-image", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                setMessage("✅ Team approved! Redirecting to dashboard...");
                setTimeout(() => router.push("/dashboard"), 2000);
            } else {
                const data = await res.json();
                setMessage(`❌ ${data.error}`);
            }
        } catch {
            setMessage("❌ Upload failed. Try again.");
        } finally {
            setUploading(false);
        }
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
            <div className="pt-24 px-4 max-w-2xl mx-auto pb-12">
                <div className="text-center mb-8">
                    <h1
                        className="text-3xl font-bold text-white mb-2"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        🎯 Team Approval
                    </h1>
                    <p className="text-gray-400">
                        Upload a team photo to get your team approved and enter the game.
                    </p>
                </div>

                {!myTeam ? (
                    <div className="glass-card p-12 text-center">
                        <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4 animate-pulse" />
                        <h2 className="text-xl font-bold text-white mb-2">
                            Waiting for Team Assignment
                        </h2>
                        <p className="text-gray-400 max-w-md mx-auto">
                            You haven&apos;t been assigned to a team yet. Wait in the{" "}
                            <a href="/lobby" className="text-orange-400 hover:underline">
                                lobby
                            </a>{" "}
                            for the admin to start the game.
                        </p>
                    </div>
                ) : myTeam.approved ? (
                    <div className="glass-card-elevated p-12 text-center">
                        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">
                            Team Approved! ✅
                        </h2>
                        <p className="text-gray-400 mb-4">
                            Your team has been approved. Head to the dashboard.
                        </p>
                        <a href="/dashboard" className="btn-primary inline-flex items-center gap-2">
                            Go to Dashboard
                        </a>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Team Info */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-card-elevated p-6"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">{myTeam.name}</h2>
                                    <p className="text-gray-500 text-sm">{myTeam.team_id}</p>
                                </div>
                                <span className="ml-auto badge-waiting">Pending Approval</span>
                            </div>

                            <div className="space-y-2">
                                {myTeam.members.map((m, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/5"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 text-xs font-bold">
                                            {m.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white text-sm truncate">{m.name}</p>
                                            <p className="text-gray-500 text-xs truncate">{m.email}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Upload/Camera Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="glass-card-elevated p-6"
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Camera className="w-5 h-5 text-orange-500" />
                                Take Team Photo
                            </h3>

                            {/* Camera View */}
                            {cameraActive ? (
                                <div className="mb-4 relative rounded-xl overflow-hidden border-2 border-orange-500/50 bg-black aspect-video">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        onClick={stopCameraStream}
                                        className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={capturePhoto}
                                        className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:scale-95 transition-all flex items-center justify-center"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-white" />
                                    </button>
                                </div>
                            ) : (
                                /* File/Preview Area */
                                <div className="mb-4">
                                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${previewUrl
                                        ? "border-orange-500/30 bg-orange-500/5"
                                        : "border-white/10"
                                        }`}>
                                        {previewUrl ? (
                                            <div>
                                                <img
                                                    src={previewUrl}
                                                    alt="Preview"
                                                    className="max-h-64 mx-auto rounded-lg mb-4 object-contain"
                                                />
                                                <p className="text-green-400 font-medium text-sm mb-2">
                                                    Photo ready to upload ✓
                                                </p>
                                                <div className="flex gap-2 justify-center">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedFile(null);
                                                            setPreviewUrl(null);
                                                            startCamera();
                                                        }}
                                                        className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-white"
                                                    >
                                                        Retake Photo
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="p-4 rounded-xl bg-white/5 inline-block">
                                                    <ImageIcon className="w-10 h-10 text-gray-500 mx-auto" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={startCamera}
                                                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all text-orange-400"
                                                    >
                                                        <Camera className="w-6 h-6" />
                                                        <span className="text-sm font-bold">Open Camera</span>
                                                    </button>
                                                    <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white cursor-pointer">
                                                        <Upload className="w-6 h-6" />
                                                        <span className="text-sm font-bold">Upload File</span>
                                                        <input
                                                            ref={fileInputRef}
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleFileSelect}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                </div>
                                                <p className="text-gray-500 text-xs">
                                                    We'll ask for camera permission if you choose "Open Camera"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Upload Action */}
                            <button
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading}
                                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {uploading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        Confirm & Upload Photo
                                    </>
                                )}
                            </button>

                            {message && (
                                <p className="mt-3 text-sm text-center text-white bg-white/5 rounded-lg p-2">
                                    {message}
                                </p>
                            )}
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
