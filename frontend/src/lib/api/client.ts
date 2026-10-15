/** Same origin: Next rewrites /api/* to the FastAPI server (see next.config.ts). */
const BASE = "/api";

/** A failed call. The backend sends a stable `code` (never text); the frontend translates it. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly field: string | null,
  ) {
    super(code);
    this.name = "ApiRequestError";
  }
}

type RequestOptions = { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown };

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
    const error = data as { code?: unknown; field?: unknown } | null;
    throw new ApiRequestError(
      response.status,
      typeof error?.code === "string" ? error.code : "UNKNOWN",
      typeof error?.field === "string" ? error.field : null,
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
  "VALIDATION_ERROR",
] as const;
export type KnownApiCode = (typeof KNOWN_CODES)[number];

export function toKnownCode(error: unknown): KnownApiCode {
  const code = error instanceof ApiRequestError ? error.code : "UNKNOWN";
  return (KNOWN_CODES as readonly string[]).includes(code) ? (code as KnownApiCode) : "UNKNOWN";
}
