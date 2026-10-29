import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const API_URL = process.env.API_URL ?? "http://localhost:8000";

const isProduction = process.env.NODE_ENV === "production";

// Quiz and question images are read straight from the image bucket's public URL (Cloudflare R2;
// MinIO from docker compose in development). Fixed when the app is built.
const IMAGES_URL = (process.env.NEXT_PUBLIC_IMAGES_URL ?? (isProduction ? "" : "http://localhost:9000/aary-images")).replace(/\/$/, "");

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

// What a page may load and where it may connect. Next.js puts small inline scripts in every page,
// so scripts need 'unsafe-inline' (a nonce per request would make every page dynamic). Everything
// else stays on this origin. `ws:`/`wss:` is for the game socket (some browsers don't match
// 'self' for WebSockets). The dev server also needs 'unsafe-eval' for hot reload.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${IMAGES_URL ? ` ${originOf(IMAGES_URL)}` : ""}`,
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The host screen goes fullscreen; nothing here needs the camera, microphone or location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), fullscreen=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // The container image runs a self-contained server (`node server.js`). Only the image build
  // sets this: `next start` does not work with a standalone output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  env: { NEXT_PUBLIC_IMAGES_URL: IMAGES_URL },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // One origin for the browser: the session cookie never crosses sites, so no CORS.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
