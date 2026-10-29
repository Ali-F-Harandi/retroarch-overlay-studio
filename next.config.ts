import type { NextConfig } from "next";

// GitHub Pages static export is enabled by setting NEXT_STATIC_EXPORT=1 (used in CI).
// NEXT_PUBLIC_BASE_PATH must be set to the repo name (e.g. /retroarch-overlay-studio).
const isExport = process.env.NEXT_STATIC_EXPORT === "1";
const basePath = isExport ? process.env.NEXT_PUBLIC_BASE_PATH || "" : "";

const nextConfig: NextConfig = {
  ...(isExport
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: basePath,
        trailingSlash: true,
      }
    : {}),
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  // allow building into a separate dir for local static-export verification
  distDir: process.env.NEXT_BUILD_DISTDIR || ".next",
};

export default nextConfig;
