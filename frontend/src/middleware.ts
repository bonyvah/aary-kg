import { NextResponse, type NextRequest } from "next/server";

// Only set where the web app runs on another host than the backend (Vercel). The backend then counts
// /api requests by the visitor address sent here, instead of the proxy's own (see backend netutil.py).
const PROXY_SECRET = process.env.AARY_PROXY_SECRET;

/** Visitor address as the host saw it. Vercel sets both headers itself, a browser can't choose them. */
function visitor(request: NextRequest): string | null {
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  // Never pass on what a browser sent under these names.
  headers.delete("x-aary-proxy");
  headers.delete("x-aary-client-ip");
  const address = visitor(request);
  if (PROXY_SECRET && address) {
    headers.set("x-aary-proxy", PROXY_SECRET);
    headers.set("x-aary-client-ip", address);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: "/api/:path*" };
