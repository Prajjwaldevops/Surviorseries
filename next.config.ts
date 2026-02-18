import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static optimization for pages that use auth
  // All pages use client-side rendering with "use client" directive
  reactStrictMode: true,
};

export default nextConfig;
