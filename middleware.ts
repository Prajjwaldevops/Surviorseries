import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes that require Clerk authentication (or test user cookie)
const isProtectedRoute = createRouteMatcher([
    "/dashboard(.*)",
    "/lobby(.*)",
    "/standings(.*)",
    "/team-approval(.*)",
]);

// Admin route that requires admin cookie
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminLoginRoute = createRouteMatcher(["/admin-login(.*)"]);
const isTestLoginRoute = createRouteMatcher(["/test-login(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    // Skip admin-login and test-login pages (public)
    if (isAdminLoginRoute(req) || isTestLoginRoute(req)) {
        return NextResponse.next();
    }

    // Admin routes → check admin cookie
    if (isAdminRoute(req)) {
        const adminCookie = req.cookies.get("survivor_admin_session");
        if (!adminCookie || adminCookie.value !== "authenticated") {
            return NextResponse.redirect(new URL("/admin-login", req.url));
        }
        return NextResponse.next();
    }

    // Protected user routes → check test user cookie FIRST, then Clerk
    if (isProtectedRoute(req)) {
        const testCookie = req.cookies.get("survivor_test_user");
        if (testCookie && testCookie.value === "authenticated") {
            // Test user bypasses Clerk auth
            return NextResponse.next();
        }

        // Regular Clerk auth
        await auth.protect();
    }
});

export const config = {
    matcher: [
        // Skip static files and Next.js internals
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
