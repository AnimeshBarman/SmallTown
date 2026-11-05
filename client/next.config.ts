import type { NextConfig } from "next";

const API_VERSION_PATH = "/api/v1";
const configuredApiOrigin = (
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || ""
).replace(/\/+$/, "");
const apiOrigin = configuredApiOrigin.endsWith(API_VERSION_PATH)
  ? configuredApiOrigin.slice(0, -API_VERSION_PATH.length)
  : configuredApiOrigin;

function configuredOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const supabaseOrigin = configuredOrigin(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
);
const imageSources = [
  "'self'",
  "data:",
  "blob:",
  ...(supabaseOrigin ? [supabaseOrigin] : ["https://*.supabase.co"]),
  "https://*.tile.openstreetmap.org",
  "https://tile.openstreetmap.org",
  "https://unpkg.com",
  "https://*.googleusercontent.com",
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://accounts.google.com https://www.gstatic.com",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  `img-src ${imageSources}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com",
  "frame-src https://accounts.google.com",
  "worker-src 'self' blob:",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.8"],
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return apiOrigin
      ? [{
          source: `${API_VERSION_PATH}/:path*`,
          destination: `${apiOrigin}${API_VERSION_PATH}/:path*`,
        }]
      : [];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      ],
    }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
