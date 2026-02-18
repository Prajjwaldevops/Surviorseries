"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            {/* Decorative background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
                <h1
                    className="text-3xl font-bold text-center mb-8"
                    style={{ fontFamily: "var(--font-display)" }}
                >
                    <span className="text-orange-500">SURVIVOR</span>{" "}
                    <span className="text-white">SERIES</span>
                </h1>
                <SignIn
                    routing="path"
                    path="/sign-in"
                    afterSignInUrl="/lobby"
                    signUpUrl="/sign-up"
                    appearance={{
                        baseTheme: undefined,
                        variables: {
                            colorPrimary: "#f97316",
                            colorBackground: "#ffffff",
                            colorText: "#1a1a1a",
                            colorInputBackground: "#f9fafb",
                            colorInputText: "#1a1a1a",
                            borderRadius: "0.75rem",
                        },
                        elements: {
                            card: "shadow-xl border border-gray-200",
                            formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
                            socialButtonsBlockButton:
                                "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
                            socialButtonsBlockButtonText: "text-gray-700 font-medium",
                            formFieldInput:
                                "bg-gray-50 border-gray-300 text-gray-900",
                            footerActionLink: "text-orange-500 hover:text-orange-600",
                        },
                    }}
                />
            </div>
        </div>
    );
}
