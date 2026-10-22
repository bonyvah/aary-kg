/** Same origin: Next rewrites /api/* to the FastAPI server (see next.config.ts). */
const BASE = "/api";

/** A failed call. The backend sends a stable `code` (never text); the frontend translates it. */
export type ApiIssue = { code: string; field: string };

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly field: string | null,
    /** A failed save lists everything that is wrong. */
    readonly issues: readonly ApiIssue[] = [],
  ) {
    super(code);
    this.name = "ApiRequestError";
  }
}

type RequestOptions = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown };

export async function apiFetch<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK", null);
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data as { code?: unknown; field?: unknown; issues?: unknown } | null;
    throw new ApiRequestError(
      response.status,
      typeof error?.code === "string" ? error.code : "UNKNOWN",
      typeof error?.field === "string" ? error.field : null,
      Array.isArray(error?.issues) ? (error.issues as ApiIssue[]) : [],
    );
  }
  return data as T;
}

/** Codes that have a translation under `common.apiError`. Anything else shows UNKNOWN. */
const KNOWN_CODES = [
  "NETWORK",
  "UNKNOWN",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "USER_NOT_FOUND",
  "CANNOT_DISABLE_SELF",
  "CANNOT_MANAGE_ADMIN",
  "GROUP_NOT_FOUND",
  "GROUP_NOT_EMPTY",
  "GROUP_NAME_TAKEN",
  "GAME_NOT_FOUND",
  "GAME_NOT_FINISHED",
  "PLAYER_NOT_FOUND",
  "ANSWER_NOT_FOUND",
  "FLAG_NOT_FOUND",
  "NICKNAME_TAKEN",
  "SCORE_NEGATIVE",
  "ANSWER_INCONSISTENT",
  "NOTHING_TO_CHANGE",
  "VALIDATION_ERROR",
  "QUIZ_NOT_FOUND",
  "CONTEST_NOT_FOUND",
  "QUIZ_INVALID",
  "CONTEST_INVALID",
  "CONTEST_NOT_DRAFT",
  "CONTEST_NOT_OPEN",
  "CONTEST_NOT_CLOSED",
  "SCORING_INCOMPLETE",
  "ENTRY_NOT_FOUND",
  "CRITERION_NOT_FOUND",
  "NO_PLAYERS",
  "CHEATERS_UNRESOLVED",
  "INVALID_STATE",
  "BAD_MESSAGE",
  "BUSY",
  "RATE_LIMITED",
] as const;
export type KnownApiCode = (typeof KNOWN_CODES)[number];

export function knownCode(code: string): KnownApiCode {
  return (KNOWN_CODES as readonly string[]).includes(code) ? (code as KnownApiCode) : "UNKNOWN";
}

export function toKnownCode(error: unknown): KnownApiCode {
  return knownCode(error instanceof ApiRequestError ? error.code : "UNKNOWN");
}
