"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Trophy,
  Zap,
  BarChart3,
  ChevronRight,
  Eye,
  Camera,
  Shuffle,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-600/3 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-orange-700/5 rounded-full blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-8"
        >
          <Zap className="w-4 h-4" />
          Real-Time Competitive Scoring
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="glow-text mb-6"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="block text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-orange-500 tracking-tight leading-none">
            SURVIVOR
          </span>
          <span className="block text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-white tracking-tight leading-none mt-2">
            SERIES
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Join the arena. Form teams. Compete in real-time.
          <br />
          <span className="text-orange-400/80">
            Only the strongest survive.
          </span>
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            href="/sign-in"
            className="btn-primary flex items-center gap-2 text-lg px-8 py-4"
          >
            Get Started
            <ChevronRight className="w-5 h-5" />
          </Link>
          <Link
            href="/standings"
            className="flex items-center gap-2 text-lg px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all font-medium"
          >
            <Eye className="w-5 h-5 text-orange-400" />
            View Standings
          </Link>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-5 h-8 rounded-full border-2 border-white/20 flex items-start justify-center pt-1.5"
          >
            <div className="w-1 h-2 rounded-full bg-white/40" />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2
              className="text-3xl sm:text-4xl font-bold text-white mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              How It Works
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              4 rounds of intense competition — from lobby to champion.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Users,
                title: "Join Lobby",
                desc: "Sign in and enter the waiting room. Up to 40 players.",
                step: "01",
              },
              {
                icon: Shuffle,
                title: "Team Formation",
                desc: "Admin forms & shuffles teams. See your team in real-time.",
                step: "02",
              },
              {
                icon: Camera,
                title: "Team Photo",
                desc: "Upload a team selfie. AdminX approves before you play.",
                step: "03",
              },
              {
                icon: Trophy,
                title: "4 Rounds",
                desc: "Compete across 4 rounds with live scoring and elimination.",
                step: "04",
              },
            ].map((feature, idx) => (
              <motion.div
                key={feature.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="glass-card p-6 hover:border-orange-500/20 transition-all group"
              >
                <div className="text-orange-500/30 text-sm font-bold mb-4">
                  STEP {feature.step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Public Standings Banner */}
      <section className="relative z-10 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card-elevated p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-700/20 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-7 h-7 text-orange-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Live Standings
            </h3>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Watch the action unfold without logging in. See standings, graphs, detailed points, team info, and round breakdowns — all in real-time.
            </p>
            <Link
              href="/standings"
              className="btn-primary inline-flex items-center gap-2 px-6 py-3"
            >
              <Eye className="w-5 h-5" />
              View Live Standings
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-gray-500 text-sm">
        <p>
          <span className="text-orange-500 font-semibold">SURVIVOR SERIES</span>{" "}
          — Built for competition
        </p>
      </footer>
    </div>
  );
}
