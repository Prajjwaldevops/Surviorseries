import { NextRequest, NextResponse } from "next/server";
import { TEST_EMAIL, TEST_PASSWORD, TEST_USER_COOKIE } from "@/lib/constants";

/**
 * POST /api/auth/test-login
 * Test user bypass login — sets a cookie so middleware lets them through.
 * Body: { email, password }
 */
export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (email === TEST_EMAIL && password === TEST_PASSWORD) {
            const response = NextResponse.json({
                success: true,
                user: {
                    id: "test-user-bypass",
                    name: "Test Player",
                    email: TEST_EMAIL,
                },
            });

            // Set test user session cookie
            response.cookies.set(TEST_USER_COOKIE, "authenticated", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 8, // 8 hours
                path: "/",
            });

            return response;
        }

        return NextResponse.json(
            { error: "Invalid test credentials" },
            { status: 401 }
        );
    } catch {
        return NextResponse.json(
            { error: "Invalid request" },
            { status: 400 }
        );
    }
}
