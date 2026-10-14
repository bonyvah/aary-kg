import type { StaffErrorCode } from "@/types/staff";

/** The password that fails in the mock, so the error state can be seen. */
export const MOCK_WRONG_PASSWORD = "wrong";

/**
 * Stands in for POST /auth/login until Phase 5. No session, no token: it only answers with
 * what the backend will answer, an error code or nothing.
 */
export function mockLogin(login: string, password: string): StaffErrorCode | null {
  if (login.trim() === "" || password === "") return "CREDENTIALS_REQUIRED";
  if (password === MOCK_WRONG_PASSWORD) return "INVALID_CREDENTIALS";
  return null;
}
