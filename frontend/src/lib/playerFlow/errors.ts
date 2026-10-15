import type { ErrorCode } from "@/types/game";

/** Message key for each error code, under the `player` namespace. The backend only sends the code. */
export const errorMessageKey: Record<ErrorCode, string> = {
  PIN_INVALID: "errors.PIN_INVALID",
  GAME_NOT_FOUND: "errors.GAME_NOT_FOUND",
  GAME_ENDED: "errors.GAME_ENDED",
  GAME_FULL: "errors.GAME_FULL",
  NICKNAME_INVALID: "errors.NICKNAME_INVALID",
  NICKNAME_TAKEN: "errors.NICKNAME_TAKEN",
  RATE_LIMITED: "errors.RATE_LIMITED",
  NETWORK: "errors.NETWORK",
  UNKNOWN: "errors.UNKNOWN",
  KICKED: "errors.KICKED",
  GAME_CLOSED: "errors.GAME_CLOSED",
  REPLACED: "errors.REPLACED",
  DISCONNECTED: "errors.DISCONNECTED",
};

/** Any code the server may send, as one the player screens can show. */
export function toPlayerError(code: string): ErrorCode {
  return code in errorMessageKey ? (code as ErrorCode) : "UNKNOWN";
}
