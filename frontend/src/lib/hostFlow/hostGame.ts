/** The game this tab is hosting for a quiz, kept so that a refresh comes back to it. */
export type HostGame = { gameId: string; pin: string };

const key = (quizId: string) => `aary.hostGame.${quizId}`;

export function readHostGame(quizId: string): HostGame | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key(quizId)) ?? "null");
    if (typeof value === "object" && value !== null && "gameId" in value && "pin" in value) {
      const { gameId, pin } = value;
      if (typeof gameId === "string" && typeof pin === "string") return { gameId, pin };
    }
  } catch {
    // Storage can be blocked or hold something else: there is no game to come back to.
  }
  return null;
}

export function writeHostGame(quizId: string, game: HostGame | null) {
  try {
    if (game) window.sessionStorage.setItem(key(quizId), JSON.stringify(game));
    else window.sessionStorage.removeItem(key(quizId));
  } catch {
    // The game still works, it just does not survive a refresh.
  }
}
