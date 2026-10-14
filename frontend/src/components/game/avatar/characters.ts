// A player's character is three ids from fixed lists. Nothing else is stored or accepted.

export const SHAPES = ["triangle", "diamond", "circle", "square", "hexagon", "star", "heart", "pill"] as const;
export const COLORS = ["red", "blue", "yellow", "green", "orange", "purple", "pink", "teal"] as const;
export const FACES = [
  "smile",
  "grin",
  "wink",
  "surprised",
  "glasses",
  "sleepy",
  "cool",
  "happy",
  "tongue",
  "angry",
  "stars",
  "shy",
] as const;

export type Shape = (typeof SHAPES)[number];
export type Color = (typeof COLORS)[number];
export type Face = (typeof FACES)[number];

export type Character = {
  shape: Shape;
  color: Color;
  face: Face;
};

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))] as T;
}

/** A random character. Call it from an event handler, not while rendering. */
export function randomCharacter(random: () => number = Math.random): Character {
  return {
    shape: pick(SHAPES, random),
    color: pick(COLORS, random),
    face: pick(FACES, random),
  };
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** The check the server runs on whatever a client sends. */
export function isCharacter(value: unknown): value is Character {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    includes(SHAPES, candidate.shape) && includes(COLORS, candidate.color) && includes(FACES, candidate.face)
  );
}
