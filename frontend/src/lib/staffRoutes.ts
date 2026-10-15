import type { UserRole } from "@/types/user";

/** Where each role lands after signing in. */
export function homePath(role: UserRole): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * Where a signed-in user must go instead of this page, or null when they may stay.
 * Admins manage the platform: no quiz editor, no hosting, no new contests. Users have no admin area.
 * The server enforces the same; this only keeps people off screens that would show an error.
 */
export function redirectFor(role: UserRole, pathname: string): string | null {
  if (role === "admin") {
    const blocked = under(pathname, "/dashboard") || under(pathname, "/quizzes") || under(pathname, "/host") || pathname === "/contests/new";
    return blocked ? "/admin" : null;
  }
  return under(pathname, "/admin") ? "/dashboard" : null;
}
