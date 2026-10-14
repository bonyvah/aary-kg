import type { ErrorCode } from "@/types/game";

/** Message key for each error code, under the `player` namespace. The backend only sends the code. */
export const errorMessageKey: Record<ErrorCode, string> = {
  PIN_INVALID: "errors.PIN_INVALID",
  GAME_NOT_FOUND: "errors.GAME_NOT_FOUND",
  NICKNAME_INVALID: "errors.NICKNAME_INVALID",
  NICKNAME_TAKEN: "errors.NICKNAME_TAKEN",
};
