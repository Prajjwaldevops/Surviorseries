import { NextRequest, NextResponse } from "next/server";
import { ADMINX_USERNAME, ADMINX_PASSWORD } from "@/lib/constants";

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        if (username === ADMINX_USERNAME && password === ADMINX_PASSWORD) {
            const response = NextResponse.json({ success: true });
            response.cookies.set("survivor_adminx_session", "authenticated", {
                path: "/",
                httpOnly: false,
                maxAge: 60 * 60 * 24, // 24 hours
                sameSite: "lax",
            });
            return response;
        }

        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    } catch {
        return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }
}
