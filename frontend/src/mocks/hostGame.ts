import { COLORS, FACES, SHAPES, type Character } from "@/components/game/avatar/characters";
import type { Player } from "@/types/game";

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
