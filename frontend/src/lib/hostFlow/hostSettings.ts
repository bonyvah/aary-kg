import type { GameSettings, HostMessage } from "@/lib/game/events";

/** The host's lobby checkboxes, kept in this browser so that the next games start the same way. */
export type SavedHostSettings = Partial<GameSettings>;

const KEY = "aary.hostSettings";

export function parseHostSettings(raw: string | null): SavedHostSettings | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { showAnswers, scoring } = value as Record<string, unknown>;
    return {
      ...(typeof showAnswers === "boolean" ? { showAnswers } : {}),
      ...(scoring === "speed" || scoring === "flat" ? { scoring } : {}),
    };
  } catch {
    return null;
  }
}

export function readHostSettings(): SavedHostSettings | null {
  try {
    return parseHostSettings(window.localStorage.getItem(KEY));
  } catch {
    return null; // Storage blocked: the lobby keeps what the server has.
  }
}

export function saveHostSettings(change: SavedHostSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readHostSettings(), ...change }));
  } catch {
    // Storage blocked: the choice still works for this game.
  }
}

/** What to tell the server so a lobby matches the saved checkboxes. `null`: it already does. */
export function settingsToApply(saved: SavedHostSettings | null, server: GameSettings): Extract<HostMessage, { type: "settings" }> | null {
  const showAnswers = saved?.showAnswers;
  const scoring = saved?.scoring;
  const changeAnswers = showAnswers !== undefined && showAnswers !== server.showAnswers;
  const changeScoring = scoring !== undefined && scoring !== server.scoring;
  if (!changeAnswers && !changeScoring) return null;
  return { type: "settings", ...(changeAnswers ? { showAnswers } : {}), ...(changeScoring ? { scoring } : {}) };
}
