"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Upload, Camera, Clock, Users, ImageIcon, X, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Team, GameState } from "@/lib/types";
import Navbar from "@/components/Navbar";

export default function TeamPhotoPage() {
    const { user, isLoaded } = useUser();
    const router = useRouter();
    const [myTeam, setMyTeam] = useState<Team | null>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [cameraActive, setCameraActive] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const isTestUser =
        typeof document !== "undefined" &&
        document.cookie.includes("survivor_test_user=authenticated");
    const currentUserId = isTestUser ? "test-user-bypass" : user?.id;

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
        }
    }, [currentUserId]);

    const fetchGameState = useCallback(async () => {
        const { data } = await supabase.from("game_state").select("*").single();
        if (data) setGameState(data);
    }, []);

    useEffect(() => {
        if (isLoaded || isTestUser) {
            fetchMyTeam();
            fetchGameState();
        }
    }, [isLoaded, isTestUser, fetchMyTeam, fetchGameState]);

    // Realtime — watch for image approval
    useEffect(() => {
        const sub = supabase
            .channel("team-photo-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchMyTeam())
            .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, () => fetchGameState())
            .subscribe();

        return () => { supabase.removeChannel(sub); };
    }, [fetchMyTeam, fetchGameState]);

    // Redirect to game when game is actually playing and photo is approved
    useEffect(() => {
        if (myTeam?.image_approved && gameState?.status === "playing") {
            router.push("/game");
        }
    }, [myTeam, gameState, router]);

    useEffect(() => {
        return () => { stopCameraStream(); };
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
                    const file = new File([blob], "team-photo.jpg", { type: "image/jpeg" });
                    setSelectedFile(file);
                    setPreviewUrl(URL.createObjectURL(file));
                    stopCameraStream();
                }
            }, "image/jpeg", 0.8);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            stopCameraStream();
        }
    };

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
                setMessage("✅ Photo uploaded! Waiting for AdminX approval...");
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

    // Team has image already and it's approved
    const imageApproved = myTeam?.image_approved;
    // Team already has image but not yet approved → waiting state
    const waitingForApproval = myTeam?.image_url && !myTeam?.image_approved;
    // Team image approved — show waiting for game start
    const hasExistingApprovedImage = myTeam?.image_url && myTeam?.image_approved;
    // Is the game actually playing?
    const gameIsPlaying = gameState?.status === "playing";

    return (
        <div className="min-h-screen">
            <Navbar />
            <div className="pt-24 px-4 max-w-2xl mx-auto pb-12">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
                        📸 Team Photo
                    </h1>
                    <p className="text-gray-400">
                        Upload a team selfie for verification. AdminX will approve your photo.
                    </p>
                </div>

                {!myTeam ? (
                    <div className="glass-card p-12 text-center">
                        <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4 animate-pulse" />
                        <h2 className="text-xl font-bold text-white mb-2">No Team Found</h2>
                        <p className="text-gray-400">
                            Go back to the <a href="/lobby" className="text-orange-400 hover:underline">lobby</a>.
                        </p>
                    </div>
                ) : hasExistingApprovedImage || imageApproved ? (
                    /* Photo approved — waiting for game to start */
                    <div className="glass-card-elevated p-12 text-center">
                        {gameIsPlaying ? (
                            <>
                                <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                                <h2 className="text-xl font-bold text-white mb-2">Photo Approved! ✅</h2>
                                <p className="text-gray-400 mb-4">Game is live — jump into the arena!</p>
                                <button onClick={() => router.push("/game")} className="btn-primary inline-flex items-center gap-2">
                                    Enter Game Arena <ArrowRight className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Clock className="w-8 h-8 text-yellow-400 animate-pulse" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Waiting for Game to Start</h2>
                                <p className="text-gray-400 mb-4">
                                    Your photo has been approved! The admin will start the game shortly.
                                </p>
                                {myTeam.image_url && (
                                    <img
                                        src={myTeam.image_url}
                                        alt="Team photo"
                                        className="max-h-48 mx-auto rounded-xl border border-white/10 mb-4"
                                    />
                                )}
                                <p className="text-xs text-gray-500 animate-pulse">
                                    This page will auto-redirect when the game starts...
                                </p>
                            </>
                        )}
                    </div>
                ) : waitingForApproval ? (
                    <div className="space-y-6">
                        <div className="glass-card-elevated p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">{myTeam.name}</h2>
                                    <p className="text-gray-500 text-sm font-mono">{myTeam.team_id}</p>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-12 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-8 h-8 text-yellow-400 animate-pulse" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Waiting for Approval</h2>
                            <p className="text-gray-400 mb-4">
                                Your team photo has been uploaded. AdminX will review and approve it.
                            </p>
                            {myTeam.image_url && (
                                <img
                                    src={myTeam.image_url}
                                    alt="Team photo"
                                    className="max-h-48 mx-auto rounded-xl border border-white/10 mb-4"
                                />
                            )}
                            <p className="text-xs text-gray-500 animate-pulse">
                                This page will auto-redirect when approved...
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Team Info */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card-elevated p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">{myTeam.name}</h2>
                                    <p className="text-gray-500 text-sm font-mono">{myTeam.team_id}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {myTeam.members.map((m, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/5">
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

                        {/* Upload/Camera */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card-elevated p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Camera className="w-5 h-5 text-orange-500" />
                                Take Team Photo
                            </h3>

                            {cameraActive ? (
                                <div className="mb-4 relative rounded-xl overflow-hidden border-2 border-orange-500/50 bg-black aspect-video">
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                    <button onClick={stopCameraStream} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70">
                                        <X className="w-5 h-5" />
                                    </button>
                                    <button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:scale-95 transition-all flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-white" />
                                    </button>
                                </div>
                            ) : (
                                <div className="mb-4">
                                    <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${previewUrl ? "border-orange-500/30 bg-orange-500/5" : "border-white/10"}`}>
                                        {previewUrl ? (
                                            <div>
                                                <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded-lg mb-4 object-contain" />
                                                <p className="text-green-400 font-medium text-sm mb-2">Photo ready to upload ✓</p>
                                                <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); startCamera(); }} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-white">
                                                    Retake Photo
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="p-4 rounded-xl bg-white/5 inline-block">
                                                    <ImageIcon className="w-10 h-10 text-gray-500 mx-auto" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button onClick={startCamera} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all text-orange-400">
                                                        <Camera className="w-6 h-6" />
                                                        <span className="text-sm font-bold">Open Camera</span>
                                                    </button>
                                                    <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white cursor-pointer">
                                                        <Upload className="w-6 h-6" />
                                                        <span className="text-sm font-bold">Upload File</span>
                                                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

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
                                        Upload Team Photo
                                    </>
                                )}
                            </button>

                            {message && (
                                <p className="mt-3 text-sm text-center text-white bg-white/5 rounded-lg p-2">{message}</p>
                            )}
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
