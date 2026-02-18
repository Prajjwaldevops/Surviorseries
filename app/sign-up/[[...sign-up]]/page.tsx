"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            {/* Decorative background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
                <h1
                    className="text-3xl font-bold text-center mb-8"
                    style={{ fontFamily: "var(--font-display)" }}
                >
                    <span className="text-orange-500">SURVIVOR</span>{" "}
                    <span className="text-white">SERIES</span>
                </h1>
                <SignUp
                    routing="path"
                    path="/sign-up"
                    afterSignUpUrl="/lobby"
                    signInUrl="/sign-in"
                />
            </div>
        </div>
    );
}
