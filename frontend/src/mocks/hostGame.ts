import { COLORS, FACES, SHAPES, type Character } from "@/components/game/avatar/characters";
import type { AnswerPosition } from "@/components/game/AnswerTile";
import type { Player, Standing } from "@/types/game";

export const MOCK_GAME_PIN = "123456";

const NAMES = [
  "Айгерим",
  "Бекзат",
  "Нурбек",
  "Мээрим",
  "Эрлан",
  "Жылдыз",
  "Данияр",
  "Чынара",
  "Темирлан",
  "Айдай",
  "Бекмырза",
  "Элмира",
  "Улан",
  "Сезим",
  "Нургүл",
  "Руслан",
  "Айжан",
  "Адилет",
] as const;

/** A fixed spread over shapes, colors and faces, so every run looks the same. */
function characterFor(index: number): Character {
  return {
    shape: SHAPES[index % SHAPES.length] as Character["shape"],
    color: COLORS[(index * 3) % COLORS.length] as Character["color"],
    face: FACES[(index * 5) % FACES.length] as Character["face"],
  };
}

/** The 18 players of the mock game, in the order they join. */
export const mockJoiners: readonly Player[] = NAMES.map((nickname, index) => ({
  id: `joiner-${index + 1}`,
  nickname,
  score: 0,
  character: characterFor(index),
}));

/** How many of `total` players have answered after `elapsed` of `seconds`: many early, fewer late, 90% in the end. */
export function answeredAt(total: number, elapsed: number, seconds: number): number {
  const progress = Math.min(1, Math.max(0, elapsed / seconds));
  return Math.min(total, Math.round(total * 0.9 * (1 - (1 - progress) ** 2)));
}

/** How the answers split once the question closed: about 55% right, the rest over the other three. */
export function distributeCounts(answered: number, correct: AnswerPosition): [number, number, number, number] {
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  const right = Math.round(answered * 0.55);
  const others = [0.5, 0.3, 0.2];
  let left = answered - right;
  counts[correct - 1] = right;
  const wrongPositions = ([1, 2, 3, 4] as const).filter((position) => position !== correct);
  wrongPositions.forEach((position, index) => {
    const share = index === wrongPositions.length - 1 ? left : Math.round((answered - right) * (others[index] ?? 0));
    counts[position - 1] = Math.min(left, share);
    left -= counts[position - 1] ?? 0;
  });
  return counts;
}

/** Scores after `round` questions: each player is right in about 6 of 10 and faster or slower by a fixed pattern. */
export function standingsAfter(round: number, players: readonly Player[]): Standing[] {
  const rows = players.map((player, index) => {
    let score = 0;
    for (let r = 1; r <= round; r += 1) {
      const right = (index * 7 + r * 3) % 10 < 6;
      if (right) score += 500 + ((index * 13 + r * 17) % 20) * 25;
    }
    return { ...player, score, isYou: false };
  });
  rows.sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
